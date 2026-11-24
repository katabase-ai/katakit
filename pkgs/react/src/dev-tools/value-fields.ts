const accessor = Symbol('accessor');
const empty = Symbol('empty');
const unavailable = Symbol('unavailable');

// Only inspect own data descriptors. A delivery can contain accessors, cycles,
// revoked proxies, or typed arrays much larger than the inspector viewport.
export const fieldValue = (object: object, key: string): unknown => {
  try {
    const field = Object.getOwnPropertyDescriptor(object, key);
    if (!field) return empty;
    return 'value' in field ? field.value : accessor;
  } catch {
    return unavailable;
  }
};

const typedArrayLength = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  'length'
)!.get!;

// Avoid a payload's shadowed length getter, including for cross-realm views.
// null denotes a keyed object; undefined means reflection failed.
export const indexedLength = (object: object): number | null | undefined => {
  try {
    if (Array.isArray(object)) {
      const length: number = Object.getOwnPropertyDescriptor(object, 'length')!.value;
      return Number.isSafeInteger(length) && length >= 0 ? length : undefined;
    }
  } catch {
    return undefined;
  }
  if (ArrayBuffer.isView(object)) {
    try {
      return typedArrayLength.call(object);
    } catch {
      /* DataView has no indexed elements. */
    }
  }
  return null;
};

export const fieldIndex = (object: object, length: number | null) => {
  if (length !== null) return { length, keyAt: String, indexed: true };
  try {
    const keys = Object.keys(object);
    return { length: keys.length, keyAt: (i: number) => keys[i]!, indexed: false };
  } catch {
    return undefined;
  }
};

export const leafText = (value: unknown): string => {
  if (value === accessor || value === empty || value === unavailable)
    return `[${value.description}]`;
  if (typeof value === 'function') return '[function]';
  if (typeof value === 'string')
    return JSON.stringify(value.length > 160 ? `${value.slice(0, 160)}…` : value);
  return String(value);
};
