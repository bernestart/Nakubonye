const fs = require('fs');

// ==========================================
// PART 1: SIGNUP.JSX (Manual DOB Text Input)
// ==========================================
let signup = fs.readFileSync('src/screens/SignUp.jsx', 'utf8');
const oldSignupDob = `<input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required disabled={busy} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" />`;
const newSignupDob = `<input type="text" placeholder="DD/MM/YYYY" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required disabled={busy} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" />`;

if (signup.includes(oldSignupDob)) {
  signup = signup.replace(oldSignupDob, newSignupDob);
  fs.writeFileSync('src/screens/SignUp.jsx', signup);
  console.log("✅ SignUp.jsx: DOB is now a manual text input.");
}

// ==========================================
// PART 2: ONBOARDING.JSX (Remove Duplicate DOB Logic)
// ==========================================
let onboard = fs.readFileSync('src/screens/Onboarding.jsx', 'utf8');

// 1. Hide the "About you" step UI (DOB/Gender) by disabling it, just like we did with the dating steps.
// This prevents any syntax errors while removing it from the user's view.
onboard = onboard.replace(/\{step === 2 && \(/g, '{false && (');

// 2. Remove the DOB/Gender validation so the user can proceed
onboard = onboard.replace(/if \(!dob\) \{ setError\('Please enter your date of birth\.'\); return false \}/g, '');
onboard = onboard.replace(/if \(!gender\) \{ setError\('Please select your gender\.'\); return false \}/g, '');

// 3. Fix the Data Insert Logic: Use the DB profile values if the Onboarding state is empty
// This ensures we don't overwrite the DOB/Gender collected during SignUp with NULLs.
onboard = onboard.replace(
  /date_of_birth: dob,/g, 
  `date_of_birth: dob || profile?.date_of_birth,`
);
onboard = onboard.replace(
  /gender,/g, 
  `gender: gender || profile?.gender,`
);

fs.writeFileSync('src/screens/Onboarding.jsx', onboard);
console.log("✅ Onboarding.jsx: Duplicate DOB step hidden and data logic fixed to use SignUp data.");

console.log("🎉 META LOGIC ACHIEVED! Run 'npm run build' now.");
