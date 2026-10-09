#!/bin/sh
set -eu

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
JAVA_HOME="$PROJECT_ROOT/.toolchains/jdk-21/Contents/Home"
ANDROID_HOME="$PROJECT_ROOT/.toolchains/android-sdk"
GRADLE_USER_HOME="$PROJECT_ROOT/.toolchains/gradle-home"
SIGNING_ROOT="$PROJECT_ROOT/.signing"
SIGNING_FILE="$SIGNING_ROOT/signing.properties"
KEYSTORE_FILE="$SIGNING_ROOT/travelos-release.jks"

export JAVA_HOME ANDROID_HOME ANDROID_SDK_ROOT="$ANDROID_HOME" GRADLE_USER_HOME
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/build-tools/36.0.0:$PATH"

if [ ! -x "$JAVA_HOME/bin/java" ] || [ ! -x "$ANDROID_HOME/build-tools/36.0.0/apksigner" ]; then
  echo "Android toolchain is missing. Run scripts/bootstrap-android-toolchain.sh first." >&2
  exit 1
fi

mkdir -p "$SIGNING_ROOT"
if [ ! -f "$SIGNING_FILE" ]; then
  SIGNING_PASSWORD=$(openssl rand -hex 24)
  "$JAVA_HOME/bin/keytool" -genkeypair -noprompt \
    -keystore "$KEYSTORE_FILE" \
    -storepass "$SIGNING_PASSWORD" \
    -keypass "$SIGNING_PASSWORD" \
    -alias travelos \
    -keyalg RSA \
    -keysize 3072 \
    -validity 10000 \
    -dname "CN=TravelOS, OU=Personal Travel App, O=TravelOS, L=Ho Chi Minh City, C=VN"
  {
    echo "storeFile=../.signing/travelos-release.jks"
    echo "storePassword=$SIGNING_PASSWORD"
    echo "keyAlias=travelos"
    echo "keyPassword=$SIGNING_PASSWORD"
  } > "$SIGNING_FILE"
  chmod 600 "$SIGNING_FILE" "$KEYSTORE_FILE"
fi

cd "$PROJECT_ROOT"
npm run android:sync
cd android
./gradlew --no-daemon clean assembleRelease

APK_SOURCE="$PROJECT_ROOT/android/app/build/outputs/apk/release/app-release.apk"
APK_DESTINATION="$PROJECT_ROOT/TravelOS-v1.0.0.apk"
cp "$APK_SOURCE" "$APK_DESTINATION"
"$ANDROID_HOME/build-tools/36.0.0/apksigner" verify --verbose --print-certs "$APK_DESTINATION"
shasum -a 256 "$APK_DESTINATION"

echo "Signed APK: $APK_DESTINATION"
