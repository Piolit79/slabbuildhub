import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import slabLogo from '@/assets/slab-builders-logo.svg';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const err = await login(email, password);
    setLoading(false);

    if (err) {
      setError('Invalid email or password');
    } else {
      // AuthContext will have the profile by now — redirect happens in App.tsx
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1e1e22] px-4">
      <Card className="w-full max-w-sm border-border/30 bg-[#2a2a2e]">
        <CardContent className="pt-8 pb-6 px-6">
          <div className="flex justify-center mb-8">
            <img src={slabLogo} alt="SLAB Builders" className="w-48" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-400">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-9 text-sm bg-[#1e1e22] border-border/30 text-white placeholder:text-gray-500"
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-400">Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-9 text-sm bg-[#1e1e22] border-border/30 text-white placeholder:text-gray-500"
                placeholder="Enter password"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}

            <Button type="submit" disabled={loading} className="w-full h-9 text-sm" style={{ backgroundColor: '#c37e87' }}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
