import React, { useEffect, useState } from 'react';
import type { CSSProperties, SVGProps } from 'react';
import type { DetectedDevice, HomeSentinelAPI } from '../../../shared/types';

type StatusFilter = 'todos' | 'nuevos' | 'modificados' | 'conocidos';

declare global {
  interface Window {
    homeSentinel: HomeSentinelAPI;
  }
}

const dragRegionStyle = {
  WebkitAppRegion: 'drag'
} as CSSProperties;

const noDragRegionStyle = {
  WebkitAppRegion: 'no-drag'
} as CSSProperties;

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
        error instanceof Error ? error.message : 'No se pudo ejecutar el escaneo de red.';

      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_24%),radial-gradient(circle_at_top_right,rgba(34,197,94,0.10),transparent_20%),linear-gradient(180deg,#04070d_0%,#0a1220_100%)] text-slate-100">
      <section className="grid h-screen grid-rows-[auto_1fr] overflow-hidden bg-[linear-gradient(180deg,rgba(9,17,29,0.96)_0%,rgba(8,15,27,0.98)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <header
          className="flex h-11 flex-nowrap items-center justify-between gap-3 overflow-hidden border-b border-sky-200/10 bg-[linear-gradient(180deg,rgba(13,24,40,0.98)_0%,rgba(10,20,34,0.98)_100%)] px-4 pr-3"
          style={dragRegionStyle}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[linear-gradient(135deg,#79b8ff_0%,#42d3c8_100%)] shadow-[0_0_14px_rgba(121,184,255,0.42)]" />
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden whitespace-nowrap leading-none">
              <strong className="shrink-0 text-[0.94rem] font-semibold text-slate-50">Home Sentinel</strong>
              <span className="shrink-0 text-[0.72rem] text-slate-600">-</span>
              <span className="min-w-0 truncate text-[0.79rem] text-slate-400">Monitorea tu red local</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5" style={noDragRegionStyle}>
            <WindowControlButton
              label="Minimizar ventana"
              onClick={() => void window.homeSentinel.windowControls.minimize()}
            >
              <MinimizeIcon />
            </WindowControlButton>
            <WindowControlButton
              label={isMaximized ? 'Restaurar ventana' : 'Maximizar ventana'}
              onClick={() => void window.homeSentinel.windowControls.toggleMaximize()}
            >
              {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
            </WindowControlButton>
            <WindowControlButton
              label="Cerrar ventana"
              onClick={() => void window.homeSentinel.windowControls.close()}
              isClose
            >
              <CloseIcon />
            </WindowControlButton>
          </div>
        </header>

        <section className="overflow-auto bg-[radial-gradient(circle_at_top_left,rgba(41,95,158,0.18),transparent_24%),linear-gradient(180deg,rgba(8,16,28,0.98)_0%,rgba(7,14,24,0.98)_100%)] px-8 py-8 max-[860px]:px-5 max-[860px]:py-6">
          <p className="mb-3 text-[0.8rem] uppercase tracking-[0.2em] text-sky-300">Home Sentinel</p>
          <h1 className="text-[clamp(2.1rem,4vw,3.2rem)] font-semibold text-slate-50">Monitor de red local</h1>
          <p className="mt-4 max-w-[60ch] text-[1rem] leading-7 text-slate-300">
            Ejecuta un escaneo de la red local para identificar dispositivos activos
            y marcar si ya eran conocidos o si aparecieron por primera vez.
          </p>

          <div className="mt-7 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
            <StatusCard label="Estado" value={isLoading ? 'Escaneando...' : bootstrapState?.status ?? 'idle'} />
            <StatusCard label="Resultados" value={String(summary.total)} />
            <StatusCard label="Nuevos" value={String(summary.nuevos)} />
            <StatusCard label="Modificados" value={String(summary.modificados)} />
          </div>

          <div className="mt-7 grid gap-3">
            <button
              className="min-w-[190px] rounded-full bg-[linear-gradient(135deg,#7dbdff_0%,#4ed6c2_100%)] px-5 py-3.5 text-[0.98rem] font-extrabold text-slate-950 shadow-[0_12px_30px_rgba(78,214,194,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(78,214,194,0.26)] disabled:cursor-wait disabled:opacity-65 disabled:shadow-none max-[640px]:w-full"
              type="button"
              onClick={() => void handleScan()}
              disabled={isLoading}
              style={noDragRegionStyle}
            >
              {isLoading ? 'Escaneando...' : 'Escanear red'}
            </button>
            {errorMessage ? <p className="m-0 text-rose-300">{errorMessage}</p> : null}
          </div>

          <section className="mt-8" aria-live="polite">
            <header className="mb-4 flex items-center justify-between gap-4 max-[640px]:flex-col max-[640px]:items-start">
              <h2 className="m-0 text-xl font-semibold text-slate-100">Dispositivos detectados</h2>
              <span className="text-sm text-slate-400">
                {filteredDevices.length === 0 ? 'Sin resultados aún' : `${filteredDevices.length} visibles`}
              </span>
            </header>

            <div className="mb-[18px] flex flex-wrap gap-3">
              <FilterField label="Estado">
                <select
                  className="rounded-xl border border-sky-200/15 bg-slate-950/75 px-3 py-2.5 text-slate-100 outline-none"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                  style={noDragRegionStyle}
                >
                  <option value="todos">Todos</option>
                  <option value="nuevos">Nuevos</option>
                  <option value="modificados">Modificados</option>
                  <option value="conocidos">Conocidos</option>
                </select>
              </FilterField>

              <FilterField label="Tipo">
                <select
                  className="rounded-xl border border-sky-200/15 bg-slate-950/75 px-3 py-2.5 text-slate-100 outline-none"
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                  style={noDragRegionStyle}
                >
                  <option value="todos">Todos</option>
                  <option value="router">Router</option>
                  <option value="pc">PC</option>
                  <option value="celular">Celular</option>
                  <option value="impresora">Impresora</option>
                  <option value="iot">IoT</option>
                  <option value="desconocido">Desconocido</option>
                </select>
              </FilterField>
            </div>

            {filteredDevices.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-sky-200/20 bg-sky-300/[0.04] p-6 text-slate-300">
                <p className="m-0">No hay resultados todavía. Ejecuta el escaneo para ver dispositivos en la red.</p>
              </div>
            ) : (
              <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.95fr)]">
                <div className="grid gap-3.5">
                  {filteredDevices.map((device) => {
                    const isSelected =
                      (device.mac ?? device.ip) === (selectedDevice?.mac ?? selectedDevice?.ip);

                    return (
                      <article
                        key={device.mac ?? device.ip}
                        className={[
                          'grid cursor-pointer gap-4 rounded-[20px] border bg-[linear-gradient(180deg,rgba(10,20,36,0.9)_0%,rgba(8,17,31,0.9)_100%)] p-5 transition hover:-translate-y-0.5',
                          device.nuevo ? 'border-emerald-300/30' : 'border-sky-200/15',
                          isSelected ? 'border-sky-300/45 shadow-[0_0_0_1px_rgba(139,180,255,0.12)]' : ''
                        ].join(' ')}
                        onClick={() => setSelectedDeviceKey(device.mac ?? device.ip)}
                        style={noDragRegionStyle}
                      >
                        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                          <DeviceField label="IP" value={device.ip} />
                          <DeviceField label="Nombre" value={device.hostname ?? 'No disponible'} />
                          <DeviceField label="Fabricante" value={device.vendor ?? 'No identificado'} />
                          <DeviceField label="MAC" value={device.mac ?? 'No disponible'} />
                          <DeviceField
                            label="Puertos"
                            value={
                              device.openPorts && device.openPorts.length > 0
                                ? device.openPorts.join(', ')
                                : 'Sin puertos detectados'
                            }
                          />
                        </div>

                        <div className="flex flex-wrap gap-2.5">
                          <Badge tone={device.activo ? 'online' : 'offline'}>
                            {device.activo ? 'Activo' : 'Inactivo'}
                          </Badge>
                          <Badge tone={device.nuevo ? 'new' : 'known'}>
                            {device.nuevo ? 'Nuevo' : 'Conocido'}
                          </Badge>
                          {device.modificado ? <Badge tone="changed">Modificado</Badge> : null}
                          <Badge tone="type">{device.deviceType ?? 'desconocido'}</Badge>
                        </div>

                        <div className="grid gap-2 pt-1">
                          <span className="text-[0.82rem] uppercase tracking-[0.08em] text-slate-400">Confianza</span>
                          <strong className="text-base font-semibold text-slate-100">
                            {typeof device.classificationConfidence === 'number'
                              ? `${Math.round(device.classificationConfidence * 100)}%`
                              : 'No disponible'}
                          </strong>

                          {device.classificationReasons && device.classificationReasons.length > 0 ? (
                            <ul className="m-0 list-disc pl-[18px] text-[0.97rem] leading-6 text-slate-300">
                              {device.classificationReasons.map((reason) => (
                                <li key={`${device.mac ?? device.ip}-${reason}`}>{reason}</li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>

                {selectedDevice ? (
                  <aside className="grid content-start gap-4 rounded-[20px] border border-sky-200/15 bg-[linear-gradient(180deg,rgba(10,20,36,0.92)_0%,rgba(8,17,31,0.92)_100%)] p-[22px]">
                    <p className="m-0 text-[0.8rem] uppercase tracking-[0.2em] text-sky-300">Detalle</p>
                    <h3 className="m-0 text-[1.35rem] font-semibold text-slate-50">{selectedDevice.hostname ?? selectedDevice.ip}</h3>
                    <p className="m-0 leading-7 text-slate-300">
                      {selectedDevice.nuevo
                        ? 'Este dispositivo apareció por primera vez en el escaneo actual.'
                        : selectedDevice.modificado
                          ? 'Este dispositivo cambió desde el último registro conocido.'
                          : 'Este dispositivo coincide con el último estado conocido.'}
                    </p>

                    <div className="grid gap-3.5">
                      <DeviceField label="Primera vez visto" value={formatDate(selectedDevice.firstSeen)} />
                      <DeviceField label="Última vez visto" value={formatDate(selectedDevice.previousLastSeen)} />
                      <DeviceField
                        label="Puertos abiertos"
                        value={
                          selectedDevice.openPorts && selectedDevice.openPorts.length > 0
                            ? selectedDevice.openPorts.join(', ')
                            : 'Sin puertos detectados'
                        }
                      />
                      <DeviceField
                        label="Confianza"
                        value={
                          typeof selectedDevice.classificationConfidence === 'number'
                            ? `${Math.round(selectedDevice.classificationConfidence * 100)}%`
                            : 'No disponible'
                        }
                      />
                    </div>

                    <div className="grid gap-2">
                      <span className="text-[0.82rem] uppercase tracking-[0.08em] text-slate-400">Cambios detectados</span>
                      {selectedDevice.changeSummary.length > 0 ? (
                        <ul className="m-0 list-disc pl-[18px] text-[0.97rem] leading-6 text-slate-300">
                          {selectedDevice.changeSummary.map((change) => (
                            <li key={`${selectedDevice.mac ?? selectedDevice.ip}-${change}`}>{change}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="m-0 leading-7 text-slate-300">No se detectaron cambios respecto al registro anterior.</p>
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

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[18px] border border-sky-200/10 bg-[linear-gradient(180deg,rgba(23,38,60,0.72)_0%,rgba(13,24,40,0.72)_100%)] p-[18px]">
      <span className="mb-1.5 block text-[0.9rem] text-slate-400">{label}</span>
      <strong className="text-2xl font-semibold text-slate-50">{value}</strong>
    </article>
  );
}

function FilterField({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid min-w-[180px] gap-1.5">
      <span className="text-[0.85rem] text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function DeviceField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[0.82rem] uppercase tracking-[0.08em] text-slate-400">{label}</span>
      <strong className="mt-1 block break-words text-base font-semibold text-slate-100">{value}</strong>
    </div>
  );
}

function Badge({
  children,
  tone
}: {
  children: React.ReactNode;
  tone: 'online' | 'offline' | 'new' | 'known' | 'changed' | 'type';
}) {
  const toneClasses: Record<typeof tone, string> = {
    online: 'bg-emerald-300/16 text-emerald-200',
    offline: 'bg-rose-300/12 text-rose-200',
    new: 'bg-amber-300/14 text-amber-200',
    known: 'bg-sky-300/14 text-sky-200',
    changed: 'bg-orange-300/14 text-orange-200',
    type: 'bg-white/8 text-slate-100 capitalize'
  };

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-2 text-[0.86rem] font-bold ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}

function WindowControlButton({
  children,
  isClose = false,
  label,
  onClick
}: {
  children: React.ReactNode;
  isClose?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={[
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/8 bg-white/[0.03] p-0 leading-none text-slate-300 transition hover:border-sky-200/18 hover:bg-white/[0.07] hover:text-slate-50',
        isClose ? 'hover:border-rose-400/28 hover:bg-rose-400/16 hover:text-rose-50' : ''
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function MinimizeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" {...props}>
      <path d="M2 8h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MaximizeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" {...props}>
      <rect x="2" y="2" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function RestoreIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" {...props}>
      <path d="M4 2.5h4.5V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 4h4.5v4.5H3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" {...props}>
      <path d="M3 3l6 6M9 3 3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
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
