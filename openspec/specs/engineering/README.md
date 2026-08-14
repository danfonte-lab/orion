# Engineering Standards

This folder contains engineering standards and operational guidance for Orion Mobile.

## Documents

- [Coding Standards](./coding-standards.md)
- [Testing](./testing.md)
- [Analytics](./analytics.md)
- [Logging](./logging.md)
- [Security](./security.md)
- [Performance](./performance.md)

## Development Notes

- Install dependencies with `npm install`.
- Start the app with `npm run start`.
- Use `npm run android`, `npm run ios`, or `npm run web` for local targets.
- Run `npm run lint` before sending changes.
- Keep environment variables such as `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_ANALYTICS_ENABLED`, and `EXPO_PUBLIC_POSTHOG_API_KEY` set in your local environment when you need API, monitoring, or analytics behavior.

## Native Build Notes

The Expo config in `app.json` includes the local plugin `./plugins/with-ios-appdelegate-fix` plus the expected Expo plugins for routing, splash screen, secure storage, localization, Sentry, video, fonts, images, and web browser support.

When you touch native dependencies or plugins, regenerate the native projects so the configuration stays in sync.

### iOS

- Run `npm run ios:build:prep` to prebuild, install pods, and open Xcode.
- The equivalent manual flow is `npx expo prebuild --platform ios --clean`, then `cd ios && pod install --repo-update && cd ..`, then `xed ios`.

### Android

- Run `npm run android:build:release` to prebuild and bundle the release AAB.
- The equivalent manual flow is `npx expo prebuild --platform android --clean`, then `cd android && ./gradlew bundleRelease`.
- The Android version name and version code come from `app.json`.

## Build Hints

- Use `npm run ios:prebuild` or `npm run android:prebuild` when you need a clean native regeneration without building immediately.
- The repo uses Expo Router typed routes and React Compiler experiments from `app.json`, so route and component changes should stay compatible with the generated Expo setup.
