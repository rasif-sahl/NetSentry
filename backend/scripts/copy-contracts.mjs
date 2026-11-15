import { copyFileSync, mkdirSync } from 'node:fs';
const destination = new URL('../dist/contracts/', import.meta.url);
mkdirSync(destination, { recursive: true });
copyFileSync(new URL('../../contracts/schemas/device-capabilities.v1.schema.json', import.meta.url), new URL('device-capabilities.v1.schema.json', destination));
console.log('Copied the versioned capability contract into the backend build.');
