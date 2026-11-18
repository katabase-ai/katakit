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

/** Latest allowance reported by a host; never predicted from local requests. */
export type GalleryAllowance = { remaining: number; total: number };

type Report = {
  source: GalleryModelConnect;
  signal: AbortSignal;
  allowance?: GalleryAllowance;
};
const Context = createContext<
  | {
      report?: Report;
      reportAllowance: (
        source: GalleryModelConnect,
        signal: AbortSignal,
        value: GalleryAllowance
      ) => void;
    }
  | undefined
>(undefined);

/** Host-session display state survives demo navigation and clears when its source is invalidated. */
export const GalleryUsageProvider = ({ children }: { children: ReactNode }) => {
  const [report, setReport] = useState<Report>();
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
  const value = useMemo(() => ({ report, reportAllowance }), [report, reportAllowance]);
  return <Context value={value}>{children}</Context>;
};

export const useGalleryUsage = () => useContext(Context);
