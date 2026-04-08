const VENDOR_BY_OUI: Record<string, string> = {
  '00:1a:11': 'Google',
  '00:1f:3b': 'Apple',
  '00:25:00': 'Apple',
  '00:50:56': 'VMware',
  '00:e0:4c': 'Realtek',
  '04:92:26': 'Liteon',
  '08:00:27': 'Oracle VirtualBox',
  '08:3a:88': 'Samsung',
  '0c:8b:fd': 'Apple',
  '10:62:e5': 'Xiaomi',
  '14:cc:20': 'TP-Link',
  '18:e8:29': 'Ubiquiti',
  '1c:bd:b9': 'D-Link',
  '20:df:b9': 'Hewlett Packard',
  '28:6c:07': 'Xiaomi',
  '2c:54:91': 'LG',
  '3c:84:6a': 'Hewlett Packard',
  '40:16:7e': 'Apple',
  '44:65:0d': 'Roku',
  '48:8f:5a': 'Samsung',
  '50:c7:bf': 'TP-Link',
  '58:ef:68': 'Samsung',
  '5c:cf:7f': 'Espressif',
  '60:45:bd': 'Google Nest',
  '68:3e:34': 'Espressif',
  '70:3a:cb': 'Apple',
  '74:ac:b9': 'Ubiquiti',
  '7c:2f:80': 'Apple',
  '84:16:f9': 'QNAP',
  '98:da:c4': 'Apple',
  '9c:b6:d0': 'Raspberry Pi',
  'a4:77:33': 'Google',
  'a4:cf:12': 'Samsung',
  'ac:bc:32': 'Apple',
  'b0:4e:26': 'Cisco',
  'b8:27:eb': 'Raspberry Pi',
  'c0:56:27': 'TP-Link',
  'c8:d7:19': 'Hewlett Packard',
  'd0:37:45': 'Apple',
  'd8:3a:dd': 'Google',
  'dc:a6:32': 'Raspberry Pi',
  'e4:f0:42': 'Samsung',
  'f4:f5:d8': 'Google',
  'fc:fb:fb': 'Facebook Portal'
};

export function resolveVendorFromMac(macAddress?: string): string | undefined {
  if (!macAddress) {
    return undefined;
  }

  const normalizedMac = macAddress.toLowerCase();
  const oui = normalizedMac.split(':').slice(0, 3).join(':');

  return VENDOR_BY_OUI[oui];
}
