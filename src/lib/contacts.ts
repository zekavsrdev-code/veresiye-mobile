// Contacts adapter — the ONLY place that touches expo-contacts. Native-module
// boundary guard (see token-store.ts): unavailable/version-skewed on the
// current dev client until an EAS rebuild → degrades to an empty list.
import { Contact, ContactField, getPermissionsAsync, requestPermissionsAsync } from 'expo-contacts';

export interface PickableContact {
  id: string;
  name: string;
  phone: string;
}

let warned = false;
function warnOnce(err: unknown) {
  if (warned) return;
  warned = true;
  console.warn(
    'expo-contacts unavailable — contact import disabled until an EAS dev-client rebuild.',
    err,
  );
}

/** Device contacts that have at least one phone number, name + first phone only. */
export async function listContactsWithPhones(): Promise<PickableContact[]> {
  try {
    const existing = await getPermissionsAsync();
    const granted = existing.granted || (await requestPermissionsAsync()).granted;
    if (!granted) return [];

    const details = await Contact.getAllDetails([ContactField.FULL_NAME, ContactField.PHONES]);
    const out: PickableContact[] = [];
    for (const c of details) {
      const phone = c.phones?.find((p) => !!p.number)?.number;
      if (!phone || !c.fullName) continue;
      out.push({ id: c.id, name: c.fullName, phone });
    }
    return out;
  } catch (err) {
    warnOnce(err);
    return [];
  }
}

// Strips separators, keeps a leading +90 or 0 as the user's device stored it —
// the API accepts free-form phone strings (see Customer.phone), this only
// removes noise (spaces/dashes/parens) a contact export commonly adds.
export function normalizePhone(raw: string): string {
  return raw.replace(/[\s\-().]/g, '');
}
