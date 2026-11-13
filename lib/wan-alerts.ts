export function wanProbeTransition(prior:any,probe:{received:number;error?:boolean},now:number){
 const failed=!!probe.error||probe.received===0;
 const continuous=prior&&now-prior.at<150000;
 const failures=failed?(continuous?(prior.failures||0)+1:1):0;
 const status=failed?(failures>=2?'offline':'checking'):'online';
 const previous=prior?.confirmedStatus||(prior?.status==='online'||prior?.status==='offline'?prior.status:null);
 const confirmedStatus=status==='checking'?previous:status;
 // Pending is never recovery; retain the last confirmed state across missing samples.
 const transition=status==='offline'&&previous!=='offline'?'offline':status==='online'&&previous==='offline'?'online':null;
 return {status,confirmedStatus,failures,transition};
}
