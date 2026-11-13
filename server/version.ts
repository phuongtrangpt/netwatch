import {readFileSync} from 'node:fs';
// Read the installed package, not a hardcoded UI label or the latest GitHub release.
export const APP_VERSION=String(JSON.parse(readFileSync('package.json','utf8')).version);
