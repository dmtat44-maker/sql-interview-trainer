const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'www', 'index.html');
const manifestPath = path.join(__dirname, '..', 'www', 'manifest.json');

if (!fs.existsSync(indexPath)) {
  console.error('ERROR: www/index.html не найден. Capacitor требует index.html внутри webDir.');
  process.exit(1);
}

if (!fs.existsSync(manifestPath)) {
  console.warn('WARN: www/manifest.json не найден. Для Capacitor это не критично, но полезно для PWA.');
}

console.log('OK: www/index.html найден. Проект готов к npx cap sync / npx cap add android.');
