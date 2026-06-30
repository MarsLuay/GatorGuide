export type JsonArrayModule<T> = T[] | { default?: T[] };

export function unwrapJsonArrayModule<T>(moduleValue: JsonArrayModule<T>) {
  if (Array.isArray(moduleValue)) return moduleValue;
  if (Array.isArray(moduleValue?.default)) return moduleValue.default;
  return [];
}
