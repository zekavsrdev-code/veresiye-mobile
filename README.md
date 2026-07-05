# Veresiye — Mobile

Multi-tenant SaaS başlangıç tabanının mobil istemcisi. **Expo SDK 57 + React Native + Expo Router +
NativeWind**. Backend (`../backend`, Django/DRF) ile aynı API sözleşmesini, web (`../frontend`,
Next.js) ile aynı i18n key setini paylaşır — domain'siz base, kendi ekranlarınla değiştir.

> Mühendislik sözleşmesi + pattern'ler: [`CLAUDE.md`](./CLAUDE.md). Cross-cutting kurallar: workspace `CLAUDE.md`.

## Başlangıç

```bash
npm install
cp .env.example .env          # EXPO_PUBLIC_API_URL'i ayarla
npx expo start                # QR → Expo Go / dev client · i / a ile simulator
```

Backend'i ayağa kaldır (workspace root'tan): `.claude/skills/docker` → SaaS dev mode
(`backend` → `http://localhost:8000/api`).

**Fiziksel cihaz uyarısı:** `localhost` cihazın kendisine çözülür. Gerçek telefonda test için
`.env`'de `EXPO_PUBLIC_API_URL`'i makinenin LAN IP'sine ayarla (örn. `http://192.168.1.20:8000/api`)
ve telefonu aynı Wi-Fi'a bağla.

## Yapı

```
src/
  app/          # Expo Router (file-based) — _layout, index (korumalı), login
  context/      # auth (SecureStore token) + lang (i18n) provider/hook
  lib/          # api (backend adapter) · env (base URL) · i18n (tr/en)
```

## Komutlar

```bash
npx expo start                    # dev server
npx tsc --noEmit                  # typecheck
npx expo export --platform ios    # bundle smoke-test
npx expo lint                     # lint
```
