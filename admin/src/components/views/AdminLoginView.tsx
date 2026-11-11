import { useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Landmark,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import { authService, type UserPrivate } from '../../services/auth';

export default function AdminLoginView() {
  const { login } = useWarta();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fillDemoAdmin = () => {
    setEmail('admin@dinas.pupr.go.id');
    setPassword('warta-dev-2026');
    setErrorMsg(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || loading) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const authToken = await authService.login({
        email: email.trim(),
        password,
      });

      const me = await authService.getMe().catch((): UserPrivate => ({
        id: authToken.user.id,
        display_name: authToken.user.display_name,
        email: authToken.user.email,
        email_verified_at: authToken.user.email_verified_at ?? null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      login(me.display_name, me);
    } catch (err: unknown) {
      const e = err as {
        response?: {
          data?: {
            error?: {
              message?: string;
              details?: Array<{ message: string }>;
            };
          };
        };
      };
      const apiErr = e.response?.data?.error;
      const detail = apiErr?.details?.[0]?.message;
      setErrorMsg(
        detail ||
          apiErr?.message ||
          'Email atau kata sandi tidak valid. Pastikan akun terdaftar di sistem dinas.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2 font-sans bg-white text-slate-900">
      {/* Kolom Kiri: Ilustrasi Panel Dashboard & Grid Background */}
      <div className="relative hidden lg:flex flex-col justify-between border-r border-slate-200/80 bg-[#f8fafc] p-12 overflow-hidden select-none">
        {/* Subtle Architectural Grid Pattern */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.45]"
          style={{
            backgroundImage: `
              linear-gradient(to right, #cbd5e1 1px, transparent 1px),
              linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Brand Header Kiri Atas */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-brand text-white shadow-xs">
            <Landmark className="size-5" />
          </div>
          <div>
            <span className="text-xl font-black tracking-tight text-brand">WARTA</span>
            <span className="block text-[11px] font-medium text-slate-500">
              Portal Dinas Provinsi DKI Jakarta
            </span>
          </div>
        </div>

        {/* Ilustrasi Dashboard Preview Tengah (Clean Minimalist Window) */}
        <div className="relative z-10 my-auto flex justify-center py-8">
          <div className="relative w-full max-w-[420px]">
            {/* Kartu Utama UI Window */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xl shadow-slate-200/50">
              {/* Window Controls */}
              <div className="flex items-center gap-1.5 pb-4 border-b border-slate-100">
                <div className="size-2.5 rounded-full bg-rose-400" />
                <div className="size-2.5 rounded-full bg-amber-400" />
                <div className="size-2.5 rounded-full bg-emerald-400" />
                <span className="ml-2 text-[10px] font-medium text-slate-400">
                  Ringkasan Proyek & Verifikasi Lapangan
                </span>
              </div>

              {/* Mock Baris UI Konten */}
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-sky-50 grid place-items-center text-sky-600">
                    <ShieldCheck className="size-4" />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 w-3/4 rounded-full bg-slate-200/80" />
                    <div className="h-2 w-1/2 rounded-full bg-slate-100" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
                    <div className="h-2 w-16 rounded-full bg-slate-200" />
                    <div className="mt-2 h-4 w-12 rounded-full bg-slate-300" />
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
                    <div className="h-2 w-20 rounded-full bg-slate-200" />
                    <div className="mt-2 h-4 w-14 rounded-full bg-sky-300" />
                  </div>
                </div>

                {/* Mock Bar Chart Pengawasan */}
                <div className="pt-3">
                  <div className="flex h-24 items-end justify-between gap-2.5 rounded-xl border border-slate-100 bg-slate-50/50 px-4 pb-2">
                    <div className="w-full h-[45%] rounded-t-md bg-blue-500/70" />
                    <div className="w-full h-[65%] rounded-t-md bg-blue-600" />
                    <div className="w-full h-[35%] rounded-t-md bg-blue-400/60" />
                    <div className="w-full h-[85%] rounded-t-md bg-blue-600" />
                    <div className="w-full h-[55%] rounded-t-md bg-sky-500" />
                    <div className="w-full h-[95%] rounded-t-md bg-blue-700" />
                    <div className="w-full h-[70%] rounded-t-md bg-blue-500" />
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Widget 1: Kanan Atas (Data Aman & Valid) */}
            <div className="absolute -top-4 -right-6 flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-lg shadow-slate-200/60">
              <div className="grid size-7 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="size-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-800">Data Terverifikasi</p>
                <p className="text-[10px] text-slate-400">Audit Lapangan & Geotag</p>
              </div>
            </div>

            {/* Floating Widget 2: Kiri Bawah (Persentase Respon) */}
            <div className="absolute -bottom-5 -left-6 rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-lg shadow-slate-200/60">
              <p className="text-xs font-bold text-slate-900">99.8% Tindak Lanjut</p>
              <p className="text-[10px] font-semibold text-emerald-600">+95% Respon Cepat Dinas</p>
            </div>

            {/* Floating Widget 3: Kanan Bawah (Tracking Status Live) */}
            <div className="absolute -bottom-4 -right-4 flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-lg shadow-slate-200/60">
              <div className="grid size-7 place-items-center rounded-lg bg-blue-50 text-blue-600">
                <Clock className="size-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-800">Status Real-time</p>
                <div className="mt-1 h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full w-4/5 rounded-full bg-blue-600" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Kiri Bawah */}
        <div className="relative z-10 text-xs text-slate-400">
          © 2026 WARTA. Pemerintah Provinsi DKI Jakarta.
        </div>
      </div>

      {/* Kolom Kanan: Form Login */}
      <div className="flex flex-col justify-center items-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="w-full max-w-[380px]">
          {/* Header Sambutan Sesuai Referensi Gambar */}
          <div className="text-left mb-6">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Selamat Datang!
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Masuk ke akun Anda untuk melanjutkan.
            </p>
          </div>

          {/* Alert Error jika Ada */}
          {errorMsg && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
            >
              <AlertCircle className="size-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Kotak Form Login */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-xs">
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label htmlFor="admin-email" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Email
                </label>
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Masukkan email Anda"
                  autoComplete="username"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-600 focus:outline-hidden focus:ring-3 focus:ring-blue-600/10"
                />
              </div>

              <div>
                <label htmlFor="admin-password" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder-slate-400 transition focus:border-blue-600 focus:outline-hidden focus:ring-3 focus:ring-blue-600/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim() || !password}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <ArrowRight className="size-4" />
                    <span>Masuk</span>
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Autofill Helper */}
            <div className="mt-5 pt-4 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={fillDemoAdmin}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition cursor-pointer"
              >
                <Sparkles className="size-3.5 text-blue-500" />
                <span>Gunakan akun demo: <strong>admin@dinas.pupr.go.id</strong></span>
              </button>
            </div>
          </div>

          {/* Legal / Syarat Ketentuan Bawah */}
          <p className="mt-6 text-center text-xs text-slate-400">
            Dengan masuk, Anda menyetujui{' '}
            <a href="#terms" className="text-slate-600 underline hover:text-slate-800">
              Syarat & Ketentuan
            </a>{' '}
            serta{' '}
            <a href="#privacy" className="text-slate-600 underline hover:text-slate-800">
              Kebijakan Privasi
            </a>
            .
          </p>

          {/* Back link to Landing */}
          <div className="mt-4 text-center">
            <a
              href="http://localhost:5174"
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 transition"
            >
              <span>← Kembali ke Portal Warga</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
