import { useEffect, useState, type FormEvent } from 'react';
import { EyeOff, UserRound, X } from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import { CURRENT_USER, SAMPLE_DATA } from '../../data/wartaData';

export default function CitizenLoginModal() {
  const { loginOpen, setLoginOpen, login } = useWarta();
  const [name, setName] = useState(SAMPLE_DATA ? CURRENT_USER : '');
  const [email, setEmail] = useState('');
  const valid = /^[A-Za-z0-9_]{3,24}$/.test(name);

  useEffect(() => {
    if (!loginOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLoginOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [loginOpen, setLoginOpen]);

  if (!loginOpen) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid) login(name);
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
    >
      <form onSubmit={submit} className="w-full max-w-md animate-pop space-y-5 rounded-2xl bg-white p-8 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="login-modal-title" className="text-xl font-extrabold text-brand">
              Masuk sebagai Warga
            </h2>
            <p className="mt-1 text-sm text-slate-600">Cukup gunakan Nama Tampilan Publik.</p>
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

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-800" htmlFor="login-name">
            Nama Tampilan Publik
          </label>
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-300 px-3.5 focus-within:border-action-border focus-within:ring-2 focus-within:ring-action-border/30">
            <UserRound className="size-4 text-slate-500" />
            <input
              id="login-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Warga_KebonJeruk"
              className="w-full py-2.5 text-base text-slate-900 outline-none placeholder:text-slate-500"
            />
          </div>
          <p className={`mt-1.5 text-xs ${valid || name.length === 0 ? 'text-slate-600' : 'text-bad-text'}`}>
            3–24 karakter: huruf, angka, atau garis bawah (_).
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-800" htmlFor="login-email">
            Email (privat, opsional)
          </label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@email.com"
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 outline-none placeholder:text-slate-500 focus:border-action-border focus:ring-2 focus:ring-action-border/30"
          />
          <p className="mt-2 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
            <EyeOff className="mt-0.5 size-4 shrink-0 text-slate-500" />
            Nama tampilan bersifat publik. Alamat email Anda disembunyikan dan tidak pernah ditampilkan ke publik.
          </p>
        </div>

        <button
          id="login-submit"
          disabled={!valid}
          className="w-full rounded-xl bg-brand py-3 text-base font-bold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          Masuk Sekarang
        </button>
      </form>
    </div>
  );
}
