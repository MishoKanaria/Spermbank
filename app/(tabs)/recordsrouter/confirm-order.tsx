import { Feather } from '@expo/vector-icons';
import { Keyring } from '@polkadot/keyring';
import { u8aToHex } from '@polkadot/util';
import { cryptoWaitReady, encodeAddress, mnemonicToMiniSecret } from '@polkadot/util-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateKeyPairFromSeed } from '@stablelib/ed25519';
import { Buffer } from 'buffer';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AnimatedCheckmark from '../../../components/common/AnimatedCheckmark';
import AnimatedQRCode from '../../../components/common/AnimatedQRCode';
import GetSenderAddress from '../../../components/GetSenderAddress';
import { generateBatchCallHex, waitForPayment } from '../../../services/blockchain/polkadotTx';
import { buildEncryptedReceiptObj } from '../../../services/encryption/cryptoUtils';
import { getSecureValue } from '../../../services/storage/secureStorage';
import { useApi } from '../../contexts/ApiContext';

interface merchantInfo {
  name: string;
  logoUrl: string;
  businessId: string;
  address: string;
  signature?: string;
}

export default function ConfirmOrder() {
  const [receipt, setReceipt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const slideAnim = React.useRef(new Animated.Value(100)).current;
  const router = useRouter();
  const [issuerAddress, setIssuerAddress] = useState<string | null>(null);
  const [ed25519Address, setEd25519Address] = useState<string | null>(null);
  const [sr25519Address, setSr25519Address] = useState<string | null>(null);
  const [hexCallLoading, setHexCallLoading] = useState(true);
  const [hexCallData, setHexCallData] = useState<string | null>(null);
  const { api, isApiReady } = useApi();
  const [qrChunks, setQrChunks] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const paymentUnsubsRef = useRef<(() => void)[]>([]);

  const generateQRChunks = useCallback((data: string) => {
    const chunkSize = 1000;
    const chunks: string[] = [];
    
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      const chunkData = {
        chunk: chunks.length + 1,
        total: Math.ceil(data.length / chunkSize),
        data: chunk
      };
      chunks.push(JSON.stringify(chunkData));
    }
    
    return chunks;
  }, []);

  // 1. Load merchant info first
  useEffect(() => {
    (async () => {
      try {
        const account = await AsyncStorage.getItem('currentAccount');
        if (!account) return setLoading(false);
        const merchantInfoKey = `merchantInfo_${account}`;
        const itemsKey = `merchant_items_${account}`;
        const cartKey = `merchant_cart_${account}`;
        const merchantInfo = await AsyncStorage.getItem(merchantInfoKey);
        const items = await AsyncStorage.getItem(itemsKey);
        const cart = await AsyncStorage.getItem(cartKey);
        const merchant = merchantInfo ? JSON.parse(merchantInfo) : {};
        const allItems = items ? JSON.parse(items) : [];
        const cartObj = cart ? JSON.parse(cart) : {};
        const cartItems = allItems.filter((item: any) => cartObj[item.id]);
        const receiptItems = cartItems.map((item: any) => ({
          id: item.id,
          name: item.name,
          qty: cartObj[item.id],
          price: item.price,
          discount: 0.00,
          total: item.price * cartObj[item.id],
          returnable: item.returnable
        }));
        const subtotal = receiptItems.reduce((sum: number, i: any) => sum + i.total, 0);
        const discount = 0.00;
        const tax = +(subtotal * 0.10).toFixed(2);
        const total = +(subtotal + tax - discount).toFixed(2);

        // Get merchant mnemonic and create keyring
        const currentAddress = await AsyncStorage.getItem('currentAccount');
        if (!currentAddress) {
          throw new Error('No current account found');
        }
        const mnemonic = await getSecureValue(`mnemonic_${currentAddress}`);
        if (!mnemonic) {
          throw new Error('merchant mnemonic not found');
        }

        // Sign the entire receipt using Polkadot's keyring
        await cryptoWaitReady();
        const keyring = new Keyring({ type: 'sr25519' });
        const pair = keyring.addFromMnemonic(mnemonic);
        const issuerAddress = pair.address;
        
        setIssuerAddress(issuerAddress);
        setLoading(false);
      } catch (err) {
        console.error('Error creating receipt:', err);
        setLoading(false);
      }
    })();
  }, []);

  // 2. Create and sign receipt when we have both addresses
  useEffect(() => {
    if (!ed25519Address || !sr25519Address || !issuerAddress) return;

    (async () => {
      try {
        const account = await AsyncStorage.getItem('currentAccount');
        if (!account) return;
        const merchantInfoKey = `merchantInfo_${account}`;
        const itemsKey = `merchant_items_${account}`;
        const cartKey = `merchant_cart_${account}`;
        const merchantInfo = await AsyncStorage.getItem(merchantInfoKey);
        const items = await AsyncStorage.getItem(itemsKey);
        const cart = await AsyncStorage.getItem(cartKey);
        const merchant = merchantInfo ? JSON.parse(merchantInfo) : {};
        const allItems = items ? JSON.parse(items) : [];
        const cartObj = cart ? JSON.parse(cart) : {};
        const cartItems = allItems.filter((item: any) => cartObj[item.id]);
        const receiptItems = cartItems.map((item: any) => ({
          id: item.id,
          name: item.name,
          qty: cartObj[item.id],
          price: item.price,
          discount: 0.00,
          total: item.price * cartObj[item.id],
          returnable: item.returnable
        }));
        const subtotal = receiptItems.reduce((sum: number, i: any) => sum + i.total, 0);
        const discount = 0.00;
        const tax = +(subtotal * 0.10).toFixed(2);
        const total = +(subtotal + tax - discount).toFixed(2);

        // Create receipt object with status
        const receiptObj = {
          receipt_id: `550e8400-e29b-41d4-a716-${Date.now().toString(16)}`,
          status: "issuer",
          signatures: {
            issuer: ""
          },
          merchant: {
            name: merchant.name || '',
            logoUrl: merchant.logoUrl || '',
            businessId: merchant.businessId || '',
            address: merchant.address || '',
          } as merchantInfo,
          sender: {
            address: sr25519Address
          },
          items: receiptItems.map((item: any) => ({
            id: item.id,
            name: item.name,
            qty: item.qty,
            price: item.price,
            discount: item.discount || 0.0,
            total: item.total,
            returnable: item.returnable,
            returned_qty: 0
          })),
          currency: 'USD',
          subtotal,
          discount,
          tax,
          total,
          returns: {
            total_returns: 0,
            returned_amount: 0.0
          },
          metadata: {
            chain: "paseoAH",
            version: "1.0",
            network: "testnet"
          }
        };

        // Get issuer mnemonic and create keyring
        const currentAddress = await AsyncStorage.getItem('currentAccount');
        if (!currentAddress) {
          throw new Error('No current account found');
        }
        const mnemonic = await getSecureValue(`mnemonic_${currentAddress}`);
        if (!mnemonic) {
          throw new Error('Issuer mnemonic not found');
        }

        // Sign the entire receipt using Polkadot's keyring
        await cryptoWaitReady();
        const keyring = new Keyring({ type: 'sr25519' });
        const pair = keyring.addFromMnemonic(mnemonic);
        
        // Create a copy without signature for signing
        const receiptForSigning = { ...receiptObj };
        receiptForSigning.signatures.issuer = "";
                
        // Sign the receipt without signature
        const message = new TextEncoder().encode(JSON.stringify(receiptForSigning));
        const signature = pair.sign(message);
        
        // Add signature to receipt
        receiptObj.signatures.issuer = u8aToHex(signature);

        setReceipt(receiptObj);
      } catch (err) {
        console.error('Error creating receipt:', err);
      }
    })();
  }, [ed25519Address, sr25519Address, issuerAddress]);

  // 3. When receipt is ready, do encryption
  useEffect(() => {
    if (!receipt || !ed25519Address || !issuerAddress || !api || !isApiReady) return;
    setHexCallLoading(true);
    setHexCallData(null);
    (async () => {
      try {
        await cryptoWaitReady();
        
        // Get the current account address first
        const currentAddress = await AsyncStorage.getItem('currentAccount');
        if (!currentAddress) {
          setHexCallLoading(false);
          return;
        }
        
        // Use current account address to get mnemonic
        const mnemonic = await getSecureValue(`mnemonic_${currentAddress}`);
        if (!mnemonic) {
          setHexCallLoading(false);
          return;
        }
        
        const mini = mnemonicToMiniSecret(mnemonic);
        const edKeyPair = generateKeyPairFromSeed(mini);
        const issuerEdPub = edKeyPair.publicKey;
        const issuerEd25519Address = encodeAddress(issuerEdPub);
        if (!ed25519Address || !issuerEd25519Address) {
          setHexCallLoading(false);
          return;
        }

        // Create encrypted receipt object
        const obj = buildEncryptedReceiptObj(receipt, [
          { address: ed25519Address }, // Sender
          { address: issuerEd25519Address } // merchant
        ]);

        // Generate the batch call hex with base64 encoded data
        const amount = Math.round((receipt.total || 0) * 1e10).toString();
        const batchHex = generateBatchCallHex({
          api,
          recipient: issuerAddress,
          amount,
          encryptedReceiptHex: JSON.stringify(obj),
        });
        if (batchHex) {
          setHexCallData(batchHex);
          setHexCallLoading(false);
        } else {
          setHexCallLoading(false);
        }
      } catch (err) {
        console.error('Error preparing hex call:', err);
        setHexCallLoading(false);
      }
    })();
  }, [receipt, ed25519Address, issuerAddress, api, isApiReady]);

  // Generate QR chunks when hex data is ready
  useEffect(() => {
    if (hexCallData) {
      const hex = hexCallData.startsWith('0x') ? hexCallData.slice(2) : hexCallData;
      const hexMatch = hex.match(/.{1,2}/g);
      if (!hexMatch) return;
      const bytes = new Uint8Array(hexMatch.map(byte => parseInt(byte, 16)));
      const base64 = Buffer.from(bytes).toString('base64');
      const chunks = generateQRChunks(base64);
      setQrChunks(chunks);
    }
  }, [hexCallData]);

  useEffect(() => {
    if (receipt && ed25519Address && sr25519Address) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 100,
        duration: 300,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [receipt, ed25519Address, sr25519Address]);

  // Payment detection subscription: only subscribe when QR modal is open, and unsubscribe when closed
  useEffect(() => {
    if (!api || !isApiReady || !showQR || !receipt || !issuerAddress || !hexCallData) return;

    const amount = Math.round(receipt.total * 1e10).toString();

    const unsub = waitForPayment(api, issuerAddress, amount, () => {
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setShowQR(false);
        router.replace('/(tabs)/recordsrouter/merchant');
      }, 2000);
    });
    paymentUnsubsRef.current.push(unsub);

    // Cleanup: unsubscribe when QR modal closes or component unmounts
    return () => {
      paymentUnsubsRef.current.forEach(fn => fn());
      paymentUnsubsRef.current = [];
    };
  }, [api, isApiReady, showQR, receipt, issuerAddress, hexCallData]);

  useEffect(() => {
    return () => {
      paymentUnsubsRef.current.forEach(fn => fn());
      paymentUnsubsRef.current = [];
    };
  }, []);

  if (!ed25519Address || !sr25519Address) {
    return <GetSenderAddress onAddressReceived={(addresses) => {
      setEd25519Address(addresses.ed25519);
      setSr25519Address(addresses.sr25519);
    }} />;
  }
  if (loading || !receipt || !issuerAddress || !receipt.sender?.address) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}><Text>Loading...</Text></View>;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Invoice/Receipt Details */}
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 200 }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          {receipt.merchant.logoUrl ? (
            <Image source={{ uri: receipt.merchant.logoUrl }} style={{ width: 64, height: 64, borderRadius: 32, marginBottom: 8 }} />
          ) : null}
          <Text style={{ fontWeight: 'bold', fontSize: 18 }}>{receipt.merchant.name}</Text>
          <Text style={{ color: '#888', fontSize: 14 }}>{receipt.merchant.address}</Text>
          <Text style={{ color: '#888', fontSize: 14 }}>Business ID: {receipt.merchant.businessId}</Text>
        </View>
        <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>Items</Text>
        {receipt.items.map((item: any, idx: number) => (
          <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text>{item.qty} × {item.name}</Text>
            <Text>${item.total.toFixed(2)}</Text>
          </View>
        ))}
        <View style={{ height: 16 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text>Subtotal</Text>
          <Text>${receipt.subtotal.toFixed(2)}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text>Tax (10%)</Text>
          <Text>${receipt.tax.toFixed(2)}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text>Discount</Text>
          <Text>${receipt.discount.toFixed(2)}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ fontWeight: 'bold' }}>Total</Text>
          <Text style={{ fontWeight: 'bold' }}>${receipt.total.toFixed(2)}</Text>
        </View>
        <Text style={{ color: '#888', fontSize: 12, marginTop: 8 }}>Receipt ID: {receipt.receipt_id}</Text>
        {sr25519Address && (
          <Text style={{ color: '#888', fontSize: 12, marginTop: 8 }} selectable>
            Sr25519 Address: {sr25519Address}
          </Text>
        )}
        {ed25519Address && (
          <Text style={{ color: '#888', fontSize: 12, marginTop: 8 }} selectable>
            Ed25519 Address: {ed25519Address}
          </Text>
        )}
        {receipt.signatures.issuer && (
          <Text style={{ color: '#888', fontSize: 12, marginTop: 8 }} selectable>
            Signature: {receipt.signatures.issuer}
          </Text>
        )}
      </ScrollView>

      {/* QR Code Button at Bottom */}
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: 125 }}>
        <TouchableOpacity
          style={{
            backgroundColor: '#FF5A4D',
            borderRadius: 8,
            paddingVertical: 16,
            alignItems: 'center',
            opacity: hexCallLoading || !hexCallData ? 0.5 : 1,
          }}
          disabled={hexCallLoading || !hexCallData}
          onPress={() => {
            if (hexCallData) {
              setShowQR(true);
            }
          }}
        >
          {hexCallLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>Show QR Code</Text>
          )}
        </TouchableOpacity>        
      </View>

      {/* QR Code Modal */}
      {showQR && hexCallData && qrChunks.length > 0 && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Scan to Pay</Text>
              <TouchableOpacity onPress={() => {
                setShowQR(false);
              }}>
                <Feather name="x" size={24} color="#D7263D" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onLongPress={async () => {
                await Clipboard.setStringAsync(hexCallData);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              delayLongPress={500}
              activeOpacity={0.8}
            >
              <AnimatedQRCode 
                chunks={qrChunks}
                size={250}
                interval={100}
              />
            </TouchableOpacity>
            <Text style={styles.modalInstructions}>
              Waiting for payment confirmation...
            </Text>
          </View>
        </View>
      )}

      {showSuccess && (
        <View style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#fff',
          zIndex: 9999,
        }}>
          <AnimatedCheckmark size={100} />
          <Text style={{
            fontSize: 32,
            color: '#4CAF50',
            fontWeight: 'bold',
            marginTop: 24,
          }}>
            Success
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#D7263D',
  },
  modalInstructions: {
    marginTop: 24,
    color: '#666',
    textAlign: 'center',
  },
}); 