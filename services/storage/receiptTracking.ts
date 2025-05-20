import AsyncStorage from '@react-native-async-storage/async-storage';

interface ReceiptTracking {
  original_receipt_id: string;
  timestamp: number;
  return_count: number;
  return_receipt_ids: string[];
}

// Get the tracking data for a receipt
export async function getReceiptTracking(receiptId: string): Promise<ReceiptTracking | null> {
  try {
    const data = await AsyncStorage.getItem(`receipt_tracking_${receiptId}`);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error('Error getting receipt tracking:', err);
    return null;
  }
}

// Initialize tracking for a new receipt
export async function initializeReceiptTracking(receipt: any): Promise<void> {
  try {
    const tracking: ReceiptTracking = {
      original_receipt_id: receipt.receipt_id,
      timestamp: Date.now(),
      return_count: 0,
      return_receipt_ids: []
    };
    await AsyncStorage.setItem(`receipt_tracking_${receipt.receipt_id}`, JSON.stringify(tracking));
  } catch (err) {
    console.error('Error initializing receipt tracking:', err);
  }
}

// Add a return to the tracking
export async function addReturnToTracking(originalReceiptId: string, returnReceiptId: string): Promise<boolean> {
  try {
    const tracking = await getReceiptTracking(originalReceiptId);
    if (!tracking) return false;

    // Add the return receipt ID to tracking
    tracking.return_receipt_ids.push(returnReceiptId);
    tracking.return_count += 1;

    await AsyncStorage.setItem(`receipt_tracking_${originalReceiptId}`, JSON.stringify(tracking));
    return true;
  } catch (err) {
    console.error('Error adding return to tracking:', err);
    return false;
  }
}

// Get all return receipt IDs for a receipt
export async function getReturnReceiptIds(receiptId: string): Promise<string[]> {
  try {
    const tracking = await getReceiptTracking(receiptId);
    return tracking?.return_receipt_ids || [];
  } catch (err) {
    console.error('Error getting return receipt IDs:', err);
    return [];
  }
}

// Get return count for a receipt
export async function getReturnCount(receiptId: string): Promise<number> {
  try {
    const tracking = await getReceiptTracking(receiptId);
    return tracking?.return_count || 0;
  } catch (err) {
    console.error('Error getting return count:', err);
    return 0;
  }
} 