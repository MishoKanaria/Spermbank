import { gcm } from '@noble/ciphers/aes';
import { Keyring } from '@polkadot/keyring';
import { hexToU8a } from '@polkadot/util';
import { decodeAddress, mnemonicToMiniSecret, signatureVerify } from '@polkadot/util-crypto';
import { convertPublicKeyToX25519, convertSecretKeyToX25519, generateKeyPairFromSeed } from '@stablelib/ed25519';
import { getRandomBytes } from 'expo-crypto';
import nacl from 'tweetnacl';
import { decodeBase64, encodeBase64 } from 'tweetnacl-util';
import { useApi } from '../../app/contexts/ApiContext';
import { parseRemark } from '../utils/remarkUtils';

// Inject secure PRNG into tweetnacl
nacl.setPRNG((x: Uint8Array, n: number) => {
  const rnd = getRandomBytes(n);
  for (let i = 0; i < n; i++) x[i] = rnd[i];
});

export function aesGcmEncrypt(plainText: string, key: Uint8Array) {
  try {
    const iv = getRandomBytes(12);
    const encoded = new TextEncoder().encode(plainText);
    const aes = gcm(key, iv);
    const ciphertext = aes.encrypt(encoded);
    return { ciphertext, iv };
  } catch (err) {
    console.error('AES-GCM encryption failed:', err);
    throw err;
  }
}

export function encryptKFor(pubKey: Uint8Array, K: Uint8Array) {
  const ephemeral = nacl.box.keyPair();
  const nonce = getRandomBytes(nacl.box.nonceLength);
  const encryptedK = nacl.box(K, nonce, pubKey, ephemeral.secretKey);
  return {
    encryptedK,
    nonce,
    ephemeralPublicKey: ephemeral.publicKey,
  };
}

export function buildEncryptedReceiptObj(receipt: any, recipients: { address: string }[]) {
  const K = getRandomBytes(32);
  const { ciphertext, iv } = aesGcmEncrypt(JSON.stringify(receipt), K);
  const recipientsArr = recipients.map((recipient) => {
    const pubKey = decodeAddress(recipient.address);
    const curve25519PubKey = convertPublicKeyToX25519(pubKey);
    const enc = encryptKFor(curve25519PubKey, K);
    return {
      ephemeral_public_key: encodeBase64(enc.ephemeralPublicKey),
      encrypted_key: encodeBase64(enc.encryptedK),
      nonce: encodeBase64(enc.nonce)
    };
  });
  return {
    encrypted_receipt: encodeBase64(ciphertext),
    aes_iv: encodeBase64(iv),
    recipients: recipientsArr
  };
}

export function decryptEncryptedReceiptObj(
  encryptedObj: any,
  userAddress: string,
  userSecretKey: Uint8Array
) {
  // 1. Find the recipient entry for this user
  try {
    // Find the recipient whose ephemeral_public_key can be decrypted with our secret key
    let foundRecipient = null;
    let K: Uint8Array | null = null;
    
    for (const recipient of encryptedObj.recipients) {
      try {
        const ephemeralPublicKey = decodeBase64(recipient.ephemeral_public_key);
        const encryptedK = decodeBase64(recipient.encrypted_key);
        const nonce = decodeBase64(recipient.nonce);
        
        const maybeK = nacl.box.open(
          encryptedK,
          nonce,
          ephemeralPublicKey,
          userSecretKey
        );
        
        if (maybeK) {
          foundRecipient = recipient;
          K = maybeK;
          break;
        }
      } catch (e) {
        console.error('Error decrypting for recipient:', recipient.tag, e);
      }
    }
    
    if (!foundRecipient || !K) {
      console.error('No matching recipient found or failed to decrypt AES key');
      throw new Error('No matching recipient found or failed to decrypt AES key');
    }

    // 2. Decrypt the receipt
    const ciphertext = decodeBase64(encryptedObj.encrypted_receipt);
    const iv = decodeBase64(encryptedObj.aes_iv);
    const aes = gcm(K, iv);
    const decrypted = aes.decrypt(ciphertext);
    const decryptedStr = new TextDecoder().decode(decrypted);
    
    return decryptedStr;
  } catch (e) {
    console.error('Error in decryption:', e);
    throw e;
  }
}

/**
 * Tries to decrypt an encrypted receipt using a mnemonic and the user's Ed25519 address.
 * Returns the parsed receipt object if successful, or null if decryption fails.
 * @param encryptedObj The encrypted receipt object (parsed JSON)
 * @param mnemonic The user's mnemonic
 * @param userAddress The user's Ed25519 address (SS58)
 * @returns The decrypted receipt object (parsed JSON) or null
 */
