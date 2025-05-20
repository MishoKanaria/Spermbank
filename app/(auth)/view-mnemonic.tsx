import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getSecureValue } from '../../services/storage/secureStorage';
import styles from '../styles/index.styles';

export default function ViewMnemonicScreen() {
  const navigation = useNavigation();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [currentAccount, setCurrentAccount] = useState<string | null>(null);

  React.useEffect(() => {
    const loadCurrentAccount = async () => {
      const address = await AsyncStorage.getItem('currentAccount');
      setCurrentAccount(address);
    };
    loadCurrentAccount();
  }, []);

  const verifyPasswordAndShowMnemonic = async () => {
    if (!currentAccount) return;
    
    const accountsStr = await AsyncStorage.getItem('accounts');
    if (!accountsStr) return;
    
    const accounts = JSON.parse(accountsStr);
    const currentAccountObj = accounts.find((acc: any) => acc.wallet.address === currentAccount);
    
    if (!currentAccountObj || currentAccountObj.password !== password) {
      Alert.alert('Error', 'Incorrect password');
      return;
    }

    const storedMnemonic = await getSecureValue(`mnemonic_${currentAccount}`);
    if (storedMnemonic) {
      setMnemonic(storedMnemonic);
      setPassword('');
    }
  };

  return (
    <LinearGradient
      colors={['#ffd6cc', '#ffb199', '#d16ba5']}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={{ flex: 1 }}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContent}>
          <View style={styles.headerContainer}>
            <Text style={styles.header}>View Mnemonic</Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Feather name="x" size={24} color="#D7263D" />
            </TouchableOpacity>
          </View>

          {!mnemonic ? (
            <View style={{ marginTop: 24 }}>
              <Text style={styles.label}>Enter your password to view your mnemonic</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0, marginRight: 8 }]}
                  placeholder="Enter password"
                  placeholderTextColor="#ccc"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Feather name={showPassword ? "eye-off" : "eye"} size={24} color="#888" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity 
                style={[styles.signupButton, { marginTop: 16, alignSelf: 'center', top: 40 }]}
                onPress={verifyPasswordAndShowMnemonic}
              >
                <Text style={styles.signupButtonText}>Show Mnemonic</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ marginTop: 24 }}>
              <Text style={styles.label}>Your mnemonic phrase:</Text>
              <View style={localStyles.mnemonicBox}>
                <Text style={localStyles.mnemonicText}>{mnemonic}</Text>
              </View>
              <Text style={[styles.label, { marginTop: 16, color: '#D7263D' }]}>
                Keep this phrase safe and secret. Anyone with this phrase can access your account.
              </Text>
            </View>
          )}
        </View>
      </View>
    </LinearGradient>
  );
}

const localStyles = StyleSheet.create({
  mnemonicBox: {
    backgroundColor: '#F3F3F3',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  mnemonicText: {
    fontSize: 16,
    color: '#222',
    lineHeight: 24,
  },
}); 