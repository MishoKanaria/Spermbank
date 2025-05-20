import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { saveMerchantInfo, uploadLogoToImgbb } from '../components/utils/merchant';
import styles from './styles/index.styles';

const IMGBB_API_KEY = 'IMGBB_API_KEY';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const [wallet, setWallet] = useState<any>(null);
  const [account, setAccount] = useState<any>(null);
  const [name, setName] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [currentAccountObj, setCurrentAccountObj] = useState<any>(null);
  const [merchantInfo, setmerchantInfo] = useState<any>(null);
  const [merchantInfoLoading, setmerchantInfoLoading] = useState(false);
  const [editingmerchantInfo, setEditingmerchantInfo] = useState<any>(null);
  const [pendingLogoUrl, setPendingLogoUrl] = useState<string | null>(null);
  const [pendingLogoLocalUri, setPendingLogoLocalUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const currentAddress = await AsyncStorage.getItem('currentAccount');
      const accountsStr = await AsyncStorage.getItem('accounts');
      if (!currentAddress || !accountsStr) return;
      const accounts = JSON.parse(accountsStr);
      const currentAccount = accounts.find((acc: any) => acc.wallet.address === currentAddress);
      setAccount(currentAccount);
      setWallet(currentAccount.wallet);
      setName(currentAccount.name);
      setCurrentAccountObj(currentAccount);
      AsyncStorage.getItem(`profileImage_${currentAddress}`).then(uri => {
        if (uri) setProfileImage(uri);
      });
      if (currentAccount.accountType === 'business') {
        setmerchantInfoLoading(true);
        // Simulate getMercahntInfo
        AsyncStorage.getItem(`merchantInfo_${currentAddress}`).then(infoStr => {
          const info = infoStr ? JSON.parse(infoStr) : null;
          const initialInfo = info || {
            name: currentAccount.name,
            logoUrl: '',
            businessId: '',
            address: '',
            signature: '',
          };
          setmerchantInfo(initialInfo);
          setEditingmerchantInfo(initialInfo);
          setmerchantInfoLoading(false);
        });
      }
    })();
  }, []);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    const currentAddress = await AsyncStorage.getItem('currentAccount');
    if (!result.canceled && result.assets && result.assets[0].uri && currentAddress) {
      await AsyncStorage.setItem(`profileImage_${currentAddress}`, result.assets[0].uri);
      setProfileImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    const currentAddress = await AsyncStorage.getItem('currentAccount');
    if (!result.canceled && result.assets && result.assets[0].uri && currentAddress) {
      await AsyncStorage.setItem(`profileImage_${currentAddress}`, result.assets[0].uri);
      setProfileImage(result.assets[0].uri);
    }
  };

  const handlemerchantInfoChange = (field: string, value: string) => {
    setEditingmerchantInfo((prev: any) => prev ? { ...prev, [field]: value } : prev);
  };

  const handleSavemerchantInfo = async () => {
    setSaving(true);
    const currentAddress = await AsyncStorage.getItem('currentAccount');
    if (currentAddress && editingmerchantInfo) {
      let logoUrl = editingmerchantInfo.logoUrl;
      if (pendingLogoLocalUri) {
        logoUrl = (await uploadLogoToImgbb(pendingLogoLocalUri, IMGBB_API_KEY)) || '';
      }
      const infoToSave = { ...editingmerchantInfo, logoUrl };
      await saveMerchantInfo(currentAddress, infoToSave);
      setmerchantInfo(infoToSave);
      setEditingmerchantInfo(infoToSave);
      setPendingLogoUrl(null);
      setPendingLogoLocalUri(null);

      // Update the profile image in AsyncStorage so index page can pick it up
      if (logoUrl) {
        await AsyncStorage.setItem(`profileImage_${currentAddress}`, logoUrl);
      }

      setSaving(false);
      navigation.goBack();
    } else {
      setSaving(false);
    }
  };

  const handleUploadLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets[0].uri) {
      setPendingLogoLocalUri(result.assets[0].uri);
      setPendingLogoUrl(null);
    }
  };

  return (
    <LinearGradient
      colors={['#ffd6cc', '#ffb199', '#d16ba5']}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <View style={[styles.modalContent, { marginTop: 60 }]}> 
            <View style={[styles.headerRow, { marginBottom: 24 }]}> 
              <Text style={{ fontWeight: 'bold', fontSize: 24, color: '#D7263D' }}>Profile</Text>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Feather name="x" size={24} color="#D7263D" />
              </TouchableOpacity>
            </View>
            {currentAccountObj?.accountType === 'business' ? (
              merchantInfoLoading ? (
                <Text>Loading...</Text>
              ) : (
                <>
                  <View style={{ alignItems: 'center', marginBottom: 16 }}>
                    {pendingLogoLocalUri || pendingLogoUrl || editingmerchantInfo?.logoUrl || merchantInfo?.logoUrl ? (
                      <Image source={{ uri: pendingLogoLocalUri || pendingLogoUrl || editingmerchantInfo?.logoUrl || merchantInfo?.logoUrl }} style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 8 }} />
                    ) : (
                      <Feather name="image" size={64} color="#D7263D" style={{ marginBottom: 8 }} />
                    )}
                    <TouchableOpacity style={styles.accountsButton} onPress={handleUploadLogo}>
                      <Text style={{ color: '#D7263D' }}>Upload Logo</Text>
                    </TouchableOpacity>
                  </View>
                  {/* Business Name */}
                  <View style={{ width: '100%', marginBottom: 16 }}>
                    <Text style={{ fontWeight: 'bold', color: '#D7263D', marginBottom: 4, letterSpacing: 2 }}>BUSINESS NAME</Text>
                    <View style={[styles.input, { backgroundColor: '#F3F3F3' }]}> 
                      <Text style={{ fontSize: 16, color: '#222' }}>{currentAccountObj?.name || ''}</Text>
                    </View>
                  </View>
                  {/* Business Address */}
                  <View style={{ width: '100%', marginBottom: 16 }}>
                    <Text style={{ fontWeight: 'bold', color: '#D7263D', marginBottom: 4, letterSpacing: 2 }}>ADDRESS</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: '#F3F3F3' }]}
                      value={editingmerchantInfo?.address || ''}
                      onChangeText={text => handlemerchantInfoChange('address', text)}
                    />
                  </View>
                  {/* Business ID */}
                  <View style={{ width: '100%', marginBottom: 16 }}>
                    <Text style={{ fontWeight: 'bold', color: '#D7263D', marginBottom: 4, letterSpacing: 2 }}>BUSINESS ID</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: '#F3F3F3' }]}
                      value={editingmerchantInfo?.businessId || ''}
                      onChangeText={text => handlemerchantInfoChange('businessId', text)}
                    />
                  </View>
                  {/* Password Field */}
                  <View style={{ width: '100%', marginBottom: 16 }}>
                    <Text style={{ fontWeight: 'bold', color: '#D7263D', marginBottom: 4, letterSpacing: 2 }}>PASSWORD</Text>
                    <TouchableOpacity
                      style={[styles.input, { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F3F3' }]}
                      onPress={() => setShowPassword(v => !v)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 16, color: '#222', letterSpacing: 2, flex: 1 }}>
                        {showPassword ? (account?.password || '') : '•'.repeat((account?.password || '').length)}
                      </Text>
                      <Feather name={showPassword ? 'eye-off' : 'eye'} size={20} color="#888" style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity style={styles.signupButton} onPress={handleSavemerchantInfo} disabled={saving}>
                    {saving ? (
                      <Text style={styles.signupButtonText}>Saving...</Text>
                    ) : (
                      <Text style={styles.signupButtonText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </>
              )
            ) : (
              <>
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                  {profileImage ? (
                    <Image source={{ uri: profileImage }} style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 8 }} />
                  ) : (
                    <Feather name="user" size={64} color="#D7263D" style={{ marginBottom: 8 }} />
                  )}
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity style={styles.accountsButton} onPress={pickImage}>
                      <Text style={{ color: '#D7263D' }}>Upload</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.accountsButton} onPress={takePhoto}>
                      <Text style={{ color: '#D7263D' }}>Camera</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {/* Name Field */}
                <View style={{ width: '100%', marginBottom: 16 }}>
                  <Text style={{ fontWeight: 'bold', color: '#D7263D', marginBottom: 4, letterSpacing: 2 }}>NAME</Text>
                  <View style={[styles.input, { backgroundColor: '#F3F3F3' }]}> 
                    <Text style={{ fontSize: 16, color: '#222' }}>{name}</Text>
                  </View>
                </View>
                {/* Password Field */}
                <View style={{ width: '100%', marginBottom: 16 }}>
                  <Text style={{ fontWeight: 'bold', color: '#D7263D', marginBottom: 4, letterSpacing: 2 }}>PASSWORD</Text>
                  <TouchableOpacity
                    style={[styles.input, { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F3F3' }]}
                    onPress={() => setShowPassword(v => !v)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 16, color: '#222', letterSpacing: 2, flex: 1 }}>
                      {showPassword ? (account?.password || '') : '•'.repeat((account?.password || '').length)}
                    </Text>
                    <Feather name={showPassword ? 'eye-off' : 'eye'} size={20} color="#888" style={{ marginLeft: 8 }} />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
} 