import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { API_BASE_URL } from '../lib/api';

export default function SignUp() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    dob: '',
    gender: 'Male'
  });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const name = `${form.firstName} ${form.lastName}`.trim();
      
      // 1. Create User in Better Auth (Neon)
      const authData = await signUp(form.email, form.password, name);
      
      // 2. Save Profile details to Neon using our new Worker route
      const profileRes = await fetch(`${API_BASE_URL}/api/profile`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authData.token}` 
        },
        body: JSON.stringify({
          id: authData.user.id,
          display_name: name,
          username: form.username,
          date_of_birth: form.dob,
          gender: form.gender
        })
      });

      const profileData = await profileRes.json();
      if (!profileData.success) throw new Error(profileData.error || 'Failed to save profile');

      // 3. Send OTP via Resend (Optional: we can add the OTP screen next, for now go to feed)
      navigate('/feed');
      
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#18191A] flex flex-col items-center justify-center p-4">
      {/* FB Style Logo */}
      <div className="mb-6 text-center">
        <h1 className="text-5xl font-black text-[#1877F2] tracking-tighter">nakubonye</h1>
        <p className="text-gray-300 mt-2 text-[15px]">Create a new account</p>
      </div>

      <div className="w-full max-w-md bg-[#242526] rounded-xl shadow-2xl p-6 border border-[#3E4042]">
        {error && <div className="bg-[#FF4D4F]/10 border border-[#FF4D4F] text-[#FF4D4F] p-3 rounded-lg mb-4 text-sm">{error}</div>}
        
        <form onSubmit={handleSignUp} className="space-y-4">
          {/* Name Row */}
          <div className="flex gap-3">
            <input type="text" name="firstName" placeholder="First name" required onChange={handleChange} className="w-full bg-[#3A3B3C] text-white placeholder-gray-400 rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#1877F2]" />
            <input type="text" name="lastName" placeholder="Surname" required onChange={handleChange} className="w-full bg-[#3A3B3C] text-white placeholder-gray-400 rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#1877F2]" />
          </div>

          <input type="text" name="username" placeholder="Username" required onChange={handleChange} className="w-full bg-[#3A3B3C] text-white placeholder-gray-400 rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#1877F2]" />
          <input type="email" name="email" placeholder="Email address" required onChange={handleChange} className="w-full bg-[#3A3B3C] text-white placeholder-gray-400 rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#1877F2]" />
          <input type="password" name="password" placeholder="Password" required onChange={handleChange} className="w-full bg-[#3A3B3C] text-white placeholder-gray-400 rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#1877F2]" />

          <div className="text-gray-400 text-xs mt-2">Date of birth</div>
          <input type="date" name="dob" required onChange={handleChange} className="w-full bg-[#3A3B3C] text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#1877F2]" />

          <div className="text-gray-400 text-xs mt-2">Gender</div>
          <select name="gender" onChange={handleChange} className="w-full bg-[#3A3B3C] text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#1877F2]">
            <option>Male</option>
            <option>Female</option>
            <option>Custom</option>
          </select>

          <p className="text-[#B0B3B8] text-[11px] leading-tight mt-2">
            People who use our service may have uploaded your contact information to Nakubonye. <a href="#" className="text-[#1877F2] hover:underline">Learn more</a>.
          </p>

          <button type="submit" disabled={loading} className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold text-lg rounded-lg py-3 mt-4 transition-colors disabled:opacity-50">
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>

          <div className="text-center mt-4">
            <Link to="/signin" className="text-[#1877F2] font-semibold text-sm hover:underline">Already have an account?</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
