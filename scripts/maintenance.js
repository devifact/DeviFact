// deno-lint-ignore-file no-process-global
const fs = require('fs');
const path = require('path');

const mode = process.argv[2];
if (mode !== 'on' && mode !== 'off') {
  console.error('Usage: node scripts/maintenance.js <on|off>');
  process.exit(1);
}

const value = mode === 'on' ? 'true' : 'false';
const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');
const targetPath = fs.existsSync(envLocalPath) ? envLocalPath : envPath;

const existing = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : '';
const lines = existing.split(/\r?\n/);
let found = false;

const updated = lines.map((line) => {
  if (line.startsWith('MAINTENANCE_MODE=')) {
    found = true;
    return `MAINTENANCE_MODE=${value}`;
  }
  return line;
});

if (!found) {
  if (updated.length && updated[updated.length - 1] !== '') {
    updated.push('');
  }
  updated.push(`MAINTENANCE_MODE=${value}`);
}

const output = updated.join('\n').replace(/\n*$/, '\n');
fs.writeFileSync(targetPath, output, 'utf8');

console.log(`MAINTENANCE_MODE=${value} written to ${targetPath}`);
