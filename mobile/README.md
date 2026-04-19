# PAL Mobile (Expo)

Same Supabase project and Next.js API (`/api/face/*`, etc.) as the web app.

## Expo Go: “Internet connection appears to be offline”

Expo Go uses that message when it **cannot load JavaScript from Metro on your Mac** — your phone may still have full internet. Fix connectivity to the dev server, not “Wi‑Fi off.”

1. **iPhone / iPad (very common):** **Settings → Expo Go → Local Network → ON.** Force-quit Expo Go, reopen, scan the QR again.
2. **Same Wi‑Fi:** Phone and Mac on the **same** network (not guest Wi‑Fi with client isolation). **VPN off** on both while testing.
3. **Mac firewall:** System **Settings → Network → Firewall** — allow **Node** / **Terminal**, or turn firewall off briefly to test.
4. **Start in LAN mode:** `npm run start:lan` from `mobile/`, then scan again.
5. **If built-in tunnel fails** (`remote gone away`): use the **Cloudflare `cloudflared` + `REACT_NATIVE_PACKAGER_HOSTNAME`** steps in **§6** below — that bypasses Expo’s shared tunnel.
6. **Sanity check:** On the phone, open **Safari** and try the **Metro URL** printed in the terminal (e.g. `http://192.168.x.x:8081`). If it never loads, the phone cannot reach your Mac until you fix Wi‑Fi/firewall or use a tunnel.

## 1. First-time setup

```bash
cd mobile
cp .env.example .env
# Edit .env — use the same Supabase URL + anon key as the web app.
# EXPO_PUBLIC_PAL_API_URL = your deployed Next URL (e.g. https://xxx.vercel.app)
npm install
```

## 2. In-app dashboard (first sidebar item per role)

After sign-in, **☰ Menu** opens the same left-rail sections as the web dashboard (**Attendance** is omitted until last).

| Role | Default screen | What it does |
|------|----------------|--------------|
| **Student** | **Events** | Upcoming / ongoing / past approved class events (same queries as web). Subject filter when you have multiple groups. |
| **Student** | **Calendar** | Same data as web **Calendar**; **Week** is the default (like react-big-calendar on the web). Week strip + optional **Month** grid, then **Classes & sessions** list (room, professor, groups, subject, time—tap a row for full detail). |
| **Professor** | **My Requests** | Your `calendar_requests` (merged by professor id + email), same as web **My Requests**. |
| **Professor** | **Calendar** | **All rooms** / **My schedule**, room filter, **Week** or **Month** scope, **Classes & sessions** list + detail sheet; **New request / book a slot** opens `/dashboard`. |
| **Professor** | **Attendance** | Same as web **Attendance** tab: your approved classes, enrolled students, present/absent from records, **Mark present / Mark absent** to override (same `upsert` as web). |
| **Admin** | **Requests → Overview** | Same Supabase aggregates as web **Admin → Requests → Overview** (guest house, sports, classrooms, people, health, mess). Date range + Refresh / Today. |
| **Admin** | **Calendar** | Campus-wide approved class + facility bookings; **Week** default, **Classes & sessions** list matching the web fields. |

All other menu rows open a **placeholder** with **Open The Nucleus (browser)** → `/dashboard` for the full web workflow.

## 3. Auth workflow (matches web)

- **Sign in** with the same email/password as on The Nucleus web login page (`signInWithPassword`).
- **Continue with Google** on login and signup uses the same Supabase provider as the web app (`signInWithOAuth` + PKCE). After Google returns to the app, **missing name or mobile** shows an in-app **Finish setup** screen (same data as web `/auth/onboarding`).
- **Students without face registration** see a card linking to **`/face-registration`** on the web (same rule as the website); native **Face registration** is in the menu.
- **Forgot password** is implemented in-app (email link must open this app; add **`thenucleus://reset-password`** to Supabase redirect URLs). **Sign up** still opens your **`EXPO_PUBLIC_PAL_API_URL`** in the browser (`/signup`) when you want the web flow.
- **Full dashboard** opens **`/dashboard`** in the browser until more screens are native.

### Google OAuth — Supabase redirect URL (required)

The app URL scheme is **`thenucleus`** (see `app.config.ts`). This is **not** the same as the store package / bundle id (`in.thenucleus.app`). Add the mobile callback to **Supabase → Authentication → URL Configuration → Redirect URLs**:

