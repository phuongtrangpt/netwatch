export function projectTelegramMessage(projectName:string,message:string){
 const lines=message.split('\n'),first=lines[0]||'';
 const marker=/^(🔴|🟢|🔁)\s/u.exec(first)?.[1];
 const header=`${marker?marker+' ':''}NetWatch · Dự án: ${projectName}`;
 if(/^(?:(?:🔴|🟢|🔁)\s*)?NetWatch\s*·/u.test(first))lines.shift();
 return [header,...lines].join('\n');
}
