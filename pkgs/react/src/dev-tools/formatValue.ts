/** Capture a readable snapshot without requiring every inspected value to be JSON. */
export const formatValue = (value: unknown): string => {
  const seen = new WeakSet<object>();
  try {
    const text =
      JSON.stringify(
        value,
        (_key, item: unknown) => {
          if (typeof item === 'bigint') return `${item}n`;
          if (typeof item === 'function') return '[Function]';
          if (typeof item === 'symbol') return String(item);
          if (item instanceof Error) return { name: item.name, message: item.message };
          if (item !== null && typeof item === 'object') {
            if (seen.has(item)) return '[Circular or repeated reference]';
            seen.add(item);
          }
          return item;
        },
        2
      ) ?? String(value);
    return text.length > 20_000 ? `${text.slice(0, 20_000)}\n… (truncated)` : text;
  } catch {
    return '[Unable to serialize value]';
  }
};
