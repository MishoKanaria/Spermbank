import { Feather } from '@expo/vector-icons';
import { decodeAddress } from '@polkadot/util-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import AnimatedQRScanner from '../components/common/AnimatedQRScanner';

interface AddContactParams {
  currentAccount: string;
  name?: string;
  address?: string;
  image?: string | null;
  edit?: boolean;
}

export default function AddContactScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: AddContactParams }, 'params'>>();
  const { currentAccount, name: initialName = '', address: initialAddress = '', image: initialImage = null, edit = false } = route.params;

  const [name, setName] = useState(initialName);
  const [address, setAddress] = useState(initialAddress);
  const [addressError, setAddressError] = useState('');
  const [image, setImage] = useState<string | null>(initialImage);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  React.useEffect(() => {
    setName(initialName);
    setAddress(initialAddress);
    setImage(initialImage);
  }, [initialName, initialAddress, initialImage]);

  const validateAddress = (address: string) => {
    const isValid = /^5[a-km-zA-HJ-NP-Z1-9]{47}$/.test(address);
    setAddressError(isValid ? '' : 'Invalid address');
    return isValid;
  };

  const onSave = async () => {
    if (!name.trim() || !address.trim() || addressError) return;
    const contactsKey = `contacts_${currentAccount}`;
    const contactsStr = await AsyncStorage.getItem(contactsKey);
    let contacts = contactsStr ? JSON.parse(contactsStr) : [];
    if (edit) {
      // Update existing contact
      contacts = contacts.map((c: any) =>
        c.address === initialAddress ? { ...c, name: name.trim(), address: address.trim() } : c
      );
    } else {
      // Add new contact
      contacts = [...contacts, { name: name.trim(), address: address.trim() }];
    }
    await AsyncStorage.setItem(contactsKey, JSON.stringify(contacts));
    if (image) {
      await AsyncStorage.setItem(`contactImage_${currentAccount}_${address.trim()}`, image);
    }
    navigation.goBack();
  };

  // Add QR scanner handler
  const handleScan = (data: string) => {
    setShowScanner(false);
    try {
      let address = data;
      // Try to parse as JSON with sr25519 field
      try {
        const parsed = JSON.parse(data);
        if (parsed.sr25519) {
          address = parsed.sr25519;
        }
      } catch {}
      // Only accept valid Substrate (sr25519) addresses
      decodeAddress(address);
      setAddress(address);
      setAddressError('');
    } catch (e) {
      setAddressError('Invalid address scanned');
    }
  };

  if (showScanner) {
    return (
      <View style={{ flex: 1 }}>
        <AnimatedQRScanner
          onDataReceived={handleScan}
          onClose={() => setShowScanner(false)}
        />
        <View style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          justifyContent: 'center',
          alignItems: 'center',
          pointerEvents: 'none',
        }}>
          <View style={{ width: 250, height: 250, borderWidth: 2, borderColor: '#000000', borderRadius: 12 }} />
        </View>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#ffd6cc', '#ffb199', '#d16ba5']}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={{ flex: 1 }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={() => navigation.goBack()}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContent}>
                <View style={styles.headerRow}>
                  <Text style={{ fontWeight: 'bold', fontSize: 24 }}>{edit ? 'Edit Contact' : 'Add Contact'}</Text>
                  <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Feather name="x" size={32} color="#D7263D" />
                  </TouchableOpacity>
                </View>
                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                  {image ? (
                    <Image source={{ uri: image }} style={{ width: 64, height: 64, borderRadius: 32, marginBottom: 12 }} />
                  ) : (
                    <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                      <Feather name="user" size={36} color="#D7263D" />
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
                    <TouchableOpacity
                      style={styles.imageButton}
                      onPress={async () => {
                        const result = await ImagePicker.launchImageLibraryAsync({
                          mediaTypes: 'images',
                          allowsEditing: true,
                          aspect: [1, 1],
                          quality: 0.7,
                        });
                        if (!result.canceled && result.assets && result.assets[0].uri) {
                          setImage(result.assets[0].uri);
                        }
                      }}
                    >
                      <Text style={{ color: '#D7263D' }}>Upload</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.imageButton}
                      onPress={async () => {
                        const result = await ImagePicker.launchCameraAsync({
                          allowsEditing: true,
                          aspect: [1, 1],
                          quality: 0.7,
                        });
                        if (!result.canceled && result.assets && result.assets[0].uri) {
                          setImage(result.assets[0].uri);
                        }
                      }}
                    >
                      <Text style={{ color: '#D7263D' }}>Camera</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.label}>NAME</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Name"
                  value={name}
                  onChangeText={setName}
                  placeholderTextColor="#888"
                />
                <Text style={styles.label}>ADDRESS</Text>
                <View style={{ position: 'relative', width: '100%', marginBottom: 20 }}>
                  <TextInput
                    style={{ ...styles.input, paddingRight: 100, marginBottom: 0 }}
                    placeholder="Address"
                    value={address.length > 16 ? `${address.slice(0, 8)}...${address.slice(-8)}` : address}
                    editable={false}
                    placeholderTextColor="#888"
                  />
                  <TouchableOpacity
                    style={{ position: 'absolute', right: 48, top: 14 }}
                    onPress={async () => {
                      const text = await Clipboard.getStringAsync();
                      setAddress(text);
                      validateAddress(text);
                    }}
                  >
                    <Feather name="clipboard" size={24} color="#D7263D" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ position: 'absolute', right: 16, top: 14 }}
                    onPress={() => setShowScanner(true)}
                  >
                    <Feather name="camera" size={24} color="#D7263D" />
                  </TouchableOpacity>
                </View>
                {addressError ? <Text style={styles.errorText}>{addressError}</Text> : null}
                {edit && (
                  <>
                    <TouchableOpacity
                      onPress={() => setShowDeleteModal(true)}
                      style={{ marginBottom: 16 }}
                    >
                      <Text style={{ color: '#D7263D', fontWeight: 'bold', fontSize: 16, textAlign: 'center' }}>Delete Contact</Text>
                    </TouchableOpacity>
                    <Modal
                      visible={showDeleteModal}
                      transparent
                      animationType="fade"
                      onRequestClose={() => setShowDeleteModal(false)}
                    >
                      <TouchableWithoutFeedback onPress={() => setShowDeleteModal(false)}>
                        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
                          <TouchableWithoutFeedback onPress={e => e.stopPropagation()}>
                            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: 320, alignItems: 'center' }}>
                              <Text style={{ fontWeight: 'bold', fontSize: 20, marginBottom: 16 }}>Delete Contact?</Text>
                              <Text style={{ color: '#888', marginBottom: 24, textAlign: 'center' }}>Are you sure you want to delete this contact?</Text>
                              <View style={{ flexDirection: 'row', gap: 12 }}>
                                <TouchableOpacity
                                  style={{ backgroundColor: '#F3F3F3', borderRadius: 8, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', marginRight: 8 }}
                                  onPress={() => setShowDeleteModal(false)}
                                >
                                  <Text style={{ color: '#666', fontWeight: 'bold', fontSize: 16 }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={{ backgroundColor: '#D7263D', borderRadius: 8, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center' }}
                                  onPress={async () => {
                                    const contactsKey = `contacts_${currentAccount}`;
                                    const contactsStr = await AsyncStorage.getItem(contactsKey);
                                    let contacts = contactsStr ? JSON.parse(contactsStr) : [];
                                    contacts = contacts.filter((c: any) => c.address !== initialAddress);
                                    await AsyncStorage.setItem(contactsKey, JSON.stringify(contacts));
                                    await AsyncStorage.removeItem(`contactImage_${currentAccount}_${initialAddress}`);
                                    setShowDeleteModal(false);
                                    navigation.goBack();
                                  }}
                                >
                                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Delete</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          </TouchableWithoutFeedback>
                        </View>
                      </TouchableWithoutFeedback>
                    </Modal>
                  </>
                )}
                <TouchableOpacity
                  style={{ ...styles.addButton, opacity: (!name.trim() || !address.trim() || !!addressError) ? 0.5 : 1 }}
                  onPress={onSave}
                  disabled={!name.trim() || !address.trim() || !!addressError}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>Save</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
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
  imageButton: {
    backgroundColor: '#F3F3F3',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 4,
  },
  addButton: {
    backgroundColor: '#FF5A4D',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
  },
  errorText: {
    color: '#D7263D',
    fontSize: 12,
    marginTop: -16,
    marginBottom: 16,
    marginLeft: 8,
  },
});

 