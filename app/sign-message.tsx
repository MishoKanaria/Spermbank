import { Feather } from '@expo/vector-icons';
import { Keyring } from '@polkadot/keyring';
import { encodeAddress } from '@polkadot/util-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Camera, CameraView } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Clipboard, Image, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { getSecureValue } from '../services/storage/secureStorage';
import sharedStyles from './styles/index.styles';

interface SignatureRequest {
  receipt_id: string;
  original_receipt_id?: string;
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

interface SignedMessage {
  signature: string;
  ed25519Address: string;
  sr25519Address: string;
}

export default function SignMessage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signatureRequest, setSignatureRequest] = useState<SignatureRequest | null>(null);
  const [signedMessage, setSignedMessage] = useState<SignedMessage | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showSignatureQR, setShowSignatureQR] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.getCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    try {
      const request = JSON.parse(data);
      
      // Validate the request structure
      if (!request || typeof request !== 'object') {
        throw new Error('Invalid QR code format');
      }

      // Create receipt object matching the example structure
      const receipt = {
        receipt_id: request.receipt_id,
        original_receipt_id: request.original_receipt_id,
        status: request.status,
        signatures: {
          issuer: request.signatures?.issuer || '',
          returner: request.signatures?.returner || ''
        },
        merchant: request.merchant,
        sender: request.sender,
        items: request.items,
        currency: request.currency,
        subtotal: request.subtotal,
        discount: request.discount,
        tax: request.tax,
        total: request.total,
        returns: request.returns,
        metadata: request.metadata
      };

      setSignatureRequest(receipt);
      setShowScanner(false);
    } catch (err) {
      console.error('QR code parsing error:', err);
      setError('Invalid QR code format');
      setShowScanner(false);
    }
  };

  const handleSign = async () => {
    try {
      setLoading(true);
      if (!signatureRequest) {
        throw new Error('No signature request found');
      }

      // Get current account address
      const currentAddress = await AsyncStorage.getItem('currentAccount');
      if (!currentAddress) {
        throw new Error('No current account found');
      }

      // Get mnemonic for current account
      const mnemonic = await getSecureValue(`mnemonic_${currentAddress}`);
      if (!mnemonic) {
        throw new Error('No mnemonic found for current account');
      }

      // Initialize keyring
      const keyring = new Keyring({ type: 'sr25519' });

      // Generate ed25519 address for encryption
      const ed25519Pair = keyring.addFromMnemonic(mnemonic, {}, 'ed25519');
      const ed25519Address = ed25519Pair.address;

      // Generate sr25519 address for signing with prefix 0
      const sr25519Pair = keyring.addFromMnemonic(mnemonic, {}, 'sr25519');
      const sr25519Address = encodeAddress(sr25519Pair.publicKey, 0);

      // Create a copy of the receipt for signing
      const receiptForSigning = {
        ...signatureRequest,
        signatures: {
          issuer: signatureRequest.signatures.issuer,
          returner: '' // Clear returner signature for signing
        }
      };

      // Sign the receipt
      const messageToSign = JSON.stringify(receiptForSigning);
      const signature = '0x' + Buffer.from(sr25519Pair.sign(messageToSign)).toString('hex');

      // Create signed message object
      const signedMessageObj: SignedMessage = {
        signature,
        ed25519Address,
        sr25519Address
      };

      // Set the signed message to display QR code
      setSignedMessage(signedMessageObj);
      setShowSignatureQR(true);
    } catch (error: any) {
      console.error('Error signing message:', error);
      Alert.alert('Error', `Failed to sign message: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (signedMessage) {
      Clipboard.setString(JSON.stringify(signedMessage));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      {showScanner ? (
        <View style={{ flex: 1 }}>
          <CameraView
            style={{ flex: 1 }}
            onBarcodeScanned={handleBarCodeScanned}
          >
            <View style={{ flex: 1, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' }}>
              <View style={{ width: 250, height: 250, borderWidth: 2, borderColor: '#000000', borderRadius: 12 }} />
            </View>
          </CameraView>
          <TouchableOpacity 
            style={[localStyles.button, { position: 'absolute', bottom: 90, left: 20, right: 20 }]} 
            onPress={() => setShowScanner(false)}
          >
            <Text style={[localStyles.buttonText, { color: '#fff' }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : showSignatureQR && signedMessage ? (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={{ flex: 1, padding: 16, paddingTop: 40 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 40 }}>
              <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
                <Feather name="arrow-left" size={24} color="#D7263D" />
              </TouchableOpacity>
              <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Sign & Approve</Text>
            </View>

            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: -100 }}>
              <Text style={{ marginBottom: 24, textAlign: 'center', fontSize: 16, color: '#666' }}>
                Scan this QR code to confirm the return
              </Text>
              <TouchableOpacity 
                onLongPress={handleCopy}
                activeOpacity={1}
              >
                <View style={{ backgroundColor: '#fff', padding: 20, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}>
                  <QRCode
                    value={JSON.stringify(signedMessage)}
                    size={200}
                  />
                </View>
              </TouchableOpacity>
              {copied && (
                <Text style={{ marginTop: 12, color: '#4CAF50', fontSize: 14 }}>Copied!</Text>
              )}
            </View>

            <View style={{ position: 'absolute', bottom: 0, left: 16, right: 16, paddingBottom: 80 }}>
              <TouchableOpacity
                style={[sharedStyles.signupButton, { opacity: loading ? 0.5 : 1 }]}
                onPress={() => router.back()}
              >
                <Text style={sharedStyles.signupButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      ) : signatureRequest ? (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={{ flex: 1, padding: 16, paddingTop: 40 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 40 }}>
              <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
                <Feather name="arrow-left" size={24} color="#D7263D" />
              </TouchableOpacity>
              <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Sign & Approve</Text>
            </View>

            <ScrollView style={{ flex: 1, marginBottom: 100 }}>
              <View style={{ marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  {signatureRequest.merchant?.logoUrl ? (
                    <Image source={{ uri: signatureRequest.merchant.logoUrl }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                  ) : (
                    <Feather name="shopping-bag" size={24} color="#D7263D" />
                  )}
                  <Text style={{ marginLeft: 12, fontSize: 20, fontWeight: 'bold' }}>
                    {signatureRequest.merchant?.name || 'merchant'}
                  </Text>
                </View>

                {signatureRequest.items ? (
                  <>
                    <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 12 }}>Items to Return:</Text>
                    {signatureRequest.items
                      .filter(item => typeof item.returned_qty === 'number' && item.returned_qty > 0)
                      .map(item => (
                        <View key={item.id + '_returned'} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                          <Text>{item.name} x{item.returned_qty!}</Text>
                          <Text>${(item.price * item.returned_qty!).toFixed(2)}</Text>
                        </View>
                      ))}

                    <Text style={{ fontWeight: 'bold', fontSize: 18, marginTop: 16, marginBottom: 12 }}>Items Kept:</Text>
                    {signatureRequest.items
                      .filter(item => {
                        const keptQty = item.qty - (item.returned_qty || 0);
                        return keptQty > 0;
                      })
                      .map(item => {
                        const keptQty = item.qty - (item.returned_qty || 0);
                        return (
                          <View key={item.id + '_kept'} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text>{item.name} x{keptQty}</Text>
                            <Text>${(item.price * keptQty).toFixed(2)}</Text>
                          </View>
                        );
                      })}

                    <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#eee' }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={{ fontWeight: 'bold' }}>Refund Amount</Text>
                        <Text style={{ fontWeight: 'bold', color: '#4CAF50' }}>
                          ${signatureRequest.returns?.returned_amount?.toFixed(2) || '0.00'}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={{ color: '#666' }}>Return Status</Text>
                        <Text style={{ color: '#666' }}>{signatureRequest.status || 'pending'}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={{ color: '#666' }}>Receipt ID</Text>
                        <Text style={{ color: '#666' }}>{signatureRequest.receipt_id}</Text>
                      </View>
                    </View>
                  </>
                ) : (
                  <View style={localStyles.messageContainer}>
                    <Text style={localStyles.messageText}>
                      {JSON.stringify(signatureRequest, null, 2)}
                    </Text>
                  </View>
                )}
              </View>

              {error && (
                <View style={{ backgroundColor: '#ffebee', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                  <Text style={{ color: '#D7263D' }}>{error}</Text>
                </View>
              )}
            </ScrollView>

            <View style={{ position: 'absolute', bottom: 0, left: 16, right: 16, paddingBottom: 80 }}>
              <TouchableOpacity
                style={[sharedStyles.signupButton, { opacity: loading ? 0.5 : 1 }]}
                onPress={handleSign}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={sharedStyles.signupButtonText}>Sign & Approve</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      ) : (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={{ flex: 1, padding: 16, paddingTop: 40 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 40 }}>
              <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
                <Feather name="arrow-left" size={24} color="#D7263D" />
              </TouchableOpacity>
              <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Sign & Approve</Text>
            </View>

            <View style={localStyles.nfcContainer}>
              <View style={localStyles.nfcCenter}>
                <Feather name="camera" size={96} color="#D7263D" style={{ marginBottom: 24 }} />
                <Text style={localStyles.nfcTitle}>Scan QR Code</Text>
                <Text style={{ color: '#666', textAlign: 'center', marginTop: 8 }}>
                  Scan the QR code to sign and approve the request
                </Text>
                {error ? <Text style={localStyles.error}>{error}</Text> : null}
              </View>
              <TouchableOpacity 
                style={[sharedStyles.signupButton, { width: '90%', alignSelf: 'center', marginBottom: 70 }]} 
                onPress={() => {
                  if (hasPermission) {
                    setShowScanner(true);
                  } else {
                    setError('Camera permission is required to scan QR codes');
                  }
                }}
              >
                <Text style={[sharedStyles.signupButtonText, { color: '#fff' }]}>Scan QR Code</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      )}
    </>
  );
}

const localStyles = StyleSheet.create({
  nfcContainer: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 0,
  },
  nfcCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  nfcTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#D7263D',
    marginBottom: 8,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#FF5A4D',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontWeight: 'bold',
    fontSize: 18,
  },
  error: {
    color: '#D7263D',
    marginTop: 16,
    fontWeight: 'bold',
  },
  messageContainer: {
    backgroundColor: '#F3F3F3',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  messageText: {
    fontSize: 14,
    color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
}); 