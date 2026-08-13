# ==============================================================================
# AOC Engine Platform E2E Integration Suite
# ==============================================================================

$ErrorActionPreference = "Stop"
$BASE_URL = "http://localhost:8000"

# --- Helper Functions ---
function Assert-Equal {
    param(
        [Parameter(Mandatory=$true)] $Actual,
        [Parameter(Mandatory=$true)] $Expected,
        [Parameter(Mandatory=$true)] [string]$TestName
    )
    if ($Actual -eq $Expected) {
        Write-Host "  [PASS] $TestName (Expected: '$Expected', Got: '$Actual')" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] $TestName (Expected: '$Expected', Got: '$Actual')" -ForegroundColor Red
        throw "Assertion failed for $TestName"
    }
}

function Write-DomainHeader {
    param([string]$Title)
    Write-Host "`n==================================================" -ForegroundColor Cyan
    Write-Host " DOMAIN: $Title" -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
}

# Clear any lingering variable scope
Remove-Variable reg_res, hb_res, trig_res, wf_id, appr_res, cb1_res, cb2_res, dlq_res, dash_res, replay_res -ErrorAction SilentlyContinue

try {
    # --------------------------------------------------------------------------
    # 1. ADMINISTRATION & HEALTH API
    # --------------------------------------------------------------------------
    Write-DomainHeader "1. Administration & System Health"
    
    $dash_res = Invoke-RestMethod -Uri "$BASE_URL/dashboard" -Method Get
    Write-Host "  [INFO] Connected to engine. Current Total Workflows: $($dash_res.total_workflows)" -ForegroundColor Gray
    Assert-Equal -Actual ($dash_res.PSObject.Properties.Name -contains "total_workflows") -Expected $true -TestName "Dashboard Endpoint Responding"

    # --------------------------------------------------------------------------
    # 2. WORKER API (Registration & Telemetry Heartbeat)
    # --------------------------------------------------------------------------
    Write-DomainHeader "2. Worker Management Domain"

    $worker_node = "worker-suite-01"
    $reg_payload = @{
        node_id = $worker_node
        capabilities = @("cuda", "ml_inference", "general")
        max_concurrency = 4
    } | ConvertTo-Json

    $reg_res = Invoke-RestMethod -Uri "$BASE_URL/workers/register" -Method Post -ContentType "application/json" -Body $reg_payload
    Write-Host "  [INFO] Registered Worker: $worker_node" -ForegroundColor Gray

    $hb_payload = @{
        node_id = $worker_node
        cpu_pct = 22.5
        mem_free_mb = 32768
        active_tasks = 0
        status = "HEALTHY"
    } | ConvertTo-Json

    $hb_res = Invoke-RestMethod -Uri "$BASE_URL/workers/heartbeat" -Method Post -ContentType "application/json" -Body $hb_payload
    Write-Host "  [INFO] Dispatched Heartbeat for $worker_node" -ForegroundColor Gray

    # --------------------------------------------------------------------------
    # 3. WORKFLOW & SCHEDULER API (Trigger & Lease Assignment)
    # --------------------------------------------------------------------------
    Write-DomainHeader "3. Workflow Lifecycle & Dispatch Domain"

    $trig_payload = @{
        action = "MODEL_EVALUATION"
        required_capability = "cuda"
        max_retries = 1
        payload = @{ model = "llama3-70b"; context_window = 8192 }
    } | ConvertTo-Json

    $trig_res = Invoke-RestMethod -Uri "$BASE_URL/workflows/trigger" -Method Post -ContentType "application/json" -Body $trig_payload
    $wf_id = $trig_res.workflow_id
    
    Assert-Equal -Actual ($wf_id -like "wf-*") -Expected $true -TestName "Workflow Trigger Generated Workflow ID"

    # --------------------------------------------------------------------------
    # 4. APPROVAL API (Manual Gate Execution)
    # --------------------------------------------------------------------------
    Write-DomainHeader "4. Approval Control Plane Domain"

    $appr_payload = @{ approved_by = "lead_operator" } | ConvertTo-Json
    $appr_res = Invoke-RestMethod -Uri "$BASE_URL/workflows/$wf_id/approve" -Method Post -ContentType "application/json" -Body $appr_payload

    Assert-Equal -Actual $appr_res.status -Expected "APPROVED" -TestName "Workflow Status Changed to APPROVED"
    Assert-Equal -Actual $appr_res.dispatched -Expected $true -TestName "Scheduler Dispatched Job"
    Assert-Equal -Actual $appr_res.assigned_node -Expected $worker_node -TestName "Assigned to Capable Worker Node"

    # --------------------------------------------------------------------------
    # 5. FAILOVER & CALLBACK API (Retry Threshold Verification)
    # --------------------------------------------------------------------------
    Write-DomainHeader "5. Runtime Callbacks & Self-Healing Engine"

    # Attempt 1: First Failure (Should Trigger Retry)
    $cb1_payload = @{ status = "FAILED"; node_id = $worker_node; error = "CUDA Out of Memory Error" } | ConvertTo-Json
    $cb1_res = Invoke-RestMethod -Uri "$BASE_URL/workflows/$wf_id/callback" -Method Post -ContentType "application/json" -Body $cb1_payload

    Assert-Equal -Actual $cb1_res.status -Expected "RETRYING" -TestName "First Failure Shifted Status to RETRYING"
    Assert-Equal -Actual $cb1_res.attempt -Expected 1 -TestName "Attempt Counter Incremented to 1"

    # Attempt 2: Second Failure (Exceeds max_retries = 1 -> Should Land in DLQ)
    $cb2_payload = @{ status = "FAILED"; node_id = $worker_node; error = "Persistent Memory Exhaustion" } | ConvertTo-Json
    $cb2_res = Invoke-RestMethod -Uri "$BASE_URL/workflows/$wf_id/callback" -Method Post -ContentType "application/json" -Body $cb2_payload

    Assert-Equal -Actual $cb2_res.status -Expected "STRANDED" -TestName "Retry Exhaustion Transitioned Status to STRANDED"
    Assert-Equal -Actual $cb2_res.moved_to_dlq -Expected $true -TestName "Workflow Flagged as Moved to DLQ"

    # --------------------------------------------------------------------------
    # 6. DLQ & REPLAY API (Audit, Isolation & Rescue)
    # --------------------------------------------------------------------------
    Write-DomainHeader "6. Dead Letter Queue & Operations Domain"

    $dlq_res = Invoke-RestMethod -Uri "$BASE_URL/dlq/all" -Method Get
    $stranded_ids = $dlq_res.stranded_jobs.id

    Assert-Equal -Actual ($stranded_ids -contains $wf_id) -Expected $true -TestName "Stranded Workflow Present in DLQ Endpoint"

    # Replay Stranded Job with Updated Parameters
    $replay_payload = @{
        replayed_by = "sysadmin_ops"
        updated_payload = @{ model = "llama3-70b"; context_window = 4096; quantized = $true }
    } | ConvertTo-Json

    $replay_res = Invoke-RestMethod -Uri "$BASE_URL/workflows/$wf_id/replay" -Method Post -ContentType "application/json" -Body $replay_payload

    Assert-Equal -Actual $replay_res.status -Expected "REPLAYED" -TestName "Replay Endpoint Returned REPLAYED Status"
    Assert-Equal -Actual $replay_res.task_data.status -Expected "PENDING_APPROVAL" -TestName "Task State Cleared back to PENDING_APPROVAL"
    Assert-Equal -Actual $replay_res.task_data.retry_count -Expected 0 -TestName "Task Retry Count Reset to 0"

    # --------------------------------------------------------------------------
    # SUITE SUMMARY
    # --------------------------------------------------------------------------
    Write-Host "`n==================================================" -ForegroundColor Green
    Write-Host " 🎉 ALL E2E PLATFORM TESTS PASSED SUCCESSFULLY! " -ForegroundColor Green
    Write-Host "==================================================" -ForegroundColor Green

} catch {
    Write-Host "`n==================================================" -ForegroundColor Red
    Write-Host " ❌ SUITE EXECUTION FAILED" -ForegroundColor Red
    Write-Host " Error Details: $_" -ForegroundColor Red
    Write-Host "==================================================" -ForegroundColor Red
}