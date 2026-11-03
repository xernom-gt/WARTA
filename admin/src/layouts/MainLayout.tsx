import { Outlet } from 'react-router-dom';

export default function MainLayout() {
  return (
    <div className="layout">
      <header className="layout__header">Lomba</header>
      <main className="layout__main">
        <Outlet />
      </main>
    </div>
  );
}
