import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import ApiStatusBar from '../../components/common/ApiStatusBar';
import { ApiProvider } from '../contexts/ApiContext';

import { useColorScheme } from '../../app/styles/useColorScheme';
import { HapticTab } from '../../components/common/HapticTab';
import TabBarBackground from '../../components/common/TabBarBackground';

// Custom center tab button for Home
function CenterTabButton(props: any) {
  const { accessibilityState } = props;
  const focused = accessibilityState?.selected;
  return (
    <View style={{ position: 'absolute', top: -24, left: 0, right: 0, alignItems: 'center', zIndex: 10 }}>
      <View style={{ shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 }}>
        <TouchableOpacity
          {...props}
          style={{ width: 80, height: 80, borderRadius: 50, backgroundColor: '#FF5A4D', justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#fff' }}
          activeOpacity={0.85}
        >
          <Feather name="home" size={38} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [accountType, setAccountType] = useState<'personal' | 'business' | null>(null);

  useEffect(() => {
    const loadAccountType = async () => {
      const currentAddress = await AsyncStorage.getItem('currentAccount');
      const accountsStr = await AsyncStorage.getItem('accounts');
      if (!currentAddress || !accountsStr) return;
      try {
        const accounts = JSON.parse(accountsStr);
        const currentAccount = accounts.find((acc: any) => acc.wallet.address === currentAddress);
        if (currentAccount) setAccountType(currentAccount.accountType);
      } catch {}
    };
    loadAccountType();
  }, []);

  const posOrReceiptsTitle = accountType === 'business' ? 'Store' : 'Receipts';
  const posOrReceiptsIcon = accountType === 'business' ? 'shopping-cart' : 'file-text';

  return (
    <>
      <ApiStatusBar />
      <ApiProvider>
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: '#FF5A4D',
            headerShown: false,
            tabBarButton: HapticTab,
            tabBarBackground: TabBarBackground,
            tabBarStyle: {
              backgroundColor: '#fff',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              height: 100,
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              borderTopWidth: 0,
              shadowColor: '#000',
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 8,
            },
            tabBarLabelStyle: {
              fontWeight: 'bold',
              fontSize: 12,
              marginBottom: 24,
            },
          }}>
          <Tabs.Screen
            name="settings"
            options={{
              title: 'Settings',
              tabBarIcon: ({ color }) => <Feather name="settings" size={24} color={color} />,
            }}
          />
          <Tabs.Screen
            name="index"
            options={{
              title: 'Home',
              tabBarIcon: () => null,
              tabBarButton: (props) => <CenterTabButton {...props} />,
            }}
          />
          <Tabs.Screen
            name="recordsrouter"
            options={{
              title: posOrReceiptsTitle,
              tabBarIcon: ({ color }) => <Feather name={posOrReceiptsIcon} size={24} color={color} />,
            }}
          />
        </Tabs>
      </ApiProvider>
    </>
  );
}
