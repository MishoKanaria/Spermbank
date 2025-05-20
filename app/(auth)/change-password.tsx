import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function ChangePasswordScreen() {
  const navigation = useNavigation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    setError('');
    setLoading(true);

    try {
      // Validate inputs
      if (!currentPassword || !newPassword || !confirmPassword) {
        setError('All fields are required');
        setLoading(false);
        return;
      }

      if (newPassword.length < 8) {
        setError('New password must be at least 8 characters');
        setLoading(false);
        return;
      }

      if (newPassword !== confirmPassword) {
        setError('New passwords do not match');
        setLoading(false);
        return;
      }

      // Get current account
      const currentAccount = await AsyncStorage.getItem('currentAccount');
      if (!currentAccount) {
        setError('No account found');
        setLoading(false);
        return;
      }

      // Get accounts
      const accountsStr = await AsyncStorage.getItem('accounts');
      if (!accountsStr) {
        setError('No accounts found');
        setLoading(false);
        return;
      }

      const accounts = JSON.parse(accountsStr);
      const accountIndex = accounts.findIndex((acc: any) => acc.wallet.address === currentAccount);

      if (accountIndex === -1) {
        setError('Account not found');
        setLoading(false);
        return;
      }

      // Verify current password
      if (accounts[accountIndex].password !== currentPassword) {
        setError('Current password is incorrect');
        setLoading(false);
        return;
      }

      // Update password
      accounts[accountIndex].password = newPassword;
      await AsyncStorage.setItem('accounts', JSON.stringify(accounts));

      Alert.alert(
        'Success',
        'Password changed successfully',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );
    } catch (e) {
      console.error('Error changing password:', e);
      setError('Failed to change password');
    }

    setLoading(false);
  };

  return (
    <LinearGradient
      colors={['#ffd6cc', '#ffb199', '#d16ba5']}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={{ flex: 1 }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <View style={styles.headerContainer}>
            <Text style={styles.header}>Change Password</Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Feather name="x" size={24} color="#D7263D" />
            </TouchableOpacity>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.label}>CURRENT PASSWORD</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Enter current password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrentPassword}
              />
              <TouchableOpacity 
                onPress={() => setShowCurrentPassword(!showCurrentPassword)} 
                style={styles.eyeIcon}
              >
                <Feather name={showCurrentPassword ? 'eye' : 'eye-off'} size={20} color="#888" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>NEW PASSWORD</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Enter new password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
              />
              <TouchableOpacity 
                onPress={() => setShowNewPassword(!showNewPassword)} 
                style={styles.eyeIcon}
              >
                <Feather name={showNewPassword ? 'eye' : 'eye-off'} size={20} color="#888" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>CONFIRM NEW PASSWORD</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity 
                onPress={() => setShowConfirmPassword(!showConfirmPassword)} 
                style={styles.eyeIcon}
              >
                <Feather name={showConfirmPassword ? 'eye' : 'eye-off'} size={20} color="#888" />
              </TouchableOpacity>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.5 }]}
              onPress={handleChangePassword}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Changing Password...' : 'Change Password'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 40,
  },
  header: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#D7263D',
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
  button: {
    backgroundColor: '#FF5A4D',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
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