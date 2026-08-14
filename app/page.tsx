'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { GraduationCap, Users, ShieldCheck, LogIn, Mail, Lock, BookOpen } from 'lucide-react';
import { LOGIN_CREDENTIALS } from '@/components/shared/constants';
import { backendLogin } from '@/components/shared/api';
import type { LoginResult } from '@/components/shared/api';
import ThemeToggle from '@/components/shared/ThemeToggle';

const ROLE_ICONS = {
  student: BookOpen,
  lecturer: GraduationCap,
  'student-affair': ShieldCheck,
  admin: Users,
};

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const found = LOGIN_CREDENTIALS.find(
      (c) => c.email.toLowerCase() === email.trim().toLowerCase() && c.password === password
    );
    if (!found) {
      toast.error('Invalid email or password. Please try again.');
      return;
    }
    let result: LoginResult;
    try {
      result = await backendLogin(found.email, found.password);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Cannot reach the university server. Please try again.');
      return;
    }
    toast.success(`Welcome back, ${result.name}!`);
    router.push(found.path);
  };

  const fillCredential = (c: (typeof LOGIN_CREDENTIALS)[number]) => {
    setEmail(c.email);
    setPassword(c.password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 lg:p-8">
      <div className="absolute top-5 right-5">
        <ThemeToggle />
      </div>

      <div className="card card-border bg-base-100 shadow-lg w-full max-w-4xl overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
          <div
            className="hidden lg:flex flex-col justify-between p-10"
            style={{ background: 'var(--login-panel)', color: 'var(--login-panel-content)' }}
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white/20 font-extrabold text-2xl">
                U
              </div>
              <div>
                <div className="text-xl font-bold tracking-tight">UniConnect</div>
                <div className="text-xs opacity-70">University Communication Platform</div>
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-extrabold leading-tight mb-3">
                One platform for every role on campus
              </h1>
              <p className="text-sm opacity-80 leading-relaxed">
                Manage lectures, oversee university operations, and handle student
                services — all from a single, secure sign-in.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {LOGIN_CREDENTIALS.map((c) => {
                const Icon = ROLE_ICONS[c.role];
                return (
                  <div key={c.role} className="flex items-center gap-3 bg-white/15 rounded-xl px-4 py-3 backdrop-blur">
                    <Icon size={18} />
                    <div>
                      <div className="text-sm font-semibold">{c.label}</div>
                      <div className="text-[11px] opacity-70">{c.path}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-6 sm:p-10">
            <div className="lg:hidden flex items-center gap-3 mb-8">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary text-primary-content font-extrabold text-2xl">
                U
              </div>
              <div>
                <div className="text-xl font-bold text-base-content tracking-tight">UniConnect</div>
                <div className="text-xs text-base-content/60">University Communication Platform</div>
              </div>
            </div>

            <h2 className="text-2xl font-extrabold text-base-content tracking-tight mb-1">
              Welcome back
            </h2>
            <p className="text-sm text-base-content/60 mb-7">
              Sign in with your university credentials to continue
            </p>

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <label className="floating-label">
                <input
                  type="email"
                  placeholder="Email"
                  className="input input-bordered w-full"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <span className="flex items-center gap-1.5">
                  <Mail size={13} /> Email
                </span>
              </label>

              <label className="floating-label">
                <input
                  type="password"
                  placeholder="Password"
                  className="input input-bordered w-full"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <span className="flex items-center gap-1.5">
                  <Lock size={13} /> Password
                </span>
              </label>

              <button type="submit" className="btn btn-primary btn-block mt-1">
                <LogIn size={16} /> Sign In
              </button>
            </form>

            <div className="divider text-xs text-base-content/50 my-5">Demo accounts</div>
            <div className="flex flex-col gap-2">
              {LOGIN_CREDENTIALS.map((c) => {
                const Icon = ROLE_ICONS[c.role];
                return (
                  <button
                    key={c.role}
                    type="button"
                    onClick={() => fillCredential(c)}
                    className="btn btn-outline btn-sm justify-start gap-2.5"
                  >
                    <Icon size={15} className="text-primary" />
                    <span className="flex-1 text-left">{c.label}</span>
                    <span className="font-mono text-[11px] text-base-content/50 hidden sm:inline">
                      {c.email}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] text-base-content/40 text-center mt-6">
              Click a demo account to fill the form, then press Sign In.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}