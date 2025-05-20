import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import React, { useEffect, useState } from 'react';
import { FlatList, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableHighlight, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';

interface Contact {
  name: string;
  address: string;
}

interface ContactsParams {
  currentAccount: string;
  onSelectContact?: (address: string) => void;
}

export default function ContactsScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: ContactsParams }, 'params'>>();
  const { currentAccount, onSelectContact } = route.params;
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactImages, setContactImages] = useState<{ [address: string]: string | null }>({});

  useFocusEffect(
    React.useCallback(() => {
      AsyncStorage.getItem(`contacts_${currentAccount}`).then(data => {
        if (data) setContacts(JSON.parse(data));
        else setContacts([]);
      });
    }, [currentAccount])
  );

  useEffect(() => {
    const loadContactImages = async () => {
      const imagePromises = contacts.map(async (contact) => {
        const uri = await AsyncStorage.getItem(`contactImage_${currentAccount}_${contact.address}`);
        return [contact.address, uri || null];
      });
      const imagesArr = await Promise.all(imagePromises);
      const images = Object.fromEntries(imagesArr);
      setContactImages(images);
    };
    loadContactImages();
  }, [contacts, currentAccount]);

  const displayAddress = (address: string) =>
    address.length > 16 ? `${address.slice(0, 8)}...${address.slice(-8)}` : address;

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
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableWithoutFeedback onPress={() => navigation.goBack()}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          </TouchableWithoutFeedback>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 400 }}>
            <View style={styles.headerRow}>
              <Text style={{ fontWeight: 'bold', fontSize: 24 }}>Contact List</Text>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Feather name="x" size={32} color="#D7263D" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={contacts}
              keyExtractor={(item, idx) => idx.toString()}
              renderItem={({ item }) => (
                <TouchableHighlight
                  style={styles.contactItem}
                  underlayColor="#eee"
                  onPress={() => {
                    (navigation as any).navigate('send', {
                      contacts,
                      currentAccount,
                      selectedAddress: item.address,
                    });
                  }}
                  onLongPress={() => {
                    (navigation.navigate as any)('add-contact', {
                      currentAccount,
                      name: item.name,
                      address: item.address,
                      image: contactImages[item.address] || null,
                      edit: true,
                    });
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    {contactImages[item.address] ? (
                      <Image source={{ uri: contactImages[item.address]! }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                    ) : (
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' }}>
                        <Feather name="user" size={22} color="#D7263D" />
                      </View>
                    )}
                    <View>
                      <Text style={styles.contactName}>{item.name}</Text>
                      <Text style={styles.contactAddress}>{displayAddress(item.address)}</Text>
                    </View>
                  </View>
                </TouchableHighlight>
              )}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', marginBottom: 12 }}>
                  <LottieView
                    source={require('../assets/animations/empty.json')}
                    autoPlay
                    loop
                    style={{ width: 160, height: 160 }}
                  />
                  <Text style={{ color: '#888', marginTop: 8 }}>No contacts yet.</Text>
                </View>
              }
              style={styles.contactsList}
              contentContainerStyle={styles.scrollContent}
            />
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => (navigation.navigate as any)('add-contact', { currentAccount })}
            >
              <Feather name="user-plus" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
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
  contactItem: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  contactName: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#222',
  },
  contactAddress: {
    color: '#888',
    fontSize: 12,
  },
  contactsList: {
    marginBottom: 16,
  },
  scrollContent: {
    flexGrow: 1,
  },
  addButton: {
    backgroundColor: '#FF5A4D',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
}); 