# Veresiye — Mobile (Expo / React Native)

> Cross-cutting kurallar (dil, git, test/build disiplini, OSS lib, disiplin notları) workspace
> `CLAUDE.md`'de **canonical**. Burada sadece mobil pattern'leri. Domain'siz base — `app/index.tsx`
> (korumalı home) + `app/login.tsx` auth akışını canlı gösterir; kendi domain'inle değiştir.
> Web muadili: `frontend/` (Next.js) — API sözleşmesi ve i18n key seti **ortak**, drift ettirme.

## Stack

- **Expo SDK 57** + **React Native 0.86** + **React 19** (React Compiler açık — `app.json` experiments).
- **Expo Router** — file-based routing (`src/app/`), web'deki Next.js App Router'ın birebir muadili.
- **NativeWind** — Tailwind-for-RN. `className` prop'u ile web'deki aynı token dili.
- **expo-secure-store** — access token OS keychain'inde.

> Expo hızlı değişiyor — kod yazmadan önce sürüm-spesifik dokümana bak: `@AGENTS.md`.

## Ortam

Mobil **Docker'da koşmaz** (backend/frontend'in aksine) — Metro bundler + cihaz/emülatör host'ta çalışır.

```bash
cd mobile
npm install
npx expo start                 # QR → Expo Go / dev client
npx expo start --ios           # iOS simulator
npx expo start --android       # Android emulator
npx tsc --noEmit               # typecheck
npx expo export --platform ios # bundle smoke-test (metro/nativewind pipeline)
```

**API base URL:** `EXPO_PUBLIC_API_URL` (`.env` / `.env.example`). Default `http://localhost:8000/api`
sadece simulator/emulator loopback'inde çalışır — **fiziksel cihaz** makinenin LAN IP'sine ihtiyaç
duyar (`lib/env.ts` başındaki nota bak). Backend'i ayağa kaldırma: workspace `.claude/skills/docker`.

## Mimari pattern'ler

**Yapı:** `src/app/` route'lar · `src/context/` provider+hook · `src/lib/` adapter (api/env/i18n).
Provider zinciri `app/_layout.tsx`'te: `LangProvider → AuthProvider → Stack`.

**Auth guard — her korumalı ekranda** (web `useRequireAuth` muadili):
```tsx
const { user, loading } = useRequireAuth()   // yoksa /login'e replace eder
if (loading || !user) return null
```

**API** (`lib/api.ts` — web `api.ts`'in mirror'ı, cookie/SSR yok, JWT bearer):
```tsx
const data = await apiGet<T[] | { results: T[] }>('/endpoint/', token)
const items = unwrapList(data)
```
Hata: asla raw `err.message` — `getErrorMessage(err, t)` ile i18n'e map'le. Silent ignore yasak.

**Auth akışı** (`context/auth.tsx`): `login()` → `POST /auth/login/` → token SecureStore'a →
`GET /auth/me/`. Web httpOnly refresh-cookie rotation'ı mobilde taşınabilir değil — access token
keychain'de persist edilir; token-in-body refresh stratejisi sonraki iş (kod içinde not düşülü).

**i18n** (`lib/i18n.ts` — web ile **ortak key seti**): kullanıcıya dönen her string `t()` ile.
Yeni key → hem `tr` hem `en` (eksik = TS hatası) **ve** web `frontend/src/lib/i18n.ts` ile senkron.

## UI/UX

NativeWind `className` — token dili web ile ortak. Renk semantiği (workspace `TASARIM_DILI.md`):
`blue`=primary/active · `emerald`=success · `rose`=destructive-only · `amber`=warning · `gray`=neutral.
`darkMode: 'class'` (tailwind.config.js); `dark:` variant'ları web'deki gibi.

- Dokunma hedefi min ~44pt; buton feedback `active:opacity-80`.
- Toast vs inline: ekran açık kalıyor (form) → inline hata; redirect/kapanış → toast.
- Native input: `TextInput` (`autoCapitalize="none"`, `secureTextEntry`, `textContentType`).

## Test

- `npx tsc --noEmit` type-error şüphesinde / "bitti" demeden önce.
- `npx expo export --platform ios` → metro/babel/nativewind pipeline smoke-test (build kırığı yakalar).
- Küçük visual/CSS tuning sonrası test koşturma — hot reload yeterli (workspace kuralı).

## Kalite ilkeleri (prensip etiketi)

- **SOLID — SRP:** tekrar UI → `components/`, mantık → hook; ekran kompozisyon yapar, business logic yazmaz.
- **SOLID — DIP:** context/hook abstraction (`useAuth`/`useLang`) — doğrudan `fetch`'e değil `apiGet`'e bağlı.
- **DRY:** API tipleri + i18n key seti web ile **tek kaynak** (kopya-mirror drift eder); token'lar NativeWind.
- **Type safety:** `any` yasak; API tipleri `lib/api.ts` merkezi. Named export.
- **OSS adapter:** lib doğrudan ekrandan import edilmez — `lib/`/`context/` altında sarmalanır.
