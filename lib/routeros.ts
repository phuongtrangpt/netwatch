const quote=(s:string)=>'"'+s.replace(/\\/g,'\\\\').replace(/\$/g,'\\$').replace(/"/g,'\\"').replace(/\r?\n/g,'\\n')+'"';
const sections:[string,string,string[]][]=[
 ['interfaces','/interface print detail as-value',['name','type','running','disabled','actual-mtu','mac-address','comment','default-name']],
 ['addresses','/ip address print as-value',['address','network','interface','actual-interface','dynamic','disabled','invalid']],
 ['vlans','/interface vlan print as-value',['name','vlan-id','interface','running','disabled','mtu']],
 ['bridges','/interface bridge print as-value',['name','running','disabled','vlan-filtering','protocol-mode']],
 ['bridgeports','/interface bridge port print as-value',['interface','bridge','pvid','hw','inactive','disabled']],
 ['bridgevlans','/interface bridge vlan print as-value',['bridge','vlan-ids','tagged','untagged','current-tagged','current-untagged','dynamic']],
 ['dhcpservers','/ip dhcp-server print as-value',['name','interface','address-pool','lease-time','disabled','invalid']],
 ['pools','/ip pool print as-value',['name','ranges','next-pool']],
 ['leases','/ip dhcp-server lease print as-value',['address','mac-address','active-address','active-mac-address','host-name','server','status','expires-after','last-seen','dynamic','disabled']],
 ['arp','/ip arp print as-value',['address','mac-address','interface','status','complete','dynamic','disabled','invalid']],
 ['hosts','/interface bridge host print as-value',['mac-address','on-interface','bridge','vid','local','dynamic']],
 ['routes','/ip route print detail as-value',['dst-address','gateway','immediate-gw','routing-table','distance','active','disabled','dynamic','check-gateway','scope','target-scope']],
 ['wanmembers','/interface list member print as-value',['list','interface','dynamic','disabled']],
 ['pppoe','/interface pppoe-client print as-value',['name','interface','running','disabled','add-default-route','default-route-distance']],
 ['dhcpclients','/ip dhcp-client print as-value',['interface','status','address','gateway','dhcp-server','disabled','add-default-route','default-route-distance']],
 ['health','/system health print as-value',['name','value','type']],
];
const pppSections:[string,string,string[]][]=[
 ['pppactive','/ppp active print as-value where service=pppoe',['name','service','caller-id','address','uptime','session-id']],
 ['pppaccounts','/ppp secret print as-value',['name','service','profile','local-address','remote-address','caller-id','disabled']],
 ['pppprofiles','/ppp profile print as-value',['name','local-address','remote-address','rate-limit','only-one','use-encryption']],
 ['pppservers','/interface pppoe-server server print as-value',['service-name','interface','default-profile','disabled','max-mtu','max-mru','one-session-per-host','max-sessions']]
];
function collector(origin:string,serviceToken:string,ingestToken:string,upgrade=false,mode='infrastructure',project='main'){
 const url=quote(origin+'/api/ingest'+(project==='main'?'':'?project='+encodeURIComponent(project)));const enabledSections=mode==='pppoe'?[...sections,...pppSections.filter(s=>s[0]!=='pppactive')]:sections;const headers=quote('Content-Type:application/json,Authorization: Bearer '+ingestToken);
 const tlsOptions=upgrade?"__NW_TLS_OPTIONS__":origin.startsWith("https://")?" check-certificate=yes":"";
 const emit=`
    :if ([:len [/system script job find where script="netwatch-collect"]] > 1) do={ :return "" }
    :local nwTransmit do={
        :local nwBody $1
        :local nwPayload [:serialize to=json value=$nwBody options=json.no-string-conversion]
        :if ([:len $nwPayload] > 62000) do={ :error "NetWatch payload exceeds safe size" }
        :local nwResponse [${upgrade?"__NW_FETCH_CONFIG__":`/tool fetch url=${url} http-method=post http-header-field=${headers}`} http-data=$nwPayload${tlsOptions} output=user as-value duration=15s]
        :return [:deserialize from=json value=($nwResponse->"data")]
    }
    :local nwSendSection do={
        :local nwSend $1
        :local nwSection $2
        :local nwGeneration $3
        :local nwRows $4
        :local nwFields $5
        :local nwChunk [:toarray ""]
        :local nwPart 0
        :local nwSize 0
        :foreach nwRow in=$nwRows do={
            :local nwClean [:toarray ""]
            :foreach nwKey in=$nwFields do={
                :if ([:typeof ($nwRow->$nwKey)] != "nothing") do={ :set ($nwClean->$nwKey) ($nwRow->$nwKey) }
            }
            :local nwRowSize [:len [:serialize to=json value=$nwClean options=json.no-string-conversion]]
            :if ((($nwSize + $nwRowSize) > 44000) || ([:len $nwChunk] >= 50)) do={
                :local nwPacket {"schema"=1;"kind"="section";"section"=$nwSection;"generation"=$nwGeneration;"part"=$nwPart;"final"=false;"rows"=$nwChunk}
                $nwSend $nwPacket
                :set nwPart ($nwPart + 1)
                :set nwChunk [:toarray ""]
                :set nwSize 0
            }
            :set ($nwChunk->[:len $nwChunk]) $nwClean
            :set nwSize ($nwSize + $nwRowSize)
        }
        :local nwPacket {"schema"=1;"kind"="section";"section"=$nwSection;"generation"=$nwGeneration;"part"=$nwPart;"final"=true;"rows"=$nwChunk}
        $nwSend $nwPacket
    }
    :local nwStats [:toarray ""]
    :foreach nwRow in=[/interface print stats as-value] do={
        :local nwClean [:toarray ""]
        :foreach nwKey in={"name";"running";"disabled";"rx-byte";"tx-byte";"rx-packet";"tx-packet";"rx-error";"tx-error";"rx-drop";"tx-drop"} do={
            :if ([:typeof ($nwRow->$nwKey)] != "nothing") do={ :set ($nwClean->$nwKey) ($nwRow->$nwKey) }
        }
        :do { :set ($nwClean->"running") [/interface get ($nwRow->".id") running] } on-error={}
        :set ($nwStats->[:len $nwStats]) $nwClean
    }
    :local nwResource [:toarray ""]
    :foreach nwKey in={"uptime";"version";"board-name";"architecture-name";"cpu-load";"cpu-count";"cpu-frequency";"free-memory";"total-memory";"free-hdd-space";"total-hdd-space"} do={
        :do { :set ($nwResource->$nwKey) [/system resource get $nwKey] } on-error={}
    }
${mode==='pppoe'?`    :do { :set ($nwResource->"ppp-active-count") [/ppp active print count-only where service=pppoe] } on-error={}
    :do { :set ($nwResource->"ppp-account-count") [/ppp secret print count-only] } on-error={}`:''}
    :local nwMetrics {"collector"=4;"schema"=1;"kind"="metrics";"identity"=[/system identity get name];"resource"=$nwResource;"stats"=$nwStats}
    :local nwReply [:toarray ""]
    :onerror nwUploadError in={ :set nwReply [$nwTransmit $nwMetrics] } do={
        :log warning ("NetWatch: metrics upload failed: " . $nwUploadError)
        :error ("NetWatch: upload failed: " . $nwUploadError)
    }
    :local nwProbeRows [:toarray ""]
    :local nwProbeCount 0
    :foreach nwTarget in=($nwReply->"targets") do={
        :if ($nwProbeCount < 16) do={
            :local nwIp [:toip ($nwTarget->"ip")]
            :if ([:typeof $nwIp] = "ip") do={
                :local nwReceived 0
                :local nwPingError false
                :do { :set nwReceived [/ping address=$nwIp count=2 interval=300ms] } on-error={ :set nwPingError true }
                :local nwProbe {"id"=($nwTarget->"id");"ip"=[:tostr $nwIp];"sent"=2;"received"=$nwReceived;"error"=$nwPingError}
                :set ($nwProbeRows->[:len $nwProbeRows]) $nwProbe
            }
            :set nwProbeCount ($nwProbeCount + 1)
        }
    }
    :if ([:len $nwProbeRows] > 0) do={
        :local nwProbePacket {"schema"=1;"kind"="probes";"results"=$nwProbeRows}
        :do { $nwTransmit $nwProbePacket } on-error={ :log warning "NetWatch: ping result upload failed" }
    }
${mode==='pppoe'?`    :do {
        :local nwFastGeneration ([/system clock get date]."-".[/system clock get time]."-".[/system resource get uptime])
        :local nwActiveRows [/ppp active print as-value where service=pppoe]
        :local nwActiveFields {"name";"service";"caller-id";"address";"uptime";"session-id"}
        $nwSendSection $nwTransmit "pppactive" $nwFastGeneration $nwActiveRows $nwActiveFields
    } on-error={ :log warning "NetWatch: active PPPoE session upload failed" }`:''}
    :global netwatchTick
    :if ([:typeof $netwatchTick] != "num") do={ :set netwatchTick 0 }
    :if (($netwatchTick % ${mode==='pppoe'?5:4}) = 0) do={
        :local nwGeneration ([/system clock get date]."-".[/system clock get time]."-".[/system resource get uptime])
${enabledSections.map(([name,cmd,fields])=>`        :do {
            :local nwSectionRows [${cmd}]
            :local nwSectionFields {${fields.map(quote).join(';')}}
            $nwSendSection $nwTransmit "${name}" $nwGeneration $nwSectionRows $nwSectionFields
        } on-error={ :log warning "NetWatch: section ${name} failed; check permissions or connectivity" }`).join('\n')}
    }
    :set netwatchTick ($netwatchTick + 1)
`;
 return emit;
}
export function installer(origin:string,serviceToken:string,ingestToken:string,project='main',mode='infrastructure'){
 const emit=collector(origin,serviceToken,ingestToken,false,mode,project);
 // Pre-compile the complete collector before modifying either named entry.
 // Quote the source exactly once so /import does not parse it as an inline
 // source={} block with nested function parameter expressions.
 const source=quote(emit);
 return `# NetWatch MikroTik installer v4 - RouterOS 7.17+\n# Private keys inside. Do not share this file.\n# Changes only NetWatch's own script and scheduler.\n\n{\n:local nwSource ${source}\n:local nwParsed [:parse $nwSource]\n:local nwScript [/system script find where name="netwatch-collect"]\n:local nwSchedule [/system scheduler find where name="netwatch-upload"]\n:if ([:len $nwScript] > 0) do={\n    :if ([/system script get $nwScript comment] != "NetWatch read-only telemetry") do={ :error "Existing script is not managed by NetWatch" }\n}\n:if ([:len $nwSchedule] > 0) do={\n    :if ([/system scheduler get $nwSchedule comment] != "NetWatch HTTPS telemetry every 30 seconds") do={ :error "Existing scheduler is not managed by NetWatch" }\n    /system scheduler disable $nwSchedule\n}\n:if ([:len $nwScript] = 0) do={\n    /system script add name="netwatch-collect" comment="NetWatch read-only telemetry" policy=read,test source=$nwSource\n} else={\n    /system script set $nwScript policy=read,test source=$nwSource\n}\n:if ([:len $nwSchedule] = 0) do={\n    /system scheduler add name="netwatch-upload" interval=${mode==='pppoe'?'60s':'30s'} start-time=startup on-event="netwatch-collect" policy=read,test comment="NetWatch HTTPS telemetry every 30 seconds"\n} else={\n    /system scheduler set $nwSchedule interval=${mode==='pppoe'?'60s':'30s'} start-time=startup on-event="netwatch-collect" policy=read,test disabled=no\n}\n:global netwatchTick 0\n:put "NetWatch v4 installed. Starting first upload."\n/system script run netwatch-collect\n:put "NetWatch: first upload completed. Check the dashboard in 2 minutes."\n}\n`;
}

export function upgradeInstaller(mode='infrastructure'){
 const template=quote(collector('', '', '', true,mode));
 return `# NetWatch v4 upgrade - keeps existing keys on this router.\n# Updates only the NetWatch script. No network settings changed.\n{\n:local nwId [/system script find where name="netwatch-collect"]\n:if ([:len $nwId] != 1) do={ :error "Install NetWatch first" }\n:if ([/system script get $nwId comment] != "NetWatch read-only telemetry") do={ :error "Script not managed by NetWatch" }\n:local nwOld [/system script get $nwId source]\n:local nwStart [:find $nwOld "/tool fetch url="]\n:if ([:typeof $nwStart] != "num") do={ :error "Cannot locate existing connection settings" }\n:local nwEnd [:find $nwOld " http-data=" $nwStart]\n:if ([:typeof $nwEnd] != "num") do={ :error "Cannot locate existing connection settings" }\n:local nwConfig [:pick $nwOld $nwStart $nwEnd]\n:local nwTemplate ${template}\n:local nwMarker "__NW_FETCH_CONFIG__"\n:local nwPos [:find $nwTemplate $nwMarker]\n:local nwNew ([:pick $nwTemplate 0 $nwPos].$nwConfig.[:pick $nwTemplate ($nwPos + [:len $nwMarker]) [:len $nwTemplate]])\n:local nwTlsMarker "__NW_TLS_OPTIONS__"\n:local nwTlsPos [:find $nwNew $nwTlsMarker]\n:local nwTlsOptions ""\n:if ([:typeof [:find $nwConfig "https://"]] = "num") do={ :set nwTlsOptions " check-certificate=yes" }\n:set nwNew ([:pick $nwNew 0 $nwTlsPos].$nwTlsOptions.[:pick $nwNew ($nwTlsPos + [:len $nwTlsMarker]) [:len $nwNew]])\n:local nwCompiled [:parse $nwNew]\n:local nwSchedule [/system scheduler find where name="netwatch-upload"]\n:if ([:len $nwSchedule] != 1) do={ :error "NetWatch scheduler missing" }\n:if ([/system scheduler get $nwSchedule comment] != "NetWatch HTTPS telemetry every 30 seconds") do={ :error "Scheduler not managed by NetWatch" }\n/system scheduler disable $nwSchedule\n/system script set $nwId source=$nwNew policy=read,test\n:global netwatchTick 0\n/system scheduler set $nwSchedule interval=${mode==='pppoe'?'60s':'30s'}\n/system scheduler enable $nwSchedule\n:put "NetWatch v4 updated. Existing keys preserved. Wait 1-2 minutes for ping results."\n}\n`;
}

export const uninstall=`/system scheduler remove [find where name="netwatch-upload"]\n/system script remove [find where name="netwatch-collect"]`;
