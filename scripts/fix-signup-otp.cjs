const fs = require('fs');
const p = 'src/screens/SignUp.jsx';

if (!fs.existsSync(p)) process.exit(1);
let lines = fs.readFileSync(p, 'utf8').split('\n');

// 1. Add verifyOtp to the auth destructure
const authIdx = lines.findIndex(l => l.includes("const { signUp"));
if (authIdx > -1 && !lines[authIdx].includes('verifyOtp')) {
  lines[authIdx] = lines[authIdx].replace("const { signUp", "const { signUp, verifyOtp");
}

// 2. Add OTP state variables
const stateIdx = lines.findIndex(l => l.includes("const [error, setError]"));
if (stateIdx > -1) {
  lines.splice(stateIdx + 1, 0, "  const [otp, setOtp] = useState('')");
}

// 3. Find the final submit function and change it to move to 'otp' step instead of navigating
// We look for the function that calls signUp()
const signUpCallIdx = lines.findIndex(l => l.includes("await signUp("));
if (signUpCallIdx > -1) {
  // Find the navigate('/feed') nearby and remove it
  let navigateIdx = lines.findIndex((l, i) => i > signUpCallIdx && l.includes("navigate('/feed')"));
  if (navigateIdx === -1) navigateIdx = lines.findIndex((l, i) => i > signUpCallIdx && l.includes('navigate("/feed")'));
  
  if (navigateIdx > -1) {
    lines[navigateIdx] = "      setStep('otp'); // Move to OTP screen instead of logging in directly";
  }
}

// 4. Inject the OTP UI block right before the end of the form
const formEndIdx = lines.findIndex(l => l.includes("</form>"));
if (formEndIdx > -1) {
  const otpBlock = `
      {step === 'otp' && (
        <div className="space-y-4 mt-6">
          <p className="text-white/70 text-[14px] text-center">
            We sent a 6-digit code to <b>{form.email}</b>
          </p>
          <input 
            className={INPUT} 
            type="text" 
            maxLength={6} 
            placeholder="000000" 
            value={otp} 
            onChange={(e) => setOtp(e.target.value.replace(/\\D/g, ''))} 
            style={{ fontSize: 24, textAlign: 'center', letterSpacing: 8 }}
          />
          <button 
            type="button"
            onClick={async () => {
              if (otp.length < 6) return;
              setLoading(true);
              try {
                const authData = await verifyOtp(form.email, otp);
                // Save profile to Neon
                const dobStr = \`\${form.year}-\${String(form.month).padStart(2,'0')}-\${String(form.day).padStart(2,'0')}\`;
                await fetch(\`\${API_BASE_URL}/api/profile\`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${authData.token}\` },
                  body: JSON.stringify({
                    id: authData.user.id,
                    display_name: \`\${form.firstName} \${form.surname}\`.trim(),
                    username: form.username || form.email.split('@')[0],
                    date_of_birth: dobStr,
                    gender: form.gender
                  })
                });
                navigate('/feed', { replace: true });
              } catch (err) {
                setError(err.message || 'Invalid code');
                setLoading(false);
              }
            }}
            disabled={loading || otp.length < 6}
            className="w-full text-white font-bold text-[16px] rounded-full py-[16px] transition-transform active:scale-[0.98] disabled:opacity-60 shadow-lg shadow-purple-900/30"
            style={GRAD}
          >
            {loading ? 'Verifying...' : 'Confirm Email'}
          </button>
        </div>
      )}
`;
  lines.splice(formEndIdx, 0, otpBlock);
}

fs.writeFileSync(p, lines.join('\n'), 'utf8');
console.log('✅ SignUp.jsx updated with OTP step.');
