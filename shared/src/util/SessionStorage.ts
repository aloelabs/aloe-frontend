/**
 * Get an integer value from session storage. If the value is not set, return null.
 * @param key The key to get the value for.
 * @returns The value from session storage, or null if the value is not set.
 */
export function getSessionStorageInteger(key: string): number | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const value = window.sessionStorage.getItem(key);
    return value ? parseInt(value) : null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

/**
 * Set an integer value in session storage.
 * @param key The key to set the value for.
 * @param value The value to set.
 */
export function setSessionStorageInteger(key: string, value: number): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.setItem(key, value.toString());
  } catch (error) {
    console.error(error);
  }
}
