import { Feather } from '@expo/vector-icons';
import { Keyring } from '@polkadot/keyring';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import confettiAnimation from '../assets/animations/confetti.json';
import { getSecureValue } from '../services/storage/secureStorage';
import { useApi } from './contexts/ApiContext';

const displayAddress = (address: string) =>
  address.length > 16 ? `${address.slice(0, 8)}...${address.slice(-8)}` : address;

type ConfirmTransactionParams = {
  recipient: string;
  amount: string;
  remark?: string;
  fee: string;
  contacts: { name: string; address: string }[];
  currentAccount?: string;
  displayRecipient: string;
  decryptedReceipt: any;
};

type RootStackParamList = {
  index: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ConfirmTransactionScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp<{ params: ConfirmTransactionParams }, 'params'>>();
  const { recipient, amount, remark, fee: initialFee, contacts = [], currentAccount, displayRecipient, decryptedReceipt } = route.params;
  const { api, isApiReady } = useApi();
  const [isSending, setIsSending] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fee, setFee] = useState<string>('');
  const [isCalculatingFee, setIsCalculatingFee] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const calculateFee = async () => {
      if (!recipient || !api || !isApiReady) return;
      try {
        setIsCalculatingFee(true);
        const currentAddress = await AsyncStorage.getItem('currentAccount');
        const accountsStr = await AsyncStorage.getItem('accounts');
        if (!currentAddress || !accountsStr) return;
        const accounts = JSON.parse(accountsStr);
        const currentAccountObj = accounts.find((acc: any) => acc.wallet.address === currentAddress);
        if (!currentAccountObj) return;
        const wallet = currentAccountObj.wallet;
        const keyring = new Keyring({ type: 'sr25519' });
        const mnemonic = await getSecureValue(`mnemonic_${wallet.address}`);
        if (!mnemonic) throw new Error('Mnemonic not found in secure storage');
        const keypair = keyring.addFromUri(mnemonic);
        const amountInPlank = BigInt(Math.floor(Number(amount) * 1e10));
        let tx;
        if (remark && remark.trim()) {
          tx = api.tx.utility.batchAll([
            api.tx.balances.transferKeepAlive(recipient, amountInPlank),
            api.tx.system.remark(remark.trim())
          ]);
        } else {
          tx = api.tx.balances.transferKeepAlive(recipient, amountInPlank);
        }
        const paymentInfo = await tx.paymentInfo(keypair);
        if (cancelled) return;
        const feeInPAS = Number(paymentInfo.partialFee.toString()) / 1e10;
        setFee(feeInPAS.toFixed(4));
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : 'Failed to calculate fee');
        setShowError(true);
      } finally {
        if (cancelled) return;
        setIsCalculatingFee(false);
      }
    };
    calculateFee();
    return () => {
      cancelled = true;
    };
  }, [recipient, amount, remark, api, isApiReady]);

  const confirmSend = async () => {
    if (!api || !isApiReady) return;
    try {
      setIsSending(true);
      const currentAddress = await AsyncStorage.getItem('currentAccount');
      const accountsStr = await AsyncStorage.getItem('accounts');
      if (!currentAddress || !accountsStr) return;
      const accounts = JSON.parse(accountsStr);
      const currentAccountObj = accounts.find((acc: any) => acc.wallet.address === currentAddress);
      if (!currentAccountObj) return;
      const wallet = currentAccountObj.wallet;
      const keyring = new Keyring({ type: 'sr25519' });
      const mnemonic = await getSecureValue(`mnemonic_${wallet.address}`);
      if (!mnemonic) throw new Error('Mnemonic not found in secure storage');
      const keypair = keyring.addFromUri(mnemonic);
      const amountInPlank = BigInt(Math.floor(Number(amount) * 1e10));
      let tx;
      if (remark && remark.trim()) {
        tx = api.tx.utility.batchAll([
          api.tx.balances.transferKeepAlive(recipient, amountInPlank),
          api.tx.system.remark(remark.trim())
        ]);
      } else {
        tx = api.tx.balances.transferKeepAlive(recipient, amountInPlank);
      }
      const result = await tx.signAndSend(keypair);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        router.replace('/(tabs)');
      }, 2000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Transaction failed');
      setShowError(true);
    } finally {
      setIsSending(false);
    }
  };

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
                <Text style={styles.header}>Confirm Transaction</Text>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                  <Feather name="x" size={24} color="#D7263D" />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>RECIPIENT</Text>
              {decryptedReceipt && decryptedReceipt.returns && decryptedReceipt.returns.total_returns > 0 ? (
                <Text style={styles.confirmText}>{displayAddress(recipient)}</Text>
              ) : (
                decryptedReceipt && decryptedReceipt.merchant && decryptedReceipt.merchant.name && decryptedReceipt.merchant.name !== (currentAccount || '') ? (
                  <Text style={styles.confirmText}>{decryptedReceipt.merchant.name}</Text>
                ) : (
                  !displayRecipient ? (
                    <View style={{ backgroundColor: '#F3F3F3', borderRadius: 6, marginBottom: 20, minHeight: 56, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14 }}>
                      <ActivityIndicator size="small" color="#D7263D" />
                    </View>
                  ) : (
                    <Text style={styles.confirmText}>{displayAddress(recipient)}</Text>
                  )
                )
              )}

              <Text style={styles.label}>AMOUNT</Text>
              <Text style={styles.confirmText}>{amount}</Text>

              <Text style={styles.label}>Note</Text>
              {remark && remark.includes('encrypted_receipt') && decryptedReceipt ? (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 14,
                    height: 56,
                    backgroundColor: '#F3F3F3',
                    borderRadius: 6,
                    marginBottom: 20,
                  }}
                  onPress={() =>
                    (navigation as any).navigate('receipt-detail', {
                      decryptedReceipt: JSON.stringify(decryptedReceipt),
                      txInfo: JSON.stringify({}),
                    })
                  }
                >
                  <Feather name="file-text" size={20} color="#D7263D" style={{ marginRight: 8 }} />
                  <Text style={{ color: '#D7263D', fontWeight: 'bold', fontSize: 16 }}>Show Receipt</Text>
                  <Feather name="arrow-right" size={18} color="#D7263D" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              ) : (
                <View
                  style={{
                    backgroundColor: '#F3F3F3',
                    borderRadius: 6,
                    marginBottom: 20,
                    minHeight: 56,
                    justifyContent: 'center',
                    paddingHorizontal: 14,
                  }}
                >
                  <Text style={styles.confirmText}>{remark && remark.trim() ? remark : 'No note'}</Text>
                </View>
              )}

              <Text style={styles.label}>TRANSACTION FEE</Text>
              {isCalculatingFee ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F3F3', padding: 12, borderRadius: 6, marginBottom: 20 }}>
                  <ActivityIndicator size="small" color="#D7263D" />
                  <Text style={{ marginLeft: 8, color: '#888', fontSize: 16 }}>Calculating fee...</Text>
                </View>
              ) : (
                <Text style={styles.confirmText}>${fee}</Text>
              )}

              <View style={styles.confirmButtons}>
                <TouchableOpacity
                  style={[styles.confirmButton, styles.cancelButton]}
                  onPress={() => navigation.goBack()}
                  disabled={isSending}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmButton, styles.sendButton, (isSending || isCalculatingFee) && { opacity: 0.5 }]}
                  onPress={confirmSend}
                  disabled={isSending || isCalculatingFee}
                >
                  {isSending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendButtonText}>Send</Text>}
                </TouchableOpacity>
              </View>
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
            />
            <Text style={{ fontSize: 32, color: '#4CAF50', fontWeight: 'bold', marginTop: 24 }}>Success!</Text>
          </View>
        )}
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
  sendButton: {
    backgroundColor: '#FF5A4D',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  errorIcon: {
    marginVertical: 24,
    alignItems: 'center',
  },
  errorButton: {
    backgroundColor: '#D7263D',
  },
  errorText: {
    color: '#D7263D',
    fontSize: 12,
    marginTop: -16,
    marginBottom: 16,
    marginLeft: 8,
  },
}); 