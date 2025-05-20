import * as SecureStore from 'expo-secure-store';

/**
 * Save a sensitive value securely.
 * @param key The key under which to store the value.
 * @param value The sensitive value to store.
 */
export async function saveSecureValue(key: string, value: string): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
    return true;
  } catch (e) {
    console.error('Error saving secure value:', e);
    return false;
  }
}

/**
 * Retrieve a sensitive value securely.
 * @param key The key under which the value is stored.
 */
export async function getSecureValue(key: string): Promise<string | null> {
  try {
    const value = await SecureStore.getItemAsync(key);
    return value;
  } catch (e) {
    console.error('Error retrieving secure value:', e);
    return null;
  }
}

/**
 * Delete a sensitive value securely.
 * @param key The key under which the value is stored.
 */
export async function deleteSecureValue(key: string): Promise<boolean> {
  try {
    await SecureStore.deleteItemAsync(key);
    return true;
  } catch (e) {
    console.error('Error deleting secure value:', e);
    return false;
  }
} 