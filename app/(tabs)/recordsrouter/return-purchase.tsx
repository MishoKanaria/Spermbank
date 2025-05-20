import { Feather } from '@expo/vector-icons';
import { cryptoWaitReady, decodeAddress, signatureVerify } from '@polkadot/util-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTransactionLookup } from '../../../services/encryption/cryptoUtils';
import { getReceiptTracking } from '../../../services/storage/receiptTracking';
import { getSecureValue } from '../../../services/storage/secureStorage';
import { default as styles } from '../../styles/index.styles';

interface ReturnItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  image?: string;
  emoji?: string;
  returnable?: boolean;
  returned_qty?: number;
}

interface Receipt {
  receipt_id: string;
  items: ReturnItem[];
  total: number;
  tax: number;
  subtotal: number;
  merchant?: {
    name: string;
    logoUrl?: string;
    address?: string;
  };
  signatures?: {
    issuer: string;
  };
  sender?: {
    address: string;
  };
}

const errorModalButtonStyles = StyleSheet.create({
  button: {
    width: 300,
    paddingVertical: 16,
    backgroundColor: '#FF5A4D',
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  text: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
});

export default function ReturnPurchase() {
  const params = useLocalSearchParams();
  const [mostRecentMap, setMostRecentMap] = useState<Map<string, any>>(new Map());
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<{ [id: string]: number }>({});
  const [isSignatureValid, setIsSignatureValid] = useState(false);
  const router = useRouter();
  const { lookupTransactionReceipt } = useTransactionLookup();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  useEffect(() => {
    (async () => {
      const currentAddress = await AsyncStorage.getItem('currentAccount');
      if (currentAddress) {
        const mapStr = await AsyncStorage.getItem(`mostRecentMap_${currentAddress}`);
        if (mapStr) {
          const entries = JSON.parse(mapStr);
          setMostRecentMap(new Map(entries));
        }
      }
    })();
  }, []);

  const verifyMerchantSignature = async (receipt: Receipt) => {
    try {
      if (!receipt.merchant) {
        return false;
      }

      if (!receipt.signatures?.issuer) {
        return false;
      }

      const currentAddress = await AsyncStorage.getItem('currentAccount');
      if (!currentAddress) {
        return false;
      }

      await cryptoWaitReady();

      // Create a copy with empty signature for verification
      const receiptForVerification = JSON.parse(JSON.stringify(receipt));
      receiptForVerification.signatures.issuer = ""; // Set empty string to match signing
      // Set returner to empty string if it exists
      if (receiptForVerification.signatures.returner) {
        receiptForVerification.signatures.returner = "";
      }

      // Verify the signature
      const message = new TextEncoder().encode(JSON.stringify(receiptForVerification));
      const signature = receipt.signatures.issuer.startsWith('0x') 
        ? receipt.signatures.issuer 
        : '0x' + receipt.signatures.issuer;
      
      const publicKey = decodeAddress(currentAddress);
      const { isValid } = signatureVerify(message, signature, publicKey);
      
      return isValid;
    } catch (err) {
      console.error('Error verifying merchant signature:', err);
      return false;
    }
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setLoading(true);
    setError(null); // Clear any previous errors

    try {
      // Validate transaction hash format
      const parts = data.split(':');
      if (parts.length !== 4 || parts[0] !== 'block' || parts[2] !== 'tx') {
        throw new Error('Invalid transaction hash format. Expected format: block:blockHash:tx:transactionHash');
      }
      const blockHash = parts[1];
      const transactionHash = parts[3];
      
      if (!blockHash.startsWith('0x') || blockHash.length !== 66 || 
          !transactionHash.startsWith('0x') || transactionHash.length !== 66) {
        throw new Error('Invalid block or transaction hash format');
      }

      const currentAddress = await AsyncStorage.getItem('currentAccount');
      if (!currentAddress) {
        throw new Error('No account found');
      }

      const sellerMnemonic = await getSecureValue(`mnemonic_${currentAddress}`);
      if (!sellerMnemonic) {
        throw new Error('No seller credentials found');
      }

      const result = await lookupTransactionReceipt(data, sellerMnemonic, currentAddress);
      if (!result) {
        throw new Error('No receipt found in transaction');
      }

      // Verify the merchant signature
      const isValid = await verifyMerchantSignature(result.receipt);
      setIsSignatureValid(isValid);
      setReceipt(result.receipt);

      const scannedReceiptId = result.receipt.receipt_id;
      // If original_receipt_id is missing (original receipt), use receipt_id as the key
      const originalId = result.receipt.original_receipt_id || scannedReceiptId;

      // Use receipt tracking to find the latest receipt in the chain
      const tracking = await getReceiptTracking(originalId);
      let latestReceiptId = originalId;
      if (tracking && tracking.return_receipt_ids.length > 0) {
        latestReceiptId = tracking.return_receipt_ids[tracking.return_receipt_ids.length - 1];
      }

      const latestReceipt = mostRecentMap.get(originalId);
      if (!latestReceipt) {
        setError('Receipt is not recognised.');
        setScanned(false);
        setLoading(false);
        return;
      }

      // Only allow if the scanned receipt is the latest in the chain
      if (scannedReceiptId !== latestReceipt.receipt_id) {
        setError('A newer version of this receipt exists. Please scan the most recent receipt.');
        setScanned(false);
        setLoading(false);
        return;
      }

      // Then check if it's fully returned
      if (mostRecentMap.get(latestReceiptId)?.status === 'returned') {
        setError('This receipt has already been fully returned.');
        setScanned(false);
        setLoading(false);
        return;
      }

      // Check if there are any returnable items left
      const hasReturnableItems = result.receipt.items.some((item: { 
        returnable: boolean; 
        qty: number; 
        returned_qty?: number; 
      }) => 
        item.returnable && (item.qty - (item.returned_qty || 0)) > 0
      );

      if (!hasReturnableItems) {
        setError('No returnable items remaining on this receipt.');
        setScanned(false);
        setLoading(false);
        return;
      }
    } catch (error) {
      console.error('Error scanning receipt:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while scanning the receipt');
      setScanned(false);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setSelectedItems(prev => {
      const newQty = (prev[id] || 0) + delta;
      // Don't allow returning more than original quantity
      const originalItem = receipt?.items.find(item => item.id === id);
      if (originalItem && newQty > originalItem.qty) {
        return prev;
      }
      // Don't allow returning non-returnable items
      const nonrefundableItem = receipt?.items.find(item => item.id === id);
      if (nonrefundableItem && !nonrefundableItem.returnable) {
        return prev;
      }
      // Allow setting to 0 or any positive number up to original quantity
      if (newQty <= 0) {
        const newItems = { ...prev };
        delete newItems[id];
        return newItems;
      }
      return { ...prev, [id]: newQty };
    });
  };

  if (!permission?.granted) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Camera permission is required to scan receipts</Text>
        <TouchableOpacity 
          style={{ marginTop: 20, padding: 10, backgroundColor: '#D7263D', borderRadius: 8 }}
          onPress={requestPermission}
        >
          <Text style={{ color: 'white' }}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#D7263D" />
        <Text style={{ marginTop: 20 }}>Loading receipt...</Text>
      </View>
    );
  }

  if (!scanned || !receipt) {
    return (
      <View style={{ flex: 1 }}>
        <CameraView
          style={{ flex: 1 }}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={handleBarCodeScanned}
        />
        <View style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'transparent',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          {error ? (
            <View style={{ 
              backgroundColor: 'rgba(0,0,0,0.8)', 
              padding: 20, 
              borderRadius: 10,
              margin: 20,
              alignItems: 'center'
            }}>
              <Text style={{ color: 'white', fontSize: 16, textAlign: 'center', marginBottom: 10 }}>
                {error}
              </Text>
              <TouchableOpacity
                style={errorModalButtonStyles.button}
                onPress={() => {
                  setError(null);
                  setScanned(false);
                }}
              >
                <Text style={errorModalButtonStyles.text}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={{ color: 'white', fontSize: 18, marginBottom: 20 }}>Scan Receipt QR Code</Text>
              <View style={{ width: 250, height: 250, borderWidth: 2, borderColor: 'white', borderRadius: 12 }} />
            </>
          )}
        </View>
      </View>
    );
  }

  const selectedItemsList = receipt.items.filter(item => selectedItems[item.id]);
  const subtotal = selectedItemsList.reduce((sum, item) => sum + (item.price * (selectedItems[item.id] || 0)), 0);
  const tax = Math.round(subtotal * 0.10 * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;

  const remainingItems = receipt.items.map(item => ({
    ...item,
    remaining_qty: item.qty - ((item.returned_qty || 0) + (selectedItems[item.id] || 0))
  }));
  const newSubtotal = remainingItems.reduce(
    (sum, item) => sum + (item.price * (item.remaining_qty > 0 ? item.remaining_qty : 0)),
    0
  );
  const newTax = Math.round(newSubtotal * 0.10 * 100) / 100;
  const newTotal = Math.round((newSubtotal + newTax) * 100) / 100;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, padding: 16, paddingTop: 40 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          {receipt.merchant?.logoUrl ? (
            <Image source={{ uri: receipt.merchant.logoUrl }} style={{ width: 40, height: 40, borderRadius: 20 }} />
          ) : (
            <Feather name="shopping-bag" size={24} color="#D7263D" />
          )}
          <Text style={{ marginLeft: 12, fontSize: 20, fontWeight: 'bold' }}>{receipt.merchant?.name || 'Merchant'}</Text>
        </View>

        <Text style={{ fontWeight: 'bold', fontSize: 24, color: '#D7263D', marginBottom: 16 }}>Return Items</Text>
        
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 270 }} showsVerticalScrollIndicator={false}>
          {receipt.items
            .filter((item: ReturnItem) => {
              // Only show items that have not been fully returned
              const alreadyReturned = item.returned_qty || 0;
              return alreadyReturned < item.qty;
            })
            .map((item: ReturnItem) => {
              const alreadyReturned = item.returned_qty || 0;
              const remainingQty = item.qty - alreadyReturned;
              return (
                <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f8fa', borderRadius: 16, marginBottom: 16, padding: 12 }}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12 }} />
                  ) : (
                    <Text style={{ fontSize: 36, marginRight: 12 }}>{item.emoji}</Text>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{item.name}</Text>
                    <Text style={{ color: '#444' }}>${item.price.toFixed(2)}</Text>
                    {!item.returnable && (
                      <Text style={{ color: '#D7263D', fontSize: 12, marginTop: 4 }}>Non-refundable</Text>
                    )}
                    {alreadyReturned > 0 && (
                      <Text style={{ color: '#666', fontSize: 12, marginTop: 4 }}>{alreadyReturned} already returned</Text>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity 
                      onPress={() => updateQuantity(item.id, -1)} 
                      style={{ backgroundColor: '#eee', borderRadius: 8, padding: 6, marginHorizontal: 4 }}
                    >
                      <Text style={{ fontWeight: 'bold', fontSize: 18, color: '#D7263D' }}>-</Text>
                    </TouchableOpacity>
                    <Text style={{ fontWeight: 'bold', fontSize: 16, marginHorizontal: 4 }}>
                      {selectedItems[item.id] || 0}
                    </Text>
                    <TouchableOpacity 
                      onPress={() => updateQuantity(item.id, 1)} 
                      style={{ backgroundColor: '#eee', borderRadius: 8, padding: 6, marginHorizontal: 4 }}
                      disabled={(selectedItems[item.id] || 0) >= remainingQty}
                    >
                      <Text style={{ fontWeight: 'bold', fontSize: 18, color: '#D7263D' }}>+</Text>
                    </TouchableOpacity>
                    <Text style={{ color: '#666', marginHorizontal: 4 }}>/ {remainingQty}</Text>
                  </View>
                  <Text style={{ fontWeight: 'bold', marginLeft: 16 }}>
                    ${(item.price * (selectedItems[item.id] || 0)).toFixed(2)}
                  </Text>
                </View>
              );
            })}
        </ScrollView>

        <View style={{ position: 'absolute', left: 16, right: 16, bottom: 90, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'stretch', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ fontWeight: 'bold', fontSize: 16 }}>Original Total</Text>
            <Text style={{ fontWeight: 'bold', fontSize: 16 }}>${receipt.total.toFixed(2)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontWeight: 'bold', fontSize: 18 }}>Refund Amount</Text>
            <Text style={{ fontWeight: 'bold', fontSize: 18, color: '#4CAF50' }}>${total.toFixed(2)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontWeight: 'bold', fontSize: 16 }}>New Receipt Total</Text>
            <Text style={{ fontWeight: 'bold', fontSize: 16 }}>${newTotal.toFixed(2)}</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Feather name={isSignatureValid ? "check-circle" : "alert-circle"} size={20} color={isSignatureValid ? "#4CAF50" : "#D7263D"} />
            <Text style={{ marginLeft: 8, color: isSignatureValid ? "#4CAF50" : "#D7263D" }}>
              {isSignatureValid ? "Receipt verified" : "Receipt not verified"}
            </Text>
          </View>

          <TouchableOpacity 
            style={[styles.signupButton, { 
              opacity: Object.keys(selectedItems).length > 0 && isSignatureValid ? 1 : 0.5 
            }]} 
            disabled={Object.keys(selectedItems).length === 0 || !isSignatureValid}
            onPress={() => {
              router.push({
                pathname: '/(tabs)/recordsrouter/confirm-return',
                params: {
                  receipt: JSON.stringify(receipt),
                  selectedItems: JSON.stringify(selectedItems),
                  returnAmount: total.toString(),
                  isSignatureValid: isSignatureValid.toString()
                }
              });
            }}
          >
            <Text style={styles.signupButtonText}>
              {!isSignatureValid ? 'Receipt Not Verified' : 
               Object.keys(selectedItems).length === 0 ? 'Select Items to Return' : 'Confirm Return'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
} 