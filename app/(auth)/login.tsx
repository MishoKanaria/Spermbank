import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Account {
  accountType: 'personal' | 'business';
  name: string;
  password: string;
  wallet: {
    address: string;
    publicKey: string;
  };
}

export default function LoginScreen() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [hasBiometric, setHasBiometric] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    checkBiometricAvailability();
    loadBiometricPreference();
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const checkBiometricAvailability = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setHasBiometric(compatible && enrolled);
  };

  const loadBiometricPreference = async () => {
    const enabled = await AsyncStorage.getItem('biometricEnabled');
    setBiometricEnabled(enabled === 'true');
  };

  const authenticateWithBiometric = async () => {
    if (!biometricEnabled || !hasBiometric || !name.trim()) return;
    
    setIsAuthenticating(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to fill password',
        fallbackLabel: 'Use password',
        cancelLabel: 'Cancel',
      });

      if (result.success) {
        // Get the account's password
        const accountsStr = await AsyncStorage.getItem('accounts');
        if (accountsStr) {
          const accounts = JSON.parse(accountsStr);
          const account = accounts.find((acc: Account) => acc.name === name.trim());
          
          if (account) {
            setPassword(account.password);
          } else {
            setError('Account not found');
          }
        }
      }
    } catch (e) {
      console.error('Biometric authentication error:', e);
      setError('Biometric authentication failed');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogin = async () => {
    try {
      const accountsStr = await AsyncStorage.getItem('accounts');
      if (!accountsStr) {
        setError('No accounts found');
        return;
      }

      const accounts = JSON.parse(accountsStr);
      const account = accounts.find((acc: any) => 
        acc.name === name.trim() && acc.password === password
      );
      
      if (!account) {
        setError('Invalid name or password');
        return;
      }

      await AsyncStorage.setItem('currentAccount', account.wallet.address);
      await AsyncStorage.setItem('lastLoggedInAccount', account.name);
      router.replace('/(tabs)');
    } catch (err) {
      console.error('Error during login:', err);
      setError(err instanceof Error ? err.message : 'Failed to login');
    }
  };

  const isFormValid = name.trim().length > 0 && password.length >= 8;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.contentContainer}>
          <View style={styles.headerContainer}>
            <Text style={styles.header}>Welcome Back</Text>
            <Text style={styles.subheader}>Sign in to continue</Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.label}>NAME</Text>
            <TextInput
              style={styles.input}
              placeholder="Your Name"
              placeholderTextColor="#ccc"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder=""
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                onFocus={() => {
                  if (biometricEnabled && hasBiometric && !isAuthenticating) {
                    authenticateWithBiometric();
                  }
                }}
              />
              <TouchableOpacity 
                onPress={() => setShowPassword(!showPassword)} 
                style={styles.eyeIcon}
              >
                <Feather name={showPassword ? 'eye' : 'eye-off'} size={20} color="#888" />
              </TouchableOpacity>
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            
            <TouchableOpacity
              style={[styles.loginButton, !isFormValid && { opacity: 0.5 }]}
              onPress={handleLogin}
              disabled={!isFormValid || loading}
            >
              <Text style={styles.loginButtonText}>
                {loading ? 'Logging in...' : 'Login'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {!isKeyboardVisible && (
        <View style={styles.bottomContainer}>
          <TouchableOpacity 
            onPress={() => router.replace('/create-account')} 
            style={styles.createAccountButton}
          >
            <Text style={styles.createAccountText}>
              Don't have an account? <Text style={styles.createAccountTextBold}>Create one</Text>
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    flex: 1,
    padding: 24,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: '#fff',
  },
  headerContainer: {
    marginTop: 60,
    marginBottom: 40,
  },
  header: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#D7263D',
    marginBottom: 8,
  },
  subheader: {
    fontSize: 16,
    color: '#666',
  },
  formContainer: {
    flex: 1,
  },
  label: {
    marginLeft: 8,
    marginBottom: 4,
    color: '#888',
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  input: {
    backgroundColor: '#F3F3F3',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 20,
    color: '#222',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  loginButton: {
    backgroundColor: '#FF5A4D',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonText: {
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
  createAccountButton: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  createAccountText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 50,
  },
  createAccountTextBold: {
    color: '#D7263D',
    fontWeight: 'bold',
  },
}); 