- **`thenucleus://auth/callback`** (dev client and production builds)
- **`thenucleus://reset-password`** (password reset from the in-app **Forgot password** flow; required for native reset links to return to the app)

**Password reset must use a build that registers the `thenucleus` URL scheme** (development client from `expo run:ios` / `expo run:android`, or a store/EAS build). **Expo Go does not open `thenucleus://` links**, so Mail/Safari may show “invalid address” after you tap the Supabase link. Request the reset from the same installed app, then open the email on the same device.

PKCE: the app stores a short-lived verifier when you tap “Send reset link”. If `exchangeCodeForSession` still fails, try requesting a new email without clearing app data.

If Google still fails after a native rebuild, log the resolved URI once (it can differ in rare Expo setups):

```ts
import { getGoogleOAuthRedirectUri } from "./src/lib/google-oauth";
console.log(getGoogleOAuthRedirectUri());
```

Add whatever exact string is printed to **Redirect URLs** as well.

## 4. Run Metro (one terminal for both phones)

```bash
cd mobile
npx expo start
```

- **Android:** install **Expo Go** from Play Store, scan the QR from the terminal/browser Dev Tools.
- **iOS:** install **Expo Go** from App Store, scan QR with the Camera app (or Expo Go).

**Same Wi‑Fi as your computer:** LAN URL works.

**Different network / VPN:** press `s` in the terminal and switch to **tunnel** (slower but works everywhere).

**Clear cache after changing `.env`:**

```bash
npx expo start -c
```

## 5. Testing Android + iOS in parallel

1. Start **one** `npx expo start` (leave it running).
2. Open **Expo Go** on **both** devices.
3. Scan the **same** QR on each (or enter the URL manually in Expo Go).
4. Both reload when you save code (Fast Refresh).

You do **not** need two Metro processes unless you want two different projects.

## 6. Xcode + physical iPhone (dev client / `expo run:ios`)

Use this when you build **PAL** in Xcode or install on a **real device** (not Expo Go).

### A. One-time / after pulling native changes

1. **Install JS deps** (repo root `mobile/`):

   ```bash
   cd mobile
   npm install
   ```

2. **Install CocoaPods** (required for `EXApplication` and every other native pod):

   ```bash
   npm run ios:pods
   ```

   Or: `cd ios && pod install`

3. **Node for Xcode script phases** — create `ios/.xcode.env` next to `Podfile` (this folder is often gitignored by Expo; the file lives only on your machine):

   ```sh
   # mobile/ios/.xcode.env
   export NODE_BINARY=$(command -v node)
   ```

   If Xcode still says **`node` not found** (common with nvm/fnm), create `ios/.xcode.env.local` with a **full path** to `node` (see `ios-xcode.env.local.example` in this folder).

### B. Open the correct project (critical)

- **Always open:** `mobile/ios/PAL.xcworkspace`
- **Never open only:** `mobile/ios/PAL.xcodeproj` — that skips the **Pods** project and causes errors like **missing `EXApplication.modulemap`** or empty `Build/Products/.../EXApplication`.

Quick open from `mobile/`:

```bash
npm run ios:workspace
```

### C. “Sandbox: bash … deny file-write-data … `PAL.app/ip.txt`”

Xcode **User Script Sandboxing** can block Expo/React Native build phases from writing into the app bundle. This repo sets **`ENABLE_USER_SCRIPT_SANDBOXING = NO`** on the **PAL** Xcode project. If you **regenerate** `ios/` with `expo prebuild --clean`, re-apply that setting (or turn off **User Script Sandboxing** under the project’s **Build Settings**) and rebuild.

### D. Clean build when things look “stale”

1. Quit Xcode.
2. **Delete Derived Data** for this app: Xcode → **Settings** → **Locations** → **Derived Data** → arrow → delete the **`PAL-…`** folder (or delete all).
3. Reopen **`PAL.xcworkspace`**.
4. **Product → Clean Build Folder** (hold **Option** if needed).
5. Build again.

### E. Signing & install on your iPhone

