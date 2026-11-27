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
  return {
    get modelId() {
      return modelId;
    },
    get busy() {
      return switching;
    },
    start: () => (switching ? Promise.resolve() : owner.start()),
    stop: () => owner.stop(),
    select: async (id: ModelId) => {
      if (switching || id === modelId) return false;
      switching = true;
      try {
        await owner.dispose();
        owner = create(id);
        modelId = id;
        return true;
      } finally {
        switching = false;
      }
    },
    dispose: () => owner.dispose(),
  };
};
