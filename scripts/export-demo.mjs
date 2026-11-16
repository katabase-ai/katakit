import { exportDemo } from './demo-links.mjs';

const [name, destination] = process.argv.slice(2);
console.log(`Exported ${name} to ${exportDemo(name, destination)}`);
