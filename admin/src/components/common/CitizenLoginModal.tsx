import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, Eye, EyeOff, Lock, Mail, UserRound, X } from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import { authService } from '../../services/auth';

export default function CitizenLoginModal() {
  const { loginOpen, setLoginOpen, login } = useWarta();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!loginOpen) return;
    setErrorMsg(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLoginOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [loginOpen, setLoginOpen]);

  if (!loginOpen) return null;

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validPassword = password.length >= 8;
  const validDisplayName = !isRegister || /^[A-Za-z0-9_]{3,24}$/.test(displayName);
  const formValid = validEmail && validPassword && validDisplayName;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formValid || loading) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      if (isRegister) {
        await authService.register({
          display_name: displayName,
          email,
          password,
        });
      }

      // Auto-login after registration or direct login
      const res = await authService.login({
        email,
        password,
      });

      const me = await authService.getMe().catch(() => ({
        id: res.user.id,
        display_name: res.user.display_name,
        email: res.user.email,
        email_verified_at: res.user.email_verified_at,
        is_active: true,
        created_at: '',
        updated_at: '',
      }));

      login(me.display_name, me);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string; details?: Array<{ message: string }> } } } };
      const apiErr = e.response?.data?.error;
      const detail = apiErr?.details?.[0]?.message;
      setErrorMsg(detail || apiErr?.message || 'Gagal masuk. Periksa kembali email dan kata sandi Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
    >
      <form onSubmit={submit} className="w-full max-w-md animate-pop space-y-4 rounded-2xl bg-white p-7 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="login-modal-title" className="text-xl font-extrabold text-brand">
              {isRegister ? 'Daftar Akun Komunitas' : 'Masuk Komunitas Warga'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              {isRegister
                ? 'Bergabung sebagai verifikator independen dan pengawas anggaran publik.'
                : 'Masuk dengan kredensial terdaftar untuk memverifikasi dan memberi suara.'}
            </p>
          </div>
          <button
            type="button"
            id="login-close"
            onClick={() => setLoginOpen(false)}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
            aria-label="Tutup dialog masuk"
          >
            <X className="size-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2 rounded-xl border border-bad-border bg-bad-bg p-3 text-xs text-bad-text">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {isRegister && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-800" htmlFor="login-display-name">
              Nama Tampilan Publik
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 focus-within:border-action-border focus-within:ring-2 focus-within:ring-action-border/30">
              <UserRound className="size-4 text-slate-400" />
              <input
                id="login-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Contoh: Warga_KebonJeruk"
                className="w-full py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                required
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">3–24 karakter: huruf, angka, atau underscore (_).</p>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-800" htmlFor="login-email">
            Alamat Email
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 focus-within:border-action-border focus-within:ring-2 focus-within:ring-action-border/30">
            <Mail className="size-4 text-slate-400" />
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="w-full py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-800" htmlFor="login-password">
            Kata Sandi
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 focus-within:border-action-border focus-within:ring-2 focus-within:ring-action-border/30">
            <Lock className="size-4 text-slate-400" />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
              className="w-full py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <button
          id="login-submit"
          type="submit"
          disabled={!formValid || loading}
          className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Memproses…' : isRegister ? 'Daftar Sekarang' : 'Masuk Sekarang'}
        </button>

        <div className="pt-2 text-center text-xs text-slate-600">
          {isRegister ? (
            <span>
              Sudah punya akun?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsRegister(false);
                  setErrorMsg(null);
                }}
                className="font-bold text-brand hover:underline"
              >
                Masuk di sini
              </button>
            </span>
          ) : (
            <span>
              Belum punya akun warga?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsRegister(true);
                  setErrorMsg(null);
                }}
                className="font-bold text-brand hover:underline"
              >
                Daftar akun baru
              </button>
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

