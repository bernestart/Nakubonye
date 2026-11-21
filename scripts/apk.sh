#!/data/data/com.termux/files/usr/bin/bash
# usage: bash scripts/apk.sh <name>   (run web build + cap sync BEFORE this, as separate commands)
cd "$(dirname "$0")/../android" || exit 1
termux-wake-lock 2>/dev/null
./gradlew clean assembleDebug --no-daemon --console=plain 2>&1 | tail -10
termux-wake-unlock 2>/dev/null
APK=app/build/outputs/apk/debug/app-debug.apk
[ -f "$APK" ] || { echo "NO APK BUILT"; exit 1; }
OUT=~/storage/downloads/nakubonye-${1:-build}.apk
cp "$APK" "$OUT" && ls -lh "$OUT"
