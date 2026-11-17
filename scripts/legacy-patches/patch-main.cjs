const fs = require('fs');
const p = 'src/main.jsx';
let s = fs.readFileSync(p, 'utf8');

const edits = [
  {
    find: `import { syncMissedNotifications, markPushReceived, markNotifSeen } from './lib/notifSync.js'`,
    replace: `import { syncMissedNotifications, markPushReceived, markNotifSeen } from './lib/notifSync.js'
import { cacheFcmToken, bindDeviceToken } from './lib/deviceToken.js'`
  },
  {
    find: `      console.log('[Push] FCM token received:', token.value.slice(0, 20) + '…')`,
    replace: `      console.log('[Push] FCM token received:', token.value.slice(0, 20) + '…')
      cacheFcmToken(token.value)`
  },
  {
    find: `  await PushNotifications.register()`,
    replace: `  await PushNotifications.register()
  // Cached-token rebind: on multi-user devices FCM may not re-fire the
  // 'registration' event when a token is already cached. Bind explicitly.
  await bindDeviceToken()`
  },
  {
    find: `    if (event === 'SIGNED_OUT') {
      // Release this device's token so the logged-out user stops receiving
      supabase.rpc('deactivate_my_device_token')
        .then(({ error }) => {
          if (error) console.warn('[Push] deactivate RPC failed:', error)
          else console.log('[Push] token released on sign-out')
        })
        .catch(e => console.warn('[Push] deactivate failed', e))
    }`,
    replace: `    if (event === 'SIGNED_OUT') {
      // NOTE: device token detach happens BEFORE signOut() in logout
      // handlers. Calling it here is too late — auth.uid() is already null
      // and the RPC silently no-ops.
    }`
  }
];

let ok = true;
for (let i = 0; i < edits.length; i++) {
  const { find, replace } = edits[i];
  if (!s.includes(find)) {
    console.error(`❌ edit ${i+1} anchor not found`);
    console.error(JSON.stringify(find.slice(0, 200)));
    ok = false;
    continue;
  }
  s = s.replace(find, replace);
  console.log(`✅ edit ${i+1} applied`);
}

if (!ok) { console.error('aborting — no file written'); process.exit(1); }
fs.writeFileSync(p, s);
console.log('✅ main.jsx written');
