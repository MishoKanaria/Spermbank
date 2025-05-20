import AsyncStorage from '@react-native-async-storage/async-storage';

export interface MerchantInfo {
  name: string;
  logoUrl: string;
  businessId: string;
  address: string;
  signature: string;
}

export interface MerchantItem {
  name: string;
  qty: number;
  price: number;
  discount: number;
  total: number;
}

export interface MerchantReceipt {
  receipt_id: string;
  merchant: MerchantInfo;
  items: MerchantItem[];
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

// Save merchant info (business account only)
export async function saveMerchantInfo(accountAddress: string, info: MerchantInfo) {
  await AsyncStorage.setItem(`merchantInfo_${accountAddress}`, JSON.stringify(info));
}

export async function getMerchantInfo(accountAddress: string): Promise<MerchantInfo | null> {
  const data = await AsyncStorage.getItem(`merchantInfo_${accountAddress}`);
  return data ? JSON.parse(data) : null;
}

// Save items for a pending purchase
export async function saveMerchantItems(accountAddress: string, items: MerchantItem[]) {
  await AsyncStorage.setItem(`merchantItems_${accountAddress}`, JSON.stringify(items));
}

export async function getMerchantItems(accountAddress: string): Promise<MerchantItem[]> {
  const data = await AsyncStorage.getItem(`merchantItems_${accountAddress}`);
  return data ? JSON.parse(data) : [];
}

// Generate a receipt
export async function generateMerchantReceipt(accountAddress: string, currency: string, tax: number): Promise<MerchantReceipt | null> {
  const merchant = await getMerchantInfo(accountAddress);
  const items = await getMerchantItems(accountAddress);
  if (!merchant || items.length === 0) return null;

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const discount = items.reduce((sum, item) => sum + item.discount, 0);
  const total = subtotal - discount + tax;

  return {
    receipt_id: `rct-${Date.now()}`,
    merchant,
    items,
    currency,
    subtotal,
    discount,
    tax,
    total,
  };
}

// Upload logo to imgbb (free image hosting)
export async function uploadLogoToImgbb(imageUri: string, apiKey: string): Promise<string | null> {
  const formData = new FormData();
  formData.append('image', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'logo.jpg',
  } as any);

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
    method: 'POST',
    body: formData,
  });
  const data = await response.json();
  return data?.data?.url || null;
} 