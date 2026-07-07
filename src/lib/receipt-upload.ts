// Receipt-photo upload adapter — the ONLY place that does a multipart file POST.
//
// Uses expo-file-system's native multipart uploadAsync instead of fetch+FormData:
// RN's fetch chokes on FormData file parts on 0.86/Fabric (the request never
// leaves the device — surfaces as a bogus "network error"), while uploadAsync
// streams the file natively. Legacy FS API (see share-file.ts) for the same
// SDK-57 reason. Native-module boundary guard: unavailable pre-EAS-rebuild →
// throws a clean ApiError the caller already knows how to toast.
import * as FileSystem from 'expo-file-system/legacy';

import {
  ApiError,
  apiUrl,
  getSessionAccess,
  refreshAccessToken,
  type LedgerTransaction,
} from './api';

type Attachment = LedgerTransaction['attachments'][number];

async function _upload(txId: string, fileUri: string, mimeType: string, bearer: string) {
  return FileSystem.uploadAsync(
    apiUrl(`/transactions/${txId}/attachments/`),
    fileUri,
    {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'image',
      mimeType,
      headers: {
        Authorization: `Bearer ${bearer}`,
        'X-Client-Platform': 'mobile',
      },
    },
  );
}

export async function uploadReceipt(
  txId: string,
  fileUri: string,
  mimeType: string,
): Promise<Attachment> {
  let res;
  try {
    res = await _upload(txId, fileUri, mimeType, getSessionAccess() ?? '');
  } catch {
    throw new ApiError(0, 'network_error', 'network_error');
  }

  // Access token expired mid-session → rotate once and retry (mirrors the
  // request() core, which this native path bypasses).
  if (res.status === 401) {
    const fresh = await refreshAccessToken();
    if (fresh) {
      try {
        res = await _upload(txId, fileUri, mimeType, fresh);
      } catch {
        throw new ApiError(0, 'network_error', 'network_error');
      }
    }
  }

  if (res.status < 200 || res.status >= 300) {
    let code = 'error';
    let detail = `HTTP ${res.status}`;
    let errors: Record<string, string[]> | null = null;
    try {
      const data = JSON.parse(res.body);
      if (data.code) code = data.code;
      if (data.detail) detail = String(data.detail);
      if (data.errors) errors = data.errors;
    } catch {
      // body wasn't JSON
    }
    throw new ApiError(res.status, code, detail, errors);
  }

  return JSON.parse(res.body) as Attachment;
}
