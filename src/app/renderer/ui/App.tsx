import React, { useEffect, useState } from 'react';
import type { AppBootstrapState, DetectedDevice, WindowState } from '../../../shared/types';

type StatusFilter = 'todos' | 'nuevos' | 'modificados' | 'conocidos';

declare global {
  interface Window {
    homeSentinel: {
      getBootstrapState: () => AppBootstrapState;
      scanDevices: () => Promise<DetectedDevice[]>;
      windowControls: {
        minimize: () => Promise<void>;
        toggleMaximize: () => Promise<void>;
        close: () => Promise<void>;
        getState: () => Promise<WindowState>;
        onStateChange: (callback: (state: WindowState) => void) => () => void;
      };
    };
  }
}

export function App() {
  const bootstrapState = window.homeSentinel?.getBootstrapState();
  const [devices, setDevices] = useState<DetectedDevice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [typeFilter, setTypeFilter] = useState<string>('todos');
  const [selectedDeviceKey, setSelectedDeviceKey] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const controls = window.homeSentinel?.windowControls;

    if (!controls) {
      return;
    }

    let isMounted = true;

    void controls.getState().then((state) => {
      if (isMounted) {
        setIsMaximized(state.isMaximized);
      }
    });

    const unsubscribe = controls.onStateChange((state) => {
      setIsMaximized(state.isMaximized);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const filteredDevices = devices.filter((device) => {
    const matchesStatus =
      statusFilter === 'todos' ||
      (statusFilter === 'nuevos' && device.nuevo) ||
      (statusFilter === 'modificados' && device.modificado) ||
      (statusFilter === 'conocidos' && device.conocido && !device.nuevo);

    const matchesType = typeFilter === 'todos' || device.deviceType === typeFilter;

    return matchesStatus && matchesType;
  });

  const selectedDevice =
    filteredDevices.find((device) => (device.mac ?? device.ip) === selectedDeviceKey) ??
    filteredDevices[0];

  const summary = {
    total: devices.length,
    nuevos: devices.filter((device) => device.nuevo).length,
    modificados: devices.filter((device) => device.modificado).length,
    conocidos: devices.filter((device) => device.conocido && !device.nuevo).length
  };

  async function handleScan(): Promise<void> {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const results = await window.homeSentinel.scanDevices();
      setDevices(results);
      setSelectedDeviceKey(results[0] ? results[0].mac ?? results[0].ip : null);
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
      <section className={`window-frame ${isMaximized ? 'is-maximized' : ''}`}>
        <header className="window-titlebar">
          <div className="window-title">
            <span className="window-title-dot" />
            <div>
              <strong>Home Sentinel</strong>
              <span>Monitor de red local</span>
            </div>
          </div>

          <div className="window-controls">
            <button
              type="button"
              className="window-control-button"
              aria-label="Minimizar ventana"
              onClick={() => void window.homeSentinel.windowControls.minimize()}
            >
              <span className="window-control-minimize" />
            </button>
            <button
              type="button"
              className="window-control-button"
              aria-label={isMaximized ? 'Restaurar ventana' : 'Maximizar ventana'}
              onClick={() => void window.homeSentinel.windowControls.toggleMaximize()}
            >
              <span className={isMaximized ? 'window-control-restore' : 'window-control-maximize'} />
            </button>
            <button
              type="button"
              className="window-control-button is-close"
              aria-label="Cerrar ventana"
              onClick={() => void window.homeSentinel.windowControls.close()}
            >
              <span className="window-control-close" />
            </button>
          </div>
        </header>

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
              <strong>{summary.total}</strong>
            </article>
            <article>
              <span>Nuevos</span>
              <strong>{summary.nuevos}</strong>
            </article>
            <article>
              <span>Modificados</span>
              <strong>{summary.modificados}</strong>
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
              <span>{filteredDevices.length === 0 ? 'Sin resultados aún' : `${filteredDevices.length} visibles`}</span>
            </header>

            <div className="filter-bar">
              <label className="filter-field">
                <span>Estado</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
                  <option value="todos">Todos</option>
                  <option value="nuevos">Nuevos</option>
                  <option value="modificados">Modificados</option>
                  <option value="conocidos">Conocidos</option>
                </select>
              </label>

              <label className="filter-field">
                <span>Tipo</span>
                <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                  <option value="todos">Todos</option>
                  <option value="router">Router</option>
                  <option value="pc">PC</option>
                  <option value="celular">Celular</option>
                  <option value="impresora">Impresora</option>
                  <option value="iot">IoT</option>
                  <option value="desconocido">Desconocido</option>
                </select>
              </label>
            </div>

            {filteredDevices.length === 0 ? (
              <div className="empty-state">
                <p>No hay resultados todavía. Ejecuta el escaneo para ver dispositivos en la red.</p>
              </div>
            ) : (
              <div className="results-layout">
                <div className="device-list">
                  {filteredDevices.map((device) => (
                    <article
                      key={device.mac ?? device.ip}
                      className={`device-card ${device.nuevo ? 'is-new' : 'is-known'} ${(device.mac ?? device.ip) === (selectedDevice?.mac ?? selectedDevice?.ip) ? 'is-selected' : ''}`}
                      onClick={() => setSelectedDeviceKey(device.mac ?? device.ip)}
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
                        {device.modificado ? <span className="badge badge-changed">Modificado</span> : null}
                        <span className="badge badge-type">
                          {device.deviceType ?? 'desconocido'}
                        </span>
                      </div>

                      <div className="device-inference">
                        <span className="device-label">Confianza</span>
                        <strong>
                          {typeof device.classificationConfidence === 'number'
                            ? `${Math.round(device.classificationConfidence * 100)}%`
                            : 'No disponible'}
                        </strong>

                        {device.classificationReasons && device.classificationReasons.length > 0 ? (
                          <ul className="reason-list">
                            {device.classificationReasons.map((reason) => (
                              <li key={`${device.mac ?? device.ip}-${reason}`}>{reason}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>

                {selectedDevice ? (
                  <aside className="detail-panel">
                    <p className="eyebrow">Detalle</p>
                    <h3>{selectedDevice.hostname ?? selectedDevice.ip}</h3>
                    <p className="detail-copy">
                      {selectedDevice.nuevo
                        ? 'Este dispositivo apareció por primera vez en el escaneo actual.'
                        : selectedDevice.modificado
                          ? 'Este dispositivo cambió desde el último registro conocido.'
                          : 'Este dispositivo coincide con el último estado conocido.'}
                    </p>

                    <div className="detail-grid">
                      <div>
                        <span className="device-label">Primera vez visto</span>
                        <strong>{formatDate(selectedDevice.firstSeen)}</strong>
                      </div>
                      <div>
                        <span className="device-label">Última vez visto</span>
                        <strong>{formatDate(selectedDevice.previousLastSeen)}</strong>
                      </div>
                      <div>
                        <span className="device-label">Puertos abiertos</span>
                        <strong>
                          {selectedDevice.openPorts && selectedDevice.openPorts.length > 0
                            ? selectedDevice.openPorts.join(', ')
                            : 'Sin puertos detectados'}
                        </strong>
                      </div>
                      <div>
                        <span className="device-label">Confianza</span>
                        <strong>
                          {typeof selectedDevice.classificationConfidence === 'number'
                            ? `${Math.round(selectedDevice.classificationConfidence * 100)}%`
                            : 'No disponible'}
                        </strong>
                      </div>
                    </div>

                    <div className="detail-section">
                      <span className="device-label">Cambios detectados</span>
                      {selectedDevice.changeSummary.length > 0 ? (
                        <ul className="reason-list">
                          {selectedDevice.changeSummary.map((change) => (
                            <li key={`${selectedDevice.mac ?? selectedDevice.ip}-${change}`}>{change}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="detail-copy">No se detectaron cambios respecto al registro anterior.</p>
                      )}
                    </div>
                  </aside>
                ) : null}
              </div>
            )}
          </section>
        </section>
      </section>
    </main>
  );
}

function formatDate(value?: string): string {
  if (!value) {
    return 'No disponible';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'No disponible';
  }

  return date.toLocaleString('es-GT');
}
