import {
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  galleryDataHandling,
  galleryDemoSections,
  type GalleryDemoSection,
  requiresGalleryCapability,
  type galleryDemoDetails,
} from './galleryDemoDetails';
import { GalleryModelContext, type GalleryModelConnect } from './galleryModel';
import { useGalleryInference } from './GalleryInferenceProvider';
import { connectWithKey } from './galleryInference';
import { GalleryFooter } from './GalleryFooter';
import { GalleryPrivacyBadge } from './GalleryPrivacyBadge';
import { GalleryDemoHeader } from './GalleryDemoHeader';
import { GalleryDemoFrame } from './GalleryDemoFrame';
import { galleryWelcomeDetails } from './galleryWelcomeDetails';
import { useGalleryMode } from './GalleryModeProvider';
import type { GalleryDeveloperPage, GalleryOperation } from './operationDetails';
import { useGalleryUsage, type GalleryAllowance } from './GalleryUsageProvider';
import type { GalleryAccount } from './GalleryAccountButton';
import { useGalleryEvents } from './galleryEvents';
import { GalleryRunLocally } from './GalleryRunLocally';
import { GalleryTermsContext } from './GalleryTermsContext';

const OperationSetup = lazy(async () => ({
  default: (await import('./GalleryOperations')).GalleryOperationSetup,
}));
const OperationGrid = lazy(async () => ({
  default: (await import('./GalleryOperations')).GalleryOperationGrid,
}));

const Welcome = lazy(async () => ({ default: (await import('./GalleryWelcome')).GalleryWelcome }));
const PublicSettings = lazy(async () => ({
  default: (await import('./GalleryPublicSettings')).GalleryPublicSettings,
}));

/**
 * Portable gallery presentation. Hosts own links, route metadata, and demo mounting;
 * importing this component cannot register another application's router or start a runtime.
 * A host that passes `connectModel` gives every `remoteModel` demo its model connection.
 */
