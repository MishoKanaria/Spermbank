import { Feather } from '@expo/vector-icons';
import { Keyring } from '@polkadot/keyring';
import { encodeAddress, mnemonicGenerate } from '@polkadot/util-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { saveSecureValue } from '../../services/storage/secureStorage';

interface Account {
  accountType: 'personal' | 'business';
  name: string;
  password: string;
  wallet: {
    mnemonic: string;
    address: string;
    publicKey: string;
  };
}

export default function CreateAccountScreen() {
  const [accountType, setAccountType] = useState<'personal' | 'business'>('personal');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const onSignUp = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Get existing accounts or create empty array
      const accountsStr = await AsyncStorage.getItem('accounts');
      const accounts = accountsStr ? JSON.parse(accountsStr) : [];
      
      // Check if name already exists
      if (accounts.some((acc: Account) => acc.name === name.trim())) {
        setError('An account with this name already exists.');
        return;
      }

      // Create wallet
      const mnemonic = mnemonicGenerate();
      const keyring = new Keyring({ type: 'sr25519' });
      const pair = keyring.addFromUri(mnemonic, { name });
      const addressWithPrefix0 = encodeAddress(pair.publicKey, 0);
      const newWallet = {
        address: addressWithPrefix0,
        publicKey: Buffer.from(pair.publicKey).toString('hex'),
      };

      await saveSecureValue(`mnemonic_${addressWithPrefix0}`, mnemonic);

      const newAccount = {
        accountType,
        name,
        password,
        wallet: newWallet
      };
      accounts.push(newAccount);
      
      await AsyncStorage.setItem('accounts', JSON.stringify(accounts));
      await AsyncStorage.setItem('currentAccount', addressWithPrefix0);
      await AsyncStorage.setItem('isLoggedIn', 'true');

      // Ensure merchant info is set for business accounts
      if (accountType === 'business') {
        const merchantInfo = {
          name,
          logoUrl: '',
          businessId: '',
          address: '',
          signature: '',
        };
        await AsyncStorage.setItem(`merchantInfo_${addressWithPrefix0}`, JSON.stringify(merchantInfo));
      }

      router.replace('/welcome' as any);

      const accountsAfter = await AsyncStorage.getItem('accounts');
    } catch (err) {
      console.error('Error creating account:', err);
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = name.trim().length > 0 && password.length >= 8;

  useEffect(() => {
    const checkLogin = async () => {
      const isLoggedIn = await AsyncStorage.getItem('isLoggedIn');
      setIsLoggedIn(isLoggedIn === 'true');
      setIsLoading(false);
    };
    checkLogin();
  }, []);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.header}>{'Create New\nAccount'}</Text>
        <TouchableOpacity onPress={() => router.push('/login')}>
          <Text style={styles.subheader}>Already Registered? Log in here.</Text>
        </TouchableOpacity>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleButton, accountType === 'personal' && styles.toggleButtonActive]}
            onPress={() => setAccountType('personal')}
          >
            <Text style={[styles.toggleText, accountType === 'personal' && styles.toggleTextActive]}>Personal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, accountType === 'business' && styles.toggleButtonActive]}
            onPress={() => setAccountType('business')}
          >
            <Text style={[styles.toggleText, accountType === 'business' && styles.toggleTextActive]}>Business</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.label}>{accountType === 'business' ? 'BUSINESS NAME' : 'NAME'}</Text>
        <TextInput
          style={styles.input}
          placeholder={accountType === 'business' ? 'Grocery Store' : 'Satoshi Nakamoto'}
          placeholderTextColor="#ccc"
          value={name}
          onChangeText={(text) => {
            setName(text);
            setError('');
          }}
          autoCapitalize="words"
        />
        <Text style={styles.label}>PASSWORD</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder=""
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 16 }}>
            <Feather name={showPassword ? 'eye' : 'eye-off'} size={20} color="#888" />
          </TouchableOpacity>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          style={[styles.signupButton, !isFormValid && { opacity: 0.5 }]}
          onPress={onSignUp}
          disabled={!isFormValid}
        >
          <Text style={styles.signupButtonText}>Sign Up</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => router.push('/import-account')}
          style={{ marginTop: 12 }}
        >
          <Text style={styles.importLink}>Import existing account</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  header: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#D7263D',
    textAlign: 'center',
    marginBottom: 8,
  },
  subheader: {
    color: '#888',
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    marginBottom: 32,
    gap: 12,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#eee',
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#FFD1D1',
  },
  toggleText: {
    color: '#888',
    fontWeight: 'bold',
    fontSize: 16,
  },
  toggleTextActive: {
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
  input: {
    width: '100%',
    backgroundColor: '#F3F3F3',
    borderRadius: 6,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
    color: '#222',
  },
  signupButton: {
    width: '100%',
    backgroundColor: '#FF5A4D',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  signupButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  error: {
    color: '#D7263D',
    marginBottom: 8,
    fontWeight: 'bold',
    alignSelf: 'center',
  },
  importLink: {
    color: '#bbb',
    fontSize: 12,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
}); 