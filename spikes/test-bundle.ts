import path from 'path';
import { fileURLToPath } from 'url';
import { bundle } from '@remotion/bundler';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('Testing Remotion bundle...');
  const entryPoint = path.resolve(__dirname, 'remotion-entry.tsx');
  const bundleLocation = await bundle({
    entryPoint,
    onProgress: (progress) => {
      console.log(`Bundle progress: ${progress}%`);
    },
  });
  console.log('Bundle succeeded at:', bundleLocation);
}

main().catch((err) => {
  console.error('Bundle failed:', err);
  process.exit(1);
});
