const fs = require('fs');

// ==========================================
// PART 1: FIX ONBOARDING.JSX (Remove Duplicate DOB)
// ==========================================
let onboard = fs.readFileSync('src/screens/Onboarding.jsx', 'utf8');

// 1. Fix the broken useState syntax caused by the previous script
onboard = onboard.replace(/const \[gender: gender \|\| profile\?\.gender, setGender\]/g, `const [gender, setGender] = useState('')`);

// 2. Hide Step 2 (DOB/Gender) from the UI completely
// We change {step === 2 && ( to {false && ( so React ignores it safely.
onboard = onboard.replace(/\{step === 2 && \(/g, '{false && (');

// 3. Remove the validation that forces the user to enter DOB/Gender in Onboarding
onboard = onboard.replace(/if \(!dob\) \{ setError\('Please enter your date of birth\.'\); return false \}/g, '');
onboard = onboard.replace(/if \(!gender\) \{ setError\('Please select your gender\.'\); return false \}/g, '');

// 4. Ensure we don't overwrite the SignUp data with NULLs
onboard = onboard.replace(/date_of_birth: dob,/g, `date_of_birth: dob || profile?.date_of_birth,`);
onboard = onboard.replace(/gender,/g, `gender: gender || profile?.gender,`);

fs.writeFileSync('src/screens/Onboarding.jsx', onboard);
console.log("✅ SUCCESS: Onboarding.jsx DOB step hidden and syntax fixed!");

// ==========================================
// PART 2: FIX EDITPROFILE.JSX (Manual DOB Input)
// ==========================================
let editProfile = fs.readFileSync('src/screens/EditProfile.jsx', 'utf8');

// Change the native date picker to a text input
const oldEditDob = `<input type="date"`;
const newEditDob = `<input type="text" placeholder="DD/MM/YYYY"`;

if (editProfile.includes(oldEditDob)) {
  editProfile = editProfile.replace(oldEditDob, newEditDob);
  fs.writeFileSync('src/screens/EditProfile.jsx', editProfile);
  console.log("✅ SUCCESS: EditProfile.jsx DOB changed to manual text input!");
} else {
  console.log("⚠️ EditProfile.jsx DOB input might already be text or needs manual review.");
}
