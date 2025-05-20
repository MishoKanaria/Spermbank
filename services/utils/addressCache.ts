import { Keyring } from '@polkadot/keyring';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Caches sr25519 and ed25519 addresses for a given mnemonic/account.
 * @param mnemonic The mnemonic phrase
 * @param account The account identifier (e.g., wallet address)
 */
export async function cacheAddresses(mnemonic: string, account: string) {
  const srKeyring = new Keyring({ type: 'sr25519' });
  const edKeyring = new Keyring({ type: 'ed25519' });

  const srPair = srKeyring.addFromUri(mnemonic);
  const edPair = edKeyring.addFromUri(mnemonic);

  await AsyncStorage.setItem(`sr25519Address_${account}`, srPair.address);
  await AsyncStorage.setItem(`ed25519Address_${account}`, edPair.address);
}

/**
 * Gets a cached address (or derives and caches it if missing).
 * @param type 'sr25519' | 'ed25519'
 * @param account The account identifier (e.g., wallet address)
 * @param mnemonic Optional mnemonic to derive if not cached
 * @returns The address string or null
 */
export async function getCachedAddress(type: 'sr25519' | 'ed25519', account: string, mnemonic?: string): Promise<string | null> {
  const key = `${type}Address_${account}`;
  let address = await AsyncStorage.getItem(key);
  if (!address && mnemonic) {
    const keyring = new Keyring({ type });
    const pair = keyring.addFromUri(mnemonic);
    address = pair.address;
    await AsyncStorage.setItem(key, address);
  }
  return address;
} 