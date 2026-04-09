# PAL Student Attendance (iOS & Android)

Expo (React Native) app for **student face attendance only**. It uses the same Supabase project and the same face pipeline as the PAL web app:

1. Upload capture to `face-photos` storage  
2. `POST /api/face/compare` on your deployed Next.js app (with `Authorization: Bearer <access_token>`)  
3. Insert into `attendance_records`  

## Prerequisites

- Node 20+  
- [Expo CLI](https://docs.expo.dev/get-started/set-up-your-environment/) (or `npx expo`)  
- Physical device recommended for camera (simulators have limited camera support)  

## Configure

```bash
cd mobile/student-attendance
cp .env.example .env
# Edit .env — set Supabase URL, anon key, and PAL web app URL
```

`EXPO_PUBLIC_PAL_API_URL` must be the **HTTPS origin** of your deployed PAL Next.js app (e.g. Vercel). The app calls `https://<that-host>/api/face/compare`.

**Web app:** deploy the latest PAL repo so `src/lib/supabase/route-client.ts` is live — it accepts the mobile `Authorization` header for the compare route.

## Run

```bash
npm install
npx expo start -c
```

`-c` clears the Metro cache (do this after any `.env` change). Then scan the QR code with **Expo Go** on your phone (same Wi‑Fi as your computer, or use **tunnel**: `npx expo start -c --tunnel`).

### “Unknown error” when scanning the QR code

1. **Fix `.env` format** — no spaces around `=`, no quotes, e.g. `EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co`
2. **Restart with cache clear:** `npx expo start -c`
3. **Update Expo Go** from the App Store / Play Store (must support your Expo SDK).
4. **Try tunnel:** `npx expo start -c --tunnel` if LAN connection fails.
5. **New Architecture** is disabled in `app.json` for better Expo Go compatibility; custom dev clients can re-enable later.

Then press `i` for iOS simulator or `a` for Android emulator.

## Build for stores

Use [EAS Build](https://docs.expo.dev/build/introduction/):

```bash
npx eas-cli login
npx eas build:configure
npx eas build --platform ios
npx eas build --platform android
```

## Student flow

1. Sign in with the same email/password as the web app (student role).  
2. Register your face on the **web** first (Face Registration).  
3. On class day, during the **15-minute window after start**, tap **Take photo & mark attendance** for today’s class.  

## Tech stack

- Expo SDK 54 / React Native  
- `@supabase/supabase-js` + AsyncStorage sessions  
- `expo-camera` (front camera)  
- Same RLS and APIs as the web app  
