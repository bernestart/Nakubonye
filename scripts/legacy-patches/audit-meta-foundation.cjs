const fs = require('fs');
let pass = 0, fail = 0;

function check(name, condition) {
  if (condition) { console.log('✅ PASS:', name); pass++; }
  else { console.log('❌ FAIL:', name); fail++; }
}

// ── 1. Check Dependencies ──
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
check('Dependency: react-easy-crop installed', pkg.dependencies['react-easy-crop'] !== undefined);

// ── 2. Check ImageCropper.jsx ──
const cropPath = 'src/components/ImageCropper.jsx';
if (fs.existsSync(cropPath)) {
  const crop = fs.readFileSync(cropPath, 'utf8');
  check('ImageCropper.jsx exists', true);
  check('ImageCropper: imports react-easy-crop', crop.includes("import Cropper from 'react-easy-crop'"));
  check('ImageCropper: has canvas.toBlob logic', crop.includes('canvas.toBlob'));
} else {
  check('ImageCropper.jsx exists', false);
}

// ── 3. Check Welcome.jsx ──
const welcomePath = 'src/screens/Welcome.jsx';
const welcome = fs.readFileSync(welcomePath, 'utf8');
check('Welcome: Dating text removed', !welcome.includes('Somebody is'));
check('Welcome: Social text added', welcome.includes('Connect with your world'));

// ── 4. Check SignUp.jsx ──
const signupPath = 'src/screens/SignUp.jsx';
const signup = fs.readFileSync(signupPath, 'utf8');
check('SignUp: DOB state added', signup.includes('dateOfBirth'));
check('SignUp: Gender state added', signup.includes('gender, setGender'));
check('SignUp: UI inputs added', signup.includes('Date of Birth') && signup.includes('Select...'));
check('SignUp: Supabase update includes DOB/Gender', signup.includes('date_of_birth: dateOfBirth'));

// ── 5. Check EditProfile.jsx ──
const editPath = 'src/screens/EditProfile.jsx';
const edit = fs.readFileSync(editPath, 'utf8');
check('EditProfile: Imports FilePicker', edit.includes('FilePicker.pickImages'));
check('EditProfile: Imports ImageCropper', edit.includes('import ImageCropper'));
check('EditProfile: Has cropImageSrc state', edit.includes('cropImageSrc'));
check('EditProfile: Native onClick wired', edit.includes('FilePicker.pickImages({ limit: 1, readData: true })'));
check('EditProfile: <ImageCropper> rendered', edit.includes('<ImageCropper'));

// ── 6. Check for JSX Syntax errors (Duplicate classNames) ──
check('EditProfile: No duplicate className', !edit.includes('className=') || !edit.match(/className=["'][^"']*["']\s+className=/));

console.log(`\n==============================`);
console.log(`PASS: ${pass} | FAIL: ${fail}`);
if (fail > 0) {
  console.log(`❌ AUDIT FAILED. DO NOT BUILD.`);
  process.exit(1);
} else {
  console.log(`✅ AUDIT PASSED. Ready for Vite Build.`);
}
