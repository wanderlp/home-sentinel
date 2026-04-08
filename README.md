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

[Ver el detalle completo de funcionalidades →](./FEATURES.md)

## Desarrollo

Scripts principales:

- `npm run dev`
  Levanta Vite y Electron en desarrollo.
- `npm run build`
  Compila `main`, `preload` y `renderer`.
- `npm run typecheck`
  Valida tipos con TypeScript.

## Más sobre este proyecto

Home Sentinel es un proyecto en desarrollo acelerado de software: una aplicación de escritorio para descubrimiento y monitoreo de red local construida en colaboración con Codex, manteniendo siempre el control técnico y funcional dentro del proyecto. La arquitectura, la lógica de red, la persistencia, la integración con Electron y la interfaz han sido trabajadas de forma iterativa, cuidando que cada cambio tenga intención y se integre de manera modular.

El proyecto nace en Guatemala 🇬🇹 y está abierto a colaboraciones de todo el mundo. El idioma principal del proyecto (código, issues, PRs y discusiones) es el español.

> 🚧 **En desarrollo activo** — el proyecto crece con nuevas funcionalidades y mejoras de forma continua. Si tienes ideas o quieres contribuir, eres bienvenido.
