import { Feather } from '@expo/vector-icons';
import { Camera, CameraView } from 'expo-camera';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Addresses {
  sr25519: string;
  ed25519: string;
}

export default function GetSenderAddress({ onAddressReceived }: { onAddressReceived?: (addresses: Addresses) => void }) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    const checkCameraPermissions = async () => {
      const { status } = await Camera.getCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    checkCameraPermissions();
  }, []);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    setScanned(true);
    try {
      // Try to parse as JSON
      try {
        const parsedData = JSON.parse(data);
        if (parsedData.sr25519 && parsedData.ed25519) {
          onAddressReceived?.({
            sr25519: parsedData.sr25519,
            ed25519: parsedData.ed25519
          });
          return;
        }
      } catch (e) {
        // If JSON parsing fails, check if it's a direct sr25519 address
        if (data.startsWith('5') && data.length === 48) {
          onAddressReceived?.({
            sr25519: data,
            ed25519: '' // No ed25519 address available
          });
          return;
        }
      }
      console.error('Invalid QR code data:', data);
    } catch (e) {
      console.error('Error processing QR code:', e);
    }
  };

  if (hasPermission === null) {
    return;
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Feather name="camera-off" size={96} color="#D7263D" style={{ marginBottom: 24 }} />
          <Text style={styles.title}>Camera Access Required</Text>
          <Text style={styles.statusText}>Please enable camera access to scan QR codes</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  camera: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 8,
    textAlign: 'center',
  },
  statusText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  }
}); 