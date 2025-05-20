import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, SafeAreaView, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import styles from '../../styles/index.styles';

interface MerchantItem {
  id: string;
  emoji: string;
  name: string;
  price: number;
  image?: string;
  unit?: string;
  returnable: boolean;
  returned_qty: number;
}

export default function ViewOrder() {
  const [items, setItems] = useState<MerchantItem[]>([]);
  const [cart, setCart] = useState<{ [id: string]: number }>({});
  const [currentAccount, setCurrentAccount] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const account = await AsyncStorage.getItem('currentAccount');
      setCurrentAccount(account);
      if (account) {
        const itemsKey = `merchant_items_${account}`;
        const cartKey = `merchant_cart_${account}`;
        const storedItems = await AsyncStorage.getItem(itemsKey);
        const storedCart = await AsyncStorage.getItem(cartKey);
        setItems(storedItems ? JSON.parse(storedItems) : []);
        setCart(storedCart ? JSON.parse(storedCart) : {});
      }
      setLoading(false);
    };
    load();
  }, []);

  // Save cart to storage whenever it changes
  useEffect(() => {
    if (!currentAccount) return;
    const cartKey = `merchant_cart_${currentAccount}`;
    AsyncStorage.setItem(cartKey, JSON.stringify(cart));
  }, [cart, currentAccount]);

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => {
      const newQty = (prev[id] || 0) + delta;
      if (newQty <= 0) {
        const newCart = { ...prev };
        delete newCart[id];
        return newCart;
      }
      return { ...prev, [id]: newQty };
    });
  };

  const handleDelete = (id: string) => {
    setCart(prev => {
      const newCart = { ...prev };
      delete newCart[id];
      return newCart;
    });
  };

  const cartItems = items.filter(item => cart[item.id]);
  const total = cartItems.reduce((sum, item) => sum + (item.price * (cart[item.id] || 0)), 0);

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>Loading...</Text></View>;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, padding: 16, paddingTop: 40 }}>
        <Text style={{ fontWeight: 'bold', fontSize: 24, color: '#D7263D', marginBottom: 16 }}>Your Order</Text>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 270 }} showsVerticalScrollIndicator={false}>
          {cartItems.length === 0 ? (
            <Text style={{ color: '#888', textAlign: 'center', marginTop: 48 }}>No items in your order.</Text>
          ) : cartItems.map(item => (
            <Swipeable
              key={item.id}
              renderRightActions={() => (
                <View style={{ backgroundColor: 'transparent', width: 80, height: '100%' }} />
              )}
              onSwipeableOpen={() => handleDelete(item.id)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f8fa', borderRadius: 16, marginBottom: 16, padding: 12 }}>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12 }} />
                ) : (
                  <Text style={{ fontSize: 36, marginRight: 12 }}>{item.emoji}</Text>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{item.name}</Text>
                  <Text style={{ color: '#444' }}>
                    ${item.price.toFixed(2)}{item.unit ? `/${item.unit}` : ''}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity onPress={() => updateQuantity(item.id, -1)} style={{ backgroundColor: '#eee', borderRadius: 8, padding: 6, marginHorizontal: 4 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 18, color: '#D7263D' }}>-</Text>
                  </TouchableOpacity>
                  <Text style={{ fontWeight: 'bold', fontSize: 16, marginHorizontal: 4 }}>{cart[item.id]}</Text>
                  <TouchableOpacity onPress={() => updateQuantity(item.id, 1)} style={{ backgroundColor: '#eee', borderRadius: 8, padding: 6, marginHorizontal: 4 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 18, color: '#4CAF50' }}>+</Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ fontWeight: 'bold', marginLeft: 16 }}>${(item.price * (cart[item.id] || 0)).toFixed(2)}</Text>
              </View>
            </Swipeable>
          ))}
        </ScrollView>
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: 125, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'stretch', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ fontWeight: 'bold', fontSize: 16 }}>Subtotal</Text>
            <Text style={{ fontWeight: 'bold', fontSize: 16 }}>${total.toFixed(2)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ fontWeight: 'bold', fontSize: 16 }}>Tax (10%)</Text>
            <Text style={{ fontWeight: 'bold', fontSize: 16 }}>${(total * 0.10).toFixed(2)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontWeight: 'bold', fontSize: 18 }}>Total</Text>
            <Text style={{ fontWeight: 'bold', fontSize: 18 }}>${(total * 1.10).toFixed(2)}</Text>
          </View>
          <TouchableOpacity style={styles.signupButton} onPress={() => router.push('./confirm-order')} disabled={cartItems.length === 0}>
            <Text style={styles.signupButtonText}>Confirm Order</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
} 