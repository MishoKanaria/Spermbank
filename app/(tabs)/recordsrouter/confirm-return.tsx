import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, SafeAreaView, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SignatureData as OrigSignatureData, ReturnReceipt, verifyAndSignReturnReceipt } from '../../../services/utils/returnReceiptUtils';
import sharedStyles from '../../styles/index.styles';

interface SignatureData extends OrigSignatureData {
  sr25519: string;
  ed25519?: string;
}

interface ReturnItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  returned_qty?: number;
  discount?: number;
  total?: number;
  image?: string;
  emoji?: string;
  returnable?: boolean;
}

interface Receipt {
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
  items: ReturnItem[];
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
  encrypted?: any;
}

export default function ConfirmReturn() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [returnObj, setReturnObj] = useState<ReturnReceipt | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [notVerified, setNotVerified] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const receipt: Receipt = JSON.parse(params.receipt as string);
  const selectedItems: { [id: string]: number } = JSON.parse(params.selectedItems as string);
  const returnAmount = parseFloat(params.returnAmount as string);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (hasScanned) return;
    setHasScanned(true);
    setShowScanner(false);
    setVerifying(true);
    setError(null);

    setTimeout(async () => {
      try {
        const signatureData: SignatureData = JSON.parse(data);

        if (!returnObj) {
          throw new Error('Return object is null');
        }

        const { signedReceipt } = await verifyAndSignReturnReceipt(returnObj, signatureData);
        setReturnObj(signedReceipt);

        // Immediately show verification success
        setTimeout(() => {
          setVerified(true);
          setVerifying(false);
          
          // Navigate to process-return screen
          router.push({
            pathname: '/(tabs)/recordsrouter/process-return',
            params: {
              signedReceipt: JSON.stringify(signedReceipt),
              qrData: JSON.stringify(signatureData)
            }
          });
        }, 300);

      } catch (err) {
        console.error('[Error] During verification/signing:', err);
        setNotVerified(true);
        setVerifying(false);
        setHasScanned(false);
      }
    }, 50);
  };

  const handleConfirm = async () => {
    try {
      setLoading(true);
      setError(null);

      // Update items: increment returned_qty for returned items
      const items = receipt.items.map(item => {
        const returnedQty = selectedItems[item.id] || 0;
        return {
          ...item,
          returned_qty: (item.returned_qty || 0) + returnedQty,
          qty: item.qty, // keep original qty
        };
      });

      // Calculate remaining quantities for each item
      const remainingItems = items.map(item => ({
        ...item,
        remaining_qty: item.qty - (item.returned_qty || 0)
      }));
      // Calculate new subtotal, tax, and total based on remaining items
      const subtotal = remainingItems.reduce(
        (sum, item) => sum + (item.price * (item.remaining_qty > 0 ? item.remaining_qty : 0)),
        0
      );
      const tax = Math.round(subtotal * 0.10 * 100) / 100;
      const total = Math.round((subtotal + tax) * 100) / 100;

      // Now calculate status based on updated items
      const totalReturnableItems = items.filter(item => item.returnable).length;
      const totalReturnedReturnableItems = items.filter(item => item.returnable && (item.returned_qty || 0) >= item.qty).length;
      const status = totalReturnedReturnableItems === totalReturnableItems ? 'returned' : 'partial_return';

      // Build the new return receipt object
      const newReceiptId = `550e8400-e29b-41d4-a716-${Date.now().toString(16)}`;
      // Always use the original_receipt_id if present, otherwise fallback to the current receipt's id
      const originalReceiptId = receipt.original_receipt_id || receipt.receipt_id;
      
      const newReturnReceipt: Receipt = {
        receipt_id: newReceiptId,
        original_receipt_id: originalReceiptId,
        status,
        signatures: {
          issuer: '',
          returner: ''
        },
        merchant: {
          name: receipt.merchant?.name || '',
          businessId: receipt.merchant?.businessId || '',
          address: receipt.merchant?.address || '',
          logoUrl: receipt.merchant?.logoUrl
        },
        sender: {
          address: receipt.sender?.address || ''
        },
        items,
        currency: receipt.currency || 'USD',
        subtotal,
        discount: receipt.discount || 0,
        tax,
        total,
        returns: {
          total_returns: Object.values(selectedItems).reduce((a, b) => a + b, 0),
          returned_amount: Math.round(returnAmount * 100) / 100
        },
        metadata: {
          chain: receipt.metadata?.chain || 'polkadot',
          version: receipt.metadata?.version || '1.0',
          network: receipt.metadata?.network || 'mainnet'
        }
      };

      setReturnObj(newReturnReceipt as ReturnReceipt);
      setShowQR(true);
    } catch (err) {
      console.error('Error preparing return:', err);
      setError(err instanceof Error ? err.message : 'Failed to prepare return');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#D7263D" />
        <Text style={{ marginTop: 20 }}>Loading receipt...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ flex: 1, padding: 16, paddingTop: 40 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 40 }}>
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
              <Feather name="arrow-left" size={24} color="#D7263D" />
            </TouchableOpacity>
            <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Confirm Return</Text>
          </View>

          <View style={sharedStyles.notValidContainer}>
            <Text style={sharedStyles.notValidTitle}>Invalid Signature</Text>
            <Text style={sharedStyles.notValidText}>
              The signature could not be verified. Please try scanning the QR code again.
            </Text>
            <TouchableOpacity 
              style={sharedStyles.retryButton}
              onPress={() => {
                setError(null);
                setShowScanner(true);
              }}
            >
              <Text style={sharedStyles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!showScanner) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ flex: 1, padding: 16, paddingTop: 40 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 40 }}>
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
              <Feather name="arrow-left" size={24} color="#D7263D" />
            </TouchableOpacity>
            <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Confirm Return</Text>
          </View>

          {showQR && returnObj ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: -100 }}>
              <Text style={{ marginBottom: 24, textAlign: 'center', fontSize: 16, color: '#666' }}>
                Ask the buyer to scan this QR code with their wallet to sign the return
              </Text>
              <View style={{ backgroundColor: '#fff', padding: 20, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}>
                {(() => {
                  const qrData = JSON.stringify(returnObj);
                  return <QRCode value={qrData} size={200} />;
                })()}
              </View>
              <TouchableOpacity 
                style={[sharedStyles.signupButton, { marginTop: 40, width: '90%' }]} 
                onPress={() => setShowScanner(true)}
              >
                <Text style={sharedStyles.signupButtonText}>Scan Signature</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <ScrollView style={{ flex: 1 }}>
                <View style={{ marginBottom: 24 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                    {receipt.merchant?.logoUrl ? (
                      <Image source={{ uri: receipt.merchant.logoUrl }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                    ) : (
                      <Feather name="shopping-bag" size={24} color="#D7263D" />
                    )}
                    <Text style={{ marginLeft: 12, fontSize: 20, fontWeight: 'bold' }}>{receipt.merchant?.name || 'merchant'}</Text>
                  </View>

                  <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 12 }}>Items to Return:</Text>
                  {Object.entries(selectedItems).map(([id, qty]) => {
                    const item = receipt.items.find(i => i.id === id);
                    if (!item) return null;
                    return (
                      <View key={id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text>{item.name} x{qty}</Text>
                        <Text>${(item.price * qty).toFixed(2)}</Text>
                      </View>
                    );
                  })}

                  <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#eee' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={{ fontWeight: 'bold' }}>Refund Amount</Text>
                      <Text style={{ fontWeight: 'bold', color: '#4CAF50' }}>${returnAmount.toFixed(2)}</Text>
                    </View>
                  </View>
                </View>

                {error && (
                  <View style={{ backgroundColor: '#ffebee', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                    <Text style={{ color: '#D7263D' }}>{error}</Text>
                  </View>
                )}
              </ScrollView>

              <TouchableOpacity
                style={[sharedStyles.signupButton, { opacity: loading ? 0.5 : 1, marginBottom: 110 }]}
                onPress={handleConfirm}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={sharedStyles.signupButtonText}>Generate Return QR Code</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {verifying && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}>
              <View style={{ backgroundColor: '#fff', padding: 20, borderRadius: 12, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#D7263D" />
                <Text style={{ marginTop: 16, fontSize: 16 }}>Verifying signature...</Text>
              </View>
            </View>
          )}

          {verified && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}>
              <View style={{ backgroundColor: '#fff', padding: 20, borderRadius: 12, alignItems: 'center' }}>
                <Feather name="check-circle" size={48} color="#4CAF50" />
                <Text style={{ marginTop: 16, fontSize: 16 }}>Signature verified!</Text>
              </View>
            </View>
          )}

          {notVerified && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}>
              <View style={{ backgroundColor: '#fff', padding: 20, borderRadius: 12, alignItems: 'center', width: 300, height: 300, justifyContent: 'center' }}>
                <Feather name="x-circle" size={48} color="#D7263D" />
                <Text style={{ marginTop: 16, fontSize: 16, color: '#D7263D' }}>Invalid signature</Text>
                <TouchableOpacity 
                  style={[sharedStyles.signupButton, { marginTop: 24, width: '90%' }]}
                  onPress={() => {
                    setNotVerified(false);
                    setShowScanner(true);
                  }}
                >
                  <Text style={sharedStyles.signupButtonText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        style={{ flex: 1 }}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={handleBarCodeScanned}
      >
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
          <Text style={{ color: 'white', fontSize: 18, marginBottom: 20 }}>Scan Signature QR Code</Text>
          <View style={{ width: 250, height: 250, borderWidth: 2, borderColor: 'white', borderRadius: 12 }} />
        </View>
      </CameraView>
      <TouchableOpacity 
        style={[sharedStyles.signupButton, { alignSelf: 'center', width: '90%', bottom: 105}]} 
        onPress={() => setShowScanner(false)}
      >
        <Text style={sharedStyles.signupButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
} 