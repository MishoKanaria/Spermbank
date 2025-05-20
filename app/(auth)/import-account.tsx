import { Feather } from '@expo/vector-icons';
import { Keyring } from '@polkadot/keyring';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';
import { router } from 'expo-router';
import React, { useState } from 'react';
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

export default function ImportAccountScreen() {
  const [accountType, setAccountType] = useState<'personal' | 'business'>('personal');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mnemonic, setMnemonic] = useState('');
  const [error, setError] = useState('');

  const onImport = async () => {
    try {
      // Get existing accounts or create empty array
      const accountsStr = await AsyncStorage.getItem('accounts');
      const accounts = accountsStr ? JSON.parse(accountsStr) : [];
      
      // Check if name already exists
      if (accounts.some((acc: Account) => acc.name === name.trim())) {
        setError('An account with this name already exists.');
        return;
      }

      // Create wallet from mnemonic
      const keyring = new Keyring({ type: 'sr25519' });
      const pair = keyring.addFromUri(mnemonic.trim(), { name });
      const newWallet = {
        address: pair.address,
        publicKey: Buffer.from(pair.publicKey).toString('hex'),
      };

      // Store mnemonic securely
      await saveSecureValue(`mnemonic_${pair.address}`, mnemonic.trim());

      // Add new account to list
      const newAccount = {
        accountType,
        name,
        password,
        wallet: newWallet
      };
      accounts.push(newAccount);
      
      // Save updated accounts list
      await AsyncStorage.setItem('accounts', JSON.stringify(accounts));
      // Set current account
      await AsyncStorage.setItem('currentAccount', pair.address);
      await AsyncStorage.setItem('isLoggedIn', 'true');
      router.replace('/welcome' as any);
    } catch (e) {
      console.error('Error importing account:', e);
      setError('Invalid mnemonic phrase. Please check and try again.');
    }
  };

  const isFormValid = name.trim().length > 0 && password.length >= 8 && mnemonic.trim().split(' ').length === 12;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.header}>{'Import\nAccount'}</Text>
        <TouchableOpacity onPress={() => router.push('/create-account')}>
          <Text style={styles.subheader}>Create new account instead</Text>
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
        <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 20 }}>
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
        <Text style={styles.label}>MNEMONIC PHRASE</Text>
        <TextInput
          style={[styles.input, { height: 100, textAlignVertical: 'center'}]}
          placeholder="Enter your 12-word mnemonic phrase"
          placeholderTextColor="#ccc"
          value={mnemonic}
          onChangeText={(text) => {
            setMnemonic(text);
            setError('');
          }}
          multiline
          autoCapitalize="none"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          style={[styles.signupButton, !isFormValid && { opacity: 0.5 }]}
          onPress={onImport}
          disabled={!isFormValid}
        >
          <Text style={styles.signupButtonText}>Import Account</Text>
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
}); 