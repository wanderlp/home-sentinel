# Funcionalidades de Home Sentinel

## Escaneo de red local

La clase `HomeSentinelScanner`:

- detecta automáticamente la IP local del sistema;
- calcula el rango de red a partir de la IP y la máscara;
- ejecuta `ping` sobre los hosts posibles de la subred;
- devuelve solo los dispositivos activos.

## Enriquecimiento del dispositivo

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

## Persistencia en SQLite

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

## Detección de dispositivos nuevos y conocidos

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
