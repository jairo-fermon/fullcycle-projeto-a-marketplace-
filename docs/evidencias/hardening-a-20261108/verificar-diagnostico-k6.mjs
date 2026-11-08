import { readFileSync,writeFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url);
const path=new URL('../../scripts/k6-load.js',import.meta.url);
const original=readFileSync(path,'utf8');
const code=original.replace(/^import .*;\r?$/gm,'').replace('export const options=','const options=').replace('export default function()','function iteration()')+'\nglobalThis.verification={record,options};';
const captured=[];
const sandbox={__ENV:{BASE_URL:'http://isolated-fixture'},Trend:class{},http:{},check:()=>{},sleep:()=>{},console:{warn:value=>captured.push(JSON.parse(value))}};
vm.runInNewContext(code,sandbox);
const values=[];const trend={add:value=>values.push(value)};
for(const headers of [{'X-Request-Id':'synthetic-request','X-Trace-Id':'00000000000000000000000000000001'}, {'X-Request-Id':['synthetic-request'],'X-Trace-Id':['00000000000000000000000000000001']}]){
 sandbox.verification.record({status:200,timings:{duration:600,waiting:590,sending:1,receiving:9},headers:{...headers,Authorization:'Bearer SENSITIVE-DUMMY'},body:'SENSITIVE-DUMMY'},'GET /orders',trend);
}
sandbox.verification.record({status:200,timings:{duration:100},headers:{},body:'SENSITIVE-DUMMY'},'GET /orders',trend);
assert.deepEqual(values,[600,600,100]);assert.equal(captured.length,2);
assert(captured.every(r=>r.event==='slow_request'&&r.requestId==='synthetic-request'&&r.traceId==='00000000000000000000000000000001'&&r.route==='GET /orders'));
assert(!JSON.stringify(captured).includes('SENSITIVE-DUMMY'));
assert.equal(sandbox.verification.options.stages.length,3);assert(sandbox.verification.options.summaryTrendStats.includes('p(99)'));
writeFileSync(new URL('diagnostico-k6-teste.json',import.meta.url),JSON.stringify({collectedAt:new Date().toISOString(),status:'PASSOU',kind:'Verificacao isolada com respostas sinteticas em vm; nenhuma chamada HTTP, sem medicao de desempenho.',checks:['header string e array','log apenas acima de 500 ms','sem corpo/autorizacao no log','metricas recebem valores de duracao','tres estagios mantidos e p99 exportado'],warningCount:captured.length,latenciesAreSynthetic:true,sourceFile:new URL('scripts/k6-load.js',root).pathname},null,2));
console.log('PASSOU: formato dos diagnosticos testado com dados sinteticos; sem corpo/credencial no log.');