export function decryptReceiptWithMnemonic(encryptedObj: any, mnemonic: string, userAddress: string): { receipt: any, isValid: boolean } | null {
  try {
    const miniSecret = mnemonicToMiniSecret(mnemonic);
    const edKeyPair = generateKeyPairFromSeed(miniSecret);
    const curve25519SecretKey = convertSecretKeyToX25519(edKeyPair.secretKey);
        
    const decrypted = decryptEncryptedReceiptObj(encryptedObj, userAddress, curve25519SecretKey);
    const receipt = JSON.parse(decrypted);
    
    // Verify signature if present
    let isValid = false;
    if (receipt.merchant?.signature && receipt.merchant?.address) {
      try {
        // Create a copy without signature for verification
        const receiptForVerification = JSON.parse(JSON.stringify(receipt));
        delete receiptForVerification.merchant.signature;

        // Get the merchant's public key from the keyring
        const keyring = new Keyring({ type: 'sr25519' });
        const storePair = keyring.addFromMnemonic(mnemonic);
        
        // Sign the receipt without signature
        const message = new TextEncoder().encode(JSON.stringify(receiptForVerification));
        
        // Convert hex signature to bytes
        const signatureHex = receipt.merchant.signature.startsWith('0x') 
          ? receipt.merchant.signature.slice(2) // Remove 0x prefix if present
          : receipt.merchant.signature;
        const signature = hexToU8a(signatureHex);
        
        const { isValid: sigValid } = signatureVerify(message, signature, storePair.publicKey);
        isValid = sigValid;
      } catch (error) {
        console.error('Error verifying signature:', error);
        isValid = false;
      }
    }
    
    return { receipt, isValid };
  } catch (e) {
    console.error('Decryption failed:', e);
    return null;
  }
}

export function useTransactionLookup() {
  const { api } = useApi();

  const lookupTransactionReceipt = async (txHash: string, mnemonic: string, userAddress: string) => {
    if (!api) {
      throw new Error('API not ready');
    }

    try {
      // Parse the transaction hash to get block hash and tx hash
      const parts = txHash.split(':');
      if (parts.length !== 4 || parts[0] !== 'block' || parts[2] !== 'tx') {
        throw new Error('Invalid transaction hash format. Expected format: block:blockHash:tx:transactionHash');
      }
      const blockHash = parts[1];
      const transactionHash = parts[3];

      // Get the block using block hash
      const block = await api.rpc.chain.getBlock(blockHash);
      if (!block) {
        throw new Error('Block not found');
      }

      // Find the specific transaction in the block
      const tx = block.block.extrinsics.find(ext => ext.hash.toString() === transactionHash);
      if (!tx) {
        throw new Error('Transaction not found in block');
      }

      // Check if it's a utility.batchAll transaction
      if (tx.method.section === 'utility' && tx.method.method === 'batchAll') {
        const calls = (tx.method.args[0] as any).toArray();

        for (const call of calls) {
          if (call.section === 'system' && call.method === 'remark') {
            const remarkHex = call.args[0].toHex ? call.args[0].toHex() : call.args[0].toString();
            let remark;
            try {
              remark = api.createType('Bytes', remarkHex).toUtf8();
            } catch {
              remark = remarkHex;
            }
            
            // Look for encrypted receipt in the remark
            if (remark && remark.includes('encrypted_receipt')) {
              let encryptedReceipt;
              try {
                const parsedRemark = parseRemark(remark);
                if (!(parsedRemark && typeof parsedRemark === 'object' && 'encrypted_receipt' in parsedRemark)) {
                  continue; // Try next remark if this one doesn't have encrypted_receipt
                }
                encryptedReceipt = parsedRemark;
              } catch (e) {
                // If not JSON, try to extract from string format
                const match = remark.match(/encrypted_receipt:(\{.*\})/);
                if (!match) {
                  continue; // Try next remark if this one doesn't match
                }
                try {
                  encryptedReceipt = JSON.parse(match[1]);
                } catch (e) {
                  console.error('Failed to parse extracted receipt:', e);
                  continue; // Try next remark if JSON parsing fails
                }
              }

              const decryptedReceipt = decryptReceiptWithMnemonic(encryptedReceipt, mnemonic, userAddress);
              if (decryptedReceipt) {
                return decryptedReceipt;
              } else {
                console.error('Failed to decrypt receipt');
              }
            } else {
            }
          }
        }
        throw new Error('No encrypted receipt found in batch transaction');
      } else {
        throw new Error('Transaction is not a utility.batchAll');
      }
    } catch (error) {
      console.error('Error looking up transaction receipt:', error);
      throw error;
    }
  };

  return { lookupTransactionReceipt };
}
