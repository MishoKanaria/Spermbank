import AsyncStorage from '@react-native-async-storage/async-storage';

export const savemerchantInfo = async (address: string, merchantInfo: any) => {
  await AsyncStorage.setItem(`merchantInfo_${address}`, JSON.stringify(merchantInfo));
};

export const uploadLogoToImgbb = async (imageUri: string, apiKey: string): Promise<string | null> => {
  try {
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
    return data.data?.url || null;
  } catch (error) {
    console.error('Error uploading logo:', error);
    return null;
  }
}; 