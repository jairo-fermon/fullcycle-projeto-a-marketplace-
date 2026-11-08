import { spawnSync } from 'node:child_process';
import { cpus,totalmem,platform,release } from 'node:os';
import { readFileSync,writeFileSync,mkdirSync,copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root);
const output=new URL('../docs/evidencias/',import.meta.url);mkdirSync(output,{recursive:true});
const report={startedAt:new Date().toISOString(),timeZone:'America/Sao_Paulo',sourceCommit:spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim(),host:{platform:platform(),release:release(),cpu:cpus()[0]?.model,logicalCpus:cpus().length,memoryBytes:totalmem(),node:process.version},clean:process.argv.includes('--clean'),checks:[]};
function run(name,command,args,configuration={}){
 console.log(`[${new Date().toISOString()}] ${name}`);const startedAt=new Date().toISOString();
 const r=spawnSync(command,args,{encoding:'utf8',timeout:600000,maxBuffer:30*1024*1024,env:{...process.env,...configuration}});const text=(r.stdout??'')+(r.stderr??'');
 writeFileSync(new URL(`${name}.txt`,output),`startedAt=${startedAt}\ncommand=${JSON.stringify([command,...args])}\nconfiguration=${JSON.stringify(configuration)}\n${text}\nexitCode=${r.status}\n`);
 report.checks.push({name,command:[command,...args],configuration,startedAt,finishedAt:new Date().toISOString(),exitCode:r.status,status:r.status===0?'PASSOU':'FALHOU'});
 if(r.status!==0)throw new Error(`${name} falhou; consulte sua evidencia.`);console.log(`${name}: PASSOU`);return text;
}
const compose=(name,args,configuration={})=>run(name,'docker',['compose',...args],configuration);
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const parseLast=text=>text.trim().split('\n').map(line=>{try{return JSON.parse(line);}catch{return null;}}).findLast(value=>value?.result==='PASSOU');
const settings=()=>Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).filter(line=>line&&!line.startsWith('#')).map(line=>{const i=line.indexOf('=');return[line.slice(0,i),line.slice(i+1)];}));
let restoreNeeded=false;
try{
 run('env-init',process.execPath,['scripts/init-env.mjs']);
 compose('compose-version',['version']);run('docker-version','docker',['version','--format','{{.Client.Version}} / {{.Server.Version}}']);
 run('docker-resources','docker',['info','--format','CPUs={{.NCPU}} MemoryBytes={{.MemTotal}} OS={{.OperatingSystem}}']);
 compose('compose-config',['config','--quiet']);
 if(report.clean)compose('limpeza',['--profile','test','--profile','tools','down','--volumes','--remove-orphans']);
 compose('subida',['up','--build','-d','--wait']);
 compose('qualidade',['--profile','test','run','--build','--rm','tests','sh','-c','npm run lint && npm run typecheck && npm run build && npm run openapi:lint && npm run sca && npm test']);
 copyFileSync('coverage/report/coverage-summary.json',new URL('coverage-summary.json',output));const coverage=JSON.parse(readFileSync(new URL('coverage-summary.json',output),'utf8')).total;
 assert(coverage.lines.pct>=80&&coverage.branches.pct>=75,'Coverage abaixo do minimo.');report.coverage={lines:coverage.lines.pct,branches:coverage.branches.pct,functions:coverage.functions.pct};
 const base=`http://127.0.0.1:${settings().PORT??'3001'}`,jaeger=`http://127.0.0.1:${settings().JAEGER_PORT??'16687'}`;
 const demo=parseLast(run('demonstracao',process.execPath,['--env-file=.env','scripts/demo.mjs']));assert(demo?.orderId&&demo?.paymentTraceId,'Demonstracao sem IDs reais.');report.demo=demo;
 let trace;
 for(let i=0;i<50;i++){try{const r=await fetch(`${jaeger}/api/traces/${demo.paymentTraceId}`);if(r.ok){const data=await r.json();if(data.data?.[0]?.spans?.some(s=>s.operationName==='payments.process_job')){trace=data;break;}}}catch{/* Aguarda exportacao assincrona. */}await sleep(200);}
 assert(trace,'Trace real completo nao encontrado no Jaeger.');const spans=trace.data[0].spans;const operations=[...new Set(spans.map(s=>s.operationName))];
 for(const name of ['HTTP POST /payments','payments.submit','payments.process_job','orders.mark_paid','postgres.orders.mark_paid'])assert(operations.includes(name),`Span ausente: ${name}`);
 writeFileSync(new URL('trace-real.json',output),JSON.stringify(trace,null,2));report.trace={id:demo.paymentTraceId,spans:spans.length,operations,url:`${jaeger}/trace/${demo.paymentTraceId}`};
 const first=parseLast(compose('seed-primeira',['exec','-T','app','node','scripts/seed.mjs']));const second=parseLast(compose('seed-repetida',['exec','-T','app','node','scripts/seed.mjs']));assert(first?.syntheticOrders===100000&&second?.syntheticOrders===100000,'Seed nao idempotente ou inferior ao volume.');report.syntheticOrders=second.syntheticOrders;
 compose('seed-sql',['exec','-T','db','sh','-c','psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT origin,count(*) FROM orders.orders GROUP BY origin; SELECT count(*) AS inconsistencias FROM orders.orders o JOIN orders.items i ON i.order_id=o.id LEFT JOIN catalog.products p ON p.id=i.product_id LEFT JOIN payments.attempts a ON a.id=o.payment_reference WHERE o.origin=\'synthetic_seed\' AND (p.id IS NULL OR o.total_cents<>i.quantity*i.unit_price_cents OR (o.status=\'PAID\' AND (a.id IS NULL OR a.status<>\'SUCCEEDED\' OR a.amount_cents<>o.total_cents)));"']);
 const image=run('imagem-id','docker',['image','inspect','--format','{{.Id}}','fullcycle-a-marketplace-app:local']).trim();const validatedImage=`fullcycle-a-marketplace-app:validated-${image.slice(7,19)}`;
 run('imagem-preservada','docker',['image','tag','fullcycle-a-marketplace-app:local',validatedImage]);
 const prod={APP_IMAGE:validatedImage,PAYMENT_PROCESSING_ENABLED:'false'};
 compose('promocao-production',['-f','docker-compose.yml','-f','compose.production.yml','up','--no-build','-d','--wait','app'],prod);
 const config=compose('config-production',['exec','-T','app','node','-e','console.log(JSON.stringify({APP_ENV:process.env.APP_ENV,LOG_LEVEL:process.env.LOG_LEVEL,PAYMENT_PROCESSING_ENABLED:process.env.PAYMENT_PROCESSING_ENABLED}))']);assert(config.includes('production')&&config.includes('false'),'Ambiente/flag nao aplicados.');
 const rejected=await fetch(`${base}/payments`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':'00000004-0000-4000-8000-999999999999'},body:JSON.stringify({orderId:demo.orderId,outcome:'approve'})});assert(rejected.status===503,'Flag nao suspendeu admissao.');
 compose('rollback-development',['up','--no-build','-d','--wait','app'],{APP_IMAGE:validatedImage,PAYMENT_PROCESSING_ENABLED:'true',APP_ENV:'development'});
 const rollback=compose('config-development',['exec','-T','app','node','-e','console.log(JSON.stringify({APP_ENV:process.env.APP_ENV,LOG_LEVEL:process.env.LOG_LEVEL,PAYMENT_PROCESSING_ENABLED:process.env.PAYMENT_PROCESSING_ENABLED}))']);assert(rollback.includes('development')&&rollback.includes('true'),'Rollback nao restaurou configuracao.');
 const recovered=await(await fetch(`${base}/orders/${demo.orderId}`)).json();assert(recovered.status==='PAID','Dados perdidos na promocao/rollback.');
 report.deployment={strategy:'recreate local',validatedImage,imageId:image,productionConfigApplied:true,disabledFlagHttpStatus:rejected.status,configurationRollbackApplied:true,binaryVersionRollbackExecuted:false,orderPreserved:true};
 restoreNeeded=true;const results={};
 for(const phase of ['baseline','optimized']){
  compose(`plano-${phase}`,['exec','-T','app','node','scripts/optimize.mjs',phase]);
  compose(`config-${phase}`,['up','--no-build','--force-recreate','-d','--wait','app'],{CATALOG_CACHE_ENABLED:String(phase==='optimized'),APP_IMAGE:validatedImage});
  for(let i=0;i<10;i++){assert((await fetch(`${base}/orders?status=PENDING&limit=20&page=1`)).ok,'Aquecimento pedidos falhou.');assert((await fetch(`${base}/catalog/products?category=category-01&limit=20`)).ok,'Aquecimento catalogo falhou.');}
  compose(`k6-${phase}`,['--profile','tools','run','--rm','k6']);
  copyFileSync(new URL('k6-summary.json',output),new URL(`k6-${phase}.json`,output));
  const metrics=JSON.parse(readFileSync(new URL(`k6-${phase}.json`,output),'utf8')).metrics;
  const record={ordersP95ms:metrics.orders_list_duration['p(95)'],catalogP95ms:metrics.catalog_list_duration['p(95)'],requests:metrics.http_reqs.count,throughput:metrics.http_reqs.rate,errors:metrics.http_req_failed.value,checks:metrics.checks.value};
  assert(record.errors===0&&record.checks===1&&record.ordersP95ms<500&&record.catalogP95ms<500,'Criterio k6 nao atendido.');results[phase]=record;
  writeFileSync(new URL(`metrics-${phase}.prom`,output),await(await fetch(`${base}/metrics`)).text());
 }
 report.performance=results;restoreNeeded=false;
 compose('logs-json',['logs','--no-color','--no-log-prefix','app']);compose('compose-status',['ps','--format','json']);
 compose('node-container',['exec','-T','app','node','--version']);compose('postgres-container',['exec','-T','db','postgres','--version']);compose('k6-version',['--profile','tools','run','--rm','--no-deps','k6','version']);
 report.status='PASSOU';
}catch(error){report.status='FALHOU';report.failure=error.message;process.exitCode=1;}
finally{
 if(restoreNeeded){try{compose('restaurar-indice',['exec','-T','app','node','scripts/optimize.mjs','optimized']);compose('restaurar-cache',['up','--no-build','-d','--wait','app'],{CATALOG_CACHE_ENABLED:'true'});}catch{report.restoreFailed=true;}}
 report.finishedAt=new Date().toISOString();writeFileSync(new URL('validacao-local.json',output),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,failure:report.failure,evidence:'docs/evidencias/validacao-local.json'}));
}
