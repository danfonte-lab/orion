#!/usr/bin/env bash
set -euo pipefail

SDK_DIR="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
LOCAL_PROPERTIES="android/local.properties"
KEYSTORE_PATH="android/../ubiquity.keystore"
KEY_ALIAS="ubiquity"

APP_VERSION_NAME="$(node -p "require('./app.json').expo.version")"
APP_VERSION_CODE="$(node -e "const a=(require('./app.json').expo.android||{}); if (!Number.isInteger(a.versionCode)) { console.error('Error: app.json -> expo.android.versionCode is required and must be an integer.'); process.exit(1);} process.stdout.write(String(a.versionCode));")"

mkdir -p android
cat > "${LOCAL_PROPERTIES}" <<EOF
sdk.dir=${SDK_DIR}
EOF

read -r -s -p "Keystore password: " STORE_PASS
echo

read -r -s -p "Key password (Enter to reuse keystore password): " KEY_PASS
echo

if [ -z "${KEY_PASS}" ]; then
  KEY_PASS="${STORE_PASS}"
fi

if [ -z "${STORE_PASS}" ]; then
  echo "Error: empty keystore password."
  exit 1
fi

if [ ! -f "${KEYSTORE_PATH}" ]; then
  echo "Error: keystore not found at ${KEYSTORE_PATH}."
  exit 1
fi

if command -v keytool >/dev/null 2>&1; then
  if ! keytool -list -keystore "${KEYSTORE_PATH}" -storepass "${STORE_PASS}" -alias "${KEY_ALIAS}" >/dev/null 2>&1; then
    echo "Error: invalid keystore credentials (store password and/or alias '${KEY_ALIAS}')."
    exit 1
  fi
fi

(
  cd android
  SENTRY_DISABLE_AUTO_UPLOAD=true \
  MYAPP_UPLOAD_STORE_PASSWORD="${STORE_PASS}" \
  MYAPP_UPLOAD_KEY_PASSWORD="${KEY_PASS}" \
  ./gradlew \
    -PAPP_VERSION_NAME="${APP_VERSION_NAME}" \
    -PAPP_VERSION_CODE="${APP_VERSION_CODE}" \
    bundleRelease
)
