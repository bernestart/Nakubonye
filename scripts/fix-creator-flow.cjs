const fs = require('fs');
const path = require('path');
const root = process.cwd();

// ==========================================
// PATCH 1: CreatorMode.jsx (Delay activation)
// ==========================================
let cm = fs.readFileSync(path.join(root, 'src/screens/CreatorMode.jsx'), 'utf8');

// A. Add refreshProfile to useAuth
cm = cm.replace(
  "const { session } = useAuth()",
  "const { session, refreshProfile } = useAuth()"
);

// B. Fix turnOn() to NOT update DB, just show onboarding
cm = cm.replace(
  /async function turnOn\(\) \{[\s\S]*?finally \{ setBusy\(false\) \}\n  \}/,
  `async function turnOn() {
    if (busy || !myId) return
    tap('medium')
    setShowOnboarding(true)
  }`
);

// C. Fix turnOff() to refresh context
cm = cm.replace(
  "setAccountType('personal')\n      setShowConfirmOff(false)",
  "setAccountType('personal')\n      setShowConfirmOff(false)\n      await refreshProfile()"
);

// D. Fix saveCategory() to refresh context
cm = cm.replace(
  "      if (error) throw error\n    } catch (e) {\n      console.warn('save category failed', e)",
  "      if (error) throw error\n      await refreshProfile()\n    } catch (e) {\n      console.warn('save category failed', e)"
);

fs.writeFileSync(path.join(root, 'src/screens/CreatorMode.jsx'), cm);
console.log('✅ CreatorMode.jsx patched (delayed activation, added context refresh)');

// ==========================================
// PATCH 2: CreatorOnboarding.jsx (Activate on finish)
// ==========================================
let co = fs.readFileSync(path.join(root, 'src/screens/CreatorOnboarding.jsx'), 'utf8');

// A. Add refreshProfile to useAuth
co = co.replace(
  "const { session } = useAuth()",
  "const { session, refreshProfile } = useAuth()"
);

// B. Update finish() to actually flip account_type and refresh
co = co.replace(
  `      const { error } = await supabase
        .from('profiles')
        .update({
          creator_default_audience: audience,
          creator_onboarded_at: new Date().toISOString(),
        })
        .eq('id', myId)
      if (error) throw error
      onFinish?.()`,
  `      const { error } = await supabase
        .from('profiles')
        .update({
          account_type: 'creator',
          creator_default_audience: audience,
          creator_onboarded_at: new Date().toISOString(),
        })
        .eq('id', myId)
      if (error) throw error
      await refreshProfile()
      onFinish?.()`
);

fs.writeFileSync(path.join(root, 'src/screens/CreatorOnboarding.jsx'), co);
console.log('✅ CreatorOnboarding.jsx patched (activates account on finish)');
