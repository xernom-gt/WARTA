import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <section>
      <h1>404 - Halaman tidak ditemukan</h1>
      <Link to="/">Kembali ke beranda</Link>
    </section>
  );
}
