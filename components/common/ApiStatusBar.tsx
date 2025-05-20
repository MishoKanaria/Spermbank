import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useApi } from '../../app/contexts/ApiContext';

export default function ApiStatusBar() {
  const { isApiReady } = useApi();

  if (isApiReady) return null;

  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" color="#fff" />
      <Text style={styles.text}>Connecting...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: '#D7263D',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    zIndex: 9999,
  },
  text: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 13,
    fontWeight: 'bold',
  },
}); 