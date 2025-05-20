import { Keyring } from '@polkadot/keyring';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { buildEncryptedReceiptObj } from '../../../services/encryption/cryptoUtils';
import { getSecureValue } from '../../../services/storage/secureStorage';
import { useApi } from '../../contexts/ApiContext';

interface ReturnReceipt {
  receipt_id: string;
  original_receipt_id: string;
  status: string;
  signatures: {
    issuer: string;
    returner: string;
  };
  merchant: {
    name: string;
    logoUrl?: string;
    businessId: string;
    address: string;
  };
  sender: {
    address: string;
  };
  items: Array<{
    id: string;
    name: string;
    price: number;
    qty: number;
    discount?: number;
    total?: number;
    returnable: boolean;
    returned_qty?: number;
  }>;
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  returns: {
    total_returns: number;
    returned_amount: number;
  };
  metadata: {
    chain: string;
    version: string;
    network: string;
  };
}

export default function ProcessReturn() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const signedReceipt = params.signedReceipt as string;
  const qrDataStr = params.qrData as string;
  const { api, isApiReady } = useApi();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hexCallData, setHexCallData] = useState<string | null>(null);

  useEffect(() => {
    const processReceipt = async () => {
      try {
        if (!signedReceipt || !api || !isApiReady) {
          throw new Error('Missing required data');
        }

        const receipt: ReturnReceipt = JSON.parse(signedReceipt);
        const qrData = JSON.parse(qrDataStr);

        // Get current account info
        const currentAddress = await AsyncStorage.getItem('currentAccount');
        if (!currentAddress) {
          throw new Error('Missing account information');
        }
        
        const mnemonic = await getSecureValue(`mnemonic_${currentAddress}`);
        if (!mnemonic) {
          throw new Error('Missing mnemonic');
        }

        // Get the ed25519 address from the QR code data
        if (!qrData.ed25519Address) {
          throw new Error('Missing ed25519 address in QR data');
        }

        // Derive issuer's ed25519 address
        const keyring = new Keyring({ type: 'ed25519' });
        const issuerPair = keyring.addFromUri(mnemonic);
        const issuerEd25519Address = issuerPair.address;

        // Encrypt the receipt using both buyer's and issuer's ed25519 addresses
        const encrypted = buildEncryptedReceiptObj(
          receipt,
          [
            { address: qrData.ed25519Address }, // buyer
            { address: issuerEd25519Address }   // issuer
          ]
        );

        // Generate batch call with return amount and encrypted receipt
        if (!receipt.returns?.returned_amount || receipt.returns.returned_amount <= 0) {
          setError("Returned amount is missing or invalid.");
          setLoading(false);
          return;
        }

        const amount = Math.round((receipt.returns?.returned_amount || 0) * 1e10).toString();
        
        // Create the batch call
        const batchCall = api.tx.utility.batchAll([
          // Transfer the return amount
          api.tx.balances.transferKeepAlive(receipt.sender.address, amount),
          // Add the encrypted receipt as a remark
          api.tx.system.remark(JSON.stringify(encrypted))
        ]);

        // Get the hex-encoded call data
        const hexCall = batchCall.toHex();

        // Navigate using Expo Router
        setTimeout(() => {
          router.push({
            pathname: '/confirm-transaction',
            params: {
              recipient: receipt.sender.address,
              amount: receipt.returns.returned_amount.toFixed(2),
              remark: JSON.stringify(encrypted),
              contacts: JSON.stringify([]),
              currentAccount: currentAddress,
              displayRecipient: receipt.merchant?.name || receipt.sender.address,
              decryptedReceipt: JSON.stringify(receipt)
            }
          });
        }, 0);

      } catch (err) {
        console.error('[ProcessReturn] Error processing receipt:', err);
        setError(err instanceof Error ? err.message : 'Failed to process receipt');
      } finally {
        setLoading(false);
      }
    };

    processReceipt();
  }, [signedReceipt, api, isApiReady]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#D7263D" />
        <Text style={styles.loadingText}>Processing return receipt...</Text>
      </View>
    );
  }
  
  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // No success page, just return null
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
    fontSize: 16,
  },
  errorText: {
    color: '#D7263D',
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 16,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  backButton: {
    padding: 16,
    backgroundColor: '#D7263D',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
}); 