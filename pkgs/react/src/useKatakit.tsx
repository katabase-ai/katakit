import { AliveKatakit, Katakit } from '@katakit/core';
import { useEffect, useRef, useState } from 'react';

export const useKatakit = (katakit: Katakit, cleanup?: (katakit: AliveKatakit) => void) => {
  const [alive, setAlive] = useState<AliveKatakit | null>(null);

  const aliveRef = useRef<boolean>(false);

  useEffect(() => {
    if (aliveRef.current) return;

    const aliveKatakit = katakit.start();
    aliveRef.current = true;

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
