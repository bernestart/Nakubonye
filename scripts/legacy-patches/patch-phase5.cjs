const fs = require('fs');
const MF = 'android/app/src/main/AndroidManifest.xml';
let m = fs.readFileSync(MF, 'utf8');

// Required for Android 12+ (API 31+) Bluetooth audio routing in WebRTC calls
const wanted = [
  'android.permission.BLUETOOTH_CONNECT',
  'android.permission.BLUETOOTH_SCAN',
  'android.permission.BLUETOOTH',
  'android.permission.BLUETOOTH_ADMIN',
];

const missing = wanted.filter(p => !m.includes(`android:name="${p}"`));
if (!missing.length) {
  console.log('⏭  All Bluetooth permissions already present');
  process.exit(0);
}

const anchor = '<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />';
if (!m.includes(anchor)) {
  console.error('❌ MODIFY_AUDIO_SETTINGS anchor not found — aborting');
  process.exit(1);
}

const insertion = missing.map(p => `    <uses-permission android:name="${p}" />`).join('\n');
m = m.replace(anchor, anchor + '\n' + insertion);
fs.writeFileSync(MF, m, 'utf8');
console.log(`✅ Added ${missing.length} Bluetooth permissions:`);
missing.forEach(p => console.log('   •', p.split('.').pop()));
