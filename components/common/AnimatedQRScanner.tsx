import { Feather } from '@expo/vector-icons';
import { CameraView } from 'expo-camera';
import React, { useCallback, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { decodeBase64 } from 'tweetnacl-util';

interface AnimatedQRScannerProps {
  onDataReceived: (data: string) => void;
  onClose: () => void;
}

// Helper function to convert base64 to hex
const base64ToHex = (base64: string): string => {
  const bytes = decodeBase64(base64);
  return '0x' + Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

export default function AnimatedQRScanner({ onDataReceived, onClose }: AnimatedQRScannerProps) {
  const [chunks, setChunks] = useState<{ [key: number]: string }>({});
  const [totalChunks, setTotalChunks] = useState<number | null>(null);

  const handleBarCodeScanned = useCallback(({ data }: { data: string }) => {
    try {
      const parsed = JSON.parse(data);
      
      if (parsed.chunk && parsed.total && parsed.data) {
        setChunks(prevChunks => {
          // Only update if we don't already have this chunk
          if (prevChunks[parsed.chunk]) {
            return prevChunks;
          }
          
          const newChunks = {
            ...prevChunks,
            [parsed.chunk]: parsed.data
          };
          
          // Check if we have all chunks
          if (Object.keys(newChunks).length === parsed.total) {
            // Sort chunks by their index and combine
            const sortedChunks = Object.entries(newChunks)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([_, data]) => data);
            
            const combinedData = sortedChunks.join('');
            
            // Convert base64 to hex before passing to onDataReceived
            try {
              const hexData = base64ToHex(combinedData);
              onDataReceived(hexData);
            } catch (e) {
              // If conversion fails, try to parse as JSON first
              try {
                const parsedData = JSON.parse(combinedData);
                onDataReceived(JSON.stringify(parsedData));
              } catch (e) {
                // If all else fails, send the raw combined data
                onDataReceived(combinedData);
              }
            }
          }
          
          return newChunks;
        });
        
        setTotalChunks(parsed.total);
      } else {
        // Handle non-chunked data
        onDataReceived(data);
      }
    } catch (e) {
      // If JSON parsing fails, treat as regular QR code
      onDataReceived(data);
    }
  }, [onDataReceived]);

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        onBarcodeScanned={handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      />
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Feather name="x" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 10,
  },
}); 