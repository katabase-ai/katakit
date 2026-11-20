import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { GalleryModelConnect } from './galleryModel';

/** Model calls remaining out of the host's allowed total; never predicted from local requests. */
export type GalleryAllowance = { remaining: number; total: number };

/** Provider-reported tokens across personal-key requests in this page session. */
export type GalleryTokenUsage = { total: number; incomplete: boolean };

type Report = {
  source: GalleryModelConnect;
  signal: AbortSignal;
  allowance?: GalleryAllowance;
};
const Context = createContext<
  | {
      report?: Report;
      tokenUsage: GalleryTokenUsage;
      reportTokenUsage: (tokens?: number) => void;
      reportAllowance: (
        source: GalleryModelConnect,
        signal: AbortSignal,
        value: GalleryAllowance
      ) => void;
    }
  | undefined
>(undefined);

/** Root-owned usage survives navigation. Only host allowance clears on source invalidation. */
export const GalleryUsageProvider = ({ children }: { children: ReactNode }) => {
  const [report, setReport] = useState<Report>();
  const [tokenUsage, setTokenUsage] = useState<GalleryTokenUsage>({ total: 0, incomplete: false });
  const reportTokenUsage = useCallback((tokens?: number) => {
    setTokenUsage(current => ({
      total: current.total + (tokens ?? 0),
      incomplete: current.incomplete || tokens === undefined,
    }));
  }, []);
  const reportAllowance = useCallback(
    (source: GalleryModelConnect, signal: AbortSignal, value: GalleryAllowance) => {
      if (signal.aborted) return;
      const valid =
        Number.isFinite(value?.remaining) &&
        Number.isFinite(value?.total) &&
        value.total > 0 &&
        value.remaining >= 0 &&
        value.remaining <= value.total;
      setReport({
        source,
        signal,
        allowance: valid ? { remaining: value.remaining, total: value.total } : undefined,
      });
    },
    []
  );
  useEffect(() => {
    if (!report) return;
    const clear = () =>
      setReport(current => (current?.signal === report.signal ? undefined : current));
    if (report.signal.aborted) {
      clear();
      return;
    }
    report.signal.addEventListener('abort', clear, { once: true });
    return () => report.signal.removeEventListener('abort', clear);
  }, [report?.signal]);
  const value = useMemo(
    () => ({ report, reportAllowance, tokenUsage, reportTokenUsage }),
    [report, reportAllowance, tokenUsage, reportTokenUsage]
  );
  return <Context value={value}>{children}</Context>;
};

export const useGalleryUsage = () => useContext(Context);
