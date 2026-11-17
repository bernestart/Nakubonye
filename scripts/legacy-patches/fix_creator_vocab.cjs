const fs = require('fs');

// 1. Fix the Settings Menu Toggle
let ps = fs.readFileSync('src/screens/ProfileSettings.jsx', 'utf8');
ps = ps.replace(/label="Professional Mode"/g, 'label="Creator Mode"');
fs.writeFileSync('src/screens/ProfileSettings.jsx', ps);
console.log('✅ Reverted Settings toggle to "Creator Mode"');

// 2. Fix the Dashboard Screen Title
let cds = fs.readFileSync('src/screens/CreatorDashboardScreen.jsx', 'utf8');
cds = cds.replace(/Professional Dashboard/g, 'Creator Dashboard');
fs.writeFileSync('src/screens/CreatorDashboardScreen.jsx', cds);
console.log('✅ Reverted Screen Title to "Creator Dashboard"');

// 3. Fix the Profile Button
let pv = fs.readFileSync('src/screens/ProfileView.jsx', 'utf8');
pv = pv.replace(/Professional Dashboard/g, 'Creator Dashboard');
fs.writeFileSync('src/screens/ProfileView.jsx', pv);
console.log('✅ Reverted Profile button to "Creator Dashboard"');