export const Gallery = ({
  demos,
  activeDemo,
  activeSection,
  renderSectionLink,
  renderLink,
  children,
  input,
  connectModel,
  modelConnectionLabel,
  privacyUrl,
  termsUrl,
  cloudPrivacyDescription,
  developerPage,
  renderDeveloperLink,
  onConfigureOperation,
  settingsPage = false,
  onOpenSettings,
  account,
  sourceRevision,
}: {
  demos: readonly (typeof galleryDemoDetails)[number][];
  activeDemo?: (typeof galleryDemoDetails)[number];
  /** Show an overview of the host's selected demos in this section. */
  activeSection?: GalleryDemoSection;
  /** Hosts supply section routes; without this callback section labels remain plain text. */
  renderSectionLink?: (link: {
    section: GalleryDemoSection;
    children: ReactNode;
    current: boolean;
  }) => ReactNode;
  renderLink: (link: {
    demo?: (typeof galleryDemoDetails)[number];
    children: ReactNode;
    current: boolean;
  }) => ReactNode;
  children?: ReactNode;
  input?: ReactNode;
  connectModel?: GalleryModelConnect;
  /** Name a host-supplied connection without claiming a free allowance. */
  modelConnectionLabel?: string;
  /** Host privacy URL, opened separately to preserve this conversation. */
  privacyUrl?: string;
  /**
   * Host Terms URL for policy links and the primary-action consent notice. Opens separately
   * so reading it does not leave the demo; inherits GalleryTermsContext when omitted.
   */
  termsUrl?: string;
  /** Verified managed-service privacy wording. Never used for developer key connections. */
  cloudPrivacyDescription?: string;
  developerPage?: GalleryDeveloperPage;
  renderDeveloperLink?: (link: {
    page: GalleryDeveloperPage;
    children: ReactNode;
    current: boolean;
  }) => ReactNode;
  onConfigureOperation?: (operation?: GalleryOperation) => void;
  /** Account-focused settings page, available without developer access. */
  settingsPage?: boolean;
  /** Navigate to public Settings or developer Configure models for the current mode. */
  onOpenSettings?: () => void;
  /** The host supplies identity and real account destinations in either mode. */
  account?: GalleryAccount;
  /**
   * The Katakit commit this host's demos come from. Get the code copies that revision so a copy
   * matches the demo the visitor used; without one it copies the default branch.
   */
  sourceRevision?: string;
}) => {
  const navigationId = useId();
  // Disclosure state belongs to this mounted gallery, not a demo runtime or its event log.
  const [collapsedSections, setCollapsedSections] = useState<readonly GalleryDemoSection[]>([]);
  const inheritedTermsUrl = useContext(GalleryTermsContext);
  const effectiveTermsUrl = termsUrl ?? inheritedTermsUrl;
  const inference = useGalleryInference();
  const { isDeveloperView } = useGalleryMode();
  const usage = useGalleryUsage();
  const { setActiveDemo } = useGalleryEvents();
  const activeDemoId = activeDemo?.id;
  useEffect(() => {
    setActiveDemo(activeDemoId);
    return () => setActiveDemo(undefined);
  }, [setActiveDemo, activeDemoId]);
  const sourceSignal = inference?.owner.getSignal();
  const usesDeveloperKey = isDeveloperView && inference?.settings.source === 'key';
  const recordAllowance = usage?.reportAllowance;
  const reportTokenUsage = usage?.reportTokenUsage;
  const tokenUsage = usesDeveloperKey ? usage?.tokenUsage : undefined;
  const reportAllowance = useCallback(
    (value: GalleryAllowance) => {
      if (!usesDeveloperKey && connectModel && sourceSignal)
        recordAllowance?.(connectModel, sourceSignal, value);
    },
    [usesDeveloperKey, connectModel, sourceSignal, recordAllowance]
  );
  const currentReport =
    !usesDeveloperKey &&
    usage?.report &&
    usage.report.source === connectModel &&
    usage.report.signal === sourceSignal &&
    !sourceSignal?.aborted
      ? usage.report
      : undefined;
  const allowance = currentReport?.allowance;
  const usageUnavailableReason = usesDeveloperKey
    ? 'Your configured provider does not report a demo allowance.'
    : !connectModel
      ? 'Cloud processing isn’t available. On-device demos still work.'
      : currentReport && !allowance
        ? 'The service returned invalid allowance data.'
        : 'The service has not reported an allowance yet.';
  const connect = useMemo<GalleryModelConnect | undefined>(() => {
    if (!inference) return undefined;
    const sourceSignal = inference.owner.getSignal();
    if (isDeveloperView && inference.settings.source === 'key')
      return connectWithKey(inference.settings, sourceSignal, { onTokenUsage: reportTokenUsage });
    if (!connectModel) return undefined;
    return async input => {
      const signal = AbortSignal.any([input.signal, sourceSignal]);
      signal.throwIfAborted();
      const connection = await connectModel({ ...input, signal });
      signal.throwIfAborted();
      return {
        ...connection,
        requestCompletion: async request => {
          const combined = AbortSignal.any([signal, request.signal]);
          combined.throwIfAborted();
          const result = await connection.requestCompletion({ ...request, signal: combined });
          combined.throwIfAborted();
          return result;
        },
      };
    };
  }, [connectModel, inference, isDeveloperView, reportTokenUsage]);
  // Named only once browser settings have loaded, so it never appears and then vanishes.
  const settingsNotice =
    inference &&
    !connect &&
    activeDemo &&
    requiresGalleryCapability(activeDemo.requiredCapabilities, 'remoteModel')
      ? isDeveloperView
        ? 'No inference is configured.'
        : 'Free inference is not available here.'
      : undefined;
  const model = useMemo(
    () => ({
      connect,
      hostAvailable: !!connectModel,
      hostConnectionLabel: modelConnectionLabel,
      isDeveloperView,
      configure: isDeveloperView ? onConfigureOperation : undefined,
      openSettings: onOpenSettings ?? (isDeveloperView ? onConfigureOperation : undefined),
      settingsNotice,
      allowance,
      tokenUsage,
      usageUnavailableReason,
      reportAllowance,
      account,
    }),
    [
      connect,
      connectModel,
      modelConnectionLabel,
      isDeveloperView,
      onConfigureOperation,
      onOpenSettings,
      settingsNotice,
      allowance,
      tokenUsage,
      usageUnavailableReason,
      reportAllowance,
      account,
    ]
  );
  return (
    <GalleryTermsContext value={effectiveTermsUrl}>
      <GalleryModelContext value={model}>
        <div className="katakit-gallery">
          <aside className="gallery-sidebar">
            <nav className="gallery-nav" aria-label="React demos">
              {renderLink({
                children: 'Welcome',
                current: !activeDemo && !activeSection && !developerPage && !settingsPage,
              })}
              {galleryDemoSections.map(section => {
                const sectionDemos = demos.filter(demo => demo.section === section);
                if (!sectionDemos.length) return null;
                const expanded = !collapsedSections.includes(section);
                const childrenId = `${navigationId}-${section}`;
                const Chevron = expanded ? ChevronDown : ChevronRight;
                return (
                  <div
                    className="gallery-nav-section"
                    role="group"
                    aria-label={section}
                    key={section}
                  >
                    <div className="gallery-nav-label">
                      {renderSectionLink ? (
                        renderSectionLink({
                          section,
                          children: section,
                          current:
                            !developerPage &&
                            !settingsPage &&
                            !activeDemo &&
                            activeSection === section,
                        })
                      ) : (
                        <span>{section}</span>
                      )}
                      <button
                        className="gallery-nav-toggle"
                        type="button"
                        aria-label={`${expanded ? 'Hide' : 'Show'} ${section} demos`}
                        aria-expanded={expanded}
                        aria-controls={childrenId}
                        onClick={() =>
                          setCollapsedSections(current =>
                            expanded
                              ? [...current, section]
                              : current.filter(entry => entry !== section)
                          )
                        }
                      >
                        <Chevron size={16} aria-hidden="true" />
                      </button>
                    </div>
                    <div className="gallery-nav-children" id={childrenId} hidden={!expanded}>
                      {sectionDemos.map(demo => (
                        <span key={demo.id}>
                          {renderLink({
                            demo,
                            children: demo.title,
                            current: !developerPage && !settingsPage && activeDemo?.id === demo.id,
                          })}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </nav>
            <GalleryFooter>{input}</GalleryFooter>
          </aside>
          <div className="gallery-content">
            {settingsPage ? (
              <Suspense fallback={<p role="status">Loading Settings…</p>}>
                <PublicSettings privacyUrl={privacyUrl} termsUrl={effectiveTermsUrl} />
              </Suspense>
            ) : isDeveloperView && developerPage ? (
              <>
                <nav className="gallery-operation-tabs" aria-label="Operation views">
                  {(['setup', 'grid'] as const).map(page => (
                    <span key={page}>
                      {renderDeveloperLink?.({
                        page,
                        children: page === 'setup' ? 'Configuration' : 'Grid',
                        current: developerPage === page,
                      })}
                    </span>
                  ))}
                </nav>
                <Suspense fallback={<p role="status">Loading operations…</p>}>
                  {developerPage === 'setup' ? (
                    <OperationSetup />
                  ) : (
                    <OperationGrid demos={demos} renderLink={renderLink} />
                  )}
                </Suspense>
              </>
            ) : activeSection && !activeDemo ? (
              <GalleryDemoHeader
                demo={{
                  title: activeSection,
                  description: {
                    Basics: 'Explore the building blocks of voice-driven interfaces.',
                    Games: 'Play with speech, words, and ideas.',
                    Meetings: 'Turn conversations into useful notes and lists.',
                  }[activeSection],
                }}
              >
                <ul className="gallery-demo-list">
                  {demos
                    .filter(demo => demo.section === activeSection)
                    .map(demo => (
                      <li key={demo.id}>
                        {renderLink({ demo, children: demo.title, current: false })}
                        <p>{demo.description}</p>
                      </li>
                    ))}
                </ul>
              </GalleryDemoHeader>
            ) : (
              <GalleryDemoHeader
                demo={activeDemo ?? galleryWelcomeDetails}
                badge={
                  activeDemo && (
                    <>
                      <GalleryRunLocally demo={activeDemo} revision={sourceRevision} />
                      <GalleryPrivacyBadge
                        key={activeDemo.id}
                        dataHandling={galleryDataHandling(activeDemo.requiredCapabilities)}
                        privacyUrl={privacyUrl}
                        developerEndpoint={isDeveloperView && inference?.settings.source === 'key'}
                        cloudPrivacyDescription={
                          connectModel &&
                          (!isDeveloperView || inference?.settings.source === 'free')
                            ? cloudPrivacyDescription
                            : undefined
                        }
                      />
                    </>
                  )
                }
              >
                <GalleryDemoFrame demo={activeDemo ?? galleryWelcomeDetails}>
                  {activeDemo ? (
                    children
                  ) : (
                    <Welcome privacyUrl={privacyUrl} termsUrl={effectiveTermsUrl} />
                  )}
                </GalleryDemoFrame>
                {!activeDemo && children}
              </GalleryDemoHeader>
            )}
          </div>
        </div>
      </GalleryModelContext>
    </GalleryTermsContext>
  );
};
