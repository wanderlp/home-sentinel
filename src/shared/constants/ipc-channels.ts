export const IPC_CHANNELS = {
  SCAN_DEVICES: 'scan-devices',
  GET_LOCAL_NETWORK_INFO: 'get-local-network-info',
  GET_NETWORK_ADAPTER_DETAIL: 'get-network-adapter-detail',
  GET_LOCAL_OPEN_PORTS: 'get-local-open-ports',
  APP_STATUS_CHANGED: 'app-status-changed',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_TOGGLE_MAXIMIZE: 'window:toggle-maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_GET_STATE: 'window:get-state',
  WINDOW_STATE_CHANGED: 'window-state-changed'
} as const;
