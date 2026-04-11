# CLAUDE.md

Este archivo proporciona orientación a Claude Code (claude.ai/code) al trabajar con el código de este repositorio.

## Comunicación

**Toda la comunicación en este proyecto debe realizarse en español**, tanto las respuestas del asistente como los comentarios de código, nombres de variables, etiquetas de la UI y documentación.

## Flujo de trabajo con Git

**No hacer `commit` ni `push` de forma automática.** Siempre presentar los cambios al programador para que pueda revisarlos, probarlos y confirmar que todo funciona correctamente antes de proceder. Solo hacer commit o push cuando el programador lo solicite explícitamente.

Antes de hacer commit, revisar todos los cambios pendientes y evaluar si pertenecen a temas distintos. Si es así, separarlos en varios commits atómicos (uno por tema). Si todos los cambios corresponden a un mismo propósito, subirlos en un solo commit.

## Comandos

```bash
# Desarrollo (renderer con Vite + Electron, se ejecutan en paralelo)
npm run dev

# Build de producción
npm run build

# Verificación de tipos en los tres tsconfig (main, preload, renderer)
npm run typecheck

# Compilar solo los procesos main/preload
npm run build:main

# Limpiar dist/
npm run clean
```

No hay runner de tests ni linter configurado en este proyecto.

## Arquitectura

Home Sentinel es una aplicación de escritorio Electron **exclusiva para Windows** que monitorea la red local. Usa React + TypeScript para la UI y Node.js para toda la lógica de escaneo.

### Modelo de procesos

La app sigue el modelo de seguridad estándar de Electron:

- **Proceso principal** ([src/app/main/index.ts](src/app/main/index.ts)): Crea el BrowserWindow sin marco, registra los handlers IPC (`scan-devices`, `window:*`) y persiste el estado de la ventana en `window-state.json`.
- **Preload script** ([src/app/preload/index.ts](src/app/preload/index.ts)): Expone `window.homeSentinel` al renderer a través de `contextBridge`. Es el único canal seguro entre el renderer y el proceso principal.
- **Renderer** ([src/app/renderer/ui/App.tsx](src/app/renderer/ui/App.tsx)): UI React de un solo componente. Todos los datos de red llegan mediante la llamada IPC `window.homeSentinel.scanDevices()`.

### Pipeline de escaneo (`src/core/`)

`DeviceService.ts` orquesta el flujo completo de escaneo:
1. **`HomeSentinelScanner`** — hace ping a toda la subred (25 concurrentes), resuelve MACs con `arp -a` y hostnames por DNS inverso / `ping -a`.
2. **`PortScanner`** — escanea 11 puertos comunes (22, 53, 80, 139, 443, 445, 515, 631, 9100, 3389, 62078) con timeout de 350ms; 10 dispositivos concurrentes.
3. **`DeviceClassifier`** — puntuación heurística usando regexes de hostname, OUI de vendor y puertos abiertos para asignar un `DeviceType` (router/pc/celular/impresora/iot/desconocido).
4. **`DeviceRepository`** — persiste en SQLite (`data/home-sentinel.db`) con modo WAL. Usa lógica de upsert `INSERT ... ON CONFLICT(mac) DO UPDATE`.
5. Retorna `DetectedDevice[]` con flags `nuevo/conocido/modificado` y un resumen de cambios.

Todos los comandos del scanner usan utilidades de shell de Windows (`ping`, `arp`, `nslookup`). No intentar hacer el escaneo multiplataforma sin reemplazar estas llamadas.

### Configuración de TypeScript

Tres archivos tsconfig separados, cada uno compilado de forma independiente:
- `tsconfig.main.json` → salida CommonJS para el proceso principal de Electron + `src/core/**`
- `tsconfig.preload.json` → preload script
- `tsconfig.renderer.json` → ESNext/DOM para el renderer React

### Tipos compartidos

[src/shared/types/network.types.ts](src/shared/types/network.types.ts) define `Device`, `DetectedDevice`, `StoredDevice` y `DeviceType`. Tanto el proceso principal como el renderer importan desde `src/shared/`.

## Restricciones clave

- La base de datos SQLite vive en `data/home-sentinel.db` en la raíz del proyecto, no en `dist/`.
- El renderer carga desde `http://127.0.0.1:5173` en desarrollo y desde el archivo compilado en producción; el proceso principal usa `app.isPackaged` para decidir.
- La ventana no tiene marco nativo; la barra de título personalizada con su región de arrastre y los controles de ventana están implementados en `App.tsx` y se comunican mediante el IPC `window.homeSentinel.windowControls`.
