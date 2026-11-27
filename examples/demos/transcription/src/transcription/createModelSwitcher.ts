import type { ModelId } from './models';

type Input = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  dispose: () => Promise<void>;
};

/** Serialize model disposal and creation; no two model owners overlap. */
export const createModelSwitcher = <T extends Input>(
  initial: ModelId,
  create: (id: ModelId) => T
) => {
  let modelId = initial;
  let owner = create(initial);
  let switching = false;
  let disposed = false;
  let ownerDisposed = false;
  let switchingPromise: Promise<boolean> | undefined;
  let disposal: Promise<void> | undefined;
  return {
    get modelId() {
      return modelId;
    },
    get busy() {
      return switching;
    },
    start: () => (switching || disposed ? Promise.resolve() : owner.start()),
    stop: () => (ownerDisposed ? Promise.resolve() : owner.stop()),
    select: (id: ModelId) => {
      if (disposed || switching || id === modelId) return Promise.resolve(false);
      switching = true;
      const operation = (async () => {
        try {
          await owner.dispose();
          ownerDisposed = true;
          if (disposed) return false;
          owner = create(id);
          ownerDisposed = false;
          modelId = id;
          return true;
        } finally {
          switching = false;
        }
      })();
      switchingPromise = operation;
      return operation;
    },
    dispose: () => {
      if (disposal) return disposal;
      disposed = true;
      disposal = (async () => {
        try {
          await switchingPromise;
        } finally {
          if (!ownerDisposed) {
            await owner.dispose();
            ownerDisposed = true;
          }
        }
      })();
      return disposal;
    },
  };
};
