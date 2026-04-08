# Home Sentinel

Home Sentinel es una aplicación de escritorio construida con Electron, React y TypeScript para descubrir y monitorear dispositivos conectados a la red local.

## Stack

- Electron
- React
- TypeScript
- Node.js
- SQLite con `sqlite3`

## Estructura del proyecto

### `src/app`

Contiene la capa de Electron y el renderer.

- `main`
  Proceso principal de Electron, creación de ventana y handlers IPC.
- `preload`
  API expuesta de forma segura al renderer mediante `contextBridge`.
- `renderer`
  Interfaz en React para ejecutar el escaneo y mostrar los resultados.

### `src/core`

Contiene la lógica principal del dominio.

- `scanner`
  Descubrimiento de dispositivos en la red local.
- `database`
  Persistencia de dispositivos en SQLite.
- `services`
  Orquestación del escaneo, comparación y guardado.
- `classification`
  Resolución de fabricante y clasificación heurística del tipo de dispositivo.

### `src/shared`

Contiene tipos compartidos entre capas.

## Funcionalidades implementadas

- Escaneo de red local por subred.
- Detección de dispositivos activos mediante `ping`.
- Resolución de dirección MAC con `arp -a`.
- Resolución de nombre de host por DNS reverso y `ping -a`.
- Identificación básica de fabricante por prefijo OUI.
- Clasificación heurística de tipo de dispositivo.
- Persistencia local en SQLite.
- Detección de dispositivos nuevos y conocidos por MAC.
- Integración entre Electron, IPC y lógica de negocio.
- Interfaz inicial para ejecutar escaneos y mostrar resultados.

[Ver más](./FEATURES.md)

## Interfaz actual

La interfaz del renderer ya permite:

- ejecutar el escaneo con el botón `Escanear red`;
- mostrar estado de carga;
- manejar errores básicos;
- listar los dispositivos detectados.

Para cada dispositivo se muestra:

- IP;
- nombre del dispositivo;
- MAC;
- fabricante;
- estado activo o inactivo;
- si es nuevo o conocido;
- tipo de dispositivo estimado.

## Integración con Electron

Existe un canal IPC:

- `scan-devices`

Flujo:

- el renderer invoca el canal;
- el proceso principal ejecuta `DeviceService.scanAndDetect()`;
- el resultado se devuelve al renderer.

## Desarrollo

Scripts principales:

- `npm run dev`
  Levanta Vite y Electron en desarrollo.
- `npm run build`
  Compila `main`, `preload` y `renderer`.
- `npm run typecheck`
  Valida tipos con TypeScript.
