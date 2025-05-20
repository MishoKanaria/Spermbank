import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import 'react-native-gesture-handler';

export default function Index() {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkAccount = async () => {
      const accountsStr = await AsyncStorage.getItem('accounts');
      const isLoggedIn = await AsyncStorage.getItem('isLoggedIn');
      setIsLoggedIn(isLoggedIn === 'true');
      setIsLoading(false);
      
      if (!accountsStr || accountsStr === 'null' || accountsStr === '') {
        router.replace('/create-account');
      } else if (isLoggedIn !== 'true') {
        router.replace('/login');
      }
      // else: stay on Home
    };
    checkAccount();
  }, [router]);

  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        await AsyncStorage.removeItem('isLoggedIn');
        setIsLoggedIn(false);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  if (isLoading) {
    return null;
  }

  if (!isLoggedIn) {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/(tabs)" />;
}
