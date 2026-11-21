#!/data/data/com.termux/files/usr/bin/bash
# usage: bash scripts/apk.sh <name>     FAST=1 skips gradle clean
set -eo pipefail
NAME="${1:-build}"
cd "$(dirname "$0")/.."
npm run build 2>&1 | grep -E "rror|built in"
npx cap sync android 2>&1 | tail -3
cd android
./gradlew $([ "$FAST" = 1 ] || echo clean) assembleDebug --no-daemon --console=plain 2>&1 | tail -12
APK=app/build/outputs/apk/debug/app-debug.apk
[ -f "$APK" ] || { echo "NO APK BUILT"; exit 1; }
OUT=~/storage/downloads/nakubonye-$NAME.apk
cp "$APK" "$OUT" && ls -lh "$OUT"
