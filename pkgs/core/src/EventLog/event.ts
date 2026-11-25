export type KatakitEvent<T extends Record<any, any> = Record<any, any>> = T & {
  meta: {
    seq: number;
    timestamp: Date;
  };
};
