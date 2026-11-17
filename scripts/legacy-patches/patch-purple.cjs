const fs = require('fs');
let total = 0;
function apply(s, find, replace, label) {
  if (!s.includes(find)) { console.error('❌', label); process.exit(1); }
  console.log('✅', label);
  total++;
  return s.replace(find, replace);
}

// ============ A. CreatorOnboarding.jsx ============
{
  const p = 'src/screens/CreatorOnboarding.jsx';
  let s = fs.readFileSync(p, 'utf8');

  // 1. Add BrandGlow import
  s = apply(s,
`import { useAuth } from '../lib/auth'`,
`import BrandGlow from '../components/BrandGlow'
import { useAuth } from '../lib/auth'`,
  'onboarding: import BrandGlow');

  // 2. Wrapper: bg-obsidian → bg-transparent + add BrandGlow
  s = apply(s,
`    <div className="fixed inset-0 z-[400] bg-obsidian flex flex-col">`,
`    <div className="fixed inset-0 z-[400] bg-transparent flex flex-col">
      <BrandGlow />`,
  'onboarding: purple background + BrandGlow');

  // 3. Photo: objectPosition top (full head visible)
  s = apply(s,
`           style={{ objectPosition: 'center 30%' }} />`,
`           style={{ objectPosition: 'top center' }} />`,
  'onboarding: photo anchored to top');

  fs.writeFileSync(p, s);
}

// ============ B. CreatorMode.jsx ============
{
  const p = 'src/screens/CreatorMode.jsx';
  let s = fs.readFileSync(p, 'utf8');

  // 1. Add BrandGlow import
  s = apply(s,
`import { useAuth } from '../lib/auth'`,
`import BrandGlow from '../components/BrandGlow'
import { useAuth } from '../lib/auth'`,
  'mode: import BrandGlow');

  // 2. Wrapper: bg-obsidian → bg-transparent + BrandGlow
  s = apply(s,
`    <div className="min-h-dvh bg-obsidian text-cream">`,
`    <div className="min-h-dvh bg-transparent text-cream">
      <BrandGlow />`,
  'mode: purple background + BrandGlow');

  // 3. Sticky header — keep the translucent style, but against transparent bg now
  s = apply(s,
`      <div className="sticky top-0 z-30 bg-obsidian/95 backdrop-blur-md border-b border-white/8">`,
`      <div className="sticky top-0 z-30 bg-transparent backdrop-blur-md border-b border-white/8">`,
  'mode: header transparent');

  // 4. Entry photo — object-top
  s = apply(s,
`          style={{ objectPosition: 'center 20%' }}`,
`          style={{ objectPosition: 'top center' }}`,
  'mode: entry photo anchored to top');

  // 5. Active photo — object-top
  s = apply(s,
`          style={{ objectPosition: 'center 25%' }}`,
`          style={{ objectPosition: 'top center' }}`,
  'mode: active photo anchored to top');

  fs.writeFileSync(p, s);
}

console.log(`\n✅ ${total} edits applied total`);
