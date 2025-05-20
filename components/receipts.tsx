import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Skeleton } from 'moti/skeleton';
import React, { useEffect, useState } from 'react';
import { Image, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import styles from '../app/styles/index.styles';
import { parseRemark } from '../services/utils/remarkUtils';
import { fetchAllTransfers, getCurrentAccountCurve25519SecretKey, TxHistoryItem } from './txHistory';

export default function Receipts() {
  const [receipts, setReceipts] = useState<TxHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [currentAccount, setCurrentAccount] = useState<string | null>(null);
  const router = useRouter();

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const address = await AsyncStorage.getItem('currentAccount');
      setCurrentAccount(address);
      if (!address) return;
      const userSecretKey = await getCurrentAccountCurve25519SecretKey();
      const txs = await fetchAllTransfers(address, [], 50, 0, userSecretKey);
      const onlyReceipts = txs.filter(tx => {
        // Try to decode hex remarks if present
        let decodedRemark = null;
        if (tx.remark && tx.remark.startsWith('0x')) {
          try {
            const cleanRemark = tx.remark.slice(2); // Remove '0x' prefix
            decodedRemark = parseRemark(cleanRemark);
          } catch (err) {
            console.error('Error decoding hex remark:', err);
          }
        }

        // Include transactions that have either:
        // 1. A decrypted receipt with merchant name (regular receipts)
        // 2. A decrypted receipt with returns data (return transactions)
        // 3. The isReturn flag is true
        // 4. A decoded remark indicating it's a return transaction
        return tx.decrypted_receipt && (
          (tx.decrypted_receipt.merchant && tx.decrypted_receipt.merchant.name) || // Regular receipts
          (tx.decrypted_receipt.returns && tx.decrypted_receipt.returns.total_returns > 0) || // Return transactions with returns data
          tx.isReturn ||
          (decodedRemark && typeof decodedRemark === 'object' && decodedRemark !== null && (decodedRemark as any).status === 'returned')
        );
      });
      setReceipts(onlyReceipts);
    } catch (err) {
      setReceipts([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReceipts();
  }, []);

  const filteredReceipts = receipts.filter(r => {
    const searchLower = search.toLowerCase();
    const businessName = r.decrypted_receipt?.merchant?.name?.toLowerCase() || '';
    const date = r.date.toLowerCase();
    const amount = r.amount.toLowerCase();
    const items = Array.isArray(r.decrypted_receipt?.items) ? r.decrypted_receipt.items : [];
    const itemNames = items.map((item: any) => (item.name || '').toLowerCase()).join(' ');
    return (
      businessName.includes(searchLower) ||
      date.includes(searchLower) ||
      amount.includes(searchLower) ||
      itemNames.includes(searchLower)
    );
  });

  return (
    <LinearGradient
      colors={['#ffd6cc', '#ffb199', '#d16ba5']}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1 }}>
        {/* Search Bar */}
        <View style={{ marginHorizontal: 16, marginTop: 40, marginBottom: 8 }}>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search receipts..."
            placeholderTextColor="#888"
            clearButtonMode="while-editing"
          />
        </View>
        {/* Receipts List */}
        <View style={{ flex: 1, marginBottom: 80 }}>
          <ScrollView
            style={{ flex: 1, marginHorizontal: 16 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={async () => {
                  setRefreshing(true);
                  await fetchReceipts();
                  setRefreshing(false);
                }}
              />
            }
          >
            {loading ? (
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
            ) : filteredReceipts.length === 0 ? (
              <View style={[styles.txBox, { alignItems: 'center', justifyContent: 'center' }]}> 
                <Text style={{ color: '#888' }}>Your receipts will appear here</Text>
              </View>
            ) : (
              filteredReceipts.map(receipt => {
                const businessName = receipt.decrypted_receipt?.merchant?.name || '';
                const logoUrl = receipt.decrypted_receipt?.merchant?.logoUrl || null;
                const receiptData = {
                  decryptedReceipt: JSON.stringify(receipt.decrypted_receipt || {}),
                  txInfo: JSON.stringify({
                    date: receipt.date || '',
                    txHash: receipt.id || '',
                    blockHash: receipt.blockHash || '',
                  }),
                  remark: JSON.stringify(receipt.remark || '')
                };
                return (
                  <TouchableOpacity
                    key={receipt.id}
                    onPress={() => router.push({
                      pathname: '/receipt-detail',
                      params: receiptData
                    })}
                  >
                    <View style={[styles.txBox, receipt.amount.includes('-') ? styles.txSend : styles.txReceive]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        {logoUrl ? (
                          <Image source={{ uri: logoUrl }} style={{ width: 28, height: 28, borderRadius: 14 }} />
                        ) : (
                          <Feather name="file-text" size={20} color="#D7263D" />
                        )}
                        <Text style={{ marginLeft: 8, fontWeight: 'bold' }}>{businessName}</Text>
                      </View>
                      <Text style={{ color: '#888', fontSize: 12 }}>{receipt.date}</Text>
                      <Text style={{ position: 'absolute', right: 16, top: 16, fontWeight: 'bold', color: (typeof receipt.amount === 'string' && receipt.amount.includes('-')) ? '#D7263D' : '#4CAF50' }}>
                        {receipt.amount}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </LinearGradient>
  );
} 