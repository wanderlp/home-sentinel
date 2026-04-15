import React, { useEffect, useRef, useState } from 'react';
import type { CSSProperties, SVGProps } from 'react';
import type { HomeSentinelAPI, LocalNetworkInfo, NetworkAdapterDetail } from '../../../shared/types';
import { useAppStore } from '../store/useAppStore';
import { PORT_DESCRIPTIONS, PORT_LABELS } from './port-info';

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
  const { status, devices, isScanning, errorMessage, isMaximized, setStatus, setDevices, setScanning, setError, setMaximized } = useAppStore();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [typeFilter, setTypeFilter] = useState<string>('todos');
  const [selectedDeviceKey, setSelectedDeviceKey] = useState<string | null>(null);
  const [localInfo, setLocalInfo] = useState<LocalNetworkInfo | null>(null);
  const [adapterDetail, setAdapterDetail] = useState<NetworkAdapterDetail | null>(null);
  const [localOpenPorts, setLocalOpenPorts] = useState<number[] | null>(null);
  const [adapterPopupOpen, setAdapterPopupOpen] = useState(false);
  const [adapterDetailLoading, setAdapterDetailLoading] = useState(false);
  const adapterPopupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const api = window.homeSentinel;

    if (!api) {
      return;
    }

    // Suscribirse a cambios de estado de la app
    const unsubscribeStatus = api.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    // Obtener estado inicial de la ventana y suscribirse a cambios
    let isMounted = true;

    void api.windowControls.getState().then((state) => {
      if (isMounted) {
        setMaximized(state.isMaximized);
      }
    });

    void api.getLocalNetworkInfo().then((info) => {
      if (!isMounted) return;
      setLocalInfo(info);
      void api.getLocalOpenPorts(info.ip).then((ports) => {
        if (isMounted) setLocalOpenPorts(ports);
      });
    });

    const unsubscribeWindow = api.windowControls.onStateChange((state) => {
      setMaximized(state.isMaximized);
    });

    return () => {
      isMounted = false;
      unsubscribeStatus();
      unsubscribeWindow();
    };
  }, [setStatus, setMaximized]);

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

  useEffect(() => {
    if (!adapterPopupOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (adapterPopupRef.current && !adapterPopupRef.current.contains(e.target as Node)) {
        setAdapterPopupOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [adapterPopupOpen]);

  async function handleOpenAdapterDetail(): Promise<void> {
    if (!localInfo) return;
    setAdapterPopupOpen((prev) => !prev);
    if (!adapterDetail && !adapterDetailLoading) {
      setAdapterDetailLoading(true);
      try {
        const detail = await window.homeSentinel.getNetworkAdapterDetail(localInfo.interfaceName);
        setAdapterDetail(detail);
      } finally {
        setAdapterDetailLoading(false);
      }
    }
  }

  async function handleScan(): Promise<void> {
    setScanning(true);
    setError(null);

    try {
      const results = await window.homeSentinel.scanDevices();
      setDevices(results);
      setSelectedDeviceKey(results[0] ? results[0].mac ?? results[0].ip : null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudo ejecutar el escaneo de red.';

      setError(message);
    } finally {
      setScanning(false);
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

        <section className="flex min-h-0 flex-1 flex-col overflow-auto bg-[radial-gradient(circle_at_top_left,rgba(41,95,158,0.18),transparent_24%),linear-gradient(180deg,rgba(8,16,28,0.98)_0%,rgba(7,14,24,0.98)_100%)]">
        <div className="flex-1 overflow-auto px-8 py-8 max-[860px]:px-5 max-[860px]:py-6">
          <div className="flex flex-wrap gap-4">
            {/* Tarjeta grande: info de red local */}
            <article className="flex min-w-[260px] flex-1 flex-col gap-4 rounded-[20px] border border-sky-200/15 bg-[linear-gradient(180deg,rgba(13,24,40,0.85)_0%,rgba(9,18,32,0.85)_100%)] p-5">
              <div className="flex items-center gap-2.5">
                <ConnectionIcon type={localInfo?.connectionType ?? 'unknown'} className="h-4 w-4 shrink-0 text-sky-400" />
                <span className="text-[0.78rem] uppercase tracking-[0.18em] text-sky-300">Este equipo</span>
                {localInfo ? (
                  <span className="ml-auto rounded-full border border-sky-200/15 px-2 py-0.5 text-[0.7rem] text-sky-400">
                    {localInfo.connectionType === 'wifi' ? 'Wi-Fi' : localInfo.connectionType === 'ethernet' ? 'Ethernet' : '—'}
                  </span>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <LocalInfoField label="Hostname" value={localInfo?.hostname ?? '—'} />
                <LocalInfoField label="IP local" value={localInfo?.ip ?? '—'} />
                <LocalInfoField label="IP pública" value={localInfo?.publicIp ?? '—'} />
                <LocalInfoField label="Activo desde" value={localInfo ? formatUptime(localInfo.uptimeSeconds) : '—'} />
                <LocalInfoField label="MAC" value={localInfo?.mac ?? '—'} />

                {/* Adaptador con botón ⓘ */}
                <div className="relative">
                  <span className="text-[0.75rem] uppercase tracking-[0.1em] text-slate-500">Adaptador</span>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <strong className="break-all text-[0.88rem] font-medium text-slate-200">
                      {localInfo?.interfaceName ?? '—'}
                    </strong>
                    {localInfo ? (
                      <button
                        type="button"
                        aria-label="Ver detalles del adaptador"
                        onClick={() => void handleOpenAdapterDetail()}
                        className="shrink-0 text-slate-500 transition hover:text-sky-300"
                        style={noDragRegionStyle}
                      >
                        <InfoCircleIcon className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>

                  {/* Popup */}
                  {adapterPopupOpen ? (
                    <div
                      ref={adapterPopupRef}
                      className="absolute left-0 top-full z-50 mt-2 max-h-64 w-80 overflow-y-auto rounded-[14px] border border-sky-200/20 bg-[linear-gradient(180deg,rgba(13,26,46,0.98)_0%,rgba(8,18,34,0.98)_100%)] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
                      style={noDragRegionStyle}
                    >
                      <p className="mb-3 text-[0.72rem] uppercase tracking-[0.18em] text-sky-300">
                        {adapterDetail?.ssid ? 'Red Wi-Fi' : 'Adaptador de red'}
                      </p>

                      {adapterDetailLoading ? (
                        <p className="text-[0.85rem] text-slate-400">Cargando...</p>
                      ) : adapterDetail ? (
                        <div className="grid gap-2.5">
                          {adapterDetail.ssid ? (
                            <PopupField label="Red (SSID)" value={adapterDetail.ssid} />
                          ) : null}
                          {adapterDetail.signal !== undefined ? (
                            <PopupField label="Señal" value={`${adapterDetail.signal}%`} accent={signalAccent(adapterDetail.signal)} />
                          ) : null}
                          {adapterDetail.radioType ? (
                            <PopupField label="Tipo de radio" value={adapterDetail.radioType} />
                          ) : null}
                          {adapterDetail.channel ? (
                            <PopupField label="Canal" value={adapterDetail.channel} />
                          ) : null}
                          {adapterDetail.authentication ? (
                            <PopupField label="Autenticación" value={adapterDetail.authentication} />
                          ) : null}
                          <PopupField label="Gateway" value={adapterDetail.gateway} />
                          <PopupField label="Máscara de subred" value={localInfo?.subnet ?? '—'} />
                          <PopupField
                            label="DNS"
                            value={adapterDetail.dns.length > 0 ? adapterDetail.dns.join(', ') : 'No disponible'}
                          />
                          <PopupField label="DHCP" value={adapterDetail.dhcp ? 'Habilitado' : 'IP estática'} />
                          <PopupField label="Descripción" value={adapterDetail.description} />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

              </div>
              {/* Puertos abiertos del equipo local */}
              <div>
                <span className="mb-2 block text-[0.75rem] uppercase tracking-[0.1em] text-slate-500">
                  Puertos abiertos
                </span>
                {localOpenPorts === null ? (
                  <span className="text-[0.82rem] text-slate-500">Escaneando...</span>
                ) : localOpenPorts.length === 0 ? (
                  <span className="text-[0.82rem] text-slate-500">Ninguno detectado</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {localOpenPorts.map((port) => (
                      <PortChip key={port} port={port} />
                    ))}
                  </div>
                )}
              </div>
            </article>

            {/* 3 tarjetas de resumen del escaneo */}
            <div className="flex shrink-0 flex-col justify-between gap-3">
              <StatusCard label="Resultados" value={String(summary.total)} />
              <StatusCard label="Nuevos" value={String(summary.nuevos)} />
              <StatusCard label="Modificados" value={String(summary.modificados)} />
            </div>
          </div>

          <div className="mt-7 grid gap-3">
            <button
              className="min-w-[190px] rounded-full bg-[linear-gradient(135deg,#7dbdff_0%,#4ed6c2_100%)] px-5 py-3.5 text-[0.98rem] font-extrabold text-slate-950 shadow-[0_12px_30px_rgba(78,214,194,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(78,214,194,0.26)] disabled:cursor-wait disabled:opacity-65 disabled:shadow-none max-[640px]:w-full"
              type="button"
              onClick={() => void handleScan()}
              disabled={isScanning}
              style={noDragRegionStyle}
            >
              {isScanning ? 'Escaneando...' : 'Escanear red'}
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
        </div>

        {/* Status bar inferior */}
        <footer
          className="flex h-7 shrink-0 items-center justify-between border-t border-sky-200/10 bg-[rgba(8,15,27,0.98)] px-4"
          style={noDragRegionStyle}
        >
          <div className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${isScanning ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            <span className="text-[0.73rem] text-slate-400">
              Estado: <span className="text-slate-200">{isScanning ? 'escaneando...' : status}</span>
            </span>
          </div>
        </footer>
      </section>
    </section>
    </main>
  );
}


function PortChip({ port }: { port: number }) {
  return (
    <span className="group relative inline-flex">
      <span className="inline-flex cursor-default items-center gap-1 rounded-md border border-sky-200/15 bg-sky-300/[0.07] px-2 py-0.5 text-[0.78rem] font-medium text-sky-200 transition group-hover:border-sky-300/30 group-hover:bg-sky-300/[0.13]">
        <span>{port}</span>
        {PORT_LABELS[port] ? (
          <span className="text-sky-400/70">{PORT_LABELS[port]}</span>
        ) : null}
      </span>
      {PORT_DESCRIPTIONS[port] ? (
        <span className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 w-64 rounded-[10px] border border-sky-200/20 bg-[rgba(10,20,38,0.97)] px-3 py-2.5 text-[0.78rem] leading-5 text-slate-300 opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition-opacity duration-150 group-hover:opacity-100">
          <span className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-wider text-sky-400">
            {PORT_LABELS[port] ?? `Puerto ${port}`}
          </span>
          {PORT_DESCRIPTIONS[port]}
        </span>
      ) : null}
    </span>
  );
}

function signalAccent(signal: number): string {
  if (signal >= 70) return 'text-emerald-300';
  if (signal >= 40) return 'text-amber-300';
  return 'text-rose-300';
}

function PopupField({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-[0.76rem] text-slate-500">{label}</span>
      <span className={`break-words text-right text-[0.82rem] font-medium ${accent ?? 'text-slate-200'}`}>{value}</span>
    </div>
  );
}

function InfoCircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 7.5v4" />
      <circle cx="8" cy="5.25" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LocalInfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[0.75rem] uppercase tracking-[0.1em] text-slate-500">{label}</span>
      <strong className="mt-0.5 block break-all text-[0.88rem] font-medium text-slate-200">{value}</strong>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(' ');
}

function ConnectionIcon({ type, className }: { type: 'wifi' | 'ethernet' | 'unknown'; className?: string }) {
  if (type === 'wifi') {
    return (
      <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 5.5C4 2.5 12 2.5 15 5.5" />
        <path d="M3 8c1.4-1.4 9.6-1.4 10 0" />
        <path d="M5.5 10.5c.7-.7 5.3-.7 5 0" />
        <circle cx="8" cy="13" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (type === 'ethernet') {
    return (
      <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="12" height="8" rx="1.5" />
        <path d="M5 4V2M8 4V2M11 4V2" />
        <path d="M5 12v2M8 12v2M11 12v2" />
      </svg>
    );
  }
  return <NetworkIcon className={className} />;
}

function NetworkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2" />
      <path d="M3.2 3.2l1.4 1.4M11.4 11.4l1.4 1.4M11.4 4.6l-1.4 1.4M4.6 11.4l-1.4 1.4" />
    </svg>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="w-[150px] rounded-[18px] border border-sky-200/10 bg-[linear-gradient(180deg,rgba(23,38,60,0.72)_0%,rgba(13,24,40,0.72)_100%)] p-[18px]">
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
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] p-0 leading-none text-slate-400 transition-all duration-150 hover:scale-110 hover:text-slate-50',
        isClose
          ? 'hover:bg-rose-500/70 hover:text-white'
          : 'hover:bg-sky-500/40 hover:text-sky-100'
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function MinimizeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" {...props}>
      <path d="M2 8h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MaximizeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" {...props}>
      <rect x="2" y="2" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function RestoreIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" {...props}>
      <path d="M4 2.5h4.5V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 4h4.5v4.5H3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" {...props}>
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
