/**
 * Get a boolean value from local storage. If the value is not set, return false.
 * @param key The key to get the value for.
 * @returns The value from local storage, or false if the value is not set.
 */
export function getLocalStorageBoolean(key: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return !!window.localStorage.getItem(key);
  } catch (error) {
    console.error(error);
    return false;
  }
}

/**
 * Set a boolean value in local storage.
 * @param key The key to set the value for.
 * @param value The value to set.
 */
export function setLocalStorageBoolean(key: string, value: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(key, value.toString());
  } catch (error) {
    console.error(error);
  }
}
