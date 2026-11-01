import { useState, type FormEvent } from 'react';
import { EyeOff, UserRound, X } from 'lucide-react';
import { useWarta } from '../../context/WartaContext';

export default function CitizenLoginModal() {
  const { loginOpen, setLoginOpen, login } = useWarta();
  const [name, setName] = useState('Warga_KebonJeruk');
  const [email, setEmail] = useState('');
  const valid = /^[A-Za-z0-9_]{3,24}$/.test(name);

  if (!loginOpen) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid) login(name);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal>
      <form onSubmit={submit} className="w-full max-w-md animate-pop rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-brand">Masuk sebagai Warga</h2>
            <p className="text-sm text-slate-500">Cukup gunakan Nama Tampilan Publik.</p>
          </div>
          <button type="button" id="login-close" onClick={() => setLoginOpen(false)} className="rounded-full p-1 hover:bg-slate-100" aria-label="Tutup">
            <X className="size-5" />
          </button>
        </div>

        <label className="mb-1 block text-sm font-semibold" htmlFor="login-name">Nama Tampilan Publik</label>
        <div className="mb-1 flex items-center gap-2 rounded-lg border border-slate-300 px-3 focus-within:ring-2 focus-within:ring-action-border">
          <UserRound className="size-4 text-slate-400" />
          <input id="login-name" value={name} onChange={(e) => setName(e.target.value)} className="w-full py-2 outline-none" />
        </div>
        <p className={`mb-4 text-xs ${valid ? 'text-slate-500' : 'text-bad-text'}`}>3–24 karakter: huruf, angka, atau garis bawah.</p>

        <label className="mb-1 block text-sm font-semibold" htmlFor="login-email">Email (privat)</label>
        <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-action-border" />
        <p className="mb-5 flex items-start gap-1.5 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
          <EyeOff className="mt-0.5 size-3.5 shrink-0" />
          Nama tampilan bersifat publik. Alamat email Anda disembunyikan dan tidak pernah ditampilkan ke publik.
        </p>

        <button id="login-submit" disabled={!valid} className="w-full rounded-lg bg-brand py-2.5 font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50">
          Masuk
        </button>
      </form>
    </div>
  );
}
