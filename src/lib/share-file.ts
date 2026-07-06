// Export/share adapter — the ONLY place that touches expo-file-system /
// expo-sharing. Native-module boundary guard (see token-store.ts): unavailable
// until an EAS dev-client rebuild → returns false + console.warn.
//
// Uses expo-file-system's LEGACY API (downloadAsync + headers) on purpose: the
// SDK 57 File/Directory API has no first-class authenticated-download path,
// while the legacy downloadAsync(url, dest, { headers }) takes the Bearer
// header directly.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

let warned = false;
function warnOnce(err: unknown) {
  if (warned) return;
  warned = true;
  console.warn(
    'expo-file-system/expo-sharing unavailable — export download disabled until an EAS dev-client rebuild.',
    err,
  );
}

/** Downloads an authenticated file to the cache dir and opens the native share
 * sheet. Returns false (caller shows a toast) on any failure or unavailability. */
export async function downloadAndShare(
  url: string,
  token: string,
  fileName: string,
): Promise<boolean> {
  try {
    const dir = FileSystem.cacheDirectory;
    if (!dir) return false;
    const destination = `${dir}${fileName}`;
    const result = await FileSystem.downloadAsync(url, destination, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (result.status !== 200) return false;

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) return false;
    await Sharing.shareAsync(result.uri);
    return true;
  } catch (err) {
    warnOnce(err);
    return false;
  }
}
