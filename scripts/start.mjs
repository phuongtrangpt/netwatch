import {existsSync,readFileSync} from 'node:fs';
// Home Assistant writes app options here; this is not used in plain Docker.
if(existsSync('/data/options.json')){
 const options=JSON.parse(readFileSync('/data/options.json','utf8'));
 if(options.password&&!process.env.NETWATCH_PASSWORD)process.env.NETWATCH_PASSWORD=options.password;
 if(options.ingest_url&&!process.env.NETWATCH_INGEST_URL)process.env.NETWATCH_INGEST_URL=options.ingest_url;
}
await import('../dist/server.mjs');
