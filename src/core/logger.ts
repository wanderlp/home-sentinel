import log from 'electron-log/main';

log.initialize();

log.transports.file.level = 'info';
log.transports.console.level = 'debug';

log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';

export default log;
