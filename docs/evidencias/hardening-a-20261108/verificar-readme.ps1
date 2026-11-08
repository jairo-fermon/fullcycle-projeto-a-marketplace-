$ErrorActionPreference = 'Stop'
$runDirectory = $PSScriptRoot
$checkoutDirectory = Join-Path $runDirectory 'fullcycle-projeto-a-marketplace-'
Set-Location -LiteralPath $checkoutDirectory
$checks = [System.Collections.Generic.List[object]]::new()
$report = [ordered]@{startedAt=[DateTime]::UtcNow.ToString('o');timeZone='America/Sao_Paulo';command='pwsh -NoProfile -File verificar-readme.ps1';checkout=$checkoutDirectory;projectName='fullcycle-a-hardening-20261108';addressAdaptation='PORT=3003 e JAEGER_PORT=16689, isolados; README padrao usa 3001/16687';checks=$checks}
try {
    $beforeHash = (Get-FileHash -LiteralPath '.env' -Algorithm SHA256).Hash
    $envOutput = & npm run env:init 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0 -or (Get-FileHash -LiteralPath '.env' -Algorithm SHA256).Hash -ne $beforeHash) { throw 'env:init nao preservou a configuracao' }
    $checks.Add(@{name='env:init preserva configuracao';status='PASSOU';output=$envOutput})
    $baseUrl = 'http://127.0.0.1:3003'
    $health = Invoke-RestMethod "$baseUrl/health"
    if ($health.status -ne 'ok') { throw 'Health incorreto' }
    $productBody = @{ sku="DEMO-$([guid]::NewGuid())"; name='Produto de demonstracao'; category='geral'; unitPriceCents=1500 } | ConvertTo-Json
    $product = Invoke-RestMethod -Method Post "$baseUrl/catalog/products" -ContentType 'application/json' -Body $productBody -StatusCodeVariable productStatus
    $orderBody = @{ items=@(@{productId=$product.id; quantity=2}) } | ConvertTo-Json -Depth 4
    $order = Invoke-RestMethod -Method Post "$baseUrl/orders" -ContentType 'application/json' -Body $orderBody -StatusCodeVariable orderStatus
    $paymentHeaders = @{ 'Idempotency-Key'=[guid]::NewGuid().ToString() }
    $paymentBody = @{orderId=$order.id; outcome='approve'} | ConvertTo-Json
    $attempt = Invoke-RestMethod -Method Post "$baseUrl/payments" -Headers $paymentHeaders -ContentType 'application/json' -Body $paymentBody -StatusCodeVariable attemptStatus
    $replayed = Invoke-RestMethod -Method Post "$baseUrl/payments" -Headers $paymentHeaders -ContentType 'application/json' -Body $paymentBody -StatusCodeVariable replayStatus
    if ($productStatus -ne 201 -or $orderStatus -ne 201 -or $attemptStatus -ne 202 -or $replayStatus -ne 200 -or $attempt.id -ne $replayed.id) { throw 'Criacao/replay nao corresponde ao contrato' }
    for ($i=0; $i -lt 100; $i++) {
        $payment = Invoke-RestMethod "$baseUrl/payments/$($attempt.id)"
        if ($payment.status -ne 'QUEUED') { break }
        Start-Sleep -Milliseconds 100
    }
    $paid = Invoke-RestMethod "$baseUrl/orders/$($order.id)"
    if ($payment.status -ne 'SUCCEEDED' -or $paid.status -ne 'PAID' -or $paid.totalCents -ne 3000 -or $paid.paymentReference -ne $attempt.id) { throw 'Fluxo de pagamento nao foi concluido como esperado' }
    $checks.Add(@{name='exemplo PowerShell do README';status='PASSOU';productStatus=$productStatus;orderStatus=$orderStatus;attemptStatus=$attemptStatus;replayStatus=$replayStatus;product=$product;order=$order;payment=$payment;paid=$paid})
    foreach ($case in @(@{path='/orders/invalido';expected=400},@{path='/orders/00000000-0000-4000-8000-000000000000';expected=404})) {
        $r=Invoke-WebRequest "$baseUrl$($case.path)" -SkipHttpErrorCheck
        if ([int]$r.StatusCode -ne $case.expected) { throw 'Erro HTTP inesperado' }
        $checks.Add(@{name=$case.path;status='PASSOU';expected=$case.expected;actual=[int]$r.StatusCode;body=$r.Content})
    }
    $conflictBody=@{orderId=$order.id;outcome='decline'} | ConvertTo-Json
    $conflict=Invoke-WebRequest -Method Post "$baseUrl/payments" -Headers $paymentHeaders -ContentType 'application/json' -Body $conflictBody -SkipHttpErrorCheck
    if ([int]$conflict.StatusCode -ne 409) { throw 'Conflito de chave nao foi rejeitado' }
    $checks.Add(@{name='mesma chave com payload diferente';status='PASSOU';actual=[int]$conflict.StatusCode;body=$conflict.Content})
    $firstCache=Invoke-WebRequest "$baseUrl/catalog/products?category=geral&limit=20"
    $secondCache=Invoke-WebRequest "$baseUrl/catalog/products?category=geral&limit=20"
    if ($firstCache.Headers['x-cache'][0] -ne 'miss' -or $secondCache.Headers['x-cache'][0] -ne 'hit') { throw 'Cache nao apresentou miss/hit' }
    $checks.Add(@{name='cache apos invalidacao por cadastro';status='PASSOU';first=$firstCache.Headers['x-cache'][0];second=$secondCache.Headers['x-cache'][0]})
    $metricsBefore=(Invoke-WebRequest "$baseUrl/metrics").Content
    $null=Invoke-RestMethod "$baseUrl/orders/$($order.id)"
    $metricsAfter=(Invoke-WebRequest "$baseUrl/metrics").Content
    if ($metricsBefore -eq $metricsAfter -or !$metricsAfter.Contains('http_errors_total') -or !$metricsAfter.Contains('http_request_duration_seconds_bucket') -or $metricsAfter.Contains($order.id)) { throw 'Metricas RED/labels incorretas' }
    $checks.Add(@{name='metricas RED e rota normalizada';status='PASSOU'})
    $beforeContainer=(& docker compose ps -q app).Trim()
    $restartOutput=& docker compose restart app 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) { throw 'Restart falhou' }
    $afterRestart=$null
    for ($i=0; $i -lt 100; $i++) {
        try {$afterRestart=Invoke-RestMethod "$baseUrl/orders/$($order.id)" -TimeoutSec 2;break} catch {Start-Sleep -Milliseconds 200}
    }
    $restartedContainer=(& docker compose ps -q app).Trim()
    if ($beforeContainer -ne $restartedContainer -or $afterRestart.status -ne 'PAID' -or $afterRestart.totalCents -ne 3000) { throw 'Restart isolado nao preservou o pedido' }
    $waitOutput=& docker compose up -d --wait app 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) { throw 'Readiness falhou' }
    $persisted = Invoke-RestMethod "$baseUrl/orders/$($order.id)"
    if ($persisted.id -ne $paid.id -or $persisted.status -ne 'PAID' -or $persisted.totalCents -ne 3000 -or $persisted.paymentReference -ne $attempt.id) { throw 'Pedido esperado ausente apos restart' }
    $checks.Add(@{name='persistencia apos reiniciar app';status='PASSOU';before=$paid;afterRestartBeforeUp=$afterRestart;containerBefore=$beforeContainer;containerAfterRestart=$restartedContainer;after=$persisted;restartOutput=$restartOutput;waitOutput=$waitOutput})
    $report.orderId=$order.id;$report.paymentId=$attempt.id;$report.status='PASSOU'
} catch {$report.status='FALHOU';$report.failure=$_.Exception.Message}
finally {$report.finishedAt=[DateTime]::UtcNow.ToString('o');$report | ConvertTo-Json -Depth 14 | Set-Content -LiteralPath (Join-Path $runDirectory 'readme-powershell.json') -Encoding utf8;[pscustomobject]$report | Select-Object status,failure,orderId,paymentId,startedAt,finishedAt | ConvertTo-Json}
if ($report.status -ne 'PASSOU') {exit 1}
