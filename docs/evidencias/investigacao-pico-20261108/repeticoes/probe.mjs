// Somente diagnostico temporario em clone isolado; nao integra a aplicacao publicada.
import { subscribe } from 'node:diagnostics_channel';
import { monitorEventLoopDelay, PerformanceObserver, performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';
const starts=new WeakMap();
const emit=value=>process.stdout.write(JSON.stringify({diagnostic:true,at:new Date().toISOString(),...value})+'\n');
subscribe('http.server.request.start',({request})=>starts.set(request,{wall:Date.now(),mono:performance.now()}));
subscribe('http.server.response.finish',({request,response})=>{
 const start=starts.get(request);if(!start)return;
 emit({event:'native_http',requestId:response.getHeader('x-request-id'),traceId:response.getHeader('x-trace-id'),route:request.url?.split('?')[0],status:response.statusCode,startWallMs:start.wall,durationMs:performance.now()-start.mono});
});
const gc=new PerformanceObserver(list=>{for(const entry of list.getEntries())emit({event:'gc',startWallMs:performance.timeOrigin+entry.startTime,durationMs:entry.duration,kind:entry.detail.kind});});gc.observe({entryTypes:['gc']});
const lag=monitorEventLoopDelay({resolution:10});lag.enable();let last=performance.eventLoopUtilization(),lastWall=Date.now(),lastMono=performance.now();
setInterval(()=>{
 const current=performance.eventLoopUtilization(),delta=performance.eventLoopUtilization(current,last);last=current;
 const wall=Date.now(),mono=performance.now();
 const read=path=>{try{return readFileSync(path,'utf8').trim();}catch{return null;}};
 emit({event:'runtime_sample',eventLoopMaxMs:lag.max/1e6,eventLoopP99Ms:lag.percentile(99)/1e6,eventLoopUtilization:delta.utilization,wallIntervalMs:wall-lastWall,monotonicIntervalMs:mono-lastMono,memory:process.memoryUsage(),ioPressure:read('/proc/pressure/io'),cpuStat:read('/sys/fs/cgroup/cpu.stat'),memoryEvents:read('/sys/fs/cgroup/memory.events')});
 lastWall=wall;lastMono=mono;lag.reset();
},500).unref();
emit({event:'probe_ready',pid:process.pid,node:process.version,scope:'diagnostic_channel HTTP, GC, event loop and Linux pressure; no request payload/headers/SQL'});
