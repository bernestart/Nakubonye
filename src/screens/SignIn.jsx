import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ArrowLeft } from 'lucide-react';

export default function SignIn() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signIn(email, password);
      navigate('/feed');
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian flex flex-col px-7 py-8 relative">
      <button onClick={() => navigate('/')} className="absolute top-6 left-6 text-white/60 hover:text-white transition-colors">
        <ArrowLeft size={24} />
      </button>

      <div className="mt-16 mb-8 text-center">
        <div 
          className="w-[60px] h-[60px] mx-auto rounded-[18px] flex items-center justify-center mb-4 shadow-lg shadow-purple-900/40"
          style={{ background: 'linear-gradient(135deg, #C084FC 0%, #A855F7 50%, #EC4899 100%)' }}
        >
          <span className="text-white font-black text-[28px] leading-none">N</span>
        </div>
        <h1 className="text-white text-[30px] leading-[1.08] font-black tracking-tight mb-2">
          Welcome back
        </h1>
        <p className="text-purple-100/65 text-[14.5px]">
          Log in to continue to Nakubonye.
        </p>
      </div>

      <div className="w-full max-w-[400px] mx-auto">
        {error && (
          <div className="text-red-300 text-[13px] bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3 mb-5">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label className="block text-white/70 text-[12.5px] font-semibold mb-2">Email address</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="bernest@gmail.com" 
              required 
              className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3.5 text-white text-[15px] placeholder:text-white/30 focus:outline-none focus:border-purple-500/70 transition-colors" 
            />
          </div>

          <div>
            <label className="block text-white/70 text-[12.5px] font-semibold mb-2">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" 
              required 
              className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3.5 text-white text-[15px] placeholder:text-white/30 focus:outline-none focus:border-purple-500/70 transition-colors" 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="mt-6 w-full text-white font-bold text-[16px] rounded-full py-[16px] transition-transform active:scale-[0.98] disabled:opacity-60 shadow-lg shadow-purple-900/30"
            style={{ background: 'linear-gradient(135deg, #EC4899 0%, #A855F7 100%)' }}
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>

          <div className="text-center pt-4">
            <Link to="/signup" className="text-purple-300 font-semibold text-[13.5px] hover:text-purple-200">
              Don't have an account? Sign up
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
