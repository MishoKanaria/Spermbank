import { Feather } from '@expo/vector-icons';
import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Camera, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import confettiAnimation from '../assets/animations/confetti.json';
import AnimatedQRScanner from '../components/common/AnimatedQRScanner';
import { decryptReceiptWithMnemonic } from '../services/encryption/cryptoUtils';
import { getSecureValue } from '../services/storage/secureStorage';
import { useApi } from './contexts/ApiContext';


// Helper for displaying a shortened address (6+...+6)
const displayAddress = (address: string) =>
  address.length > 16 ? `${address.slice(0, 8)}...${address.slice(-8)}` : address;

export default function SendScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: { contacts: { name: string; address: string }[]; currentAccount: string; selectedAddress?: string; returnReceipt?: string } }, 'params'>>();
  const { contacts = [], currentAccount = '', selectedAddress = '', returnReceipt } = route.params || {};

  const [recipient, setRecipient] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [remark, setRemark] = useState('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [addressError, setAddressError] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const [fee, setFee] = useState<string>('');
  const [contactImages, setContactImages] = useState<{ [address: string]: string | null }>({});
  const [balance, setBalance] = useState<number | null>(null);
  const [amountError, setAmountError] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { api } = useApi();
  const [decryptedReceipt, setDecryptedReceipt] = useState<any>(null);
  const [decrypting, setDecrypting] = useState(false);
  const justVisitedReceiptDetail = useRef(false);

  const formatAddress = (address: string) => {
    if (!address) return '';
    return displayAddress(address);
  };

  const validateAddress = (address: string) => {
    try {
      const publicKey = decodeAddress(address);
      const reencoded = encodeAddress(publicKey);
      setAddressError('');
      return true;
    } catch (error) {
      setAddressError('Invalid address');
      return false;
    }
  };

  const onSend = async () => {
    if (!recipientAddress || !amount || !!addressError || !!amountError) {
      let errorMsg = addressError || 'Please enter a valid recipient and amount.';
      if (amountError === 'over_balance') errorMsg = 'Please send a lower amount.';
      else if (amountError) errorMsg = amountError;
      console.error('onSend blocked:', { errorMsg, amount, balance, amountError, recipientAddress, addressError });
      setErrorMessage(errorMsg);
      setShowError(true);
      return;
    }
    if (!validateAddress(recipientAddress)) return;

    // Check if we have a return receipt to process
    const returnReceipt = route.params?.returnReceipt ? JSON.parse(route.params.returnReceipt) : null;
    if (returnReceipt) {
      // Navigate to confirm transaction with encrypted receipt as remark
      (navigation.navigate as any)('confirm-transaction', {
        recipient: recipientAddress,
        amount,
        remark,
        contacts,
        currentAccount,
        displayRecipient: displayAddress(recipientAddress), // Use shortened address for returns
        decryptedReceipt: returnReceipt
      });
    } else {
      // Regular transaction
      (navigation.navigate as any)('confirm-transaction', {
        recipient: recipientAddress,
        amount,
        remark,
        contacts,
        currentAccount,
        displayRecipient: decryptedReceipt?.merchant?.name || displayAddress(recipientAddress),
        decryptedReceipt: decryptedReceipt || null,
      });
    }
  };

  useEffect(() => {
    (async () => {
      const { status } = await Camera.getCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  useEffect(() => {
    const loadContactImages = async () => {
      const imagePromises = contacts.map(async (contact) => {
        const uri = await AsyncStorage.getItem(`contactImage_${currentAccount}_${contact.address}`);
        return [contact.address, uri || null];
      });
      const imagesArr = await Promise.all(imagePromises);
      const images = Object.fromEntries(imagesArr);
      setContactImages(images);
    };
    loadContactImages();
  }, [contacts, currentAccount]);

  // Fetch balance on mount
  useEffect(() => {
    (async () => {
      const accountsStr = await AsyncStorage.getItem('accounts');
      const currentAddress = await AsyncStorage.getItem('currentAccount');
      if (!accountsStr || !currentAddress) return;
      const accounts = JSON.parse(accountsStr);
      const currentAccountObj = accounts.find((acc: any) => acc.wallet.address === currentAddress);
      if (!currentAccountObj) return;
      // Assume balance is stored as a string in currentAccountObj.balance, or fetch from storage/api as needed
      // For demo, try to get from storage
      const storedBalance = await AsyncStorage.getItem(`balance_${currentAddress}`);
      if (storedBalance) {
        setBalance(Number(storedBalance));
      } else {
        // fallback: set to null
        setBalance(null);
      }
    })();
  }, []);

  // Validate amount
  useEffect(() => {
    if (!amount || !balance) {
      setAmountError('');
      return;
    }
    const numAmount = Number(amount);
    if (isNaN(numAmount)) {
      setAmountError('Invalid amount');
    } else if (numAmount > balance) {
      setAmountError('over_balance');
    } else {
      setAmountError('');
    }
  }, [amount, balance]);

  useEffect(() => {
    if (!currentAccount || !contacts) {
      setError('Missing account or contacts.');
    }
  }, [currentAccount, contacts]);

  useFocusEffect(
    useCallback(() => {
      if (justVisitedReceiptDetail.current) {
        justVisitedReceiptDetail.current = false;
        return;
      }
      if (selectedAddress) {
        setRecipient(displayAddress(selectedAddress));
        setRecipientAddress(selectedAddress);
      } else {
        setRecipient('');
        setRecipientAddress('');
      }
      setAmount('');
      setRemark('');
      setAddressError('');
      setAmountError('');
      setDecryptedReceipt(null);
      setError(null);

      return () => {};
    }, [selectedAddress])
  );

  // When navigating to receipt-detail, set the ref
  const handleShowReceipt = () => {
    justVisitedReceiptDetail.current = true;
    (navigation as any).navigate('receipt-detail', {
      decryptedReceipt: JSON.stringify(decryptedReceipt),
      txInfo: JSON.stringify({}),
    });
  };

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <Text style={{ color: '#D7263D', fontWeight: 'bold', fontSize: 18, marginBottom: 16 }}>{error}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 16 }}>
          <Text style={{ color: '#D7263D', fontWeight: 'bold' }}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#black', fontWeight: 'bold', fontSize: 18, marginBottom: 24, textAlign: 'center' }}>
          Enable camera permission to use this feature
        </Text>
        <TouchableOpacity
          onPress={() => Linking.openSettings()}
          style={{ backgroundColor: '#FF5A4D', borderRadius: 8, paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center', marginTop: 16 }}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16, width: 200, textAlign: 'center' }}>Open Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (showScanner) {
    return (
      <View style={{ flex: 1 }}>
        <AnimatedQRScanner
          onDataReceived={async (data) => {
            setShowScanner(false);
            setDecrypting(true);
            try {
              // If it's hex data (from animated QR), treat it as a call
              if (data.startsWith('0x')) {
                if (!api) throw new Error('API not ready');
                try {
                  const call = api.createType('Call', data);
                  let recipient = '';
                  let amount = '';
                  let remark = '';
                  let businessName = '';
                  let decryptedReceiptObj = null;

                  if (call.section === 'utility' && call.method === 'batchAll') {
                    const calls = (call.args[0] as any).toArray();
                    for (const c of calls) {
                      if (c.section === 'balances' && c.method === 'transferKeepAlive') {
                        recipient = c.args[0].toString();
                        amount = (Number(c.args[1]) / 1e10).toString();
                      }
                      if (c.section === 'system' && c.method === 'remark') {
                        const remarkHex = c.args[0].toHex ? c.args[0].toHex() : c.args[0].toString();
                        try {
                          remark = api.createType('Bytes', remarkHex).toUtf8();
                        } catch {
                          remark = remarkHex;
                        }
                        // Check for encrypted_receipt in remark
                        if (remark && remark.includes('encrypted_receipt')) {
                          try {
                            const currentAddress = await AsyncStorage.getItem('currentAccount');
                            const mnemonic = await getSecureValue(`mnemonic_${currentAddress}`);
                            if (mnemonic) {
                              const receiptObj = JSON.parse(remark);
                              const decrypted = decryptReceiptWithMnemonic(receiptObj.encrypted_receipt_info || receiptObj, mnemonic, currentAddress!);
                              if (decrypted && decrypted.receipt.merchant?.name) {
                                businessName = decrypted.receipt.merchant.name;
                                decryptedReceiptObj = decrypted.receipt;
                              }
                            }
                          } catch (e) {
                            console.error('[QR] Error decrypting receipt:', e);
                          }
                        }
                      }
                    }
                  }
                  setAmount(amount);
                  setRemark(remark);
                  if (businessName && recipient) {
                    setRecipient(businessName);
                    setRecipientAddress(recipient);
                    setDecryptedReceipt(decryptedReceiptObj);
                  } else if (recipient) {
                    setRecipient(displayAddress(recipient));
                    setRecipientAddress(recipient);
                    setDecryptedReceipt(null);
                  } else {
                    setRecipient('');
                    setRecipientAddress('');
                    setDecryptedReceipt(null);
                  }
                } catch (e) {
                  console.error('[QR] Error parsing QR data:', e);
                  // If parsing as call fails, try as JSON
                  try {
                    const parsedData = JSON.parse(data);
                    if (parsedData.sr25519) {
                      setRecipientAddress(parsedData.sr25519);
                      setRecipient(displayAddress(parsedData.sr25519));
                    }
                  } catch (e) {
                    console.error('[QR] Error parsing QR data as JSON:', e);
                    // If all else fails, treat as address
                    setRecipientAddress(data);
                    setRecipient(displayAddress(data));
                  }
                }
              } else {
                // Handle non-hex data
                try {
                  const parsedData = JSON.parse(data);
                  if (parsedData.sr25519) {
                    setRecipientAddress(parsedData.sr25519);
                    setRecipient(displayAddress(parsedData.sr25519));
                  }
                } catch (e) {
                  console.error('[QR] Error parsing QR data as JSON:', e);
                  // If all else fails, treat as address
                  setRecipientAddress(data);
                  setRecipient(displayAddress(data));
                }
              }
            } catch (e) {
              console.error('[QR] Error processing QR data:', e);
              setRecipientAddress(data);
              setRecipient(displayAddress(data));
            } finally {
              setDecrypting(false);
            }
          }}
          onClose={() => setShowScanner(false)}
        />
        <View style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          justifyContent: 'center',
          alignItems: 'center',
          pointerEvents: 'none',
        }}>
          <View style={{ width: 250, height: 250, borderWidth: 2, borderColor: '#000000', borderRadius: 12 }} />
        </View>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#ffd6cc', '#ffb199', '#d16ba5']}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={{ flex: 1 }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.modalBackdrop}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContent}>
              <View style={styles.headerContainer}>
                <Text style={styles.header}>Send Funds</Text>
                <TouchableOpacity onPress={navigation.goBack}>
                  <Feather name="x" size={24} color="#D7263D" />
                </TouchableOpacity>
              </View>
              
              <Text style={styles.label}>RECIPIENT</Text>
              <View style={styles.inputContainer}>
                {decrypting ? (
                  <View style={[styles.input, { flex: 1, flexDirection: 'row', alignItems: 'center', height: 56, marginBottom: 0 }]}> 
                    <ActivityIndicator size="small" color="#D7263D" style={{ marginRight: 8 }} />
                    <Text style={{ color: '#888', fontSize: 16 }}>Loading...</Text>
                  </View>
                ) : (
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Address"
                    placeholderTextColor="#ccc"
                    value={(() => {
                      // For returns, show the recipient address
                      if (decryptedReceipt && decryptedReceipt.returns && decryptedReceipt.returns.total_returns > 0) {
                        return displayAddress(recipientAddress);
                      }
                      // For regular transactions, show merchant name if available
                      if (decryptedReceipt && decryptedReceipt.merchant && decryptedReceipt.merchant.name) {
                        return decryptedReceipt.merchant.name;
                      }
                      return displayAddress(recipientAddress);
                    })()}
                    onChangeText={(text) => {
                      setRecipient(text);
                      validateAddress(text);
                    }}
                    editable={false}
                  />
                )}
                {!decrypting && (
                  <TouchableOpacity 
                    style={styles.scanButton}
                    onPress={() => setShowScanner(true)}
                  >
                    <Feather name="camera" size={24} color="#D7263D" />
                  </TouchableOpacity>
                )}
                {!decrypting && (
                  <TouchableOpacity
                    style={{ position: 'absolute', right: 48, top: 14 }}
                    onPress={async () => {
                      const clipboardContent = await Clipboard.getStringAsync();
                      setRecipient(clipboardContent);
                      setRecipientAddress(clipboardContent);
                      validateAddress(clipboardContent);
                    }}
                  >
                    <Feather name="clipboard" size={24} color="#D7263D" />
                  </TouchableOpacity>
                )}
              </View>
              {addressError ? <Text style={styles.errorText}>{addressError}</Text> : null}

              <Text style={styles.label}>AMOUNT</Text>
              <View style={styles.inputRow}>
                <Text style={{ color: '#888', fontSize: 16 }}>$</Text>
                {decrypting ? (
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', height: 56 }}>
                    <ActivityIndicator size="small" color="#D7263D" style={{ marginLeft: 10 }} />
                    <Text style={{ color: '#888', fontSize: 16, marginLeft: 8 }}>Loading...</Text>
                  </View>
                ) : (
                  <TextInput
                    style={[
                      styles.input,
                      { flex: 1, backgroundColor: 'transparent', marginBottom: 0, paddingLeft: 10 }
                    ]}
                    placeholder="0.00"
                    placeholderTextColor="#ccc"
                    value={amount}
                    onChangeText={(text) => {
                      setAmount(text.replace(/[^0-9.]/g, ''));
                    }}
                    keyboardType="decimal-pad"
                  />
                )}
              </View>
              {amountError === 'over_balance' ? <Text style={styles.errorText}>Please send a lower amount.</Text> : amountError ? <Text style={styles.errorText}>{amountError}</Text> : null}

              <Text style={styles.label}>NOTE</Text>
              <View style={[styles.inputBox, { minHeight: 56, padding: 0, alignItems: 'stretch' }]}> 
                {decrypting ? (
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', height: 56 }}>
                    <ActivityIndicator size="small" color="#D7263D" style={{ marginLeft: 10 }} />
                    <Text style={{ color: '#888', fontSize: 16, marginLeft: 8 }}>Loading...</Text>
                  </View>
                ) : remark && remark.includes('encrypted_receipt') ? (
                  <TouchableOpacity
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 56 }}
                    onPress={handleShowReceipt}
                  >
                    <Feather name="file-text" size={20} color="#D7263D" style={{ marginRight: 8 }} />
                    <Text style={{ color: '#D7263D', fontWeight: 'bold', fontSize: 16 }}>Show Receipt</Text>
                    <Feather name="arrow-right" size={18} color="#D7263D" style={{ marginLeft: 8 }} />
                  </TouchableOpacity>
                ) : (
                  <TextInput
                    style={[styles.input, { height: 56, marginBottom: 0 }]}
                    placeholder="Add a note"
                    placeholderTextColor="#ccc"
                    value={remark}
                    onChangeText={(text) => {
                      setRemark(text);
                    }}
                  />
                )}
              </View>

              <TouchableOpacity
                style={[styles.sendButton, (!recipient || !amount || addressError || amountError) ? { opacity: 0.5 } : null]}
                onPress={onSend}
                disabled={!recipient || !amount || !!addressError || !!amountError}
              >
                <Text style={styles.sendButtonText}>Send</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>

        {showSuccess && (
          <View style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.6)',
            zIndex: 9999,
          }}>
            <LottieView
              source={confettiAnimation}
              autoPlay
              speed={0.5}
              loop={false}
              style={{ width: 320, height: 320 }}
              onAnimationFinish={() => {
              }}
              onLayout={() => {
              }}
            />
            <Text style={{ fontSize: 32, color: '#4CAF50', fontWeight: 'bold', marginTop: 24 }}>Success!</Text>
          </View>
        )}

        {/* Error Modal */}
        {showError && (
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalContent}>
                <View style={styles.headerContainer}>
                  <Text style={styles.header}>Error</Text>
                  <TouchableOpacity onPress={() => setShowError(false)}>
                    <Feather name="x" size={24} color="#D7263D" />
                  </TouchableOpacity>
                </View>

                <View style={styles.errorIcon}>
                  <Feather name="x-circle" size={48} color="#D7263D" />
                </View>

                <Text style={styles.errorText}>{errorMessage}</Text>

                <TouchableOpacity
                  style={[styles.confirmButton, styles.errorButton]}
                  onPress={() => setShowError(false)}
                >
                  <Text style={styles.sendButtonText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        )}
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#D7263D',
  },
  label: {
    alignSelf: 'flex-start',
    marginLeft: 8,
    marginBottom: 4,
    color: '#888',
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    backgroundColor: '#F3F3F3',
    borderRadius: 6,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
    color: '#222',
  },
  scanButton: {
    position: 'absolute',
    right: 16,
    top: 14,
  },
  sendButton: {
    backgroundColor: '#FF5A4D',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 20,
  },
  confirmText: {
    fontSize: 16,
    color: '#222',
    marginBottom: 20,
    backgroundColor: '#F3F3F3',
    padding: 12,
    borderRadius: 6,
    minHeight: 16,
  },
  confirmButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F3F3',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: 'bold',
    fontSize: 16,
  },
  errorText: {
    color: '#D7263D',
    fontSize: 12,
    marginTop: -16,
    marginBottom: 16,
    marginLeft: 8,
  },
  successIcon: {
    marginVertical: 24,
    alignItems: 'center',
  },
  successText: {
    fontSize: 18,
    color: '#4CAF50',
    textAlign: 'center',
    marginBottom: 24,
  },
  successButton: {
    backgroundColor: '#4CAF50',
  },
  errorIcon: {
    marginVertical: 24,
    alignItems: 'center',
  },
  errorButton: {
    backgroundColor: '#D7263D',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feeLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F3F3',
    padding: 12,
    borderRadius: 6,
    marginBottom: 20,
  },
  feeLoadingText: {
    marginLeft: 8,
    color: '#888',
    fontSize: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F3F3',
    borderRadius: 6,
    marginBottom: 20,
    paddingLeft: 14,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F3F3',
    borderRadius: 6,
    marginBottom: 20,
  }
}); 