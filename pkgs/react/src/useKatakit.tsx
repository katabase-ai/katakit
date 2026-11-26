import { AliveKatakit, Katakit } from '@katakit/core';
import { useEffect, useState } from 'react';

export const useKatakit = (katakit: Katakit, cleanup?: (katakit: AliveKatakit) => void) => {
  const [alive, setAlive] = useState<AliveKatakit | null>(null);

  useEffect(() => {
    const aliveKatakit = katakit.start();

    setAlive(aliveKatakit);

    return () => {
      cleanup?.(aliveKatakit);
    };
  }, [katakit]);

  return alive;
};

export const useKatakitInit = (
  katakitFn: () => Katakit,
  cleanup?: (katakit: AliveKatakit) => void
) => {
  const [katakit] = useState(katakitFn);
  return useKatakit(katakit, cleanup);
};
