import type { NetworkScanResult } from '../../../shared/types/network.types';
import { NullNetworkScanner } from '../stubs/null-network-scanner';

export class NetworkMonitorService {
  private readonly scanner = new NullNetworkScanner();

  initialize(): void {
    // Reserved for future startup hooks, schedulers, and IPC registration.
  }

  async scanNetwork(): Promise<NetworkScanResult> {
    return this.scanner.scan();
  }
}
