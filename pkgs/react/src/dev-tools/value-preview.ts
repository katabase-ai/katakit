const maxFields = 6;
const maxDepth = 2;

// Build a detached JSON tree. In particular, never pass a payload's toJSON
// method, accessor, or coercion hook through to the serializer.
const preview = (value: unknown, depth: number): unknown => {
  if (typeof value === 'function') return '[function]';
  if (typeof value === 'string') return value.slice(0, 160);
  if (typeof value === 'bigint' || typeof value === 'symbol' || value === undefined)
    return String(value);
  if (value === null || typeof value !== 'object') return value;

  const field = (key: string) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) return '[empty]';
    return 'value' in descriptor ? preview(descriptor.value, depth + 1) : '[accessor]';
  };
  if (Array.isArray(value)) {
    const length = Object.getOwnPropertyDescriptor(value, 'length')!.value as number;
    if (depth === maxDepth) return `Array(${length})`;
    return Array.from({ length: Math.min(length, maxFields) }, (_, i) => field(String(i)));
  }
  if (depth === maxDepth) return '{…}';
  if (ArrayBuffer.isView(value)) {
    // Audio buffers can have millions of indexed properties. Probe only the preview window.
    const items: unknown[] = [];
    for (let i = 0; i < maxFields && Object.hasOwn(value, i); i++) items.push(field(String(i)));
    return items;
  }
  return Object.fromEntries(
    Object.keys(value)
      .slice(0, maxFields)
      .map(key => [key, field(key)])
  );
};

export const valueText = (value: unknown): string => {
  try {
    return JSON.stringify(preview(value, 0), null, 2);
  } catch {
    // Reflection itself may fail, e.g. on a revoked proxy.
    return '[unavailable]';
  }
};
