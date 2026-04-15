export const IPC_CHANNELS = {
  SCAN_DEVICES: 'scan-devices',
  GET_LOCAL_NETWORK_INFO: 'get-local-network-info',
  APP_STATUS_CHANGED: 'app-status-changed',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_TOGGLE_MAXIMIZE: 'window:toggle-maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_GET_STATE: 'window:get-state',
  WINDOW_STATE_CHANGED: 'window-state-changed'
} as const;
