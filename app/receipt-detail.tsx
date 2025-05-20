import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

interface BasicReceipt {
  receipt_id?: string;
  original_receipt_id?: string;
  status?: string;
  merchant?: {
    name?: string;
    address?: string;
    businessId?: string;
    logoUrl?: string;
  };
  items?: Array<{
    id: string;
    qty: number;
    name: string;
    price?: number;
    total?: number;
    discount?: number;
    returnable?: boolean;
    returned_qty?: number;
  }>;
  currency?: string;
  subtotal?: number;
  tax?: number;
  gst?: number;
  total?: number;
  discount?: number;
  returns?: {
    total_returns: number;
    returned_amount: number;
    items?: Array<{
      id: string;
      qty: number;
      name: string;
      price?: number;
      total?: number;
      returned_qty?: number;
    }>;
  };
  metadata?: {
    chain: string;
    version: string;
    network: string;
  };
}

interface TxInfo {
  date?: string;
  txHash?: string;
  blockHash?: string;
}

const ReceiptDetailScreen = () => {
  const params = useLocalSearchParams();
  let decryptedReceipt: BasicReceipt = {};
  let txInfo: TxInfo = {};

  try {
    if (params.decryptedReceipt) {
      decryptedReceipt = JSON.parse(params.decryptedReceipt as string);
    }
    if (params.txInfo) {
      txInfo = JSON.parse(params.txInfo as string);
    }
  } catch (error) {
    console.error('Error parsing receipt data:', error);
  }

  const merchant = decryptedReceipt?.merchant || {};
  const items = decryptedReceipt?.items || [];
  const currency = '$';
  const subtotal = decryptedReceipt?.subtotal || 0;
  const tax = decryptedReceipt?.tax || 0;
  const gst = decryptedReceipt?.gst || 0;
  const total = decryptedReceipt?.total || 0;
  const discount = decryptedReceipt?.discount || 0;
  const date = txInfo?.date || '';
  const txHash = txInfo?.txHash || '';
  const blockHash = txInfo?.blockHash || '';
  const totalReturns = decryptedReceipt?.returns?.total_returns || 0;
  const returnedAmount = decryptedReceipt?.returns?.returned_amount || 0;

  // Filter items for main section (not fully returned)
  const nonReturnedItems = items.filter(item => (item.qty ?? 0) - (item.returned_qty ?? 0) > 0);
  // Filter items for returned section
  const returnedItems = items.filter(item => (item.returned_qty ?? 0) > 0);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <LinearGradient
        colors={['#ffd6cc', '#ffb199', '#d16ba5']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.logoContainer}>
          {merchant.logoUrl ? (
            <Image source={{ uri: merchant.logoUrl }} style={styles.logo} />
          ) : (
            <View style={[styles.logo, { backgroundColor: '#fff' }]} />
          )}
        </View>
        <Text style={styles.merchantName}>{merchant.name || 'merchant'}</Text>
        {merchant.address ? (
          <Text style={styles.address}>{merchant.address}</Text>
        ) : null}
        {merchant.businessId ? (
          <Text style={styles.businessId}>{merchant.businessId}</Text>
        ) : null}
        {totalReturns > 0 && (
          <View style={styles.returnsBadge}>
            <Text style={styles.returnsBadgeText}>
              {totalReturns} {totalReturns === 1 ? 'Return' : 'Returns'}
            </Text>
          </View>
        )}
        {returnedAmount > 0 && (
          <Text style={styles.returnedAmount}>
            {currency}{returnedAmount.toFixed(2)} Returned
          </Text>
        )}
      </LinearGradient>

      <View style={styles.container}>
        <Text style={styles.receiptId}>Receipt ID: {decryptedReceipt?.receipt_id || 'N/A'}</Text>

        {/* Items */}
        <View style={styles.itemsSection}>
          {nonReturnedItems.length === 0 ? (
            <Text style={{ color: '#888', textAlign: 'center' }}>No unreturned items</Text>
          ) : (
            nonReturnedItems.map((item, idx) => {
              const remainingQty = (item.qty ?? 0) - (item.returned_qty ?? 0);
              const itemTotal = (item.price ?? 0) * remainingQty;
              return (
                <View key={idx} style={styles.itemRow}>
                  <Text style={styles.itemQty}>{remainingQty}</Text>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.itemPrice}>{currency}{itemTotal.toFixed(2)}</Text>
                    <Text style={styles.itemPriceSmall}>{currency}{(item.price ?? 0).toFixed(2)} each</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Returned Items */}
        {returnedItems.length > 0 && (
          <View style={styles.returnsSection}>
            <Text style={styles.returnsSectionTitle}>Returned Items</Text>
            {returnedItems.map((item, idx) => (
              <View key={idx} style={styles.returnItemRow}>
                <View style={styles.returnItemLeft}>
                  <Text style={styles.returnItemQty}>{item.returned_qty}</Text>
                  <Text style={styles.returnItemName}>{item.name}</Text>
                </View>
                <View style={styles.returnItemRight}>
                  <Text style={styles.returnItemPrice}>
                    -{currency}{((item.price || 0) * (item.returned_qty || 0)).toFixed(2)}
                  </Text>
                  <Text style={styles.itemPriceSmall}>{currency}{(item.price ?? 0).toFixed(2)} each</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{currency}{subtotal.toFixed(2)}</Text>
          </View>
          {discount > 0 && (
            <View style={styles.totalsRow}>
              <Text style={[styles.totalsLabel, { color: '#2E7D32' }]}>Discount</Text>
              <Text style={[styles.totalsValue, { color: '#2E7D32' }]}>
                -{currency}{discount.toFixed(2)}
              </Text>
            </View>
          )}
          {tax > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Tax</Text>
              <Text style={styles.totalsValue}>{currency}{tax.toFixed(2)}</Text>
            </View>
          )}
          {gst > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>GST</Text>
              <Text style={styles.totalsValue}>{currency}{gst.toFixed(2)}</Text>
            </View>
          )}
          {returnedAmount > 0 && (
            <View style={styles.totalsRow}>
              <Text style={[styles.totalsLabel, { color: '#D7263D' }]}>Returns</Text>
              <Text style={[styles.totalsValue, { color: '#D7263D' }]}>
                -{currency}{returnedAmount.toFixed(2)}
              </Text>
            </View>
          )}
          <View style={styles.totalsRow}>
            <Text style={[styles.totalsLabel, { fontWeight: 'bold', fontSize: 18 }]}>Total</Text>
            <Text style={[styles.totalsValue, { fontWeight: 'bold', fontSize: 18 }]}>
              {currency}{total.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Footer */}
        {date ? (
          <View style={styles.footerSection}>
            <Text style={styles.footerLabel}>Date Of Transaction</Text>
            <Text style={styles.footerValue}>{date}</Text>
          </View>
        ) : null}
        {txHash ? (
          <View style={styles.footerSection}>
            <Text style={[styles.footerLabel, { marginTop: 12 }]}>Transaction ID</Text>
            <View style={{ alignItems: 'center', marginTop: 8 }}>
              <QRCode
                value={`block:${blockHash}:tx:${txHash}`}
                size={80}
              />
            </View>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  logoContainer: {
    backgroundColor: '#fff',
    borderRadius: 48,
    padding: 8,
    marginBottom: 8,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    resizeMode: 'contain',
  },
  merchantName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  businessId: {
    fontSize: 14,
    textAlign: 'center',
    color: '#fff',
    opacity: 0.85,
  },
  address: {
    fontSize: 10,
    textAlign: 'center',
    color: '#fff',
    opacity: 0.85,
  },
  container: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: -24,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  receiptId: {
    fontSize: 14,
    color: '#D7263D',
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  itemsSection: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
    paddingVertical: 12,
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemQty: {
    fontSize: 15,
    color: '#888',
    width: 24,
    textAlign: 'right',
  },
  itemName: {
    flex: 1,
    fontSize: 16,
    color: '#222',
    marginLeft: 8,
  },
  itemPrice: {
    fontSize: 16,
    color: '#222',
    fontWeight: 'bold',
  },
  itemPriceSmall: {
    fontSize: 12,
    color: '#888',
  },
  totalsSection: {
    borderTopWidth: 1,
    borderColor: '#eee',
    paddingTop: 12,
    marginBottom: 12,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  totalsLabel: {
    fontSize: 15,
    color: '#888',
  },
  totalsValue: {
    fontSize: 15,
    color: '#222',
    fontWeight: 'bold',
  },
  footerSection: {
    alignItems: 'center',
    marginTop: 16,
  },
  footerLabel: {
    fontSize: 13,
    color: '#888',
    marginBottom: 2,
  },
  footerValue: {
    fontSize: 15,
    color: '#222',
    marginBottom: 2,
  },
  returnsBadge: {
    backgroundColor: '#D7263D',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  returnsBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  returnedAmount: {
    color: '#fff',
    fontSize: 14,
    marginTop: 4,
    opacity: 0.9,
  },
  returnsSection: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
    paddingVertical: 12,
    marginBottom: 12,
  },
  returnsSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D7263D',
    marginBottom: 8,
  },
  returnItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  returnItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  returnItemRight: {
    alignItems: 'flex-end',
  },
  returnItemQty: {
    fontSize: 15,
    color: '#D7263D',
    width: 24,
    textAlign: 'right',
  },
  returnItemName: {
    flex: 1,
    fontSize: 16,
    color: '#222',
    marginLeft: 8,
  },
  returnItemPrice: {
    fontSize: 16,
    color: '#D7263D',
    fontWeight: 'bold',
  },
});

export default ReceiptDetailScreen; 