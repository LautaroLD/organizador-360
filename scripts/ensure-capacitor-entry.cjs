const fs = require('fs');
const path = require('path');

const webDir = path.resolve(process.cwd(), 'public');
const entryFile = path.join(webDir, 'index.html');

if (!fs.existsSync(webDir)) {
  fs.mkdirSync(webDir, { recursive: true });
}

if (!fs.existsSync(entryFile)) {
  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Veenzo</title>
  </head>
  <body>
    <p>Cargando Veenzo...</p>
  </body>
</html>
`;

  fs.writeFileSync(entryFile, html, 'utf8');
  console.log('Created public/index.html for Capacitor.');
} else {
  console.log('public/index.html already exists.');
}
