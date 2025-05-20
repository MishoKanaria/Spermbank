import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { getSecureValue } from '../../services/storage/secureStorage';
import styles from '../styles/index.styles';

type RootStackParamList = {
  contacts: { currentAccount: string };
  profile: undefined;
  'change-password': undefined;
  '/(transactions)/sign-message': undefined;
};

export default function SettingsScreen() {
  const router = useRouter();
  const [currentAccount, setCurrentAccount] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<'personal' | 'business' | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [hasBiometric, setHasBiometric] = useState(false);
  const [showMnemonicModal, setShowMnemonicModal] = useState(false);
  const [password, setPassword] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [versionTaps, setVersionTaps] = useState(0);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const address = await AsyncStorage.getItem('currentAccount');
      setCurrentAccount(address);
      
      // Load account type
      const accountsStr = await AsyncStorage.getItem('accounts');
      if (accountsStr) {
        const accounts = JSON.parse(accountsStr);
        const currentAccount = accounts.find((acc: any) => acc.wallet.address === address);
        if (currentAccount) {
          setAccountType(currentAccount.accountType);
        }
      }

      // Check biometric availability
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setHasBiometric(compatible && enrolled);

      // Load saved preferences
      const biometric = await AsyncStorage.getItem('biometricEnabled');
      const notifications = await AsyncStorage.getItem('notificationsEnabled');
      const darkMode = await AsyncStorage.getItem('darkModeEnabled');
      
      setBiometricEnabled(biometric === 'true');
      setNotificationsEnabled(notifications !== 'false');
      setDarkModeEnabled(darkMode === 'true');
    };

    loadSettings();

    // Cleanup function to reset taps and hide delete button when leaving the page
    return () => {
      setVersionTaps(0);
      setShowDelete(false);
    };
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('isLoggedIn');
    await AsyncStorage.removeItem('currentAccount');
    router.replace('/login');
  };

  const toggleBiometric = async (value: boolean) => {
    if (value && !hasBiometric) {
      Alert.alert(
        'Biometric Not Available',
        'Your device does not support biometric authentication or it is not set up.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (value) {
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to enable biometric login',
          fallbackLabel: 'Use password',
        });

        if (result.success) {
          setBiometricEnabled(true);
          await AsyncStorage.setItem('biometricEnabled', 'true');
        }
      } catch (e) {
        console.error('Biometric authentication error:', e);
        Alert.alert(
          'Authentication Failed',
          'Failed to authenticate. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } else {
      setBiometricEnabled(false);
      await AsyncStorage.setItem('biometricEnabled', 'false');
    }
  };

  const toggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);
    await AsyncStorage.setItem('notificationsEnabled', value.toString());
  };

  const toggleDarkMode = async (value: boolean) => {
    setDarkModeEnabled(value);
    await AsyncStorage.setItem('darkModeEnabled', value.toString());
  };

  const handleShowMnemonic = async () => {
    try {
      // Get current account
      const currentAddress = await AsyncStorage.getItem('currentAccount');
      if (!currentAddress) return;

      // Get accounts
      const accountsStr = await AsyncStorage.getItem('accounts');
      if (!accountsStr) return;

      // Find current account
      const accounts = JSON.parse(accountsStr);
      const currentAccount = accounts.find((acc: any) => acc.wallet.address === currentAddress);
      if (!currentAccount) return;

      // Verify password
      if (password !== currentAccount.password) {
        Alert.alert('Error', 'Incorrect password');
        return;
      }

      // Get mnemonic
      const storedMnemonic = await getSecureValue(`mnemonic_${currentAddress}`);
      if (!storedMnemonic) {
        Alert.alert('Error', 'Mnemonic not found');
        return;
      }

      setMnemonic(storedMnemonic);
    } catch (e) {
      console.error('Error showing mnemonic:', e);
      Alert.alert('Error', 'Failed to retrieve mnemonic');
    }
  };

  const handleVersionPress = () => {
    const newTaps = versionTaps + 1;
    setVersionTaps(newTaps);
    
    if (newTaps >= 5) {
      setShowDelete(true);
      setVersionTaps(0);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete this account? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Get current account
              const currentAddress = await AsyncStorage.getItem('currentAccount');
              if (!currentAddress) return;

              // Get accounts
              const accountsStr = await AsyncStorage.getItem('accounts');
              if (!accountsStr) return;

              // Remove account from list
              const accounts = JSON.parse(accountsStr);
              const updatedAccounts = accounts.filter((acc: any) => acc.wallet.address !== currentAddress);

              // If no accounts left, go to create account
              if (updatedAccounts.length === 0) {
                await AsyncStorage.clear();
                router.replace('/create-account');
                return;
              }

              // Save updated accounts
              await AsyncStorage.setItem('accounts', JSON.stringify(updatedAccounts));

              // Set new current account
              await AsyncStorage.setItem('currentAccount', updatedAccounts[0].wallet.address);
              router.replace('/welcome');
            } catch (e) {
              console.error('Error deleting account:', e);
              Alert.alert('Error', 'Failed to delete account. Please try again.');
            }
          }
        }
      ]
    );
  };

  return (
    <LinearGradient
      colors={['#ffd6cc', '#ffb199', '#d16ba5']}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={{ flex: 1 }}
    >
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View style={styles.container}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ACCOUNT</Text>
            <View style={styles.settingsGroup}>
              <TouchableOpacity 
                style={styles.settingsItem}
                onPress={() => router.push('/profile')}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Feather name="user" size={24} color="#D7263D" style={{ marginRight: 12 }} />
                  <Text style={styles.settingsText}>Profile</Text>
                </View>
                <Feather name="chevron-right" size={24} color="#D7263D" />
              </TouchableOpacity>
              <View style={styles.settingsItem}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Feather name="credit-card" size={24} color="#D7263D" style={{ marginRight: 12 }} />
                  <Text style={styles.settingsText}>Account Type</Text>
                </View>
                <Text style={{ color: '#666' }}>{accountType === 'personal' ? 'Personal' : 'Business'}</Text>
              </View>
              <TouchableOpacity 
                style={styles.settingsItem}
                onPress={() => router.push('/contacts')}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Feather name="users" size={24} color="#D7263D" style={{ marginRight: 12 }} />
                  <Text style={styles.settingsText}>Contacts</Text>
                </View>
                <Feather name="chevron-right" size={24} color="#D7263D" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.settingsItem}
                onPress={() => router.push('/view-mnemonic')}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Feather name="key" size={24} color="#D7263D" style={{ marginRight: 12 }} />
                  <Text style={styles.settingsText}>Mnemonic</Text>
                </View>
                <Feather name="chevron-right" size={24} color="#D7263D" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SECURITY</Text>
            <View style={styles.settingsGroup}>
              <View style={styles.settingsItem}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Feather name="smartphone" size={24} color="#D7263D" style={{ marginRight: 12 }} />
                  <Text style={styles.settingsText}>Biometric Login</Text>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={toggleBiometric}
                  trackColor={{ false: '#f0f0f0', true: '#ffb199' }}
                  thumbColor={biometricEnabled ? '#D7263D' : '#f4f3f4'}
                />
              </View>
              <TouchableOpacity 
                style={styles.settingsItem}
                onPress={() => router.push('/change-password')}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Feather name="lock" size={24} color="#D7263D" style={{ marginRight: 12 }} />
                  <Text style={styles.settingsText}>Change Password</Text>
                </View>
                <Feather name="chevron-right" size={24} color="#D7263D" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.settingsItem}
                onPress={() => router.push({
                  pathname: '/sign-message' as any
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Feather name="file-text" size={24} color="#D7263D" style={{ marginRight: 12 }} />
                  <Text style={styles.settingsText}>Sign Message</Text>
                </View>
                <Feather name="chevron-right" size={24} color="#D7263D" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PREFERENCES</Text>
            <View style={styles.settingsGroup}>
              <View style={styles.settingsItem}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Feather name="bell" size={24} color="#D7263D" style={{ marginRight: 12 }} />
                  <Text style={styles.settingsText}>Notifications</Text>
                </View>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={toggleNotifications}
                  trackColor={{ false: '#f0f0f0', true: '#ffb199' }}
                  thumbColor={notificationsEnabled ? '#D7263D' : '#f4f3f4'}
                />
              </View>
              <View style={styles.settingsItem}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Feather name="moon" size={24} color="#D7263D" style={{ marginRight: 12 }} />
                  <Text style={styles.settingsText}>Dark Mode</Text>
                </View>
                <Switch
                  value={darkModeEnabled}
                  onValueChange={toggleDarkMode}
                  trackColor={{ false: '#f0f0f0', true: '#ffb199' }}
                  thumbColor={darkModeEnabled ? '#D7263D' : '#f4f3f4'}
                />
              </View>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.logoutButton, { marginTop: 8 }]}
            onPress={handleLogout}
          >
            <Text style={[styles.logoutButtonText, { color: '#fff' }]}>Logout</Text>
          </TouchableOpacity>

          {showDelete && (
            <TouchableOpacity 
              style={[styles.deleteButton, { marginTop: 16 }]}
              onPress={handleDeleteAccount}
            >
              <Text style={styles.deleteButtonText}>Delete Account</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={handleVersionPress}>
            <Text style={styles.versionText}>Version 1.0.0</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
} 