import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { API_BASE_URL } from '../lib/api';
import { ArrowLeft } from 'lucide-react';

export default function SignUp() {
  const navigate = useNavigate();
  const { signUp, verifyOtp } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [form, setForm] = useState({
    firstName: '', surname: '', username: '',
    email: '', password: '',
    dobMonth: 'Jan', dobDay: '1', dobYear: '2000', gender: 'Male'
  });
  const [otp, setOtp] = useState('');

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleNext = () => {
    setError('');
    if (step === 2 && (!form.firstName || !form.surname)) return setError('Please enter your name.');
    if (step === 5 && !form.email.includes('@')) return setError('Please enter a valid email.');
    if (step === 6 && form.password.length < 6) return setError('Password must be 6+ characters.');
    
    if (step === 6) {
      submitSignUp(); 
    } else {
      setStep(step + 1);
    }
  };

  const submitSignUp = async () => {
    setLoading(true);
    try {
      const fullName = `${form.firstName} ${form.surname}`.trim();
      const monthNum = String(new Date(Date.parse(form.dobMonth + " 1, 2012")).getMonth() + 1).padStart(2, '0');
      const dob = `${form.dobYear}-${monthNum}-${String(form.dobDay).padStart(2, '0')}`;
      const finalUsername = form.username.trim() || form.email.split('@')[0];

      const authData = await signUp(form.email, form.password, fullName);
      
      await fetch(`${API_BASE_URL}/api/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authData.token}` },
        body: JSON.stringify({
          id: authData.user.id, display_name: fullName, username: finalUsername,
          date_of_birth: dob, gender: form.gender
        })
      });

      setStep(7); 
    } catch (err) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 6) return setError('Enter the 6-digit code.');
    setLoading(true);
    try {
      await verifyOtp(form.email, otp);
      navigate('/feed');
    } catch (err) {
      setError(err.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const years = Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i);

  // Input styling: Deep purple glassmorphism instead of gray
  const inputClass = "w-full bg-[#2d1b4e]/60 border border-purple-500/30 rounded-2xl px-4 py-3.5 text-white text-[15px] placeholder:text-purple-300/40 focus:outline-none focus:border-purple-400 focus:bg-[#2d1b4e]/90 transition-all";
  const btnClass = "w-full text-white font-bold text-[16px] rounded-full py-[16px] transition-transform active:scale-[0.98] shadow-[0_0_20px_rgba(168,85,247,0.3)]";
  const btnStyle = { background: 'linear-gradient(135deg, #C084FC 0%, #A855F7 50%, #EC4899 100%)' };

  return (
    <div className="min-h-screen bg-[#1a0b2e] flex flex-col px-7 py-8 relative">
      
      {/* Background Radial Glow to match Welcome Screen */}
      <div className="absolute top-0 left-0 w-full h-[50vh] bg-[radial-gradient(circle_at_50%_0%,#2A1055_0%,transparent_70%)] pointer-events-none" />

      <button onClick={() => step > 1 ? setStep(step - 1) : navigate('/')} className="absolute top-8 left-6 text-purple-300/70 hover:text-white transition-colors z-10">
        <ArrowLeft size={24} />
      </button>

      {error && (
        <div className="mt-12 text-red-300 text-[13px] bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3 mb-2 z-10 relative">
          {error}
        </div>
      )}

      {/* STEP 1: Intro */}
      {step === 1 && (
        <div className="flex-1 flex flex-col justify-center pb-20 z-10 relative">
          <div className="w-[60px] h-[60px] rounded-[18px] flex items-center justify-center mb-6 shadow-[0_8px_24px_rgba(168,85,247,0.45)]" style={btnStyle}>
            <span className="text-white font-black text-[28px] leading-none">N</span>
          </div>
          <h1 className="text-white text-[32px] leading-[1.1] font-black tracking-tight mb-3">
            Get started on Nakubonye with a new account
          </h1>
          <p className="text-purple-100/80 text-[15px] mb-8 leading-relaxed font-medium">
            A Nakubonye account lets you access all our apps and features easily and securely.
          </p>
          <button onClick={() => setStep(2)} className={btnClass} style={btnStyle}>
            Get Started
          </button>
        </div>
      )}

      {/* STEP 2: Name (Meta Exact Layout + Purple Identity) */}
      {step === 2 && (
        <div className="flex-1 mt-16 z-10 relative">
          <h1 className="text-white text-[28px] font-black mb-2">What's your name?</h1>
          <p className="text-purple-200/70 text-[14.5px] mb-8 font-medium">Enter the name you use in real life.</p>
          
          <div className="flex gap-3">
            <input 
              type="text" name="firstName" placeholder="First name" 
              onChange={handleChange} value={form.firstName} 
              className={inputClass} 
            />
            <input 
              type="text" name="surname" placeholder="Surname" 
              onChange={handleChange} value={form.surname} 
              className={inputClass} 
            />
          </div>
          
          <button onClick={handleNext} className={`mt-8 ${btnClass}`} style={btnStyle}>Next</button>
        </div>
      )}

      {/* STEP 3: DOB */}
      {step === 3 && (
        <div className="flex-1 mt-16 z-10 relative">
          <h1 className="text-white text-[28px] font-black mb-2">What's your date of birth?</h1>
          <p className="text-purple-200/70 text-[14.5px] mb-8 font-medium">Choose your date of birth. You can always make this private later.</p>
          <div className="flex gap-2">
            <select name="dobMonth" onChange={handleChange} className={`w-1/2 ${inputClass} appearance-none`}>
              {months.map(m => <option key={m} className="bg-[#1a0b2e] text-white">{m}</option>)}
            </select>
            <select name="dobDay" onChange={handleChange} className={`w-1/4 ${inputClass} appearance-none`}>
              {days.map(d => <option key={d} className="bg-[#1a0b2e] text-white">{d}</option>)}
            </select>
            <select name="dobYear" onChange={handleChange} className={`w-1/4 ${inputClass} appearance-none`}>
              {years.map(y => <option key={y} className="bg-[#1a0b2e] text-white">{y}</option>)}
            </select>
          </div>
          <button onClick={handleNext} className={`mt-8 ${btnClass}`} style={btnStyle}>Next</button>
        </div>
      )}

      {/* STEP 4: Gender */}
      {step === 4 && (
        <div className="flex-1 mt-16 z-10 relative">
          <h1 className="text-white text-[28px] font-black mb-2">What's your gender?</h1>
          <p className="text-purple-200/70 text-[14.5px] mb-8 font-medium">You can change who sees your gender on your profile later.</p>
          <div className="bg-[#2d1b4e]/60 border border-purple-500/30 rounded-2xl overflow-hidden">
            {['Female', 'Male', 'Custom'].map(g => (
              <label key={g} className="flex items-center justify-between p-4 border-b border-purple-500/20 last:border-0">
                <span className="text-white text-[15px] font-medium">{g}</span>
                <input type="radio" name="gender" value={g} checked={form.gender === g} onChange={handleChange} className="w-5 h-5 accent-purple-500" />
              </label>
            ))}
          </div>
          <button onClick={handleNext} className={`mt-8 ${btnClass}`} style={btnStyle}>Next</button>
        </div>
      )}

      {/* STEP 5: Email */}
      {step === 5 && (
        <div className="flex-1 mt-16 z-10 relative">
          <h1 className="text-white text-[28px] font-black mb-2">What's your email address?</h1>
          <p className="text-purple-200/70 text-[14.5px] mb-8 font-medium">Enter the email address at which you can be contacted. No one will see this on your profile.</p>
          <input type="email" name="email" placeholder="Email address" onChange={handleChange} value={form.email} className={inputClass} />
          <button onClick={handleNext} className={`mt-8 ${btnClass}`} style={btnStyle}>Next</button>
        </div>
      )}

      {/* STEP 6: Password */}
      {step === 6 && (
        <div className="flex-1 mt-16 z-10 relative">
          <h1 className="text-white text-[28px] font-black mb-2">Create a password</h1>
          <p className="text-purple-200/70 text-[14.5px] mb-8 font-medium">Create a password with at least six letters or numbers. It should be something that others can't guess.</p>
          <input type="password" name="password" placeholder="Password" onChange={handleChange} value={form.password} className={inputClass} />
          <button onClick={handleNext} disabled={loading} className={`mt-8 ${btnClass} disabled:opacity-50`} style={btnStyle}>
            {loading ? 'Creating...' : 'Next'}
          </button>
        </div>
      )}

      {/* STEP 7: OTP */}
      {step === 7 && (
        <div className="flex-1 mt-16 z-10 relative">
          <h1 className="text-white text-[28px] font-black mb-2">Enter confirmation code</h1>
          <p className="text-purple-200/70 text-[14.5px] mb-8 font-medium">To confirm your account, enter the 6-digit code we sent to <span className="text-white font-semibold">{form.email}</span></p>
          <input type="text" maxLength={6} placeholder="123456" value={otp} onChange={(e) => setOtp(e.target.value)} className="w-full bg-[#2d1b4e]/60 border border-purple-500/30 rounded-2xl px-4 py-4 text-white text-center text-[24px] tracking-[10px] font-black focus:outline-none focus:border-purple-400" />
          <button onClick={handleVerifyOtp} disabled={loading || otp.length < 6} className={`mt-8 ${btnClass} disabled:opacity-50`} style={btnStyle}>
            {loading ? 'Verifying...' : 'Next'}
          </button>
        </div>
      )}

      <div className="mt-auto pt-6 text-center z-10 relative">
        <Link to="/signin" className="text-purple-400 font-semibold text-[13.5px] hover:text-purple-300 transition-colors">Already have an account?</Link>
      </div>
    </div>
  );
}
