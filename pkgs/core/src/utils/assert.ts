// typescript can't use arrow functions for assertions
// oxlint-disable-next-line func-style
export function assert(value: any, message: string): asserts value {
  if (!value) {
    throw new Error(message);
  }
}
