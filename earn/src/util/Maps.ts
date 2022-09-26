export function deepCopyMap<K, V>(map: Map<K, V>): Map<K, V> {
  const newMap = new Map<K, V>();
  map.forEach((v, k) => newMap.set(k, v));
  return newMap;
}
