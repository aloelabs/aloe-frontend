export function filterNullishValues<T>(values: (T | null | undefined)[]): T[] {
  return values.filter((v) => v !== null && v !== undefined) as T[];
}
