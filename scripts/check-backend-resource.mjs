import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const PLATFORM_SEGMENTS = {
  darwin: 'macos',
  linux: 'linux',
  win32: 'windows',
};

const BINARY_NAME = process.platform === 'win32' ? 'neuroflow-backend.exe' : 'neuroflow-backend';
const platformSegment = PLATFORM_SEGMENTS[process.platform];

if (!platformSegment) {
  console.error(`\n[backend-check] Unsupported platform: ${process.platform}`);
  process.exit(1);
}

const expectedBinaryPath = path.resolve('artifacts', 'backend', platformSegment, BINARY_NAME);

if (!fs.existsSync(expectedBinaryPath)) {
  console.error(`\n[backend-check] Missing backend artifact for ${process.platform}.`);
  console.error(`[backend-check] Expected binary: ${expectedBinaryPath}`);
  console.error('[backend-check] Build/copy the backend artifact before packaging. See README.md ("Building for Production").\n');
  process.exit(1);
}

const stats = fs.statSync(expectedBinaryPath);

if (!stats.isFile()) {
  console.error(`\n[backend-check] Expected a file but found something else at: ${expectedBinaryPath}\n`);
  process.exit(1);
}

console.log(`[backend-check] Found backend artifact: ${expectedBinaryPath}`);
