import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import styles from '../../styles/index.styles';

const EMOJI_LIST = ['🍰', '🍔', '🍟', '🌭', '🌮', '🍕', '🍣', '🍩', '🍎', '🍪', '🍦', '🥗', '🥪', '🍜', '🍤', '🍗'];

function getRandomEmoji() {
  return EMOJI_LIST[Math.floor(Math.random() * EMOJI_LIST.length)];
}

export default function AddItem() {
  const params = useLocalSearchParams();
  const [imageUri, setImageUri] = useState<string | null>((params.image as string) || null);
  const [name, setName] = useState((params.name as string) || '');
  const [price, setPrice] = useState((params.price as string) || '');
  const [unit, setUnit] = useState((params.unit as string) || '');
  const [itemId, setItemId] = useState((params.id as string) || '');
  const [returnable, setReturnable] = useState(
    params.returnable === undefined ? true : params.returnable === 'true'
  );
  const [returnedQty, setReturnedQty] = useState(Number(params.returned_qty) || 0);
  const [saving, setSaving] = useState(false);
  const [emoji, setEmoji] = useState((params.emoji as string) || getRandomEmoji());
  const isEditing = !!params.id;

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets[0].uri) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name is required');
      return;
    }
    if (!price.trim() || isNaN(Number(price))) {
      Alert.alert('Valid price is required');
      return;
    }
    setSaving(true);
    const currentAccount = await AsyncStorage.getItem('currentAccount');
    if (!currentAccount) {
      Alert.alert('No account found');
      setSaving(false);
      return;
    }
    const key = `merchant_items_${currentAccount}`;
    const stored = await AsyncStorage.getItem(key);
    let items = stored ? JSON.parse(stored) : [];
    if (isEditing) {
      // Update existing item
      items = items.map((item: any) =>
        item.id === params.id
          ? {
              ...item,
              image: imageUri || undefined,
              emoji: imageUri ? undefined : emoji,
              name: name.trim(),
              price: Number(price),
              unit: unit.trim() || undefined,
              id: itemId.trim() || item.id,
              returnable: returnable,
              returned_qty: returnedQty
            }
          : item
      );
    } else {
      // Add new item
      const newItem = {
        id: itemId.trim() || `item-${Date.now()}`,
        image: imageUri || undefined,
        emoji: imageUri ? undefined : emoji,
        name: name.trim(),
        price: Number(price),
        unit: unit.trim() || undefined,
        returnable: returnable,
        returned_qty: 0
      };
      items.push(newItem);
    }
    await AsyncStorage.setItem(key, JSON.stringify(items));
    setSaving(false);
    router.replace('/(tabs)/recordsrouter');
  };

  const handleDelete = async () => {
    Alert.alert('Delete Item', 'Are you sure you want to delete this item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const currentAccount = await AsyncStorage.getItem('currentAccount');
          if (!currentAccount) return;
          const key = `merchant_items_${currentAccount}`;
          const stored = await AsyncStorage.getItem(key);
          let items = stored ? JSON.parse(stored) : [];
          items = items.filter((item: any) => item.id !== params.id);
          await AsyncStorage.setItem(key, JSON.stringify(items));
          router.replace('/(tabs)/recordsrouter');
        }
      }
    ]);
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <View style={[styles.modalContent, { alignItems: 'center', alignSelf: 'center', maxHeight: '80%' }]}> 
        <ScrollView style={{ width: '100%' }} contentContainerStyle={{ alignItems: 'center', paddingBottom: 10 }} showsVerticalScrollIndicator={false}>
          <View style={[styles.headerRow, { marginBottom: 24 }]}> 
            <Text style={{ fontWeight: 'bold', fontSize: 24, color: '#D7263D' }}>{isEditing ? 'Edit Item' : 'Add Item'}</Text>
            <TouchableOpacity onPress={() => router.replace('/(tabs)/recordsrouter')}>
              <Feather name="x" size={24} color="#D7263D" />
            </TouchableOpacity>
          </View>
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 8 }} />
            ) : (
              <Text style={{ fontSize: 64, marginBottom: 8 }}>{emoji}</Text>
            )}
            <TouchableOpacity style={styles.accountsButton} onPress={pickImage}>
              <Text style={{ color: '#D7263D' }}>Upload Image</Text>
            </TouchableOpacity>
          </View>
          {/* Item ID */}
          <View style={{ width: '100%', marginBottom: 16 }}>
            <Text style={{ fontWeight: 'bold', color: '#D7263D', marginBottom: 4, letterSpacing: 2 }}>ITEM ID</Text>
            <TextInput
              style={[styles.input, { backgroundColor: '#F3F3F3' }]}
              value={itemId}
              onChangeText={setItemId}
              placeholder="SKU-123"
            />
          </View>
          {/* Name */}
          <View style={{ width: '100%', marginBottom: 16 }}>
            <Text style={{ fontWeight: 'bold', color: '#D7263D', marginBottom: 4, letterSpacing: 2 }}>ITEM NAME</Text>
            <TextInput
              style={[styles.input, { backgroundColor: '#F3F3F3' }]}
              value={name}
              onChangeText={setName}
              placeholder="Burger"
            />
          </View>
          {/* Price */}
          <View style={{ width: '100%', marginBottom: 16 }}>
            <Text style={{ fontWeight: 'bold', color: '#D7263D', marginBottom: 4, letterSpacing: 2 }}>PRICE</Text>
            <TextInput
              style={[styles.input, { backgroundColor: '#F3F3F3' }]}
              value={price}
              onChangeText={setPrice}
              placeholder="4.99"
              keyboardType="decimal-pad"
            />
          </View>
          {/* Unit */}
          <View style={{ width: '100%', marginBottom: 16 }}>
            <Text style={{ fontWeight: 'bold', color: '#D7263D', marginBottom: 4, letterSpacing: 2 }}>UNIT (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: '#F3F3F3' }]}
              value={unit}
              onChangeText={setUnit}
              placeholder="kg, each, box"
            />
          </View>
          {/* Returnable Toggle */}
          <View style={{ width: '100%', marginBottom: 16 }}>
            <Text style={{ fontWeight: 'bold', color: '#D7263D', marginBottom: 4, letterSpacing: 2 }}>RETURNABLE</Text>
            <TouchableOpacity 
              style={[
                styles.input, 
                { 
                  backgroundColor: '#F3F3F3',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 16
                }
              ]}
              onPress={() => setReturnable(!returnable)}
            >
              <Text style={{ color: '#222' }}>{returnable ? 'Item can be returned' : 'Item cannot be returned'}</Text>
              <View style={{ 
                width: 40, 
                height: 24, 
                backgroundColor: returnable ? '#4CAF50' : '#FF5A4D',
                borderRadius: 12,
                justifyContent: 'center',
                paddingHorizontal: 2
              }}>
                <View style={{ 
                  width: 20, 
                  height: 20, 
                  backgroundColor: '#fff',
                  borderRadius: 10,
                  transform: [{ translateX: returnable ? 16 : 0 }]
                }} />
              </View>
            </TouchableOpacity>
          </View>
          {isEditing && (
            <TouchableOpacity onPress={handleDelete} style={{ marginBottom: 16, alignSelf: 'center' }}>
              <Text style={{ color: '#D7263D', fontWeight: 'bold', fontSize: 16 }}>Delete</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
        <TouchableOpacity style={[styles.signupButton, { marginTop: 8, alignSelf: 'center' }]} onPress={handleSave} disabled={saving}>
          <Text style={styles.signupButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
} 