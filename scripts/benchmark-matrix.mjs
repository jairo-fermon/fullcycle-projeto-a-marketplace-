import { spawn,execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync,writeFileSync,mkdirSync,existsSync,createWriteStream } from 'node:fs';
import { resolve,join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpus,totalmem,platform,release } from 'node:os';

const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root);
const settings=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).filter(l=>l&&!l.startsWith('#')).map(l=>{const n=l.indexOf('=');return[l.slice(0,n),l.slice(n+1)];}));
const project=process.env.COMPOSE_PROJECT_NAME??settings.COMPOSE_PROJECT_NAME;
// Recusar a instalacao padrao e exigir declaracao explicita de ambiente isolado.
if(process.env.BENCHMARK_ISOLATED!=='true'||!/^fullcycle-a-(hardening|benchmark)[a-z0-9-]*$/.test(project??'')||!settings.PORT||settings.PORT==='3001'||!settings.JAEGER_PORT||settings.JAEGER_PORT==='16687')throw new Error('Exige BENCHMARK_ISOLATED=true, projeto fullcycle-a-hardening/benchmark e portas proprias no .env. Nao usar instalacao original/producao.');
const rounds=Number(process.env.BENCHMARK_ROUNDS??'2');if(!Number.isInteger(rounds)||rounds<1||rounds>3)throw new Error('BENCHMARK_ROUNDS deve ser 1, 2 ou 3.');
const output=resolve(root,process.env.BENCHMARK_OUTPUT??'tmp/benchmark-matrix');
if(existsSync(output))throw new Error('Diretorio de evidencias ja existe; escolher outro para preservar resultados.');
mkdirSync(output,{recursive:true});
const report={startedAt:new Date().toISOString(),timeZone:'America/Sao_Paulo',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),project,port:settings.PORT,jaegerPort:settings.JAEGER_PORT,rounds,host:{platform:platform(),release:release(),cpu:cpus()[0]?.model,logicalCpus:cpus().length,memoryBytes:totalmem()},scriptSha256:Object.fromEntries(['scripts/k6-load.js','scripts/benchmark-matrix.mjs'].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),stages:[{duration:'10s',target:5},{duration:'15s',target:15},{duration:'10s',target:0}],warmupRequestsPerRoute:10,monitorIntervalMs:5000,checks:[],runs:[]};
function assert(condition,message){if(!condition)throw new Error(message);}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function execute(name,args,configuration={},allowFailure=false,keep=true){
 const startedAt=new Date().toISOString();let stdout='',stderr='';
 const result=await new Promise((done,reject)=>{
  const child=spawn('docker',args,{env:{...process.env,COMPOSE_PROJECT_NAME:project,...configuration},windowsHide:true,timeout:600000});
  child.stdout.on('data',chunk=>{stdout+=chunk.toString();});child.stderr.on('data',chunk=>{stderr+=chunk.toString();});child.once('error',reject);child.once('close',code=>done({code}));
 });
 const record={name,startedAt,finishedAt:new Date().toISOString(),command:['docker',...args],configuration,exitCode:result.code,status:result.code===0?'PASSOU':'FALHOU'};
 if(keep){report.checks.push(record);writeFileSync(join(output,`${name}.txt`),JSON.stringify(record)+'\n'+stdout+stderr);}
 if(result.code!==0&&!allowFailure)throw new Error(`${name}: comando falhou (${result.code}).`);
 return{stdout,stderr,exitCode:result.code};
}
const compose=(name,args,config={},allowFailure=false,keep=true)=>execute(name,['compose',...args],config,allowFailure,keep);
async function sql(name,text,keep=true){return(await compose(name,['exec','-T','db','sh','-c','psql -X -tA -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '+"'"+text.replaceAll("'","'\\''")+"'"],{},false,keep)).stdout.trim();}
async function dataset(name){
 const query="SELECT json_build_object('orders',count(*),'syntheticOrders',count(*) FILTER(WHERE origin='synthetic_seed'),'orderFingerprint',md5(string_agg(id::text||status||total_cents::text||created_at::text,',' ORDER BY id)),'products',(SELECT count(*) FROM catalog.products),'productFingerprint',(SELECT md5(string_agg(id::text||sku||category||unit_price_cents::text,',' ORDER BY id)) FROM catalog.products)) FROM orders.orders;";
 return JSON.parse(await sql(name,query));
}
const base=`http://127.0.0.1:${settings.PORT}`,jaeger=`http://127.0.0.1:${settings.JAEGER_PORT}`;
let original,indexBefore,restoreNeeded=false,restoreEnv;
try{
 await execute('docker-resources',['info','--format','CPUs={{.NCPU}} MemoryBytes={{.MemTotal}} OS={{.OperatingSystem}}']);
 const container=(await compose('app-container',['ps','-q','app'])).stdout.trim();assert(container,'App isolado precisa estar rodando.');
 const image=(await execute('app-image-id',['inspect','--format','{{.Image}}',container])).stdout.trim();const imageReference=(await execute('app-image-reference',['inspect','--format','{{.Config.Image}}',container])).stdout.trim();
 original=JSON.parse((await compose('app-config',['exec','-T','app','node','-e','console.log(JSON.stringify({cache:process.env.CATALOG_CACHE_ENABLED,payments:process.env.PAYMENT_PROCESSING_ENABLED,appEnv:process.env.APP_ENV,logLevel:process.env.LOG_LEVEL}))'])).stdout.trim());
 assert(original.appEnv==='development','Experimento restrito a development isolado.');
 const index=(await sql('index-original',"SELECT to_regclass('orders.orders_status_created_id_idx') IS NOT NULL;"));indexBefore=index==='t';
 report.original={...original,indexEnabled:indexBefore,imageId:image,imageReference};
 report.datasetBefore=await dataset('dataset-before');assert(report.datasetBefore.syntheticOrders===100000,'Exige 100 mil sinteticos preparados separadamente.');
 restoreEnv={APP_IMAGE:imageReference,CATALOG_CACHE_ENABLED:original.cache,PAYMENT_PROCESSING_ENABLED:original.payments,APP_ENV:original.appEnv,LOG_LEVEL:original.logLevel};
 restoreNeeded=true;
 const scenarios=[{name:'index0-cache0',index:false,cache:false},{name:'index1-cache0',index:true,cache:false},{name:'index0-cache1',index:false,cache:true},{name:'index1-cache1',index:true,cache:true}];
 for(let round=1;round<=rounds;round++)for(const scenario of(round%2?scenarios:[...scenarios].reverse())){
  const label=`r${round}-${scenario.name}`,configuration={...restoreEnv,APP_IMAGE:imageReference,CATALOG_CACHE_ENABLED:String(scenario.cache)};
  console.log(`[${new Date().toISOString()}] ${label}`);
  await compose(label+'-plan',['exec','-T','app','node','scripts/optimize.mjs',scenario.index?'optimized':'baseline']);
  await compose(label+'-configure',['up','--no-build','--force-recreate','-d','--wait','app'],configuration);
  const actualImage=(await execute(label+'-image',['inspect','--format','{{.Image}}',(await compose(label+'-container',['ps','-q','app'])).stdout.trim()])).stdout.trim();assert(actualImage===image,'Imagem mudou entre cenarios.');
  assert((await sql(label+'-index',"SELECT to_regclass('orders.orders_status_created_id_idx') IS NOT NULL;"))===(scenario.index?'t':'f'),'Estado do indice incorreto.');
  const warmup=[];
  for(let i=0;i<10;i++){
   const orders=await fetch(base+'/orders?status=PENDING&limit=20&page=1');assert(orders.ok&&(await orders.json()).items.length===20,'Aquecimento pedidos falhou.');
   const products=await fetch(base+'/catalog/products?category=category-01&limit=20');assert(products.ok&&(await products.json()).items.length===20,'Aquecimento catalogo falhou.');
   const cache=products.headers.get('x-cache');assert(scenario.cache?['hit','miss'].includes(cache):cache==='bypass','Cache diverge do cenario.');warmup.push(cache);
  }
  const samples=[],resourceLog=createWriteStream(join(output,label+'-resources.ndjson'));let stop=false;
  const monitor=(async()=>{while(!stop){
   const sample={at:new Date().toISOString()};
   try{
    const containers=(await execute('monitor-containers',['ps','-q','--filter',`label=com.docker.compose.project=${project}`],{},false,false)).stdout.trim().split(/\s+/).filter(Boolean);
    const resources=await execute('monitor-resources',['stats','--no-stream','--format','{{json .}}',...containers],{},true,false);sample.resources=resources.stdout.trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));sample.resourcesExitCode=resources.exitCode;
    const query="SELECT json_build_object('active',(SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND state='active'),'sessions',(SELECT count(*) FROM pg_stat_activity WHERE datname=current_database()),'blockedSessions',(SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND cardinality(pg_blocking_pids(pid))>0),'waitingLocks',(SELECT count(*) FROM pg_locks WHERE NOT granted),'readyJobs',(SELECT count(*) FROM payments.jobs WHERE state='READY'));";
    sample.postgres=JSON.parse(await sql('monitor-pg',query,false));
   }catch(error){sample.error=error.message;}
   samples.push(sample);resourceLog.write(JSON.stringify(sample)+'\n');
   for(let i=0;i<10&&!stop;i++)await pause(500);
  }})();
  const startedAt=new Date().toISOString();let load;
  try{load=await compose(label+'-k6',['--profile','tools','run','--rm','-e',`BENCHMARK_CASE=${scenario.name}`,'-e',`BENCHMARK_ROUND=${round}`,'k6','run','--log-format=json','--summary-export=/results/k6-summary.json','/scripts/load.js'],configuration,true);}finally{stop=true;await monitor;await new Promise(resolve=>resourceLog.end(resolve));}
  assert(load,'Carga nao executada.');
  const summary=JSON.parse(readFileSync('docs/evidencias/k6-summary.json','utf8'));writeFileSync(join(output,label+'-k6.json'),JSON.stringify(summary,null,2));
  const metric=name=>summary.metrics[name]?.values??summary.metrics[name];
  const iterations=metric('iterations').count;
  const stats=name=>{const m=metric(name);return{p50:m.med,p95:m['p(95)'],p99:m['p(99)'],max:m.max,avg:m.avg,count:m.count??iterations,countSource:m.count===undefined?'iterations: uma chamada por rota em cada iteracao':'trend count'};};
  const orders=stats('orders_list_duration'),catalog=stats('catalog_list_duration');assert(Number.isFinite(orders.p99)&&Number.isFinite(catalog.p99),'p99 nao exportado; nao inferir.');
  const slow=[];
  for(const line of(load.stdout+load.stderr).split('\n')){try{const value=JSON.parse(line);const event=typeof value.msg==='string'?JSON.parse(value.msg):value;if(event.event==='slow_request')slow.push(event);}catch{/* Somente logs JSON reconhecidos. */}}
  const metrics=await(await fetch(base+'/metrics')).text();writeFileSync(join(output,label+'-metrics.prom'),metrics);
  assert(scenario.cache?metrics.includes('catalog_cache_requests_total{result="hit"}'):metrics.includes('catalog_cache_requests_total{result="bypass"}')&&!metrics.includes('catalog_cache_requests_total{result="hit"}'),'Contadores nao comprovam cache.');
  const logs=await compose(label+'-logs',['logs','--no-color','--no-log-prefix','app'],{},false,false);
  writeFileSync(join(output,label+'-logs.jsonl'),logs.stdout);
  const records=logs.stdout.split('\n').flatMap(line=>{try{return[JSON.parse(line)];}catch{return[];}}).filter(r=>r.msg==='request_completed');
  for(const event of slow.slice(0,5))if(/^[a-f0-9]{32}$/.test(event.traceId)){
   try{const response=await fetch(jaeger+'/api/traces/'+event.traceId);if(response.ok)writeFileSync(join(output,label+'-trace-'+event.traceId+'.json'),JSON.stringify(await response.json(),null,2));}catch{/* Falta de trace registrada por ausencia do arquivo; nao inventar correlacao. */}
  }
  const checks=metric('checks').value??metric('checks').rate,errors=metric('http_req_failed').value??metric('http_req_failed').rate;
  const entry={round,scenario:scenario.name,index:scenario.index,cache:scenario.cache,startedAt,finishedAt:new Date().toISOString(),imageId:actualImage,warmup,orders,catalog,requests:metric('http_reqs').count,throughput:metric('http_reqs').rate,iterations,errors,checks,exitCode:load.exitCode,slowRequests:slow,serverLogRequests:records.length,maxServerDurationMs:Math.max(0,...records.map(r=>r.durationMs)),resourceSamples:samples.length,maxBlockedSessions:Math.max(0,...samples.map(s=>s.postgres?.blockedSessions??0)),status:load.exitCode===0&&errors===0&&checks===1&&orders.p95<500&&catalog.p95<500?'PASSOU':'FALHOU'};
  report.runs.push(entry);writeFileSync(join(output,'matrix.json'),JSON.stringify(report,null,2));
  assert(entry.status==='PASSOU',`${label}: thresholds falharam; preservar resultado e restaurar configuracao.`);
  console.log(JSON.stringify({scenario:scenario.name,round,status:entry.status,ordersP95ms:orders.p95,ordersMaxMs:orders.max,catalogP95ms:catalog.p95,slowRequests:slow.length}));
 }
 report.datasetAfter=await dataset('dataset-after');assert(JSON.stringify(report.datasetAfter)===JSON.stringify(report.datasetBefore),'Dados mudaram durante a comparacao.');
 report.status='PASSOU';
}catch(error){report.status='FALHOU';report.failure=error.message;process.exitCode=1;}
finally{
 if(restoreNeeded){try{
  await compose('restore-index',['exec','-T','app','node','scripts/optimize.mjs',indexBefore?'optimized':'baseline']);
  await compose('restore-app',['up','--no-build','--force-recreate','-d','--wait','app'],restoreEnv);
  const config=JSON.parse((await compose('restored-config',['exec','-T','app','node','-e','console.log(JSON.stringify({cache:process.env.CATALOG_CACHE_ENABLED,payments:process.env.PAYMENT_PROCESSING_ENABLED,appEnv:process.env.APP_ENV,logLevel:process.env.LOG_LEVEL}))'])).stdout.trim());
  assert(JSON.stringify(config)===JSON.stringify(original),'Configuracao nao foi restaurada.');
  assert((await sql('restored-index',"SELECT to_regclass('orders.orders_status_created_id_idx') IS NOT NULL;"))===(indexBefore?'t':'f'),'Indice nao restaurado.');report.restoration={status:'PASSOU',config,indexEnabled:indexBefore};
 }catch(error){report.restoration={status:'FALHOU',error:error.message};report.status='FALHOU';process.exitCode=1;}}
 report.finishedAt=new Date().toISOString();writeFileSync(join(output,'matrix.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,failure:report.failure,runs:report.runs.length,restoration:report.restoration,output}));
}
