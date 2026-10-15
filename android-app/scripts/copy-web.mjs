// Copies the web app in ../macros into www/ for Capacitor.
import { cpSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../../macros', import.meta.url));
const dest = fileURLToPath(new URL('../www', import.meta.url));
rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true, filter: p => !p.endsWith('README.md') });
console.log('Copied web app to www/');
