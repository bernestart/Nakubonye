const fs = require('fs');

// ---------- 1. ProfileSettings.jsx ----------
{
  const p = 'src/screens/ProfileSettings.jsx';
  let s = fs.readFileSync(p, 'utf8');
  const find = `              await supabase.auth.signOut()`;
  const replace = `              const { detachDeviceToken } = await import('../lib/deviceToken.js')
              await detachDeviceToken()
              await supabase.auth.signOut()`;
  if (!s.includes(find)) { console.error('❌ ProfileSettings anchor not found'); process.exit(1); }
  s = s.replace(find, replace);
  fs.writeFileSync(p, s);
  console.log('✅ ProfileSettings.jsx patched');
}

// ---------- 2. DeleteAccountModal.jsx ----------
{
  const p = 'src/components/DeleteAccountModal.jsx';
  let s = fs.readFileSync(p, 'utf8');
  const find = `    const { error: err } = await supabase.rpc('delete_my_account')`;
  const replace = `    // Release FCM token BEFORE deleting the auth user (auth.uid() must be valid)
    try {
      const { detachDeviceToken } = await import('../lib/deviceToken.js')
      await detachDeviceToken()
    } catch (e) { console.warn('detach failed', e) }

    const { error: err } = await supabase.rpc('delete_my_account')`;
  if (!s.includes(find)) { console.error('❌ DeleteAccountModal anchor not found'); process.exit(1); }
  s = s.replace(find, replace);
  fs.writeFileSync(p, s);
  console.log('✅ DeleteAccountModal.jsx patched');
}

// ---------- 3. App.jsx (inline logout button) ----------
{
  const p = 'src/App.jsx';
  let s = fs.readFileSync(p, 'utf8');
  const find = `          onClick={async () => { const { supabase } = await import('./lib/supabase'); await supabase.auth.signOut() }}`;
  const replace = `          onClick={async () => {
            const { supabase } = await import('./lib/supabase')
            const { detachDeviceToken } = await import('./lib/deviceToken.js')
            await detachDeviceToken()
            await supabase.auth.signOut()
          }}`;
  if (!s.includes(find)) { console.error('❌ App.jsx anchor not found'); process.exit(1); }
  s = s.replace(find, replace);
  fs.writeFileSync(p, s);
  console.log('✅ App.jsx patched');
}

console.log('✅ all three files patched');
