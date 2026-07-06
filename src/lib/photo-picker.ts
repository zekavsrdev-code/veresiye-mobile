// Photo picker adapter — the ONLY place that touches expo-image-picker.
// Native-module boundary guard (see token-store.ts): unavailable/version-skewed
// on the current dev client until an EAS rebuild → degrades to `null` + warn.
import * as ImagePicker from 'expo-image-picker';

export interface PickedPhoto {
  uri: string;
  mimeType: string;
  fileName: string;
}

let warned = false;
function warnOnce(err: unknown) {
  if (warned) return;
  warned = true;
  console.warn(
    'expo-image-picker unavailable — photo capture disabled until an EAS dev-client rebuild.',
    err,
  );
}

function toPickedPhoto(asset: ImagePicker.ImagePickerAsset): PickedPhoto {
  return {
    uri: asset.uri,
    mimeType: asset.mimeType ?? 'image/jpeg',
    fileName: asset.fileName ?? `receipt-${Date.now()}.jpg`,
  };
}

export async function pickFromCamera(): Promise<PickedPhoto | null> {
  try {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      allowsEditing: false,
    });
    if (result.canceled || result.assets.length === 0) return null;
    return toPickedPhoto(result.assets[0]);
  } catch (err) {
    warnOnce(err);
    return null;
  }
}

export async function pickFromGallery(): Promise<PickedPhoto | null> {
  try {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return null;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      allowsEditing: false,
      allowsMultipleSelection: false,
    });
    if (result.canceled || result.assets.length === 0) return null;
    return toPickedPhoto(result.assets[0]);
  } catch (err) {
    warnOnce(err);
    return null;
  }
}
