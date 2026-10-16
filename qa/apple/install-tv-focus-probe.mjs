import fs from 'node:fs';
import path from 'node:path';
const app = path.resolve('appletv-app');
const index = path.join(app, 'index.js');
const source = fs.readFileSync(index, 'utf8');
if (!source.includes('import App from "./App";')) throw new Error('Unexpected TV entry point');
fs.copyFileSync('qa/apple/TVFocusProbe.js', path.join(app, 'TVFocusProbe.js'));
fs.writeFileSync(index, source.replace('import App from "./App";', 'import App from "./TVFocusProbe";'));
fs.writeFileSync('qa-output/DIAGNOSTIC-BUILD-NOT-FOR-RELEASE.txt',
  'Contains an isolated TV focus probe. Not a store build or release QA artifact.\n');
