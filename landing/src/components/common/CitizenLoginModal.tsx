import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound, Mail, X } from 'lucide-react';
import { useWarta } from '../../context/WartaContext';

const DISPLAY_NAME_REGEX = /^[A-Za-z0-9_]{3,24}$/;

/** Nama tampilan sementara dari bagian depan email, sampai API login tersambung. */
function nameFromEmail(email: string): string {
  const base = email.split('@')[0].replace(/[^A-Za-z0-9_]/g, '_').slice(0, 24);
  return base.length >= 3 ? base : `warga_${base}`.slice(0, 24);
}

export default function CitizenLoginModal() {
  const { loginOpen, setLoginOpen, login, register } = useWarta();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loginOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLoginOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [loginOpen, setLoginOpen]);

  if (!loginOpen) return null;

  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    setError('');
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim();
    const cleanName = displayName.trim();

    if (!cleanEmail.includes('@')) {
      setError('Masukkan alamat email yang valid.');
      return;
    }
    if (password.length < 8) {
      setError('Kata sandi minimal 8 karakter.');
      return;
    }
    if (mode === 'register') {
      if (!DISPLAY_NAME_REGEX.test(cleanName)) {
        setError('Nama tampilan harus 3 sampai 24 karakter: huruf, angka, atau garis bawah, tanpa spasi.');
        return;
      }
      register(cleanName, cleanEmail);
      return;
    }
    login(nameFromEmail(cleanEmail), cleanEmail);
  };

  const field =
    'w-full rounded-xl border border-slate-300 bg-white py-3 pr-4 pl-11 text-base text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <h2 id="auth-modal-title" className="text-xl font-bold text-slate-900">
            {mode === 'login' ? 'Masuk' : 'Daftar akun warga'}
          </h2>
          <button
            type="button"
            onClick={() => setLoginOpen(false)}
            className="-m-2 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Tutup dialog"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
          {mode === 'register' && (
            <div>
              <label htmlFor="auth-display-name" className="mb-1.5 block text-sm font-medium text-slate-800">
                Nama tampilan
              </label>
              <input
                id="auth-display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="warga_kemayoran"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <p className="mt-1.5 text-sm text-slate-600">
                Nama ini tampil di aduan dan suara Anda. Email tidak pernah ditampilkan.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="mb-1.5 block text-sm font-medium text-slate-800">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-3.5 left-4 size-5 text-slate-500" aria-hidden="true" />
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={field}
              />
            </div>
          </div>

          <div>
            <label htmlFor="auth-password" className="mb-1.5 block text-sm font-medium text-slate-800">
              Kata sandi
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute top-3.5 left-4 size-5 text-slate-500" aria-hidden="true" />
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={field}
              />
            </div>
            {mode === 'register' && <p className="mt-1.5 text-sm text-slate-600">Minimal 8 karakter.</p>}
          </div>

          {error && (
            <p role="alert" className="rounded-xl border border-bad-border bg-bad-bg px-4 py-3 text-sm font-medium text-bad-text">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-xl bg-brand py-3 text-base font-semibold text-white transition hover:bg-brand-dark"
          >
            {mode === 'login' ? 'Masuk' : 'Buat akun'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-700">
          {mode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}{' '}
          <button
            type="button"
            onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
            className="font-semibold text-brand underline-offset-2 hover:underline"
          >
            {mode === 'login' ? 'Daftar' : 'Masuk'}
          </button>
        </p>

        <p className="mt-5 border-t border-slate-200 pt-5 text-sm leading-relaxed text-slate-600">
          Server belum tersambung. Sesi dan aduan Anda hanya tersimpan di halaman ini dan hilang saat dimuat ulang.
        </p>
      </div>
    </div>
  );
}
