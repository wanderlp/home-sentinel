import React, { useState } from 'react';
import type { AppBootstrapState, DetectedDevice } from '../../../shared/types';

declare global {
  interface Window {
    homeSentinel: {
      getBootstrapState: () => AppBootstrapState;
      scanDevices: () => Promise<DetectedDevice[]>;
    };
  }
}

export function App() {
  const bootstrapState = window.homeSentinel?.getBootstrapState();
  const [devices, setDevices] = useState<DetectedDevice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleScan(): Promise<void> {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const results = await window.homeSentinel.scanDevices();
      setDevices(results);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo ejecutar el escaneo de red.';

      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="dashboard-card">
        <p className="eyebrow">Home Sentinel</p>
        <h1>Monitor de red local</h1>
        <p className="description">
          Ejecuta un escaneo de la red local para identificar dispositivos activos
          y marcar si ya eran conocidos o si aparecieron por primera vez.
        </p>

        <div className="status-grid">
          <article>
            <span>Estado</span>
            <strong>{isLoading ? 'Escaneando...' : bootstrapState?.status ?? 'idle'}</strong>
          </article>
          <article>
            <span>Resultados</span>
            <strong>{devices.length}</strong>
          </article>
        </div>

        <div className="actions">
          <button
            className="scan-button"
            type="button"
            onClick={() => void handleScan()}
            disabled={isLoading}
          >
            {isLoading ? 'Escaneando...' : 'Escanear red'}
          </button>
          {errorMessage ? <p className="error-message">{errorMessage}</p> : null}
        </div>

        <section className="results-section" aria-live="polite">
          <header className="results-header">
            <h2>Dispositivos detectados</h2>
            <span>{devices.length === 0 ? 'Sin resultados aun' : `${devices.length} encontrados`}</span>
          </header>

          {devices.length === 0 ? (
            <div className="empty-state">
              <p>No hay resultados todavia. Ejecuta el escaneo para ver dispositivos en la red.</p>
            </div>
          ) : (
            <div className="device-list">
              {devices.map((device) => (
                <article
                  key={device.mac ?? device.ip}
                  className={`device-card ${device.nuevo ? 'is-new' : 'is-known'}`}
                >
                  <div className="device-main">
                    <div>
                      <span className="device-label">IP</span>
                      <strong>{device.ip}</strong>
                    </div>
                    <div>
                      <span className="device-label">Nombre</span>
                      <strong>{device.hostname ?? 'No disponible'}</strong>
                    </div>
                    <div>
                      <span className="device-label">Fabricante</span>
                      <strong>{device.vendor ?? 'No identificado'}</strong>
                    </div>
                    <div>
                      <span className="device-label">MAC</span>
                      <strong>{device.mac ?? 'No disponible'}</strong>
                    </div>
                    <div>
                      <span className="device-label">Puertos</span>
                      <strong>
                        {device.openPorts && device.openPorts.length > 0
                          ? device.openPorts.join(', ')
                          : 'Sin puertos detectados'}
                      </strong>
                    </div>
                  </div>

                  <div className="device-badges">
                    <span className={`badge ${device.activo ? 'badge-online' : 'badge-offline'}`}>
                      {device.activo ? 'Activo' : 'Inactivo'}
                    </span>
                    <span className={`badge ${device.nuevo ? 'badge-new' : 'badge-known'}`}>
                      {device.nuevo ? 'Nuevo' : 'Conocido'}
                    </span>
                    <span className="badge badge-type">
                      {device.deviceType ?? 'desconocido'}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
