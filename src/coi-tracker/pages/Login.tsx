import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/coi-tracker/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, AlertCircle } from 'lucide-react';
import slabLogo from '@/assets/slab-builders-logo.svg';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      const ok = login(username.trim(), password);
      if (ok) {
        navigate('/', { replace: true });
      } else {
        setError('Invalid username or password.');
      }
      setLoading(false);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-[#1e1e22] flex flex-col items-center justify-center p-4">
      {/* Card */}
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src={slabLogo} alt="SLAB Builders" className="w-48 mb-4 opacity-90" />
          <div className="flex items-center gap-2 text-[#7b7c81]">
            <Shield className="h-4 w-4 text-[#c24f5d]" />
            <span className="text-sm font-medium tracking-widest uppercase">COI Tracker</span>
          </div>
        </div>

        {/* Form */}
        <div className="bg-[#27272c] rounded-xl border border-[#38383e] p-8 shadow-xl">
          <h1 className="text-lg font-semibold text-white mb-1">Sign in</h1>
          <p className="text-xs text-[#7b7c81] mb-6">Enter your credentials to continue</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-xs text-[#9b9ba0]">Username</Label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="bg-[#1e1e22] border-[#38383e] text-white placeholder:text-[#555560] focus-visible:ring-[#c24f5d]"
                placeholder="studiolab"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs text-[#9b9ba0]">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="bg-[#1e1e22] border-[#38383e] text-white placeholder:text-[#555560] focus-visible:ring-[#c24f5d]"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-[#c24f5d]/10 border border-[#c24f5d]/30 px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 text-[#c24f5d] shrink-0" />
                <p className="text-xs text-[#c24f5d]">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full bg-[#c24f5d] hover:bg-[#a8404d] text-white border-0 mt-2"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
