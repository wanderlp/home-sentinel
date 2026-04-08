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

### Escaneo de red local

La clase `HomeSentinelScanner`:

- detecta automáticamente la IP local del sistema;
- calcula el rango de red a partir de la IP y la máscara;
- ejecuta `ping` sobre los hosts posibles de la subred;
- devuelve solo los dispositivos activos.

### Enriquecimiento del dispositivo

Durante el escaneo se intentan resolver datos adicionales:

- `mac`
  Se obtiene desde la tabla ARP usando `arp -a`.
- `hostname`
  Se intenta resolver por DNS reverso y, si falla, con `ping -a`.
- `vendor`
  Se infiere a partir del prefijo OUI de la MAC.
- `deviceType`
  Se clasifica mediante reglas heurísticas usando `hostname` y `vendor`.

Tipos actuales:

- `router`
- `pc`
- `celular`
- `impresora`
- `iot`
- `desconocido`

### Persistencia en SQLite

El repositorio `DeviceRepository` guarda dispositivos en la tabla `devices`.

Campos actuales:

- `id`
- `ip`
- `mac`
- `hostname`
- `vendor`
- `deviceType`
- `firstSeen`
- `lastSeen`

Comportamiento:

- si la MAC ya existe, se actualizan los datos y `lastSeen`;
- si la MAC no existe, se inserta un nuevo registro;
- los dispositivos sin MAC no se guardan por ahora.

### Detección de dispositivos nuevos y conocidos

`DeviceService`:

- ejecuta el escaneo;
- consulta los dispositivos conocidos en SQLite;
- compara por MAC;
- marca cada resultado como `conocido` o `nuevo`;
- guarda los resultados después de clasificarlos.

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
