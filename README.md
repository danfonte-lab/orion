# Welcome to the Orion Mobile App 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```
In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

## Frameworks, Libraries, and External Tools

### App Dependencies

| Name | Description (main function) | License |
|---|---|---|
| expo | Core Expo SDK/runtime for React Native app development | MIT |
| react-native | Framework for building native mobile apps | MIT |
| react | UI component library | MIT |
| react-dom | React DOM support (web target) | MIT |
| expo-router | File-based routing/navigation for Expo apps | MIT |
| @react-navigation/native | Navigation foundation for React Native | MIT |
| @react-navigation/bottom-tabs | Bottom tab navigation | MIT |
| @react-navigation/elements | Shared navigation UI components | MIT |
| react-native-screens | Native screen primitives for navigation performance | MIT |
| react-native-gesture-handler | Native gesture handling | MIT |
| react-native-safe-area-context | Safe area support for notches/system UI | MIT |
| react-native-reanimated | Advanced performant animations | MIT |
| react-native-worklets | Worklets/multithreading support | MIT |
| expo-haptics | Haptic feedback integration | MIT |
| expo-local-authentication | Biometrics (Face ID/Touch ID/fingerprint) | MIT |
| expo-secure-store | Secure local key-value storage | MIT |
| expo-file-system | Local file system access | MIT |
| expo-image-picker | Select/take images and videos | MIT |
| expo-image | Optimized cross-platform image component | MIT |
| expo-linear-gradient | Gradient view component | MIT |
| expo-status-bar | Status bar control helpers | MIT |
| expo-splash-screen | Keep/hide native splash screen programmatically | MIT |
| expo-system-ui | Interact with system UI elements | MIT |
| expo-constants | Access app/device constants | MIT |
| expo-linking | Deep linking and URL handling | MIT |
| expo-web-browser | In-app browser and auth redirect handling | MIT |
| expo-localization | Locale/language/timezone information | MIT |
| expo-font | Runtime font loading | MIT |
| expo-symbols | SF Symbols integration on iOS | MIT |
| @expo/vector-icons | Popular icon packs for Expo/RN | MIT |
| @expo-google-fonts/dm-sans | DM Sans font package for Expo | MIT AND OFL-1.1 |
| @expo-google-fonts/instrument-serif | Instrument Serif font package for Expo | MIT AND OFL-1.1 |
| @expo-google-fonts/inter | Inter font package for Expo | MIT AND OFL-1.1 |
| nativewind | Tailwind-style utility classes for React Native | MIT |
| tailwindcss | Utility-first CSS framework (used with NativeWind tooling) | MIT |
| i18next | Internationalization framework | MIT |
| react-i18next | React bindings for i18next | MIT |
| axios | Promise-based HTTP client | MIT |
| @sentry/react-native | Error/crash monitoring SDK | MIT |
| typescript | Static typing language/tooling for JavaScript | Apache-2.0 |
| @types/react | TypeScript definitions for React | MIT |
| eslint | Linting and static analysis | MIT |
| eslint-config-expo | ESLint config rules for Expo projects | MIT |
| prettier-plugin-tailwindcss | Sorts Tailwind classes during formatting | MIT |

### External Tools and Services

| Name | Description (main function) | License |
|---|---|---|
| Sentry (service) | Receives errors/events sent by the mobile app | Commercial SaaS (SDK is MIT) |
| Backend API (`EXPO_PUBLIC_API_URL`) | Provides auth/profile/schedule/newsfeed/payslip endpoints | Proprietary/Unknown |
| Expo CLI | Local development/build commands (`expo start`, `expo run:*`) | MIT |
| npm Registry | Dependency distribution service for packages | Service terms |



## Native Build (Without EAS Server)

### Before build

1. Regenerate native projects:
   ```bash
   npx expo prebuild --clean
   ```

Or use the predefined scripts:
```bash
npm run ios:prebuild
npm run android:prebuild
```

2. This project includes the local plugin `./plugins/with-ios-appdelegate-fix` (registered in `app.json`) that automatically reapplies required fixes after each prebuild:
   - iOS `AppDelegate.swift` compatibility fixes for Expo SDK 55.
   - iOS `SENTRY_DISABLE_AUTO_UPLOAD=true` in Xcode `Release` build settings.
   - Android `MainApplication.kt` migration to `ExpoReactHostFactory`.
   - Android `hermesCommand` path fix (`hermes-compiler`).
   - Android Sentry upload task disable for local release builds.
   - Android release signing config from `MYAPP_UPLOAD_*` properties.

### iOS (TestFlight internal)

1. Prepare iOS native project (prebuild + pods + open Xcode):
   ```bash
   npm run ios:build:prep
   ```

2. Equivalent manual commands:
   ```bash
   npx expo prebuild --platform ios --clean
   cd ios && pod install --repo-update && cd ..
   xed ios
   ```

3. In Xcode:
   - Target `Orion` -> `Signing & Capabilities` -> choose Apple Team.
   - Scheme: `Any iOS Device (arm64)`.
   - Build configuration: `Release`.
   - `Product` -> `Archive`.
   - Organizer -> `Distribute App` -> `TestFlight Internal Only`.

### Android (Play Console internal testing)

1. Ensure `android/gradle.properties` has upload key settings:
   - `MYAPP_UPLOAD_STORE_FILE`
   - `MYAPP_UPLOAD_KEY_ALIAS`
   - `MYAPP_UPLOAD_STORE_PASSWORD` (can stay empty)
   - `MYAPP_UPLOAD_KEY_PASSWORD` (can stay empty)
   - `app.json` includes `expo.android.versionCode` (integer) and `expo.version` (string)

2. Generate AAB:
   ```bash
   npm run android:build:release
   ```
   - The script prompts for keystore password and key password at runtime.
   - Passwords are injected as environment variables for that build only (not committed).
   - App version is injected from `app.json` at build time:
     - `expo.version` -> Android `versionName`
     - `expo.android.versionCode` -> Android `versionCode`
   - The script auto-creates `android/local.properties` with `sdk.dir` using `ANDROID_HOME`, `ANDROID_SDK_ROOT`, or fallback `~/Library/Android/sdk`.

3. Equivalent manual commands:
   ```bash
   npx expo prebuild --platform android --clean
   cd android
   ./gradlew bundleRelease
   ```

4. Output file:
   - `android/app/build/outputs/bundle/release/app-release.aab`

5. Troubleshooting signing errors:
   - If build fails with `:app:signReleaseBundle` and `keystore password was incorrect`, the issue is the signing credentials, not Sentry.
   - Ensure `MYAPP_UPLOAD_KEY_ALIAS` matches the alias inside your keystore (current expected alias: `ubiquity`).
   - Re-run `npm run android:build:release` and enter the exact keystore password.
   - If your key password differs from keystore password, provide it in the second prompt; otherwise press Enter to reuse.
