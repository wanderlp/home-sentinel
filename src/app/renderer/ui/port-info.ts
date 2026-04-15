export const PORT_LABELS: Record<number, string> = {
  22: 'SSH',
  53: 'DNS',
  80: 'HTTP',
  139: 'NetBIOS',
  443: 'HTTPS',
  445: 'SMB',
  515: 'LPD',
  631: 'IPP',
  3389: 'RDP',
  9100: 'Print',
  62078: 'iPhone'
};

export const PORT_DESCRIPTIONS: Record<number, string> = {
  22: 'Acceso remoto seguro por terminal (SSH). Permite administrar el equipo desde la línea de comandos de forma cifrada.',
  53: 'Servidor DNS local. Resuelve nombres de dominio a direcciones IP. Común en routers y servidores.',
  80: 'Servidor web HTTP sin cifrado. Puede ser IIS, XAMPP, Docker u otra app que levantó un servidor local.',
  139: 'NetBIOS: protocolo antiguo de Windows para compartir archivos en red local. Se activa con el uso compartido de archivos.',
  443: 'Servidor web HTTPS con cifrado. Igual que el 80 pero con certificado SSL/TLS.',
  445: 'SMB: protocolo de Windows para compartir carpetas e impresoras en red. Fue el vector del ataque WannaCry (2017). No exponer a internet.',
  515: 'LPD: protocolo de impresión en red (Line Printer Daemon). Indica que hay una impresora o cola de impresión activa.',
  631: 'IPP: protocolo moderno de impresión en red (CUPS/IPP). Suele aparecer junto a impresoras o gestores de impresión.',
  3389: 'Escritorio Remoto de Windows (RDP). Permite conectarse al escritorio desde otro equipo. Desactivar si no se usa activamente.',
  9100: 'Puerto RAW de impresión directa. Usado por impresoras de red para recibir trabajos sin protocolo intermedio.',
  62078: 'Servicio de sincronización de iPhone/iPad con iTunes o Finder vía USB-over-IP.'
};
