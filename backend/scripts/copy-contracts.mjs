import { copyFileSync, mkdirSync } from 'node:fs';
const destination = new URL('../dist/contracts/', import.meta.url);
mkdirSync(destination, { recursive: true });
for (const file of ['device-capabilities.v1.schema.json','measurement.v1.schema.json','measurement-batch.v1.schema.json']) copyFileSync(new URL(`../../contracts/schemas/${file}`, import.meta.url), new URL(file, destination));
console.log('Copied versioned capability and measurement contracts into the backend build.');
