const fs = require('fs');
const p = 'src/screens/CreatorOnboarding.jsx';
let s = fs.readFileSync(p, 'utf8');
let n = 0;
function apply(find, replace, label) {
  if (!s.includes(find)) { console.error('❌', label); process.exit(1); }
  s = s.replace(find, replace); console.log('✅', label); n++;
}

// 1. PhotoIllustration wrapper
apply(
`    <div className="relative w-full h-48 rounded-3xl overflow-hidden mb-6">`,
`    <div
      className="relative overflow-hidden mb-6"
      style={{ marginLeft: '-20px', marginRight: '-20px', width: 'calc(100% + 40px)', height: '288px' }}
    >`,
'photo wrapper full-bleed');

// 2. Mega wrapper (has h-48 rounded-3xl on className)
apply(
`      className="relative w-full h-48 rounded-3xl overflow-hidden mb-6 flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #2A1055 0%, #4C1D95 50%, #7C3AED 100%)' }}`,
`      className="relative overflow-hidden mb-6 flex items-center justify-center"
      style={{ marginLeft: '-20px', marginRight: '-20px', width: 'calc(100% + 40px)', height: '256px', background: 'linear-gradient(135deg, #2A1055 0%, #4C1D95 50%, #7C3AED 100%)' }}`,
'mega full-bleed');

// 3. Coins wrapper (55%)
apply(
`      className="relative w-full h-48 rounded-3xl overflow-hidden mb-6 flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #2A1055 0%, #4C1D95 55%, #7C3AED 100%)' }}
    >
      <svg viewBox="0 0 300 200" className="w-full h-full">
        {/* Gold coins`,
`      className="relative overflow-hidden mb-6 flex items-center justify-center"
      style={{ marginLeft: '-20px', marginRight: '-20px', width: 'calc(100% + 40px)', height: '256px', background: 'linear-gradient(135deg, #2A1055 0%, #4C1D95 55%, #7C3AED 100%)' }}
    >
      <svg viewBox="0 0 300 200" className="w-full h-full">
        {/* Gold coins`,
'coins full-bleed');

// 4. Chart wrapper — same className+style as coins; use the "Grid lines" comment to disambiguate
apply(
`      className="relative w-full h-48 rounded-3xl overflow-hidden mb-6 flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #2A1055 0%, #4C1D95 55%, #7C3AED 100%)' }}
    >
      <svg viewBox="0 0 300 200" className="w-full h-full">
        {/* Grid lines */}`,
`      className="relative overflow-hidden mb-6 flex items-center justify-center"
      style={{ marginLeft: '-20px', marginRight: '-20px', width: 'calc(100% + 40px)', height: '256px', background: 'linear-gradient(135deg, #2A1055 0%, #4C1D95 55%, #7C3AED 100%)' }}
    >
      <svg viewBox="0 0 300 200" className="w-full h-full">
        {/* Grid lines */}`,
'chart full-bleed');

// 5. Trim container padding so full-bleed hits screen edge cleanly
apply(
`      <div className="flex-1 overflow-y-auto px-5 pb-6">`,
`      <div className="flex-1 overflow-y-auto pb-6" style={{ paddingLeft: '20px', paddingRight: '20px', overflowX: 'hidden' }}>`,
'container padding');

fs.writeFileSync(p, s);
console.log(`\n✅ ${n} edits applied`);
