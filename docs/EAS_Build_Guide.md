# EAS Build and Play Store Deployment Guide

This guide details the exact steps to configure, build, and submit the **MediReport AI** Android mobile application to the Google Play Store using **EAS (Expo Application Services)**.

---

## 🛠️ Step 1: Install EAS CLI & Log In

EAS CLI is the command-line tool used to build your React Native app in the cloud.

1. **Install EAS CLI globally**:
   ```bash
   npm install -g eas-cli
   ```

2. **Log in to your Expo account**:
   ```bash
   eas login
   ```
   *If you do not have an Expo account, create one at [expo.dev](https://expo.dev).*

3. **Initialize the EAS Project**:
   Run this command in the `mobile-app` directory to link the project to your Expo account:
   ```bash
   cd mobile-app
   eas project:init
   ```

---

## 🔒 Step 2: Set Up Production Environment Variables

Ensure that your production environment variables (Supabase keys and HTTPS Production Backend API URL) are set up correctly.

1. Create/edit your **`.env`** file in the `mobile-app` directory:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://azzagpnsymotbcejxubb.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-production-supabase-key
   EXPO_PUBLIC_API_BASE_URL=https://api.medireport.ai
   ```
   > [!IMPORTANT]
   > Do NOT use `localhost` or local IPs (like `192.168.x.x`) for production. The API URL must be a public, secure `https://` endpoint hosting your FastAPI backend.

2. **Register Secrets on EAS**:
   To ensure EAS Build has access to these keys during cloud compilation, upload them using:
   ```bash
   eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value https://azzagpnsymotbcejxubb.supabase.co
   eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value your-production-supabase-key
   eas secret:create --name EXPO_PUBLIC_API_BASE_URL --value https://api.medireport.ai
   ```

---

## 🚀 Step 3: Run Build Commands

We configured `eas.json` with profiles for **Preview** (generating a shareable APK) and **Production** (generating a release-ready AAB).

### A. Build a Shareable APK (For manual testing on devices)
Run this command to build a standalone APK that you can copy to any Android device:
```bash
eas build --platform android --profile preview
```
- **Output**: Once the cloud build finishes, Expo will provide a QR code and a direct `.apk` download URL.

### B. Build a Release AAB (For Google Play Store submission)
Run this command to compile the final `.aab` file:
```bash
eas build --platform android --profile production
```
- **EAS Credentials**: During the first run, EAS will ask: `Do you want us to generate a new Android Keystore for you?` Select **Yes**. Expo will securely manage your signing credentials.
- **Output**: Expo will produce an `.aab` (Android App Bundle) file ready to upload to the Play Console.

---

## 🏥 Step 4: Play Store Compliance & Submission Checklist

Because **MediReport AI** handles sensitive health/medical data, Google Play Store enforces strict guidelines:

1. **Medical App Declaration**:
   - In Google Play Console, go to **App Content** $\rightarrow$ **Health/Medical Apps**.
   - Declare that the App is a health/medical app.
   - Choose **Medical report analysis/educational information** as the primary health function.

2. **Privacy Policy Link**:
   - Google requires a public Privacy Policy URL.
   - You can host the provided [privacy_policy.html](file:///c:/Users/user/Downloads/medireport-ai-complete-starter/medireport-ai/docs/privacy_policy.html) using GitHub Pages or your own web hosting.
   - Add this link under **Play Console** $\rightarrow$ **App Content** $\rightarrow$ **Privacy Policy**.

3. **Android Permissions Justification**:
   - **CAMERA**: Declared in `app.json`. Used strictly for capturing photos of printed lab sheets.
   - **READ_EXTERNAL_STORAGE**: Declared in `app.json`. Used strictly for selecting digital report screenshots from the gallery.
   - **INTERNET**: Declared in `app.json`. Required for connecting to the FastAPI processing services.

4. **Medical Disclaimer Placement**:
   - The app contains a visible, persistent medical disclaimer on:
     - The **Safety & Privacy onboarding screen** ([DisclaimerScreen.js](file:///c:/Users/user/Downloads/medireport-ai-complete-starter/medireport-ai/mobile-app/screens/DisclaimerScreen.js))
     - The **Results interpretation screen footer** ([ResultScreen.js](file:///c:/Users/user/Downloads/medireport-ai-complete-starter/medireport-ai/mobile-app/screens/ResultScreen.js))
   - Verification phrasing: *“⚠️ MEDICAL DISCLAIMER: This is not a diagnosis. Please consult a qualified doctor.”*

5. **Upload the AAB**:
   - Go to **Play Console** $\rightarrow$ **Production** (or **Closed Testing**).
   - Create a new release and upload the `.aab` file downloaded from Expo.
   - Fill out the release notes and submit for review.
