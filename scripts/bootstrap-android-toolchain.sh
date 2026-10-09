#!/bin/sh
set -eu

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
TOOLS_ROOT="$PROJECT_ROOT/.toolchains"
JDK_ARCHIVE="$TOOLS_ROOT/temurin21.tar.gz"
SDK_ARCHIVE="$TOOLS_ROOT/android-commandlinetools.zip"
JDK_ROOT="$TOOLS_ROOT/jdk-21"
SDK_ROOT="$TOOLS_ROOT/android-sdk"

mkdir -p "$TOOLS_ROOT" "$JDK_ROOT" "$SDK_ROOT/cmdline-tools"

if [ ! -x "$JDK_ROOT/Contents/Home/bin/java" ]; then
  curl -fL "https://api.adoptium.net/v3/binary/latest/21/ga/mac/aarch64/jdk/hotspot/normal/eclipse" -o "$JDK_ARCHIVE"
  tar -xzf "$JDK_ARCHIVE" -C "$JDK_ROOT" --strip-components=1
fi

export JAVA_HOME="$JDK_ROOT/Contents/Home"
export ANDROID_HOME="$SDK_ROOT"
export ANDROID_SDK_ROOT="$SDK_ROOT"

if [ ! -x "$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" ]; then
  curl -fL "https://dl.google.com/android/repository/commandlinetools-mac_arm64-15859902_latest.zip" -o "$SDK_ARCHIVE"
  ACTUAL_SHA=$(shasum -a 256 "$SDK_ARCHIVE" | awk '{print $1}')
  EXPECTED_SHA="835b62a26162b229b441d1f6d4680383815a270809eb33522c0d480fa5002c4e"
  if [ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]; then
    echo "Android command-line tools checksum mismatch" >&2
    exit 1
  fi
  rm -rf "$TOOLS_ROOT/cmdline-tools-unpacked"
  mkdir -p "$TOOLS_ROOT/cmdline-tools-unpacked"
  unzip -q "$SDK_ARCHIVE" -d "$TOOLS_ROOT/cmdline-tools-unpacked"
  mv "$TOOLS_ROOT/cmdline-tools-unpacked/cmdline-tools" "$SDK_ROOT/cmdline-tools/latest"
fi

yes | "$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" --licenses >/dev/null || true
"$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" "platform-tools" "platforms;android-36" "build-tools;36.0.0"

echo "Android toolchain is ready."

