from pathlib import Path
import json,subprocess,datetime,urllib.request,uuid
run=Path(__file__).resolve().parent;checkout=run/'fullcycle-projeto-a-marketplace-'
manual=json.loads((run/'readme-powershell.json').read_text(encoding='utf-8-sig'));order=str(uuid.UUID(manual['orderId']));payment=str(uuid.UUID(manual['paymentId']))
report={'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'timezone':'America/Sao_Paulo','checkout':str(checkout),'checks':[]}
def command(name,args):
 r=subprocess.run(args,cwd=checkout,capture_output=True,text=True,encoding='utf-8');report['checks'].append({'name':name,'command':args,'exitCode':r.returncode,'stdout':r.stdout,'stderr':r.stderr,'status':'PASSOU'if r.returncode==0 else'FALHOU'})
 if r.returncode:raise RuntimeError(name)
 return r.stdout.strip()
def get():
 with urllib.request.urlopen('http://127.0.0.1:3003/orders/'+order,timeout=5)as r:return json.load(r)
try:
 before=get();old=command('id app antes',['docker','compose','ps','-q','app'])
 command('recriar somente app',['docker','compose','up','--no-build','--force-recreate','-d','--wait','app'])
 new=command('id app depois',['docker','compose','ps','-q','app']);after=get()
 assert old!=new and before==after and after['status']=='PAID'and after['paymentReference']==payment
 report['recreation']={'oldContainer':old,'newContainer':new,'sameOrder':True,'orderId':order,'paymentId':payment,'status':after['status'],'totalCents':after['totalCents']}
 sql=f"SELECT id,status,total_cents,payment_reference FROM orders.orders WHERE id='{order}'; SELECT count(*) AS synthetic_orders FROM orders.orders WHERE origin='synthetic_seed'; SELECT count(*) AS products FROM catalog.products; SELECT count(*) AS receipts_for_payment FROM payments.receipts WHERE payment_id='{payment}'; SELECT state,deliveries,count(*) FROM payments.jobs GROUP BY state,deliveries; SELECT count(*) AS migrations FROM schema_migrations;"
 command('SQL dados e recibo',['docker','compose','exec','-T','db','sh','-c','psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "'+sql+'"'])
 volume='fullcycle-a-hardening-20261108_marketplace-data';command('volume antes',['docker','volume','inspect','--format','{{.Name}}',volume])
 command('encerrar clone preservando volume',['docker','compose','--profile','test','--profile','tools','down'])
 command('encerrar projeto de teste fresh',['docker','compose','-p','fullcycle-a-hardening-candidate-20261108','--profile','test','down'])
 command('volume depois',['docker','volume','inspect','--format','{{.Name}}',volume])
 for project in ['fullcycle-a-hardening-20261108','fullcycle-a-hardening-candidate-20261108']:
  assert not command('containers restantes '+project,['docker','ps','-aq','--filter','label=com.docker.compose.project='+project])
 report['volumePreserved']=True;report['volumeDeletionRequested']=False;report['status']='PASSOU'
except Exception as e:report['status']='FALHOU';report['failure']=str(e)
finally:
 report['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();(run/'persistencia-encerramento.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps({'status':report['status'],'failure':report.get('failure'),'recreation':report.get('recreation'),'volumePreserved':report.get('volumePreserved')}))
if report['status']!='PASSOU':raise SystemExit(1)
