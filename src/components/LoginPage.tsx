import { useState, FormEvent } from 'react';
import { Eye, EyeOff, Lock, LogIn, PackageCheck, User as UserIcon } from 'lucide-react';
import { apiRequest, setStoredAuth } from '../api';
import { User } from '../types';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageError, setImageError] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await apiRequest<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), password }),
      });
      setStoredAuth(result.token, result.user);
      onLoginSuccess(result.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Please check credentials.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function applySampleAccount(sampleUser: string, samplePass: string) {
    setUsername(sampleUser);
    setPassword(samplePass);
    setError('');
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-5xl bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        {/* Left Visual & Project Context Panel */}
        <div className="lg:col-span-6 bg-blue-600 text-white p-8 sm:p-10 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-white/15 border border-white/25 flex items-center justify-center">
                <PackageCheck className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm font-semibold tracking-tight text-blue-50">
                VTU 3rd Sem CSE Community Project
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-6 text-white leading-tight [text-wrap:balance]">
              Digital Inventory &amp; Sales Management System
            </h1>
            <p className="text-sm text-blue-100 mt-3 leading-relaxed max-w-md">
              A centralized store operations platform for tracking product stock, recording supplier purchases, billing customers with automatic stock deduction, and exporting CSV reports.
            </p>
          </div>

          <div className="mt-8">
            <div className="rounded-xl overflow-hidden border border-white/20 bg-blue-700/40 aspect-[4/3]">
              {!imageError ? (
                <img
                  src="/src/assets/images/login_inventory_visual_1794923332582.jpg"
                  alt="Modern retail stockroom and digital checkout counter illustration"
                  referrerPolicy="no-referrer"
                  onError={() => setImageError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-blue-500 to-blue-700">
                  <PackageCheck className="w-12 h-12 text-white/90 mb-3" />
                  <p className="text-sm font-medium text-white">
                    Inventory, Billing &amp; Reporting Workspace
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Login Form Panel */}
        <div className="lg:col-span-6 p-8 sm:p-12 flex flex-col justify-center bg-white">
          <div className="max-w-md w-full mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Admin Sign In
            </h2>
            <p className="text-sm text-slate-500 mt-1.5">
              Sign in with your store administrator or staff credentials to manage inventory and sales.
            </p>

            {error && (
              <div
                role="alert"
                className="mt-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 font-medium"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="login-username"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Username
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    className="w-full pl-10 pr-4 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-colors"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-10 pr-11 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-60 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                {isSubmitting ? 'Signing in...' : 'Sign In to Dashboard'}
              </button>
            </form>

            {/* Sample Testing Credentials Box */}
            <div className="mt-7 pt-6 border-t border-slate-200">
              <p className="text-xs font-semibold text-slate-700">
                Sample Testing Credentials
              </p>
              <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => applySampleAccount('admin', 'admin123')}
                  className="text-left p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                >
                  <div className="text-xs font-semibold text-slate-900">Admin Account</div>
                  <div className="text-xs font-mono text-slate-600 mt-0.5">
                    admin / admin123
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => applySampleAccount('staff', 'staff123')}
                  className="text-left p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                >
                  <div className="text-xs font-semibold text-slate-900">Staff Account</div>
                  <div className="text-xs font-mono text-slate-600 mt-0.5">
                    staff / staff123
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
