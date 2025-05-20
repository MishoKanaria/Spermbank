import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

interface GenerateQrModalProps {
  visible: boolean;
  onClose: () => void;
  value: string;
  label?: string;
}

export default function GenerateQrModal({ visible, onClose, value, label }: GenerateQrModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContent}>
          <View style={[styles.headerContainer, { marginBottom: 24 }]}> 
            <Text style={styles.header}>{label || 'QR Code'}</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={24} color="#D7263D" />
            </TouchableOpacity>
          </View>
          <View style={{ alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <QRCode value={value} size={250} />
            <Text style={{ marginTop: 16, color: '#888', textAlign: 'center' }}>Scan this QR code</Text>
          </View>
        </View>
      </View>
    </Modal>
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
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#D7263D',
  },
}); 