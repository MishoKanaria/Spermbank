import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

export default function WelcomeScreen() {
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const navigationDelay = 2000; // 2 seconds for one cycle

  useEffect(() => {
    AsyncStorage.getItem('account').then((data) => {
      if (data) {
        try {
          const parsed = JSON.parse(data);
          setName(parsed.name);
        } catch {}
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/(tabs)');
    }, navigationDelay);
    return () => clearTimeout(timer);
  }, [router]);

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" />;
  }

  return (
    <LottieView
      source={require('../assets/animations/confetti.json')}
      autoPlay
      loop={false}
      style={{ flex: 1 }}
      resizeMode="cover"
    />
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
  logoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  logoText: {
    color: '#bbb',
    fontSize: 20,
  },
  welcomeText: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#D7263D',
    textAlign: 'center',
    marginBottom: 32,
  },
  startButton: {
    backgroundColor: '#FF5A4D',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
}); 