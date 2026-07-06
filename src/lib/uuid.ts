// Idempotency keys for ledger writes. crypto.randomUUID when the runtime has it
// (Hermes on recent Expo SDKs); Math.random v4 fallback — collision odds are
// irrelevant at per-merchant write volumes, and the DB constraint is per-tenant.
export function newIdempotencyKey(): string {
  const cryptoObj = globalThis.crypto as Crypto | undefined;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
