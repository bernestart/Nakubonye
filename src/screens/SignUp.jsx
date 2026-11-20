import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { API_BASE_URL } from '../lib/api';
import { ArrowLeft } from 'lucide-react';

export default function SignUp() {
  const navigate = useNavigate();
  const { signUp, verifyOtp } = useAuth();
  
  const [step, setStep] = useState('form'); // 'form' or 'otp'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otp, setOtp] = useState('');
  
  const [form, setForm] = useState({
    firstName: '',
    surname: '',
    username: '',
    email: '',
    password: '',
    dobMonth: 'January',
    dobDay: '1',
    dobYear: '2000',
    gender: 'Male'
  });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // STEP 1: Create Account & Send OTP
  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const fullName = `${form.firstName} ${form.surname}`.trim();
      await signUp(form.email, form.password, fullName);
      // If successful, move to OTP screen
      setStep('otp');
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Verify OTP & Save Profile
  const handleVerify = async (e) => {
    e.preventDefault();
    if (otp.length < 6) return;
    
    setLoading(true);
    setError('');

    try {
      // Verify OTP with Better Auth
      const authData = await verifyOtp(form.email, otp);
      
      // Save extra profile details to Neon
      const monthNum = String(new Date(Date.parse(form.dobMonth + " 1, 2012")).getMonth() + 1).padStart(2, '0');
      const dob = `${form.dobYear}-${monthNum}-${String(form.dobDay).padStart(2, '0')}`;
      const finalUsername = form.username.trim() || form.email.split('@')[0];

      await fetch(`${API_BASE_URL}/api/profile`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authData.token}` 
        },
        body: JSON.stringify({
          id: authData.user.id,
          display_name: `${form.firstName} ${form.surname}`.trim(),
          username: finalUsername,
          date_of_birth: dob,
          gender: form.gender
        })
      });

      navigate('/feed');
    } catch (err) {
      setError(err.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const years = Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i);

  // ─── OTP SCREEN ──────────────────────────────────────────
  if (step === 'otp') {
    return (
      <div className="min-h-screen bg-obsidian flex flex-col px-7 py-8 relative">
        <button onClick={() => setStep('form')} className="absolute top-6 left-6 text-white/60 hover:text-white transition-colors">
          <ArrowLeft size={24} />
        </button>

        <div className="mt-16 mb-8 text-center">
          <h1 className="text-white text-[28px] leading-tight font-black tracking-tight mb-2">Enter confirmation code</h1>
          <p className="text-purple-100/65 text-[14px]">
            We sent a 6-digit code to <br/>
            <span className="text-white font-semibold">{form.email}</span>
          </p>
        </div>

        <div className="w-full max-w-[400px] mx-auto">
          {error && (
            <div className="text-red-300 text-[13px] bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3 mb-5">
              {error}
            </div>
          )}

          <input 
            type="text" 
            maxLength={6}
            placeholder="000000" 
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-4 text-white text-center text-[28px] tracking-[12px] font-black focus:outline-none focus:border-purple-500/70 transition-colors" 
          />
          
          <button 
            onClick={handleVerify}
            disabled={loading || otp.length < 6}
            className="mt-6 w-full text-white font-bold text-[16px] rounded-full py-[16px] transition-transform active:scale-[0.98] disabled:opacity-60 shadow-lg shadow-purple-900/30"
            style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}
          >
            {loading ? 'Verifying...' : 'Confirm'}
          </button>
        </div>
      </div>
    );
  }

  // ─── SIGN UP FORM SCREEN ─────────────────────────────────
  return (
    <div className="min-h-screen bg-obsidian flex flex-col px-7 py-8 relative overflow-y-auto">
      <button onClick={() => navigate('/')} className="absolute top-6 left-6 text-white/60 hover:text-white transition-colors">
        <ArrowLeft size={24} />
      </button>

      <div className="mt-12 mb-8 text-center">
        <div 
          className="w-[60px] h-[60px] mx-auto rounded-[18px] flex items-center justify-center mb-4 shadow-lg shadow-purple-900/40"
          style={{ background: 'linear-gradient(135deg, #C084FC 0%, #A855F7 50%, #EC4899 100%)' }}
        >
          <span className="text-white font-black text-[28px] leading-none">N</span>
        </div>
        <h1 className="text-white text-[30px] leading-[1.08] font-black tracking-tight mb-2">
          Create account
        </h1>
        <p className="text-purple-100/65 text-[14.5px]">
          Join Nakubonye today.
        </p>
      </div>

      <div className="w-full max-w-[400px] mx-auto pb-10">
        {error && (
          <div className="text-red-300 text-[13px] bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3 mb-5">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSignUp} className="space-y-4">
          <div className="flex gap-3">
            <div className="w-1/2">
              <label className="block text-white/70 text-[12.5px] font-semibold mb-2">First name</label>
              <input type="text" name="firstName" placeholder="Bernest" required onChange={handleChange} className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3.5 text-white text-[15px] placeholder:text-white/30 focus:outline-none focus:border-purple-500/70 transition-colors" />
            </div>
            <div className="w-1/2">
              <label className="block text-white/70 text-[12.5px] font-semibold mb-2">Surname</label>
              <input type="text" name="surname" placeholder="Niyo" required onChange={handleChange} className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3.5 text-white text-[15px] placeholder:text-white/30 focus:outline-none focus:border-purple-500/70 transition-colors" />
            </div>
          </div>

          <div>
            <label className="block text-white/70 text-[12.5px] font-semibold mb-2">Username <span className="text-white/30 font-normal">(optional)</span></label>
            <input type="text" name="username" placeholder="Leave blank to auto-generate" onChange={handleChange} className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3.5 text-white text-[15px] placeholder:text-white/30 focus:outline-none focus:border-purple-500/70 transition-colors" />
          </div>

          <div>
            <label className="block text-white/70 text-[12.5px] font-semibold mb-2">Email address</label>
            <input type="email" name="email" placeholder="bernest@gmail.com" required onChange={handleChange} className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3.5 text-white text-[15px] placeholder:text-white/30 focus:outline-none focus:border-purple-500/70 transition-colors" />
          </div>
          <div>
            <label className="block text-white/70 text-[12.5px] font-semibold mb-2">Password</label>
            <input type="password" name="password" placeholder="••••••••" required onChange={handleChange} className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3.5 text-white text-[15px] placeholder:text-white/30 focus:outline-none focus:border-purple-500/70 transition-colors" />
          </div>

          <div className="pt-1">
            <label className="block text-white/70 text-[12.5px] font-semibold mb-2">Date of birth</label>
            <div className="flex gap-2">
              <select name="dobMonth" onChange={handleChange} className="w-1/2 bg-white/[0.04] border border-white/10 rounded-2xl px-3 py-3.5 text-white text-[15px] focus:outline-none appearance-none">
                {months.map(m => <option key={m} className="bg-obsidian text-white">{m}</option>)}
              </select>
              <select name="dobDay" onChange={handleChange} className="w-1/4 bg-white/[0.04] border border-white/10 rounded-2xl px-3 py-3.5 text-white text-[15px] focus:outline-none appearance-none">
                {days.map(d => <option key={d} className="bg-obsidian text-white">{d}</option>)}
              </select>
              <select name="dobYear" onChange={handleChange} className="w-1/4 bg-white/[0.04] border border-white/10 rounded-2xl px-3 py-3.5 text-white text-[15px] focus:outline-none appearance-none">
                {years.map(y => <option key={y} className="bg-obsidian text-white">{y}</option>)}
              </select>
            </div>
          </div>

          <div className="pt-1">
            <label className="block text-white/70 text-[12.5px] font-semibold mb-2">Gender</label>
            <select name="gender" onChange={handleChange} className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3.5 text-white text-[15px] focus:outline-none appearance-none">
              <option className="bg-obsidian text-white">Male</option>
              <option className="bg-obsidian text-white">Female</option>
              <option className="bg-obsidian text-white">Custom</option>
            </select>
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="mt-4 w-full text-white font-bold text-[16px] rounded-full py-[16px] transition-transform active:scale-[0.98] disabled:opacity-60 shadow-lg shadow-purple-900/30"
            style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>

          <div className="text-center pt-4">
            <Link to="/signin" className="text-purple-300 font-semibold text-[13.5px] hover:text-purple-200">
              Already have an account?
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
