import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
mkdirSync('.test-dist',{recursive:true});
const names=['core','discovery','topology','wire-routing','routeros','device-id','read-only-ui','wan-alerts','wan-reminders'];
for(const name of names)await build({entryPoints:[`tests/${name}.test.ts`],outfile:`.test-dist/${name}.test.mjs`,bundle:true,platform:'node',format:'esm',target:'node20',packages:'external',jsx:'automatic',plugins:[{name:'ignore-styles',setup(b){b.onResolve({filter:/\.css$/},a=>({path:a.path,namespace:'empty-css'}));b.onLoad({filter:/.*/,namespace:'empty-css'},()=>({contents:'',loader:'js'}));}}]});
const r=spawnSync(process.execPath,['--test',...names.map(n=>`.test-dist/${n}.test.mjs`),'tests/local.test.mjs'],{stdio:'inherit'});
process.exit(r.status??1);
