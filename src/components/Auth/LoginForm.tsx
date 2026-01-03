import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginForm({ onSuccess }: { onSuccess?: () => void }) {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // If your context exposes a signIn / login method adapt the call below.
      if (typeof (auth as any).signIn === 'function') {
        const res = await (auth as any).signIn({ email, password, remember });
        if (res?.error) throw res.error;
      } else if (typeof (auth as any).login === 'function') {
        const res = await (auth as any).login(email, password);
        if (res?.error) throw res.error;
      } else {
        console.warn('No signIn/login method found on auth context');
      }

      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-md border border-slate-200 p-8">
        <header className="mb-6 text-center">
          <img src="/vite.svg" alt="Logo" className="mx-auto h-12 w-12 mb-3" />
          <h1 className="text-2xl font-semibold text-slate-800">Quarry ERP</h1>
          <p className="text-sm text-slate-500 mt-1">Mobile Operations - Contractor Portal</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="inline-flex items-center gap-2 text-slate-700">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4"
              />
              Remember me
            </label>
            <button
              type="button"
              onClick={() => {
                // If you have a forgot-password flow, route or call it here
                if (typeof (auth as any).sendPasswordReset === 'function') {
                  (auth as any).sendPasswordReset(email);
                } else {
                  // fallback - you can open a modal / route to forgot page
                  console.warn('Forgot password action not implemented');
                }
              }}
              className="text-indigo-600 hover:underline"
            >
              Forgot password?
            </button>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded-md bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </form>

        <footer className="mt-6 text-center text-sm text-slate-500">
          <p>
            Need an account?{' '}
            <button
              type="button"
              onClick={() => {
                // adapt to your signup route / modal
                if (typeof (auth as any).openSignup === 'function') {
                  (auth as any).openSignup();
                } else {
                  window.location.hash = 'signup';
                }
              }}
              className="text-indigo-600 hover:underline"
            >
              Sign up
            </button>
          </p>
        </footer>
      </div>
    </div>
  );
}
