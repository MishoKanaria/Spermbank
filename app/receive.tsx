import { Feather } from '@expo/vector-icons';
import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { getSecureValue } from '../services/storage/secureStorage';
import { cacheAddresses, getCachedAddress } from '../services/utils/addressCache';

interface ReceiveParams {
  account: string;
}

export default function ReceiveScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: ReceiveParams }, 'params'>>();
  const { account } = route.params || {};
  const isMounted = useRef(true);
  const [copied, setCopied] = useState(false);
  const [sr25519Address, setSr25519Address] = useState('');
  const [ed25519Address, setEd25519Address] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      let sr = await getCachedAddress('sr25519', account);

      // If not cached, get mnemonic and cache them
      if (!sr && account) {
        const mnemonic = await getSecureValue(`mnemonic_${account}`);
        if (mnemonic) {
          await cacheAddresses(mnemonic, account);
          sr = await getCachedAddress('sr25519', account);
        }
      }

      if (mounted) {
        let ed = await getCachedAddress('ed25519', account);
        setEd25519Address(ed || '');
        let srAddr = '';
        try {
          if (sr) {
            // Decode and re-encode with prefix 0 (Polkadot)
            const pubkey = decodeAddress(sr);
            srAddr = encodeAddress(pubkey, 0);
          }
        } catch (e) {
          srAddr = '';
        }
        setSr25519Address(srAddr);
      }
    })();
    return () => { mounted = false; };
  }, [account]);

  const qrValue = JSON.stringify({
    sr25519: sr25519Address,
    ed25519: ed25519Address
  });

  const isLoading = !sr25519Address || !ed25519Address;

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
                <View style={styles.titleContainer}>
                  <Text style={styles.header}>Address</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                  <Feather name="x" size={24} color="#D7263D" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onLongPress={async () => {
                  await Clipboard.setStringAsync(qrValue);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                delayLongPress={500}
                style={styles.qrContainer}
              >
                {isLoading ? (
                  <ActivityIndicator size="large" color="#D7263D" />
                ) : (
                  <QRCode value={qrValue} size={250} />
                )}
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
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
    minHeight: 390,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#D7263D',
  },
  qrContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyText: {
    position: 'absolute',
    bottom: 20,
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: 'bold',
  }
}); 