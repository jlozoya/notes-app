# 📱 notes-app (client)

A **React Native (Expo)** client for a collaborative notes app, styled with **Tailwind**. Create, edit, and sync rich-text notes in real time.

> This repo contains the **mobile client only**. The backend (API + websockets) lives in a separate service.

---

## ✨ Features

* 📝 Rich text note editor (mobile-friendly)
* 🔄 Real-time updates (Socket.IO)
* 👤 Auth-ready structure (login/register screens/hooks)
* 🎨 **Tailwind** styling via NativeWind
* 🧭 Expo Router navigation
* 🚀 OTA updates & EAS builds (optional)

---

## 🧰 Tech Stack

* **React Native** (Expo SDK)
* **TypeScript**
* **Expo Router**
* **Tailwind** via **NativeWind**
* **Socket.IO client**
* **Jest** for testing

---

## 🚀 Quick Start

### 1) Prerequisites

* Node.js 18+ (20 recommended)
* Git
* Expo CLI (optional):

  ```bash
  npm i -g expo-cli
  ```
* Android Studio (SDK/AVD) and/or Xcode (for iOS)

### 2) Install

```bash
# from repository root or client folder
cd frontend   # or the folder where this app lives
npm ci        # or npm install
```

### 3) Environment

Create a `.env` file (or use your CI secrets) with at least:

```bash
# Base API origin (no trailing slash)
EXPO_PUBLIC_API_URL=https://notesapp.lozoya.org
EXPO_PUBLIC_WEB_BASE=https://notesapp.lozoya.org
```

> All vars prefixed with `EXPO_PUBLIC_` are embedded at build time and available via `process.env.EXPO_PUBLIC_*`.

### 4) Run

```bash
# start dev server
npm run start

# open on Android emulator/device
npm run android

# open on iOS simulator (macOS)
npm run ios

# optional: run on web (for simple previews)
npm run web
```

> If you test on a real Android device over USB and your backend runs on `localhost` of your computer, you may need:
>
> ```bash
> adb reverse tcp:4000 tcp:4000
> ```
>
> (Change ports to match your API/socket server.)

---

## 📂 Project Structure

```
frontend/
├─ src/
│  ├─ app/                     # Expo Router routes (screens/layouts)
│  │  ├─ (auth)/               # login/register
│  │  ├─ (app)/notes/          # notes list + editor
│  │  └─ _layout.tsx
│  ├─ components/           # UI components
│  ├─ hooks/                # custom hooks (auth, notes, sockets)
│  ├─ lib/                  # API client, socket factory, utils
│  └─ styles/               # tailwind & theme helpers
├─ assets/                  # images/fonts
├─ app.json                 # Expo config
├─ tailwind.config.js       # Tailwind config
├─ babel.config.js
└─ package.json
```

---

## 🎨 Tailwind Setup (NativeWind)

* **NativeWind** is used to bring Tailwind classes to React Native components.
* Typical setup includes:

  * `nativewind` in dependencies
  * `tailwind.config.js` with your theme
  * `babel.config.js` with `nativewind/babel` plugin

Example `tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

Example `babel.config.js` addition:

```js
plugins: ["nativewind/babel"]
```

Use in components:

```tsx
<View className="flex-1 bg-white dark:bg-black">
  <Text className="text-xl font-semibold">Hello Notes</Text>
</View>
```

---

## 🔌 API & Realtime

The client uses:

* `EXPO_PUBLIC_API_URL` for REST endpoints (e.g. `https://notesapp.lozoya.org`).
* `EXPO_PUBLIC_WEB_BASE` to set the domain to share notes (e.g. `https://notesapp.lozoya.org`).
* A Socket.IO client pointing to the same origin (or a dedicated socket URL if you set one).

> Make sure your backend CORS/socket config allows the app’s origin/scheme.

---

## 🧪 Testing

* Jest is configured for TypeScript. If you don’t have tests yet, you can let CI pass without them:

```jsonc
// package.json
{
  "scripts": {
    "test": "jest --passWithNoTests"
  }
}
```

Run tests:

```bash
npm test
```

---

## 📦 Builds (EAS)

If you use **EAS**:

```bash
# login
eas login

# configure credentials (once)
eas credentials -p android
# eas credentials -p ios   # macOS with Apple dev account

# build
eas build --platform android --profile production --non-interactive
# eas build --platform ios --profile production --non-interactive
```

> Ensure `EXPO_PUBLIC_*` envs are set in your EAS project or CI.

---

## 🔧 Troubleshooting

**Android SDK path**

* If Metro/Gradle complains about SDK, verify: ANDROID_HOME and JAVA_HOME

* Confirm `platform-tools` in your PATH and `adb devices` works.

**CORS / Socket connection**

* If the client can’t reach the backend, confirm:

  * `EXPO_PUBLIC_API_URL` points to a reachable host from the device/emulator.
  * Backend CORS allows your scheme (`exp://`, `http://`, or production `https://`).
  * For local dev on Android emulator: use `10.0.2.2` to target host machine.

**Expo Router**

* If you see routing errors, ensure your `app/` folder contains a `_layout.tsx` and screens export default components.

---

## 🗺️ Scripts

```jsonc
{
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "build": "expo build",               // legacy; prefer EAS
    "test": "jest --passWithNoTests",
    "lint": "eslint ."
  }
}
```

---

## 🔒 Environment Variables (summary)

| Var                   | Example                       | Notes                              |
| --------------------- | ----------------------------- | ---------------------------------- |
| `EXPO_PUBLIC_API_URL` | `https://notesapp.lozoya.org` | Required – base URL for API/socket |

> Add more `EXPO_PUBLIC_*` keys as your app grows (feature flags, sentry DSN, etc.).

---

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feat/awesome`
2. Commit: `git commit -m "feat: add awesome"`
3. Push: `git push origin feat/awesome`
4. Open a PR

Please follow the existing code style and run `lint` before submitting.

---

## 📄 License

MIT — use it, hack it, improve it.
