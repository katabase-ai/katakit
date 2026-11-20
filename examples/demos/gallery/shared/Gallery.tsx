import {
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import type { galleryDemoDetails } from './galleryDemoDetails';
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
import { useLocalInference } from '../../notes-react/src/inference/localInference';
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
  renderLink,
  children,
  input,
  connectModel,
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
  localInference = false,
}: {
  demos: readonly (typeof galleryDemoDetails)[number][];
  activeDemo?: (typeof galleryDemoDetails)[number];
  renderLink: (link: {
    demo?: (typeof galleryDemoDetails)[number];
    children: ReactNode;
    current: boolean;
  }) => ReactNode;
  children?: ReactNode;
  input?: ReactNode;
  connectModel?: GalleryModelConnect;
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
  /**
   * The host's Vite dev server runs the model connection plugin. Developer view then uses it in
   * place of the browser-direct key form, which remains for builds without a dev server.
   */
  localInference?: boolean;
}) => {
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
  // The content column is its own scroller, so a new page has to be returned to its top.
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    content.current?.scrollTo({ top: 0 });
  }, [activeDemoId, developerPage, settingsPage]);
  const sourceSignal = inference?.owner.getSignal();
  const usesLocalInference = isDeveloperView && localInference;
  const local = useLocalInference({ enabled: usesLocalInference });
  const usesDeveloperKey =
    usesLocalInference || (isDeveloperView && inference?.settings.source === 'key');
  const recordAllowance = usage?.reportAllowance;
  const reportTokenUsage = usage?.reportTokenUsage;
  // The dev server counts the tokens its provider reports; the browser-direct key counts its own.
  const localUsage = local.status?.connection && local.status.usage;
  const tokenUsage = usesLocalInference
    ? localUsage && {
        total: localUsage.inputTokens + localUsage.outputTokens,
        incomplete: false,
      }
    : usesDeveloperKey
      ? usage?.tokenUsage
      : undefined;
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
    if (usesLocalInference) return local.connect;
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
  }, [
    connectModel,
    inference,
    isDeveloperView,
    reportTokenUsage,
    usesLocalInference,
    local.connect,
  ]);
  // Named only once browser settings have loaded, so it never appears and then vanishes. The
  // dev-server connection sets itself up inside the demo, so it needs no notice here.
  const settingsNotice =
    !usesLocalInference &&
    inference &&
    !connect &&
    (activeDemo?.capabilities as readonly string[] | undefined)?.includes('remoteModel')
      ? `${isDeveloperView ? 'No inference is configured.' : 'Free inference is not available here.'} You can still transcribe locally.`
      : undefined;
  const model = useMemo(
    () => ({
      connect,
      hostAvailable: !!connectModel,
      isDeveloperView,
      configure: isDeveloperView ? onConfigureOperation : undefined,
      openSettings: onOpenSettings ?? (isDeveloperView ? onConfigureOperation : undefined),
      settingsNotice,
      allowance,
      tokenUsage,
      usageUnavailableReason,
      reportAllowance,
      account,
      localInference: usesLocalInference ? local : undefined,
    }),
    [
      local,
      usesLocalInference,
      connect,
      connectModel,
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
                current: !activeDemo && !developerPage && !settingsPage,
              })}
              {demos.map(demo => (
                <span key={demo.id}>
                  {renderLink({
                    demo,
                    children: demo.title,
                    current: !developerPage && !settingsPage && activeDemo?.id === demo.id,
                  })}
                </span>
              ))}
            </nav>
            <GalleryFooter>{input}</GalleryFooter>
          </aside>
          <div ref={content} className="gallery-content">
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
            ) : (
              <GalleryDemoHeader
                demo={activeDemo ?? galleryWelcomeDetails}
                badge={
                  activeDemo && (
                    <>
                      <GalleryRunLocally demo={activeDemo} revision={sourceRevision} />
                      <GalleryPrivacyBadge
                        key={activeDemo.id}
                        dataHandling={activeDemo.dataHandling}
                        privacyUrl={privacyUrl}
                        developerEndpoint={usesDeveloperKey}
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
