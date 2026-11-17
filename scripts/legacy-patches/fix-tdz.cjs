const fs = require('fs');
const path = 'vite.config.js'; // or vite.config.ts
if (!fs.existsSync(path)) { console.log('vite.config not found. Create one or adjust manually.'); process.exit(0); }
let content = fs.readFileSync(path, 'utf8');
if (!content.includes('minify:')) {
  content = content.replace(/export default defineConfig\(\{/, `export default defineConfig({\n  build: {\n    minify: false, // temporary: fixes TDZ error\n  },`);
  fs.writeFileSync(path, content);
  console.log('✅ Vite minification disabled (fixes TDZ crash).');
} else {
  console.log('⏭ minify already set. Check value is false.');
}
