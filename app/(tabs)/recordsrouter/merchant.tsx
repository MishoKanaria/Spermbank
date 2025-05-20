import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import styles from '../../styles/index.styles';

// item type
interface merchantItem {
  id: string;
  emoji: string;
  name: string;
  price: number;
  image?: string;
  unit?: string;
  returnable: boolean;
  returned_qty: number;
}

export default function merchant() {
  const [items, setItems] = useState<merchantItem[]>([]);
  const [cart, setCart] = useState<{ [id: string]: number }>({});
  const [currentAccount, setCurrentAccount] = useState<string | null>(null);
  const [mostRecentMap, setMostRecentMap] = useState<Map<string, string>>(new Map());

  // Load current account and items from storage
  useEffect(() => {
    const load = async () => {
      const account = await AsyncStorage.getItem('currentAccount');
      setCurrentAccount(account);
      if (account) {
        const key = `merchant_items_${account}`;
        const merchantd = await AsyncStorage.getItem(key);
        if (merchantd) {
          setItems(JSON.parse(merchantd));
        } else {
          setItems([]); // No items yet
        }
        // Load mostRecentMap
        const mapKey = `mostRecentMap_${account}`;
        const merchantdMap = await AsyncStorage.getItem(mapKey);
        if (merchantdMap) {
          const entries = JSON.parse(merchantdMap);
          setMostRecentMap(new Map(entries));
        }
      }
    };
    load();
  }, []);

  // Save items to storage whenever they change
  useEffect(() => {
    if (!currentAccount) return;
    const key = `merchant_items_${currentAccount}`;
    AsyncStorage.setItem(key, JSON.stringify(items));
  }, [items, currentAccount]);

  // Save cart to storage whenever it changes
  useEffect(() => {
    if (!currentAccount) return;
    const cartKey = `merchant_cart_${currentAccount}`;
    AsyncStorage.setItem(cartKey, JSON.stringify(cart));
  }, [cart, currentAccount]);

  const addToCart = (id: string) => {
    setCart(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => {
      const newCart = { ...prev };
      if (newCart[id] > 1) {
        newCart[id] -= 1;
      } else {
        delete newCart[id];
      }
      return newCart;
    });
  };

  const clearCart = async () => {
    setCart({});
    if (currentAccount) {
      const cartKey = `merchant_cart_${currentAccount}`;
      await AsyncStorage.removeItem(cartKey);
    }
  };

  const renderItem = ({ item }: { item: merchantItem }) => {
    const quantity = cart[item.id] || 0;
    if (item.id === 'add') return null; // handled in FlatList renderItem
    return (
      <View style={localStyles.itemBox}>
        <TouchableOpacity
          onLongPress={() => router.push({
            pathname: '/(tabs)/recordsrouter/add-item',
            params: {
              id: item.id,
              name: item.name,
              price: item.price.toString(),
              unit: item.unit || '',
              image: item.image || '',
              emoji: item.emoji || '',
              returnable: item.returnable ? 'true' : 'false',
              returned_qty: item.returned_qty?.toString() || '0'
            },
          })}
          activeOpacity={1}
          style={{ alignItems: 'center', justifyContent: 'center', width: '100%' }}
        >
          {item.image ? (
            <Image source={{ uri: item.image }} style={{ width: 56, height: 56, borderRadius: 28, marginBottom: 8 }} />
          ) : (
            <Text style={localStyles.emoji}>{item.emoji}</Text>
          )}
          <Text style={localStyles.name}>{item.name}</Text>
          <Text style={localStyles.price}>
            ${item.price.toFixed(2)}{item.unit ? `/${item.unit}` : ''}
          </Text>
          {quantity === 0 ? (
            <TouchableOpacity style={localStyles.addButton} onPress={() => addToCart(item.id)}>
              <Text style={localStyles.addButtonText}>ADD</Text>
            </TouchableOpacity>
          ) : (
            <View style={localStyles.qtyRow}>
              <TouchableOpacity style={localStyles.qtyButton} onPress={() => removeFromCart(item.id)}>
                <Text style={localStyles.qtyButtonText}>-</Text>
              </TouchableOpacity>
              <Text style={localStyles.qtyValue}>{quantity}</Text>
              <TouchableOpacity style={localStyles.qtyButtonGreen} onPress={() => addToCart(item.id)}>
                <Text style={localStyles.qtyButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // Cart item count
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  // Animation for View Order button
  const slideAnim = useRef(new Animated.Value(100)).current; // Start hidden (100px below)

  useEffect(() => {
    if (cartCount > 0) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 100,
        duration: 300,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [cartCount]);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, padding: 16, paddingTop: 25 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ fontWeight: 'bold', fontSize: 24, color: '#D7263D' }}>Store</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity 
              onPress={() => router.push({
                pathname: '/(tabs)/recordsrouter/return-purchase',
                params: {
                  mostRecentMap: JSON.stringify(Array.from(mostRecentMap.entries()))
                }
              })} 
              style={{ padding: 8, marginRight: 8 }}
            >
              <Feather name="rotate-ccw" size={24} color="#D7263D" />
            </TouchableOpacity>
            <TouchableOpacity onPress={clearCart} style={{ padding: 8 }}>
              <Feather name="trash-2" size={24} color="#D7263D" />
            </TouchableOpacity>
          </View>
        </View>
        {items.length === 0 ? (
          <>
            <View style={{ alignItems: 'center', marginTop: 150 }}>
              <LottieView
                source={require('../../../assets/animations/empty.json')}
                autoPlay
                loop
                style={{ width: 240, height: 240 }}
              />
              <Text style={{ color: '#888', marginTop: 50, marginBottom: 0, fontSize: 18 }}>No items yet.</Text>
            </View>
            <Animated.View style={[localStyles.animatedViewOrder, { transform: [{ translateY: slideAnim }], bottom: 205 }]}> 
              <TouchableOpacity
                style={styles.signupButton}
                onPress={() => router.push('/(tabs)/recordsrouter/add-item')}
              >
                <Text style={styles.signupButtonText}>Add Item</Text>
              </TouchableOpacity>
            </Animated.View>
          </>
        ) : (
          <FlatList
            data={[...items, { id: 'add', name: '', price: 0, emoji: '', unit: '', returnable: false, returned_qty: 0 }]}
            renderItem={({ item }) =>
              item.id === 'add' ? (
                <TouchableOpacity 
                  style={[localStyles.itemBox, { alignItems: 'center', justifyContent: 'center' }]} 
                  onPress={() => router.push('/(tabs)/recordsrouter/add-item')}
                >
                  <Text style={{ fontSize: 40, color: '#FF5A4D', marginBottom: 8 }}>＋</Text>
                  <Text style={[localStyles.name, { color: '#FF5A4D' }]}>Add Item</Text>
                </TouchableOpacity>
              ) : (
                renderItem({ item })
              )
            }
            keyExtractor={item => item.id}
            numColumns={2}
            contentContainerStyle={{ paddingBottom: 150 }}
            showsVerticalScrollIndicator={false}
          />
        )}
        <Animated.View style={[localStyles.animatedViewOrder, { transform: [{ translateY: slideAnim }], bottom: 105 }]}> 
          <TouchableOpacity
            style={[styles.signupButton, { opacity: cartCount > 0 ? 1 : 0 }]}
            onPress={() => router.push('/(tabs)/recordsrouter/view-order')}
            disabled={cartCount === 0}
            activeOpacity={cartCount > 0 ? 0.7 : 1}
          >
            <Text style={styles.signupButtonText}>View Order{cartCount > 0 ? ` (${cartCount})` : ''}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  itemBox: {
    flex: 1,
    backgroundColor: '#f8f8fa',
    margin: 8,
    borderRadius: 16,
    alignItems: 'center',
    padding: 16,
    minWidth: 140,
    maxWidth: '48%',
    position: 'relative',
  },
  emoji: { fontSize: 40, marginBottom: 8 },
  name: { fontWeight: 'bold', fontSize: 16, color: '#222' },
  price: { color: '#444', marginBottom: 8 },
  addButton: {
    backgroundColor: '#FFA500',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 18,
    marginTop: 8,
  },
  addButtonText: { color: '#fff', fontWeight: 'bold' },
  cartCount: {
    position: 'absolute',
    top: 8,
    right: 12,
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cartCountText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  animatedViewOrder: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#3333',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  qtyButton: {
    backgroundColor: '#FF5A4D',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginHorizontal: 4,
  },
  qtyButtonGreen: {
    backgroundColor: '#4CAF50',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginHorizontal: 4,
  },
  qtyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  qtyValue: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginHorizontal: 8,
  },
}); 