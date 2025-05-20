import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Buffer } from 'buffer';
import { Camera } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import isEqual from 'lodash.isequal';
import { Skeleton } from 'moti/skeleton';
import React, { useEffect, useRef, useState } from 'react';
import { Image, Modal, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { buildMostRecentReceiptMap, fetchAllTransfers, getCurrentAccountCurve25519SecretKey, TxHistoryItem } from '../../components/txHistory';
import { getMerchantInfo, MerchantInfo } from '../../components/utils/merchant';
import { useApi } from '../contexts/ApiContext';
import styles from '../styles/index.styles';

interface Account {
  accountType: 'personal' | 'business';
  name: string;
  password: string;
  wallet: {
    address: string;
    publicKey: string;
  };
}

global.Buffer = Buffer;

export default function Home() {
  const { api, isApiReady } = useApi();
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profileModal, setProfileModal] = useState(false);
  const [sendModal, setSendModal] = useState(false);
  const [search, setSearch] = useState('');
  const [searchModal, setSearchModal] = useState(false);
  const [name, setName] = useState('');
  const [balance, setBalance] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmClearModal, setConfirmClearModal] = useState(false);
  const [contacts, setContacts] = useState<{ name: string; address: string }[]>([]);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [txHistory, setTxHistory] = useState<TxHistoryItem[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<TxHistoryItem | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [currentAccount, setCurrentAccount] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [currentAccountObj, setCurrentAccountObj] = useState<Account | null>(null);
  const [merchantInfo, setMerchantInfo] = useState<MerchantInfo | null>(null);
  const [merchantInfoLoading, setMerchantInfoLoading] = useState(false);
  const [merchantInfoError, setMerchantInfoError] = useState<string | null>(null);
  const [editingMerchantInfo, setEditingMerchantInfo] = useState<MerchantInfo | null>(null);
  const [pendingLogoUrl, setPendingLogoUrl] = useState<string | null>(null);
  const [pendingLogoLocalUri, setPendingLogoLocalUri] = useState<string | null>(null);
  const [showContactsPicker, setShowContactsPicker] = useState(false);
  const [mostRecentMap, setMostRecentMap] = useState<Map<string, any>>(new Map());
  const IMGBB_API_KEY = '9123477e18b5e1545824a288db4ba20b';
  const navigation = useNavigation();
  const prevWalletRef = useRef<string | undefined>(undefined);
  const prevContactsRef = useRef<typeof contacts>(contacts);

  // Fetch transaction history and update cache
  const fetchAndSetTxHistory = async (address: string, contacts: { name: string; address: string }[] = []) => {
    setTxLoading(true);
    setTxError(null);
    try {
      const userSecretKey = await getCurrentAccountCurve25519SecretKey();
      const txs = await fetchAllTransfers(address, contacts || [], 20, 0, userSecretKey);
      
      setTxHistory(txs);
      
      // Build and store the most recent receipt map
      const map = buildMostRecentReceiptMap(txs);
      
      setMostRecentMap(map);
      
      // Store both tx history and most recent map
      await AsyncStorage.setItem(`txHistory_${address}`, JSON.stringify(txs));
      await AsyncStorage.setItem(`mostRecentMap_${address}`, JSON.stringify(Array.from(map.entries())));
      
      setTxLoading(false);
    } catch (err) {
      console.error('Error in fetchAndSetTxHistory:', err);
      setTxError('An error occurred while fetching transactions.');
      setTxLoading(false);
    }
  };

  // useEffect for initial load
  useEffect(() => {
    setLoading(true);
    (async () => {
      // Only load account/profile info for main loading
      const currentAddress = await AsyncStorage.getItem('currentAccount');
      const accountsStr = await AsyncStorage.getItem('accounts');
      if (!currentAddress || !accountsStr) {
        router.replace('/create-account');
        return;
      }
      const accounts = JSON.parse(accountsStr);
      const currentAccount = accounts.find((acc: Account) => acc.wallet.address === currentAddress);
      if (!currentAccount) {
        router.replace('/create-account');
        return;
      }
      setWallet(currentAccount.wallet);
      setName(currentAccount.name);
      setCurrentAccountObj(currentAccount);
      setLoading(false); // Page is ready, show UI
      // Now fetch tx history in background (will show txLoading spinner in tx section)
      fetchAndSetTxHistory(currentAddress, contacts || []);
    })();
  }, []);

  // Load contacts from AsyncStorage
  useFocusEffect(
    React.useCallback(() => {
      if (currentAccount) {
        AsyncStorage.getItem(`contacts_${currentAccount}`).then(data => {
          if (data) setContacts(JSON.parse(data));
          else setContacts([]);
        });
      }
    }, [currentAccount])
  );

  // Load cached tx history on mount and when wallet changes
  useEffect(() => {
    const walletChanged = prevWalletRef.current !== wallet?.address;
    const contactsChanged = !isEqual(prevContactsRef.current, contacts);
    if (wallet && (walletChanged || contactsChanged)) {
      fetchAndSetTxHistory(wallet.address, contacts);
      prevWalletRef.current = wallet?.address;
      prevContactsRef.current = contacts;
    }
  }, [wallet, contacts]);

  // Load current account and profile image from storage
  useEffect(() => {
    AsyncStorage.getItem('currentAccount').then(address => {
      setCurrentAccount(address);
      if (address) {
        AsyncStorage.getItem(`profileImage_${address}`).then(uri => {
          if (uri) setProfileImage(uri);
        });
      }
    });
  }, []);

  // Add focus effect to reload profile image
  useFocusEffect(
    React.useCallback(() => {
      const loadProfileImage = async () => {
        const address = await AsyncStorage.getItem('currentAccount');
        if (address) {
          const uri = await AsyncStorage.getItem(`profileImage_${address}`);
          if (uri) setProfileImage(uri);
        }
      };
      loadProfileImage();
    }, [])
  );

  // Load business merchant info if business account
  useEffect(() => {
    if (currentAccountObj?.accountType === 'business' && currentAccount) {
      setMerchantInfoLoading(true);
      getMerchantInfo(currentAccount)
        .then(info => {
          // If no merchant info, initialize with empty/defaults
          const initialInfo = info || {
            name: currentAccountObj.name,
            logoUrl: '',
            businessId: '',
            address: '',
            signature: '',
          };
          setMerchantInfo(initialInfo);
          setEditingMerchantInfo(initialInfo);
          setMerchantInfoLoading(false);
        })
        .catch(() => {
          setMerchantInfoError('Failed to load merchant info');
          setMerchantInfoLoading(false);
        });
    }
  }, [currentAccountObj, currentAccount, profileModal]);

  // Enhanced filtered transaction history based on search (matches receipts.tsx logic)
  const filteredTxHistory = txHistory.filter(tx => {
    const searchLower = search.toLowerCase();
    // Contact/merchant name
    const displayName = tx.decrypted_receipt?.merchant?.name || tx.name || '';
    const date = tx.date.toLowerCase();
    const amount = tx.amount.toLowerCase();
    // All item names in receipt
    const items = Array.isArray(tx.decrypted_receipt?.items) ? tx.decrypted_receipt.items : [];
    const itemNames = items.map((item: any) => (item.name || '').toLowerCase()).join(' ');
    return (
      displayName.toLowerCase().includes(searchLower) ||
      date.includes(searchLower) ||
      amount.includes(searchLower) ||
      itemNames.includes(searchLower)
    );
  });

  // Helper to get profile image for a given address
  const getProfileImageForAddress = async (address: string): Promise<string | null> => {
    try {
      if (!currentAccount) return null;
      const uri = await AsyncStorage.getItem(`contactImage_${currentAccount}_${address}`);
      if (uri) return uri;
      // REMARK: Placeholder for future REMARK tx image logic
      return null;
    } catch {
      return null;
    }
  };

  // Cache for tx images
  const [txImages, setTxImages] = useState<{ [address: string]: string | null }>({});

  // Preload images for visible txs
  useEffect(() => {
    const preloadImages = async () => {
      const addresses = filteredTxHistory.map(tx => tx.counterparty);
      const uniqueAddresses = Array.from(new Set(addresses));
      const images: { [address: string]: string | null } = {};
      for (const addr of uniqueAddresses) {
        images[addr] = await getProfileImageForAddress(addr);
      }
      setTxImages(images);
    };
    preloadImages();
  }, [txHistory, search]);

  // Subscribe to balance updates via WebSocket
  useEffect(() => {
    if (!wallet?.address || !api || !isApiReady) return;
    let unsubscribe: (() => void) | null = null;
    api.query.system.account(wallet.address, (accountInfo: any) => {
      const free = accountInfo.data.free;
      const pas = Number(free) / 1e10;
      setBalance(pas.toFixed(2));
      AsyncStorage.setItem(`balance_${wallet.address}`, pas.toString());
    }).then((unsub: any) => {
      unsubscribe = unsub;
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [api, isApiReady, wallet?.address]);

  useEffect(() => {
    // Request camera permission early
    Camera.requestCameraPermissionsAsync();
  }, []);

  if (loading) return null;
  if (!wallet) return null;

  return (
    <LinearGradient
      colors={['#ffd6cc', '#ffb199', '#d16ba5']}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1 }}>
        {/* Top row: Profile and Menu */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 30, marginHorizontal: 16 }}>
          <TouchableOpacity onPress={() => navigation.navigate('profile' as never)} style={styles.iconCircle}>
            {currentAccountObj?.accountType === 'business' && merchantInfo?.logoUrl ? (
              <Image source={{ uri: merchantInfo.logoUrl }} style={{ width: 48, height: 48, borderRadius: 24 }} />
            ) : profileImage ? (
              <Image source={{ uri: profileImage }} style={{ width: 48, height: 48, borderRadius: 24 }} />
            ) : (
              <Feather name="user" size={32} color="#D7263D" />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('settings' as never)}>
            <Feather name="menu" size={32} color="#D7263D" />
          </TouchableOpacity>
        </View>

        {/* Name, Token, Balance, Accounts */}
        <View style={{ alignItems: 'center', marginTop: 16 }}>
          <Text style={{ fontWeight: 'bold', fontSize: 18, color: '#fff' }}>{name}</Text>
          {(balance === null || !wallet || !api || !isApiReady) ? (
            <Skeleton width={120} height={32} radius={8} colors={['#ddd', '#eee', '#ddd']} />
          ) : (
            <Text style={{ fontSize: 32, color: '#fff', fontWeight: 'bold', marginVertical: 8 }}>
              {balance === 'Error' ? 'Error' : `$${balance}`}
            </Text>
          )}
          <TouchableOpacity style={[styles.accountsButton, { backgroundColor: '#fff' }]}>
            <Text style={{ color: '#666' }}>
              {currentAccountObj?.accountType === 'business' ? 'Business Account' : 'Personal Account'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 32, marginBottom: 16, gap: 24 }}>
          <TouchableOpacity
            style={styles.actionCircle}
            onPress={() => (navigation.navigate as any)('send', {
              contacts,
              currentAccount,
              selectedAddress
            })}
          >
            <MaterialIcons name="send" size={28} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCircle}
            onPress={() => (navigation.navigate as any)('receive', { account: currentAccount })}
          >
            <Ionicons name="qr-code" size={28} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCircle} onPress={() => (navigation.navigate as any)('contacts', { currentAccount })}>
            <Feather name="users" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={{ marginHorizontal: 16, marginBottom: 8 }}>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search..."
            placeholderTextColor="#888"
            clearButtonMode="while-editing"
          />
        </View>

        {/* Transaction History*/}
        <View style={{ flex: 1, marginBottom: 80 }}>
          <ScrollView
            style={{ flex: 1, marginHorizontal: 16 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  if (wallet?.address) fetchAndSetTxHistory(wallet.address, contacts);
                }}
              />
            }
          >
            {txLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <View key={i} style={[styles.txBox, { opacity: 1, backgroundColor: '#eee' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Skeleton width={28} height={20} radius={10} colors={['#ddd', '#eee', '#ddd']} />
                    <View style={{ marginLeft: 8 }}>
                      <Skeleton width={80} height={12} radius={4} colors={['#ddd', '#eee', '#ddd']} />
                    </View>
                  </View>
                  <View style={{ marginBottom: 8 }}>
                    <Skeleton width={120} height={8} radius={4} colors={['#ddd', '#eee', '#ddd']} />
                  </View>
                  <Skeleton width={60} height={12} radius={4} colors={['#ddd', '#eee', '#ddd']} />
                </View>
              ))
            ) : txError ? (
              <View style={[styles.txBox, { alignItems: 'center', justifyContent: 'center' }]}> 
                <Text style={{ color: '#D7263D', fontWeight: 'bold' }}>{txError}</Text>
              </View>
            ) : filteredTxHistory.length === 0 ? (
              <View style={[styles.txBox, { alignItems: 'center', justifyContent: 'center' }]}> 
                <Text style={{ color: '#888' }}>Your transaction history will appear here</Text>
              </View>
            ) : (
              filteredTxHistory.map(tx => {
                // Transaction display logic: use tx.isReturn for returns
                let displayName = '';
                let displayImage: string | null = null;
                const contact = contacts.find(c => c.address === tx.counterparty);
                const addressShort = tx.counterparty.slice(0, 6) + '...' + tx.counterparty.slice(-6);
                if (tx.decrypted_receipt) {
                  if (tx.isReturn) {
                    displayName = addressShort;
                    displayImage = null;
                  } else {
                    // If business account and merchant name is our name, show counterparty address and no logo
                    if (
                      currentAccountObj?.accountType === 'business' &&
                      tx.decrypted_receipt.merchant?.name === name
                    ) {
                      displayName = addressShort;
                      displayImage = null;
                    } else {
                      displayName = tx.decrypted_receipt.merchant?.name || addressShort;
                      displayImage = tx.decrypted_receipt.merchant?.logoUrl || null;
                    }
                  }
                } else if (contact) {
                  displayName = contact.name;
                  displayImage = txImages[tx.counterparty] || null;
                } else {
                  displayName = addressShort;
                  displayImage = null;
                }
                return (
                  <TouchableOpacity key={tx.id} onPress={() => (navigation.navigate as any)('tx-detail', { tx: { ...tx, imageUri: displayImage }, contacts, profileImage, currentAccount })}>
                    <View style={[styles.txBox, tx.amount.includes('-') ? styles.txSend : styles.txReceive]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        {/* Replace icon with image */}
                        {displayImage ? (
                          <Image source={{ uri: displayImage }} style={{ width: 28, height: 28, borderRadius: 14 }} />
                        ) : (
                          <Feather name="user" size={20} color="#D7263D" />
                        )}
                        <Text style={{ marginLeft: 8, fontWeight: 'bold' }}>{displayName}</Text>
                      </View>
                      <Text style={{ color: '#888', fontSize: 12 }}>{tx.date}</Text>
                      <Text style={{ position: 'absolute', right: 16, top: 16, fontWeight: 'bold', color: (typeof tx.amount === 'string' && tx.amount.includes('-')) ? '#D7263D' : '#4CAF50' }}>
                        {tx.amount}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>

        {/* Clear Data Confirmation Modal */}
        <Modal visible={confirmClearModal} transparent animationType="slide" onRequestClose={() => setConfirmClearModal(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <Text style={{ fontWeight: 'bold', fontSize: 20, marginBottom: 16 }}>Clear All Data</Text>
              <Text style={{ marginBottom: 24, textAlign: 'center' }}>Are you sure you want to clear all data? This action cannot be undone.</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  style={[styles.button, { flex: 1, backgroundColor: '#eee' }]}
                  onPress={() => setConfirmClearModal(false)}
                >
                  <Text style={[styles.buttonText, { color: '#666' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, { flex: 1, backgroundColor: '#D7263D' }]}
                  onPress={async () => {
                    await AsyncStorage.clear();
                    setConfirmClearModal(false);
                    router.replace('/create-account');
                  }}
                >
                  <Text style={styles.buttonText}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </LinearGradient>
  );
}
