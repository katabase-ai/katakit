import { installRecorder } from './dev-tools/deliveries';
import { makePanel } from './dev-tools/panel';

/**
 * Mount the browser's observable timeline before constructing any Katakit runtimes.
 * Each dot is a delivery to an existing subscriber. Returns the host's cleanup
 * function, which stops recording and removes the panel.
 */
export const openKatakitDevtools = (): (() => void) => {
  const panel = makePanel();
  try {
    const stop = installRecorder(panel.record);
    return () => {
      stop();
      panel.dispose();
    };
  } catch (error) {
    panel.dispose();
    throw error;
  }
};
