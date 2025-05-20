import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

interface AnimatedQRCodeProps {
  chunks: string[];
  size?: number;
  interval?: number;
  onPreRenderComplete?: () => void;
}

export default function AnimatedQRCode({ 
  chunks,
  size = 250, 
  interval = 100,
  onPreRenderComplete
}: AnimatedQRCodeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Start animation when chunks are ready
  useEffect(() => {
    if (chunks.length > 0) {
      setIsReady(true);
      
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Start new interval
      intervalRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          const next = (prev + 1) % chunks.length;
          return next;
        });
      }, interval);

      onPreRenderComplete?.();
    }

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [chunks.length, interval, onPreRenderComplete]);

  if (!isReady || chunks.length === 0) {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <View style={styles.loadingPlaceholder} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Pre-render all QR codes */}
      <View style={styles.qrContainer}>
        {chunks.map((chunk, index) => (
          <View
            key={index}
            style={[
              styles.qrWrapper,
              index === currentIndex ? styles.visible : styles.hidden
            ]}
          >
            <QRCode
              value={chunk}
              size={size}
              backgroundColor="white"
              color="black"
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrContainer: {
    position: 'relative',
    width: 250,
    height: 250,
  },
  qrWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visible: {
    opacity: 1,
    zIndex: 1,
  },
  hidden: {
    opacity: 0,
    zIndex: 0,
  },
  loadingPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  }
}); 
