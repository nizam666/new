import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export function LoginForm({ onSuccess }: { onSuccess?: () => void }) {
  const auth = useAuth();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Auto-format employee ID to dummy email if no @ present
      let loginEmail = loginId.trim();
      if (!loginEmail.includes('@')) {
        loginEmail = `${loginEmail.replace(/\s+/g, '').toLowerCase()}@sribaba-internal.com`;
      }

      const { error } = await auth.signIn(loginEmail, password);
      // 'remember' is not currently supported by auth context but kept in state for future use
      if (error) throw error;

      if (onSuccess) onSuccess();
    } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      setError(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-md border border-slate-200 p-8">
        <header className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-800">Sri Baba Blue Metals</h1>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Employee ID / Email</label>
            <input
              type="text"
              required
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. EMP001 or you@example.com"
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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (typeof (auth as any).sendPasswordReset === 'function') {
                  let resetEmail = loginId.trim();
                  if (!resetEmail.includes('@')) {
                    resetEmail = `${resetEmail.replace(/\s+/g, '').toLowerCase()}@sribaba-internal.com`;
                  }
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (auth as any).sendPasswordReset(resetEmail);
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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (typeof (auth as any).openSignup === 'function') {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
