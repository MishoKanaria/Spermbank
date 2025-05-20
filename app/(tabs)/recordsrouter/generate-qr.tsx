import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

export default function GenerateQrPage() {
  const router = useRouter();
  const { value, label } = useLocalSearchParams();
  const [copied, setCopied] = useState(false);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <View style={{ position: 'absolute', top: 40, right: 20 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="x" size={28} color="#D7263D" />
        </TouchableOpacity>
      </View>
      <Text style={{ fontWeight: 'bold', fontSize: 24, color: '#D7263D', marginBottom: 24 }}>
        {label || 'QR Code'}
      </Text>
      <TouchableOpacity
        onLongPress={async () => {
          await Clipboard.setStringAsync(typeof value === 'string' ? value : '');
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        delayLongPress={500}
        style={{ alignSelf: 'center' }}
      >
        <QRCode value={typeof value === 'string' ? value : ''} size={300} />
      </TouchableOpacity>
      {copied && (
        <Text style={{ color: '#4CAF50', marginTop: 8, fontWeight: 'bold' }}>Copied!</Text>
      )}
    </View>
  );
} 