import { Stack } from 'expo-router';

// Ledger stack. Detail is a default push (edge-swipe back); create/entry/statement
// are modals (iOS card sheet) per the interaction spec.
export default function LedgerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="customer/[id]/index" />
      <Stack.Screen name="customer/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="customer/[id]/statement" options={{ presentation: 'modal' }} />
      <Stack.Screen name="entry" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
