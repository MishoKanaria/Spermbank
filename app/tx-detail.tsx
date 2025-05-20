import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RouteProp, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { parseRemark } from '../services/utils/remarkUtils';

interface TxDetailParams {
  tx: {
    id: string;
    type: 'send' | 'receive';
    name: string;
    date: string;
    amount: string;
    counterparty: string;
    remark?: string;
    // Optionally add imageUri if you want to pass it
    imageUri?: string | null;
    decrypted_receipt?: {
      merchant?: {
        name: string;
        logoUrl?: string;
      };
    };
    blockHash?: string;
    isReturn: boolean;
    encrypted_receipt_info?: {
      merchant?: {
        name: string;
        logoUrl?: string;
      };
    };
  };
  contacts: { name: string; address: string }[];
  profileImage?: string | null;
  currentAccount?: string;
}

// Helper to format address for wrapping
function formatAddressWrap(addr: string) {
  if (!addr || addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...\n...${addr.slice(-6)}`;
}

export default function TxDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: TxDetailParams }, 'params'>>();
  const { tx, contacts, profileImage, currentAccount } = route.params;

  const isFocused = useIsFocused();
  const [contactsState, setContactsState] = React.useState(contacts);
  const [contactImage, setContactImage] = React.useState<string | null>(tx.imageUri || null);
  const [accountType, setAccountType] = React.useState<string | null>(null);
  const [accountName, setAccountName] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadContacts = async () => {
      if (currentAccount) {
        const data = await AsyncStorage.getItem(`contacts_${currentAccount}`);
        if (data) setContactsState(JSON.parse(data));
      }
    };
    if (isFocused) {
      loadContacts();
    }
  }, [isFocused, currentAccount]);

  React.useEffect(() => {
    const loadImage = async () => {
      if (currentAccount && tx.counterparty) {
        const uri = await AsyncStorage.getItem(`contactImage_${currentAccount}_${tx.counterparty}`);
        setContactImage(uri);
      }
    };
    loadImage();
  }, [isFocused, currentAccount, tx.counterparty, contactsState]);

  React.useEffect(() => {
    const loadAccountInfo = async () => {
      if (currentAccount) {
        const accountsStr = await AsyncStorage.getItem('accounts');
        if (accountsStr) {
          const accounts = JSON.parse(accountsStr);
          const currentAccountObj = accounts.find((acc: any) => acc.wallet.address === currentAccount);
          if (currentAccountObj) {
            setAccountType(currentAccountObj.accountType);
            setAccountName(currentAccountObj.name);
          }
        }
      }
    };
    loadAccountInfo();
  }, [currentAccount]);

  const contact = contactsState.find(c => c.address === tx.counterparty);
  const addressShort = formatAddressWrap(tx.counterparty);
  const isSend = tx.type === 'send';

  // Always check for merchant information first
  let displayName = contact?.name || tx.name || '';
  let displayImage: string | null = contactImage;
  let merchantName: string | null = null;

  if (
    accountType === 'business' &&
    tx.decrypted_receipt?.merchant?.name === accountName
  ) {
    // Business account viewing its own transaction: show address and default logo
    displayName = addressShort;
    displayImage = null;
    merchantName = null;
  } else if (tx.decrypted_receipt?.merchant?.name) {
    // Buyer or other: show merchant branding
    displayName = tx.decrypted_receipt.merchant.name;
    displayImage = tx.decrypted_receipt.merchant.logoUrl || null;
    merchantName = tx.decrypted_receipt.merchant.name;
  } else if (tx.isReturn) {
    // Fallback for returns with no merchant info
    displayName = addressShort;
    displayImage = null;
    merchantName = null;
  } else if (contact) {
    displayName = contact.name;
    displayImage = contactImage;
  }

  // Determine counterparty display for the right side
  let counterpartyDisplay = '';
  if (isSend) {
    counterpartyDisplay = merchantName || (contact ? contact.name : addressShort);
  } else {
    counterpartyDisplay = merchantName || (contact ? contact.name : addressShort);
  }

  // Determine arrow direction
  let arrowDirection: 'arrow-right' | 'arrow-left' = isSend ? 'arrow-right' : 'arrow-left';

  const hasReceipt =
    (tx.decrypted_receipt && typeof tx.decrypted_receipt === 'object' && tx.decrypted_receipt !== null && 'encrypted_receipt' in tx.decrypted_receipt) ||
    (tx.encrypted_receipt_info && typeof tx.encrypted_receipt_info === 'object' && tx.encrypted_receipt_info !== null && 'encrypted_receipt' in tx.encrypted_receipt_info) ||
    (tx.remark && (() => {
      const parsed = parseRemark(tx.remark);
      return typeof parsed === 'object' && parsed !== null && 'encrypted_receipt' in parsed;
    })());

  return (
    <LinearGradient
      colors={['#ffd6cc', '#ffb199', '#d16ba5']}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={{ flex: 1 }}
    >
      <View style={styles.backdrop}>
        <View style={styles.content}>
          <View style={[styles.headerRow, { marginBottom: 24 }]}> 
            <Text style={styles.header}>Transaction Details</Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Feather name="x" size={24} color="#D7263D" />
            </TouchableOpacity>
          </View>
          {/* Counterparty image and name */}
          <TouchableOpacity
            style={{ alignItems: 'center', marginBottom: 16 }}
            onPress={() => {
              (navigation.navigate as any)('send', {
                selectedAddress: tx.counterparty,
                contacts,
                currentAccount,
              });
            }}
          >
            {displayImage ? (
              <Image source={{ uri: displayImage }} style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 8 }} />
            ) : (
              <Feather name="user" size={64} color="#D7263D" style={{ marginBottom: 8 }} />
            )}
            <Text style={{ fontWeight: 'bold', fontSize: 18 }}>
              {displayName}
            </Text>
            {/* Add to Contacts button if not already in contacts */}
            {!contact && (
              <TouchableOpacity
                style={{ marginTop: 8, backgroundColor: '#FF5A4D', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 20 }}
                onPress={() => (navigation.navigate as any)('add-contact', {
                  address: tx.counterparty,
                  name: '',
                  currentAccount,
                })}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Add to Contacts</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
          {/* Name/Account Row with Arrow */}
          <View style={styles.accountRow}>
            {/* Left side */}
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.accountText}>
                {'You'}
              </Text>
            </View>
            <Feather
              name={arrowDirection}
              size={28}
              color="#D7263D"
              style={{ marginHorizontal: 18 }}
            />
            {/* Right side */}
            <View style={{ flex: 1, alignItems: 'flex-start' }}>
              <Text style={[styles.accountText, !isSend ? { color: '#D7263D' } : {}]}>
                {counterpartyDisplay}
              </Text>
            </View>
          </View>
          {/* Time Field */}
          <View style={{ width: '100%', marginBottom: 16 }}>
            <Text style={styles.label}>TIME</Text>
            <View style={styles.inputBox}> 
              <Text style={{ fontSize: 16, color: '#222' }}>{tx.date}</Text>
            </View>
          </View>
          {/* Amount Field */}
          <View style={{ width: '100%', marginBottom: 16 }}>
            <Text style={styles.label}>AMOUNT</Text>
            <View style={styles.inputBox}> 
              <Text style={{ fontSize: 18, color: tx.amount.includes('-') ? '#D7263D' : '#4CAF50', fontWeight: 'bold' }}>
                {tx.amount}
              </Text>
            </View>
          </View>
          {/* Notes Field */}
          <View style={{ width: '100%' }}>
            <Text style={styles.label}>NOTES</Text>
            <View style={[styles.inputBox, { padding: 0 }]}> 
              <ScrollView style={{ maxHeight: 100 }} contentContainerStyle={{ padding: 12 }}>
                {hasReceipt ? (
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
                    onPress={() => {
                      (navigation.navigate as any)('receipt-detail', {
                        decryptedReceipt: JSON.stringify(tx.decrypted_receipt || tx.encrypted_receipt_info || {}),
                        txInfo: JSON.stringify({
                          date: tx.date,
                          txHash: tx.id,
                          blockHash: tx.blockHash || '',
                        }),
                      });
                    }}
                  >
                    <Feather name="file-text" size={20} color="#D7263D" style={{ marginRight: 8 }} />
                    <Text style={{ color: '#D7263D', fontWeight: 'bold', fontSize: 16 }}>Show Receipt</Text>
                    <Feather name="arrow-right" size={18} color="#D7263D" style={{ marginLeft: 8 }} />
                  </TouchableOpacity>
                ) : (
                  <Text style={{ color: '#888' }}>
                    {tx.remark ? (
                      (() => {
                        const parsed = parseRemark(tx.remark);
                        if (typeof parsed === 'string') {
                          return parsed;
                        } else if (typeof parsed === 'object' && parsed) {
                          return JSON.stringify(parsed, null, 2);
                        } else {
                          return tx.remark;
                        }
                      })()
                    ) : 'No notes.'}
                  </Text>
                )}
              </ScrollView>
            </View>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  header: {
    fontWeight: 'bold',
    fontSize: 24,
    color: '#D7263D',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F3F3',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    width: '100%',
  },
  accountText: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#222',
    minWidth: 80,
    textAlign: 'center',
    flexWrap: 'wrap',
    maxWidth: 120,
  },
  label: {
    fontWeight: 'bold',
    color: '#D7263D',
    marginBottom: 4,
    letterSpacing: 2,
  },
  inputBox: {
    backgroundColor: '#F3F3F3',
    borderRadius: 6,
    padding: 12,
    minHeight: 16,
  },
}); 