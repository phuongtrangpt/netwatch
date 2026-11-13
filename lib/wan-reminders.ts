export type WanCondition={interface:string;label:string;state:'offline'|'online'|'unknown';reason?:string};
export function planWanReminders(previous:Record<string,any>,conditions:WanCondition[],repeatMinutes:number,now:number){
 const next:Record<string,any>={},due:WanCondition[]=[];
 for(const condition of conditions){
  const old=previous[condition.interface];
  if(condition.state==='unknown'){if(old)next[condition.interface]=old;continue;}
  if(condition.state==='online')continue;
  const incident=old?{...old}:{since:now,lastAlertAt:now,repeatMinutes};
  if(incident.repeatMinutes!==repeatMinutes){incident.repeatMinutes=repeatMinutes;incident.lastAlertAt=now;}
  if([30,60].includes(repeatMinutes)&&now-incident.lastAlertAt>=repeatMinutes*60000){due.push(condition);incident.lastAlertAt=now;}
  next[condition.interface]=incident;
 }
 return {next,due};
}
