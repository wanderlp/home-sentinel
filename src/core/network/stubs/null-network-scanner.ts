import type { NetworkScannerContract } from '../contracts/network-scanner.contract';
import type { NetworkScanResult } from '../../../shared/types/network.types';

export class NullNetworkScanner implements NetworkScannerContract {
  async scan(): Promise<NetworkScanResult> {
    return {
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      devices: []
    };
  }
}
