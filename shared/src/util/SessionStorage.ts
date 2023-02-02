/**
 * Get a string value from session storage. If the value is not set, return null.
 * @param key The key to get the value for.
 * @returns The value from session storage, or null if the value is not set.
 */
export function getSessionStorageString(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.sessionStorage.getItem(key);
  } catch (error) {
    console.error(error);
    return null;
  }
}

/**
 * Set a string value in session storage.
 * @param key The key to set the value for.
 * @param value The value to set.
 */
export function setSessionStorageString(key: string, value: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.setItem(key, value);
  } catch (error) {
    console.error(error);
  }
}

/**
 * Get an integer value from session storage. If the value is not set, return null.
 * @param key The key to get the value for.
 * @returns The value from session storage, or null if the value is not set.
 */
export function getSessionStorageInteger(key: string): number | null {
  const value = getSessionStorageString(key);
  if (value === null) {
    return null;
  }
  return parseInt(value, 10);
}

/**
 * Set an integer value in session storage.
 * @param key The key to set the value for.
 * @param value The value to set.
 */
export function setSessionStorageInteger(key: string, value: number): void {
  setSessionStorageString(key, value.toString());
}
