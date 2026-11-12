// Device identifiers are not credentials. getRandomValues is available on HTTP too.
export function newDeviceId(source:Pick<Crypto,'getRandomValues'>=globalThis.crypto):string{
 const bytes=new Uint8Array(16);source.getRandomValues(bytes);
 return 'device-'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