1. Connect the iPhone with USB (unlock it, tap **Trust** if asked).
2. On the phone: **Settings → Privacy & Security → Developer Mode** → **On** (iOS 16+), reboot if prompted.
3. In Xcode, select the **PAL** scheme and your **iPhone** as the run destination (not “Any iOS Device” only).
4. Select the **PAL** target → **Signing & Capabilities**:
   - Enable **Automatically manage signing**.
   - **Team:** your Apple ID / organization (must match a valid **App ID** for `in.thenucleus.app` in [Apple Developer](https://developer.apple.com/account) if you use capabilities; for local dev, Xcode often creates a development profile automatically).
5. **Product → Run** (▶). First install may require: iPhone → **Settings → General → VPN & Device Management** → trust the developer app.

**Bundle ID / Android package** is `in.thenucleus.app` (`app.config.ts`). If that ID is taken or not in your team, change it in **Expo config** and regenerate native projects (`npx expo prebuild --clean`) or adjust **Product Bundle Identifier** / **applicationId** in Xcode / Gradle to match your Apple Developer / Play Console identifiers.

### F. Wi‑Fi entitlement (optional)

`app.config.ts` only adds the **Wi‑Fi information** entitlement when `IOS_WIFI_INFO_ENTITLEMENT=1`. If signing fails because of entitlements, leave it **unset** unless you need attendance Wi‑Fi features on device.

### G. CLI alternative (same result as Xcode build)

From `mobile/`:

```bash
npm run ios
```

Picks a simulator by default; for **device**, connect the phone and run:

```bash
npx expo run:ios --device
```

---

## 7. EAS (store builds + dev clients) — when you’re ready

```bash
npm install -g eas-cli
eas login
cd mobile
eas init
```

`eas init` adds your `extra.eas.projectId` to `app.config.ts` (paste the block Expo gives you). Then:

- **Internal installable builds:** `eas build --profile preview --platform all`
- **Development client** (for native modules beyond Expo Go): `eas build --profile development --platform all`

Submit to stores: `eas submit` after production builds.

## 8. Web app / Vercel

The Next app at the repo root **excludes** `mobile/` in `tsconfig.json`, so Vercel `next build` is unchanged.

## 9. “Internet connection appears to be offline” (Expo Go / Metro)

That message almost always means the **phone cannot reach your dev machine** (where Metro runs), not that the public internet is down.

1. **Prefer LAN when you can** (most reliable; phone + Mac on same Wi‑Fi, no guest isolation):

   ```bash
   cd mobile
   npm run start:lan
   ```

2. **Built-in tunnel** (`npm run start:tunnel`) uses Expo’s shared ngrok pool. If you see **`failed to start tunnel` / `remote gone away`**, that service is overloaded or rate-limited—**not your project**. Retry later, or use LAN / your own tunnel below.

   The repo includes **`@expo/ngrok`** so you are not prompted to install it separately.

3. **Your own free tunnel (Cloudflare)** when LAN is impossible and Expo tunnel fails:

   ```bash
   brew install cloudflare/cloudflare/cloudflared
   ```

   Terminal A (leave running):

   ```bash
   cloudflared tunnel --url http://localhost:8081
   ```

   Copy the printed `https://….trycloudflare.com` hostname (no `https://`, no path)—e.g. `random-words.trycloudflare.com`.

   Terminal B:

   ```bash
   cd mobile
   REACT_NATIVE_PACKAGER_HOSTNAME=random-words.trycloudflare.com npx expo start --lan
   ```

   Scan the QR in Expo Go. Traffic goes: phone → Cloudflare → your Mac → Metro on `8081`.

4. **LAN checklist** (same Wi‑Fi as `start:lan` / default start):
   - Phone and computer on the **same Wi‑Fi** (not guest / “AP isolation” networks).
   - **VPN off** on both while testing.
   - **macOS firewall:** allow **Node** incoming connections, or temporarily turn firewall off to test.
   - **iOS:** Settings → Expo Go → enable **Local Network** (if you see it).

5. **Android emulator on the same machine:** USB or run:

   ```bash
   adb reverse tcp:8081 tcp:8081
   adb reverse tcp:19000 tcp:19000
   ```

6. **After changing `.env`:** `npm run start:clear` (or `npx expo start -c`).

7. **API URLs in `.env`:** `EXPO_PUBLIC_PAL_API_URL` must be a URL the **phone** can open (e.g. `https://your-app.vercel.app`). **Never** use `http://localhost:3000` here — on the phone, “localhost” is the phone itself.

8. **Supabase key:** use the **anon** key from Supabase → Project Settings → API (`eyJ…` JWT, or the current dashboard “anon public” key). If auth/API calls fail with odd errors, double-check the key matches the project.
