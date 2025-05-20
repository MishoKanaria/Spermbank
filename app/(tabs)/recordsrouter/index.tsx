import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Receipts from '../../../components/receipts';
import Merchant from './merchant';

export default function RecordsRouter() {
  const [accountType, setAccountType] = useState<'personal' | 'business' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAccountType() {
      const currentAddress = await AsyncStorage.getItem('currentAccount');
      const accountsStr = await AsyncStorage.getItem('accounts');
      if (!currentAddress || !accountsStr) {
        setAccountType(null);
        setLoading(false);
        return;
      }
      const accounts = JSON.parse(accountsStr);
      const currentAccount = accounts.find((acc: any) => acc.wallet.address === currentAddress);
      if (!currentAccount) {
        setAccountType(null);
        setLoading(false);
        return;
      }
      setAccountType(currentAccount.accountType);
      setLoading(false);
    }
    fetchAccountType();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#D7263D" />
      </View>
    );
  }
  if (accountType === 'business') return <Merchant />;
  if (accountType === 'personal') return <Receipts />;
  return null;
}

RecordsRouter.options = {
  headerShown: false,
}; 