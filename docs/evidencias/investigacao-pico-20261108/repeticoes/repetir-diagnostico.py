from pathlib import Path
import subprocess,json,os,datetime,time,hashlib,urllib.request,threading
root=Path(__file__).resolve().parents[2]
tmp=Path(__file__).resolve().parent
clone=root/'tmp/hardening-20261108/fullcycle-projeto-a-marketplace-'
out=root.parent/'fullcycle-hardening/A/investigacao-pico/repeticoes'
out.mkdir(parents=True,exist_ok=False)
env={**os.environ,'COMPOSE_PROJECT_NAME':'fullcycle-a-hardening-20261108','CATALOG_CACHE_ENABLED':'true'}
settings=dict(line.split('=',1) for line in (clone/'.env').read_text().splitlines() if '=' in line and not line.startswith('#'))
assert settings['PORT']=='3003' and settings['COMPOSE_PROJECT_NAME']=='fullcycle-a-hardening-20261108'
override={'services':{'app':{'environment':{'NODE_OPTIONS':'--import=/app/diagnostic-probe.mjs'},'volumes':[{'type':'bind','source':str(tmp/'probe.mjs'),'target':'/app/diagnostic-probe.mjs','read_only':True}]},'k6':{'volumes':[{'type':'bind','source':str(tmp/'k6-diagnostico.js'),'target':'/scripts/diagnostic.js','read_only':True}]}}}
(tmp/'override.json').write_text(json.dumps(override),encoding='utf8')
report={'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'Tres repeticoes diagnosticas adicionais, instrumentadas; nao substituem benchmark anterior; sem injecao de falha ou stress de disco.','project':env['COMPOSE_PROJECT_NAME'],'port':3003,'scriptsSha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [tmp/'probe.mjs',tmp/'k6-diagnostico.js']},'checks':[],'rounds':[]}
def cmd(name,args,override_enabled=True):
    command=['docker','compose','-f','docker-compose.yml']+(['-f',str(tmp/'override.json')] if override_enabled else [])+args
    before=datetime.datetime.now(datetime.timezone.utc).isoformat()
    p=subprocess.run(command,cwd=clone,env=env,capture_output=True,text=True,encoding='utf8',errors='replace',timeout=300)
    (out/(name+'.txt')).write_text(json.dumps({'startedAt':before,'command':command,'exitCode':p.returncode})+'\n'+p.stdout+p.stderr,encoding='utf8')
    report['checks'].append({'name':name,'startedAt':before,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':p.returncode})
    if p.returncode:raise RuntimeError(name+' falhou')
    return p.stdout
def sql(name,query):return cmd(name,['exec','-T','db','sh','-c','psql -X -tA -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '+"'"+query.replace("'","'\\''")+"'"])
monitor_stop=threading.Event()
def monitor():
    with (out/'pg-samples.ndjson').open('w',encoding='utf8') as f:
        while not monitor_stop.is_set():
            try:
                r=sql('pg-monitor',"SELECT json_build_object('at',clock_timestamp(),'active',(SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND state='active'),'sessions',(SELECT count(*) FROM pg_stat_activity WHERE datname=current_database()),'blocked',(SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND cardinality(pg_blocking_pids(pid))>0),'waitingLocks',(SELECT count(*) FROM pg_locks WHERE NOT granted),'readyJobs',(SELECT count(*) FROM payments.jobs WHERE state='READY'));")
                f.write(r.strip()+'\n');f.flush()
            except Exception as exc:f.write(json.dumps({'error':str(exc)})+'\n');f.flush()
            monitor_stop.wait(0.5)
worker=None
try:
    cmd('subida',['up','--no-build','-d','--wait'])
    original=sql('dataset-before',"SELECT json_build_object('synthetic',count(*) FILTER(WHERE origin='synthetic_seed'),'orders',count(*),'hash',md5(string_agg(id::text||status||total_cents::text,',' ORDER BY id))) FROM orders.orders;").strip()
    assert json.loads(original)['synthetic']==100000
    report['imageId']=subprocess.check_output(['docker','inspect','--format','{{.Image}}',cmd('container',['ps','-q','app']).strip()],text=True).strip()
    worker=threading.Thread(target=monitor,daemon=True);worker.start()
    for round_no in range(1,4):
        for _ in range(10):
            for route in ['/orders?status=PENDING&limit=20&page=1','/catalog/products?category=category-01&limit=20']:
                with urllib.request.urlopen('http://127.0.0.1:3003'+route) as response:assert response.status==200
        name='r'+str(round_no)
        print(datetime.datetime.now(datetime.timezone.utc).isoformat(),name,flush=True)
        cmd(name+'-k6',['--profile','tools','run','--rm','-e','DIAGNOSTIC_ROUND='+str(round_no),'k6','run','--log-format=json','--summary-export=/results/diagnostic-r'+str(round_no)+'.json','/scripts/diagnostic.js'])
        result=json.loads((clone/'docs/evidencias'/('diagnostic-r'+str(round_no)+'.json')).read_text())
        (out/(name+'-summary.json')).write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
        report['rounds'].append({'round':round_no,'summary':result})
    assert sql('dataset-after',"SELECT json_build_object('synthetic',count(*) FILTER(WHERE origin='synthetic_seed'),'orders',count(*),'hash',md5(string_agg(id::text||status||total_cents::text,',' ORDER BY id))) FROM orders.orders;").strip()==original
    report['datasetUnchanged']=True
    logs=cmd('app-logs',['logs','--no-color','--no-log-prefix','app'])
    assert 'probe_ready' in logs and 'native_http' in logs
    report['status']='PASSOU'
except Exception as exc:report['status']='FALHOU';report['failure']=str(exc)
finally:
    monitor_stop.set()
    if worker:worker.join(timeout=20)
    # Nao deixar preload/override ativo. Down preserva os dados e volumes.
    try:cmd('encerrar-preservando-volume',['--profile','tools','down']);report['stoppedPreservingVolume']=True
    except Exception as exc:report['stopError']=str(exc);report['status']='FALHOU'
    report['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
    (out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'status':report['status'],'failure':report.get('failure'),'rounds':len(report['rounds']),'output':str(out)}),flush=True)
if report['status']!='PASSOU':raise SystemExit(1)
