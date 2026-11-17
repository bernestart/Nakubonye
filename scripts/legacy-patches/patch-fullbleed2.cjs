const fs = require('fs');
const p = 'src/screens/CreatorOnboarding.jsx';
let s = fs.readFileSync(p, 'utf8');
let n = 0;
function apply(find, replace, label) {
  if (!s.includes(find)) { console.error('❌', label); console.error(JSON.stringify(find.slice(0,150))); process.exit(1); }
  s = s.replace(find, replace); console.log('✅', label); n++;
}

// 1. Photo — full-bleed, no box, taller
apply(
`function PhotoIllustration({ src }) {
  return (
    <div className="relative w-full h-56 rounded-3xl overflow-hidden mb-6">`,
`function PhotoIllustration({ src }) {
  return (
    <div
      className="relative h-72 overflow-hidden mb-6"
      style={{ marginLeft: '-20px', marginRight: '-20px', width: 'calc(100% + 40px)' }}
    >`,
'photo full-bleed');

// 2. Mega — full-bleed
apply(
`    <div
      className="relative w-full h-48 rounded-3xl overflow-hidden mb-6 flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #2A1055 0%, #4C1D95 50%, #7C3AED 100%)' }}
    >`,
`    <div
      className="relative h-64 overflow-hidden mb-6 flex items-center justify-center"
      style={{ marginLeft: '-20px', marginRight: '-20px', width: 'calc(100% + 40px)', background: 'linear-gradient(135deg, #2A1055 0%, #4C1D95 50%, #7C3AED 100%)' }}
    >`,
'mega full-bleed');

// 3. Coins — full-bleed
apply(
`    <div
      className="relative w-full h-48 rounded-3xl overflow-hidden mb-6 flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #2A1055 0%, #4C1D95 55%, #7C3AED 100%)' }}
    >
      <svg viewBox="0 0 300 200" className="w-full h-full">
        {/* Gold coins — 3 stacked, 2 floating */}`,
`    <div
      className="relative h-64 overflow-hidden mb-6 flex items-center justify-center"
      style={{ marginLeft: '-20px', marginRight: '-20px', width: 'calc(100% + 40px)', background: 'linear-gradient(135deg, #2A1055 0%, #4C1D95 55%, #7C3AED 100%)' }}
    >
      <svg viewBox="0 0 300 200" className="w-full h-full">
        {/* Gold coins — 3 stacked, 2 floating */}`,
'coins full-bleed');

// 4. Chart — full-bleed (uses same opening as coins, so it's the remaining one)
apply(
`    <div
      className="relative w-full h-48 rounded-3xl overflow-hidden mb-6 flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #2A1055 0%, #4C1D95 55%, #7C3AED 100%)' }}
    >
      <svg viewBox="0 0 300 200" className="w-full h-full">
        {/* Grid lines */}`,
`    <div
      className="relative h-64 overflow-hidden mb-6 flex items-center justify-center"
      style={{ marginLeft: '-20px', marginRight: '-20px', width: 'calc(100% + 40px)', background: 'linear-gradient(135deg, #2A1055 0%, #4C1D95 55%, #7C3AED 100%)' }}
    >
      <svg viewBox="0 0 300 200" className="w-full h-full">
        {/* Grid lines */}`,
'chart full-bleed');

// 5. Ensure photos use the correct slot names
apply(
`      <PhotoIllustration src="/illustrations/welcome.jpg" />`,
`      <PhotoIllustration src="/illustrations/welcome.jpg" />`,
'welcome src check');

apply(
`      <PhotoIllustration src="/illustrations/audience.jpg" />`,
`      <PhotoIllustration src="/illustrations/audience.jpg" />`,
'audience src check');

apply(
`      <PhotoIllustration src="/illustrations/frame.jpg" />`,
`      <PhotoIllustration src="/illustrations/frame.jpg" />`,
'frame src check');

fs.writeFileSync(p, s);
console.log(`\n✅ CreatorOnboarding.jsx — ${n} edits`);
