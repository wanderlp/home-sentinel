import type { Device, DeviceType } from '../../shared/types';
import { resolveVendorFromMac } from './vendor-registry';

const HOSTNAME_RULES: Array<{ pattern: RegExp; deviceType: DeviceType; score: number; reason: string }> = [
  {
    pattern: /(iphone|ipad|galaxy|android|pixel|redmi|moto|phone)/i,
    deviceType: 'celular',
    score: 0.55,
    reason: 'El nombre del dispositivo coincide con patrones típicos de teléfono.'
  },
  {
    pattern: /(printer|laserjet|deskjet|epson|brother|xerox|canon)/i,
    deviceType: 'impresora',
    score: 0.65,
    reason: 'El nombre del dispositivo coincide con patrones típicos de impresora.'
  },
  {
    pattern: /(router|gateway|mikrotik|ubiquiti|unifi|tp-link|tplink|cisco)/i,
    deviceType: 'router',
    score: 0.6,
    reason: 'El nombre del dispositivo coincide con patrones típicos de router o gateway.'
  },
  {
    pattern: /(desktop|laptop|notebook|thinkpad|macbook|pc|surface)/i,
    deviceType: 'pc',
    score: 0.55,
    reason: 'El nombre del dispositivo coincide con patrones típicos de equipo personal.'
  },
  {
    pattern: /(cam|camera|tv|roku|chromecast|nest|echo|alexa|esp|iot|sensor)/i,
    deviceType: 'iot',
    score: 0.55,
    reason: 'El nombre del dispositivo coincide con patrones típicos de IoT o multimedia.'
  }
];

const ROUTER_VENDORS = ['Cisco', 'TP-Link', 'Ubiquiti', 'D-Link'];
const PHONE_VENDORS = ['Apple', 'Samsung', 'Xiaomi', 'Google'];
const PRINTER_VENDORS = ['Hewlett Packard', 'Brother', 'Canon', 'Epson', 'Xerox'];
const IOT_VENDORS = ['Roku', 'Google Nest', 'Espressif', 'Raspberry Pi', 'QNAP', 'LG'];
const PORT_HINTS: Array<{ ports: number[]; deviceType: DeviceType; score: number; reason: string }> = [
  {
    ports: [9100, 631, 515],
    deviceType: 'impresora',
    score: 0.7,
    reason: 'Tiene puertos típicos de impresión abiertos.'
  },
  {
    ports: [53, 80, 443],
    deviceType: 'router',
    score: 0.65,
    reason: 'Combina puertos comunes de resolución DNS y administración web.'
  },
  {
    ports: [62078],
    deviceType: 'celular',
    score: 0.75,
    reason: 'Expone un puerto típico de dispositivos Apple móviles.'
  },
  {
    ports: [445, 139, 3389],
    deviceType: 'pc',
    score: 0.65,
    reason: 'Expone puertos comunes de equipos Windows.'
  },
  {
    ports: [22, 80, 443],
    deviceType: 'iot',
    score: 0.4,
    reason: 'Expone puertos comunes de administración en dispositivos embebidos o de red.'
  }
];

interface InferenceCandidate {
  score: number;
  reasons: string[];
}

export class DeviceClassifier {
  classify(device: Device): Device {
    const vendor = device.vendor ?? resolveVendorFromMac(device.mac);
    const inference = this.inferDeviceType(device, vendor);

    return {
      ...device,
      vendor,
      deviceType: inference.deviceType,
      classificationConfidence: inference.confidence,
      classificationReasons: inference.reasons
    };
  }

  private inferDeviceType(
    device: Device,
    vendor?: string
  ): { deviceType: DeviceType; confidence: number; reasons: string[] } {
    const hostname = device.hostname ?? '';
    const openPorts = new Set(device.openPorts ?? []);
    const candidates = this.createCandidateMap();

    for (const rule of HOSTNAME_RULES) {
      if (rule.pattern.test(hostname)) {
        this.addEvidence(candidates, rule.deviceType, rule.score, rule.reason);
      }
    }

    if (vendor && ROUTER_VENDORS.includes(vendor)) {
      this.addEvidence(candidates, 'router', 0.35, `El fabricante ${vendor} suele estar asociado a dispositivos de red.`);
    }

    if (vendor && PRINTER_VENDORS.includes(vendor)) {
      this.addEvidence(candidates, 'impresora', 0.4, `El fabricante ${vendor} suele estar asociado a impresoras.`);
    }

    if (vendor && IOT_VENDORS.includes(vendor)) {
      this.addEvidence(candidates, 'iot', 0.35, `El fabricante ${vendor} suele estar asociado a dispositivos IoT o multimedia.`);
    }

    if (vendor && PHONE_VENDORS.includes(vendor)) {
      this.addEvidence(candidates, 'celular', hostname ? 0.35 : 0.2, `El fabricante ${vendor} es frecuente en dispositivos móviles.`);
    }

    if (hostname.startsWith('DESKTOP-') || hostname.startsWith('LAPTOP-')) {
      this.addEvidence(candidates, 'pc', 0.5, 'El hostname sigue el patrón típico de equipos Windows.');
    }

    for (const hint of PORT_HINTS) {
      const matches = hint.ports.filter((port) => openPorts.has(port));

      if (matches.length === 0) {
        continue;
      }

      const adjustedScore = hint.deviceType === 'router' && !openPorts.has(53)
        ? hint.score - 0.2
        : hint.score;

      this.addEvidence(
        candidates,
        hint.deviceType,
        adjustedScore,
        `${hint.reason} Puertos detectados: ${matches.join(', ')}.`
      );
    }

    const bestMatch = this.resolveBestCandidate(candidates);

    if (!bestMatch) {
      return {
        deviceType: 'desconocido',
        confidence: 0.2,
        reasons: ['No hay evidencia suficiente para identificar el tipo de dispositivo.']
      };
    }

    return bestMatch;
  }

  private createCandidateMap(): Record<DeviceType, InferenceCandidate> {
    return {
      router: { score: 0, reasons: [] },
      pc: { score: 0, reasons: [] },
      celular: { score: 0, reasons: [] },
      impresora: { score: 0, reasons: [] },
      iot: { score: 0, reasons: [] },
      desconocido: { score: 0, reasons: [] }
    };
  }

  private addEvidence(
    candidates: Record<DeviceType, InferenceCandidate>,
    deviceType: DeviceType,
    score: number,
    reason: string
  ): void {
    candidates[deviceType].score += score;
    candidates[deviceType].reasons.push(reason);
  }

  private resolveBestCandidate(
    candidates: Record<DeviceType, InferenceCandidate>
  ): { deviceType: DeviceType; confidence: number; reasons: string[] } | null {
    const rankedCandidates = (Object.entries(candidates) as Array<[DeviceType, InferenceCandidate]>)
      .filter(([, candidate]) => candidate.score > 0)
      .sort((left, right) => right[1].score - left[1].score);

    if (rankedCandidates.length === 0) {
      return null;
    }

    const [deviceType, candidate] = rankedCandidates[0];

    return {
      deviceType,
      confidence: Math.min(0.98, Number(candidate.score.toFixed(2))),
      reasons: candidate.reasons
    };
  }
}
