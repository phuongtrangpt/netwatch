import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
mkdirSync('.test-dist',{recursive:true});
const names=['core','discovery','topology','wire-routing','routeros'];
for(const name of names)await build({entryPoints:[`tests/${name}.test.ts`],outfile:`.test-dist/${name}.test.mjs`,bundle:true,platform:'node',format:'esm',target:'node20',packages:'external'});
const r=spawnSync(process.execPath,['--test',...names.map(n=>`.test-dist/${n}.test.mjs`),'tests/local.test.mjs'],{stdio:'inherit'});
process.exit(r.status??1);
