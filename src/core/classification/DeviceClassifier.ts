import type { Device, DeviceType } from '../../shared/types';
import { resolveVendorFromMac } from './vendor-registry';

const HOSTNAME_RULES: Array<{ pattern: RegExp; deviceType: DeviceType }> = [
  { pattern: /(iphone|ipad|galaxy|android|pixel|redmi|moto|phone)/i, deviceType: 'celular' },
  { pattern: /(printer|laserjet|deskjet|epson|brother|xerox|canon)/i, deviceType: 'impresora' },
  { pattern: /(router|gateway|mikrotik|ubiquiti|unifi|tp-link|tplink|cisco)/i, deviceType: 'router' },
  { pattern: /(desktop|laptop|notebook|thinkpad|macbook|pc|surface)/i, deviceType: 'pc' },
  { pattern: /(cam|camera|tv|roku|chromecast|nest|echo|alexa|esp|iot|sensor)/i, deviceType: 'iot' }
];

const ROUTER_VENDORS = ['Cisco', 'TP-Link', 'Ubiquiti', 'D-Link'];
const PHONE_VENDORS = ['Apple', 'Samsung', 'Xiaomi', 'Google'];
const PRINTER_VENDORS = ['Hewlett Packard', 'Brother', 'Canon', 'Epson', 'Xerox'];
const IOT_VENDORS = ['Roku', 'Google Nest', 'Espressif', 'Raspberry Pi'];

export class DeviceClassifier {
  classify(device: Device): Device {
    const vendor = device.vendor ?? resolveVendorFromMac(device.mac);
    const deviceType = this.resolveDeviceType(device, vendor);

    return {
      ...device,
      vendor,
      deviceType
    };
  }

  private resolveDeviceType(device: Device, vendor?: string): DeviceType {
    const hostname = device.hostname ?? '';

    for (const rule of HOSTNAME_RULES) {
      if (rule.pattern.test(hostname)) {
        return rule.deviceType;
      }
    }

    if (vendor && ROUTER_VENDORS.includes(vendor)) {
      return 'router';
    }

    if (vendor && PRINTER_VENDORS.includes(vendor)) {
      return 'impresora';
    }

    if (vendor && IOT_VENDORS.includes(vendor)) {
      return 'iot';
    }

    if (vendor && PHONE_VENDORS.includes(vendor)) {
      return hostname ? 'celular' : 'desconocido';
    }

    if (hostname.startsWith('DESKTOP-') || hostname.startsWith('LAPTOP-')) {
      return 'pc';
    }

    return 'desconocido';
  }
}
