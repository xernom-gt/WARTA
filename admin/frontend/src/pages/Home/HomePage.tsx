import Button from '@/components/ui/Button';

export default function HomePage() {
  return (
    <section>
      <h1>Selamat Datang</h1>
      <p>Project frontend React + TypeScript siap digunakan.</p>
      <Button onClick={() => alert('Halo!')}>Mulai</Button>
    </section>
  );
}
