import type { AppBootstrapState } from '../../../shared/types/app.types';

declare global {
  interface Window {
    homeSentinel: {
      getBootstrapState: () => AppBootstrapState;
    };
  }
}

export function App() {
  const bootstrapState = window.homeSentinel?.getBootstrapState();

  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Home Sentinel</p>
        <h1>Base lista para monitoreo de red local</h1>
        <p className="description">
          La estructura inicial separa Electron, la logica de negocio y los tipos
          compartidos para crecer sin friccion.
        </p>

        <div className="status-grid">
          <article>
            <span>Estado inicial</span>
            <strong>{bootstrapState?.status ?? 'unknown'}</strong>
          </article>
          <article>
            <span>Dispositivos</span>
            <strong>{bootstrapState?.scannedDevices ?? 0}</strong>
          </article>
        </div>
      </section>
    </main>
  );
}
