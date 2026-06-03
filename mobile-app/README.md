# 📱 MediReport AI Mobile Client

React Native mobile client built with **Expo Go (SDK 51)**. It provides interface layouts for camera scanning, manual value edits, health trends, cached daily wellness advice, and an official National Library of Medicine wiki.

## 📁 Directory Layout

```text
mobile-app/
├── components/         # Reusable styling layouts (Theme, AppCard, StatusBadge)
├── screens/            # Application screens
│   ├── DashboardScreen.js   # Main user home dashboard
│   ├── ScanScreen.js        # Camera scanner interface
│   ├── ResultScreen.js      # Biomarkers breakdown list and NLM browser links
│   ├── HistoryScreen.js     # Past user scan history
│   ├── TrendScreen.js       # Historical biomarkers trends charts
│   ├── WikiScreen.js        # Medical lab dictionary & encyclopedia
│   ├── ManualEntryScreen.js # Manual input form with reference range lookups
│   └── ProfileScreen.js     # Theme settings and account details
├── navigation/         # Navigators (Auth stack, App Bottom Tabs)
├── services/           # Services (FastAPI client, Supabase config, auth listener)
├── utils/              # Grid layouts and unit multipliers
├── assets/             # Launchers and splash screen graphics
├── app.json            # Android package names, permissions, and plugin settings
└── eas.json            # Cloud compilation profiles (APK, AAB)
```

## ⚙️ Key Features

1. **AsyncStorage Cache Layer**: Caches fresh Gemini-generated or curated daily health tips on-device so they display instantly even when running offline.
2. **Dashed NLM Buttons**: Renders a direct browser portal link on every biomarker card. When tapped, it launches the official MedlinePlus test article directly.
3. **Responsive Scaling Grid**: Tailored scales (`scale`, `verticalScale`, `fs` fonts) to guarantee visual alignment across various physical Android screen sizes.
4. **Offline Fallback UI**: Displays friendly warning banners and caches inputs when the FastAPI backend or Supabase database is unreachable.

## 🚀 Running the App Locally

Ensure you have Node.js installed, then execute:

```bash
# Install JavaScript dependencies
npm install

# Create environment variable file
# Set EXPO_PUBLIC_API_BASE_URL to your computer's local IP address (e.g. http://192.168.x.x:8000)
# Do NOT use localhost/127.0.0.1 as real phones cannot communicate with localhost.
cp .env.example .env

# Start Metro Bundler
npx expo start --clear
```

Scan the QR code displayed in the terminal with the **Expo Go app** on your Android device to test.

## 📦 Cloud App Compilation (EAS)

We configure build profiles inside `eas.json` to generate packages for test devices or deployment:

```bash
# Build stand-alone testing APK
eas build -p android --profile preview

# Compile production Google Play Store AAB
eas build -p android --profile production
```
