import { useState, type FormEvent } from 'react';
import { EyeOff, KeyRound, Mail, UserCheck, UserPlus, X } from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import { CURRENT_USER, OTHER_USER } from '../../data/wartaData';

const DISPLAY_NAME_REGEX = /^[A-Za-z0-9_]{3,24}$/;

const DEMO_ACCOUNTS = [
  { displayName: CURRENT_USER, email: 'warga.kebonjeruk@contoh.id', label: 'Pemilik draf & laporan SDN Tebet' },
  { displayName: OTHER_USER, email: 'warga.cilincing@contoh.id', label: 'Pelapor Rusun Rorotan IX' },
  { displayName: 'Warga_Tebet', email: 'warga.tebet@contoh.id', label: 'Warga pemeriksa independen' },
];

export default function CitizenLoginModal() {
  const { loginOpen, setLoginOpen, login, register } = useWarta();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [displayName, setDisplayName] = useState('Warga_Kemayoran');
  const [email, setEmail] = useState('warga.kemayoran@contoh.id');
  const [password, setPassword] = useState('rahasia123');
  const [error, setError] = useState('');

  if (!loginOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanName = displayName.trim();
    const cleanEmail = email.trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Masukkan alamat email yang valid.');
      return;
    }
    if (password.length < 8) {
      setError('Kata sandi minimal 8 karakter.');
      return;
    }
    if (mode === 'register') {
      if (!DISPLAY_NAME_REGEX.test(cleanName)) {
        setError('Nama tampilan harus 3–24 karakter (huruf, angka, atau garis bawah tanpa spasi).');
        return;
      }
      register(cleanName, cleanEmail);
      return;
    }

    login(cleanName || CURRENT_USER, cleanEmail);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="auth-modal-title" className="text-lg font-bold text-slate-900">
              {mode === 'login' ? 'Masuk ke akun warga' : 'Daftar akun warga baru'}
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              Identitas publik hanya menampilkan nama samaran warga.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLoginOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Tutup dialog"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition ${
              mode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="size-4" /> Masuk
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition ${
              mode === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserPlus className="size-4" /> Daftar Baru
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
          <div>
            <label htmlFor="auth-display-name" className="mb-1 block text-sm font-medium text-slate-700">
              Nama tampilan publik (`display_name`)
            </label>
            <input
              id="auth-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Contoh: Warga_Kemayoran"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <p className="mt-1 text-xs text-slate-500">
              3–24 karakter alfanumerik atau garis bawah (`_`). Ditampilkan pada laporan dan suara.
            </p>
          </div>

          <div>
            <label htmlFor="auth-email" className="mb-1 block text-sm font-medium text-slate-700">
              Alamat email pribadi
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-3 left-3.5 size-4 text-slate-400" />
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.id"
                className="w-full rounded-xl border border-slate-300 py-2.5 pr-3.5 pl-10 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
          </div>

          <div>
            <label htmlFor="auth-password" className="mb-1 block text-sm font-medium text-slate-700">
              Kata sandi
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute top-3 left-3.5 size-4 text-slate-400" />
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 8 karakter"
                className="w-full rounded-xl border border-slate-300 py-2.5 pr-3.5 pl-10 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <EyeOff className="mt-0.5 size-4 shrink-0 text-slate-500" />
            <span>
              Email Anda dienkripsi dan hanya dapat dilihat oleh Anda sendiri melalui endpoint privat (`/auth/me`).
            </span>
          </div>

          {error && (
            <p role="alert" className="rounded-xl border border-bad-border bg-bad-bg px-3 py-2 text-xs font-medium text-bad-text">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
          >
            {mode === 'login' ? 'Masuk Sekarang' : 'Buat Akun & Kirim Verifikasi Email'}
          </button>
        </form>

        {/* Simulasi cepat akun warga untuk pengujian alur */}
        <div className="mt-5 border-t border-slate-200 pt-4">
          <p className="mb-2 text-xs font-semibold text-slate-500">
            Pilih cepat akun simulasi warga:
          </p>
          <div className="space-y-1.5">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.displayName}
                type="button"
                onClick={() => login(acc.displayName, acc.email)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left text-xs transition hover:border-slate-300 hover:bg-slate-50"
              >
                <span className="font-semibold text-slate-900">{acc.displayName}</span>
                <span className="text-slate-500">{acc.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
