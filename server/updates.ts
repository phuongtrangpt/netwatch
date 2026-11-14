import {APP_VERSION} from './version';
import {existsSync,mkdirSync,readFileSync,writeFileSync,copyFileSync,createWriteStream,openSync,closeSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
const REPO='phuongtrangpt/netwatch',root=resolve('.'),data=resolve(process.env.DATA_DIR||'/data'),updateDir=join(data,'updates');
const statusPath=join(updateDir,'status.json');
let cache:any=null,cacheAt=0,inflight:Promise<any>|null=null,busy=false;
let lastCheckError:Error|null=null,retryAt=0;
export function newerVersion(candidate:string,current:string){const valid=/^\d+\.\d+\.\d+$/;if(!valid.test(candidate)||!valid.test(current))return false;const a=candidate.split('.').map(Number),b=current.split('.').map(Number);for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i];}return false;}
export function parseRelease(value:any){
 const version=String(value?.tag_name||'').replace(/^v/,'');
 if(!/^\d+\.\d+\.\d+$/.test(version)||value.draft||value.prerelease)throw Error('Bản phát hành không hợp lệ.');
 const name=`netwatch-windows-x64-${version}.zip`,asset=value.assets?.find((a:any)=>a.name===name&&a.state==='uploaded');
 const url=`https://github.com/${REPO}/releases/download/v${version}/${name}`;
 const valid=asset&&asset.browser_download_url===url&&/^sha256:[a-f0-9]{64}$/.test(asset.digest||'')&&asset.size>0&&asset.size<350*1024*1024;
 return {version,releaseUrl:`https://github.com/${REPO}/releases/tag/v${version}`,notes:String(value.body||'').slice(0,12000),...(valid?{asset:{url,size:asset.size,sha256:asset.digest.slice(7)}}:{})};
}
function platform(){if(process.env.SUPERVISOR_TOKEN)return 'homeassistant';if(process.platform==='win32'&&process.arch==='x64'&&existsSync(join(root,'node.exe'))&&existsSync(join(root,'update-netwatch.ps1')))return 'windows';return 'docker';}
export async function fetchLatestRelease(fetcher:typeof fetch=fetch){
 // Release assets use GitHub's download service rather than the rate-limited API.
 try{const r=await fetcher(`https://github.com/${REPO}/releases/latest/download/netwatch-update.json`,{signal:AbortSignal.timeout(12000)});if(r.ok){const result=parseRelease(await r.json());if(result.asset)return result;}}catch{}
 const r=await fetcher(`https://api.github.com/repos/${REPO}/releases/latest`,{headers:{Accept:'application/vnd.github+json','User-Agent':'NetWatch-updater'},signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error(r.status===403||r.status===429?'GitHub đang giới hạn kiểm tra phiên bản. Chờ vài phút rồi thử lại, hoặc tải bản Windows từ trang phát hành.':'Không đọc được bản phát hành từ GitHub.');
 return parseRelease(await r.json());
}
async function release(){
 if(cache&&Date.now()-cacheAt<300000)return cache;
 if(inflight)return inflight;
 if(lastCheckError&&Date.now()<retryAt)throw lastCheckError;
 inflight=(async()=>{try{cache=await fetchLatestRelease();cacheAt=Date.now();lastCheckError=null;return cache;}catch(error){lastCheckError=error instanceof Error?error:Error('Không kiểm tra được phiên bản.');retryAt=Date.now()+60000;throw lastCheckError;}})();
 try{return await inflight;}finally{inflight=null;}
}
export function updateStatus(){try{const s=JSON.parse(readFileSync(statusPath,'utf8'));if(['downloading','preparing'].includes(s.phase)&&Date.now()-s.at>660000)return {phase:'failed',message:'Lần cập nhật trước đã bị gián đoạn. Bạn có thể thử lại.',targetVersion:s.targetVersion||null};return {phase:String(s.phase||''),message:String(s.message||'').slice(0,1000),targetVersion:s.targetVersion||null,at:s.at||null,...(Number.isFinite(s.totalBytes)&&s.totalBytes>0&&Number.isFinite(s.downloadedBytes)?{downloadedBytes:Math.min(s.totalBytes,Math.max(0,s.downloadedBytes)),totalBytes:s.totalBytes,percent:Math.min(100,Math.max(0,Math.floor(s.downloadedBytes/s.totalBytes*100)))}:{})};}catch{return {phase:'idle',message:'',targetVersion:null};}}
function status(phase:string,message:string,targetVersion:string,progress:{downloadedBytes:number;totalBytes:number}|null=null){mkdirSync(updateDir,{recursive:true,mode:0o700});writeFileSync(statusPath,JSON.stringify({phase,message,targetVersion,at:Date.now(),...(progress||{})}),{mode:0o600});}
export async function systemInfo(){
 const environment=platform();let haPath:string|null=null;
 if(environment==='homeassistant')try{const r=await fetch('http://supervisor/addons/self/info',{headers:{Authorization:'Bearer '+process.env.SUPERVISOR_TOKEN},signal:AbortSignal.timeout(4000)});const v:any=await r.json();if(v.result==='ok'&&/^[a-zA-Z0-9_-]+$/.test(v.data?.slug))haPath='/hassio/addon/'+v.data.slug+'/info';}catch{}
 try{const latest=await release();return {currentVersion:APP_VERSION,latestVersion:latest.version,available:newerVersion(latest.version,APP_VERSION),releaseUrl:latest.releaseUrl,notes:latest.notes,environment,canInstall:environment==='windows'&&!!latest.asset,homeAssistantPath:haPath,checkedAt:cacheAt,status:updateStatus()};}
 catch(error){return {currentVersion:APP_VERSION,latestVersion:null,available:false,environment,canInstall:false,homeAssistantPath:haPath,checkError:error instanceof Error?error.message:'Không kiểm tra được cập nhật.',status:updateStatus()};}
}
export async function beginUpdate(version:string,shutdown:()=>void){
 if(platform()!=='windows')throw Error('Bản cài này cần cập nhật qua Home Assistant hoặc Docker.');
 if(busy||['downloading','preparing','applying','restarting'].includes(updateStatus().phase))throw Error('Một lần cập nhật đang chạy.');
 const latest=await release();if(busy||['downloading','preparing','applying','restarting'].includes(updateStatus().phase))throw Error('Một lần cập nhật đang chạy.');if(version!==latest.version||!newerVersion(version,APP_VERSION)||!latest.asset)throw Error('Không có gói cập nhật hợp lệ mới hơn phiên bản đang chạy.');
 busy=true;status('downloading','Đang tải gói cập nhật từ GitHub…',version,{downloadedBytes:0,totalBytes:latest.asset.size});
 void (async()=>{
  const job=join(updateDir,randomUUID());mkdirSync(job,{recursive:true,mode:0o700});const zip=join(job,'package.zip'),helper=join(job,'update-netwatch.ps1'),request=join(job,'request.json');
  const response=await fetch(latest.asset.url,{signal:AbortSignal.timeout(300000)});if(!response.ok||!response.body)throw Error('Không tải được gói cập nhật.');
  let size=0,lastProgressAt=0;const hash=createHash('sha256');const limit=new Transform({transform(chunk,encoding,callback){size+=chunk.length;if(size>latest.asset.size)return callback(Error('Kích thước gói cập nhật không hợp lệ.'));hash.update(chunk);if(Date.now()-lastProgressAt>=500||size===latest.asset.size){lastProgressAt=Date.now();status('downloading','Đang tải gói cập nhật từ GitHub…',version,{downloadedBytes:size,totalBytes:latest.asset.size});}callback(null,chunk);}});
  await pipeline(Readable.fromWeb(response.body as any),limit,createWriteStream(zip,{mode:0o600}));
  if(size!==latest.asset.size||hash.digest('hex')!==latest.asset.sha256)throw Error('Mã kiểm tra SHA-256 không khớp; đã dừng cập nhật.');
  copyFileSync(join(root,'update-netwatch.ps1'),helper);
  writeFileSync(request,JSON.stringify({appRoot:root,dataDir:data,zipPath:zip,sha256:latest.asset.sha256,targetVersion:version,parentPid:process.pid,port:Number(process.env.PORT||8080)}),{mode:0o600});
  status('preparing','Đang kiểm tra gói cài và chuẩn bị sao lưu…',version);
  const quote=(value:string)=>"'"+value.replace(/'/g,"''")+"'";
  const command=Buffer.from(`& ${quote(helper)} -RequestPath ${quote(request)}`,'utf16le').toString('base64');
  const powershell=join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
  // A detached PowerShell 5.1 process exits before running. An attached child
  // is killed by libuv when this server exits. A detached copy of Node owns
  // the PowerShell child instead, and remains outside the application swap.
  const runner=join(job,'updater-node.exe'),bootstrap=join(job,'launch.mjs');
  copyFileSync(process.execPath,runner);
  writeFileSync(bootstrap,`import {spawn} from 'node:child_process';import {openSync,closeSync} from 'node:fs';
const fd=openSync(${JSON.stringify(join(job,'helper.log'))},'a');
const child=spawn(${JSON.stringify(powershell)},${JSON.stringify(['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',command])},{cwd:${JSON.stringify(root)},detached:false,windowsHide:true,stdio:['ignore',fd,fd]});closeSync(fd);
child.once('error',e=>{console.error(e);process.exit(1);});child.once('exit',code=>process.exit(code??1));`,{mode:0o600});
  const log=openSync(join(job,'launcher.log'),'a');
  let child:ReturnType<typeof spawn>;try{child=spawn(runner,[bootstrap],{cwd:job,detached:true,stdio:['ignore',log,log],windowsHide:true});}finally{closeSync(log);}
  let helperExited=false,helperCode:number|null=null;child.once('exit',(code)=>{helperExited=true;helperCode=code;});
  await new Promise<void>((ok,fail)=>{child.once('spawn',()=>ok());child.once('error',fail);});child.unref();
  // Helper validates the archive before requesting shutdown with a ready marker.
  let ready=false;for(let i=0;i<1200;i++){if(existsSync(join(job,'ready'))){ready=true;break;}if(helperExited||updateStatus().phase==='failed')break;await new Promise(r=>setTimeout(r,500));}
  if(!ready)throw Error('Chưa thể chuẩn bị cập nhật; ứng dụng tiếp tục chạy.'+(helperExited?' Helper exit: '+helperCode:''));
  status('applying','Đang dừng ứng dụng để sao lưu và thay bản mới…',version);shutdown();
 })().catch(error=>{busy=false;status('failed',error instanceof Error?error.message:'Cập nhật thất bại; bản hiện tại vẫn hoạt động.',version);});
 return {ok:true,status:updateStatus()};
}
