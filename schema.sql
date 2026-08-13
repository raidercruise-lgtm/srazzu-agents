-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Define Enum Types for Workflow States
CREATE TYPE workflow_status AS ENUM (
    'PENDING_APPROVAL',
    'APPROVED',
    'DISPATCHED',
    'RUNNING',
    'COMPLETED',
    'FAILED',
    'REPLAYED',
    'REJECTED'
);

-- Core Workflows Table (Source of Truth)
CREATE TABLE IF NOT EXISTS workflows (
    id VARCHAR(64) PRIMARY KEY,
    action VARCHAR(128) NOT NULL,
    target_node VARCHAR(64),
    required_capability VARCHAR(64) DEFAULT 'general',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status workflow_status NOT NULL DEFAULT 'PENDING_APPROVAL',
    result JSONB DEFAULT '{}'::jsonb,
    executed_by VARCHAR(64),
    error_message TEXT,
    retry_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Approvals Table (Audit Trail)
CREATE TABLE IF NOT EXISTS workflow_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id VARCHAR(64) NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    approved_by VARCHAR(128) NOT NULL,
    reason TEXT,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dead Letter Queue (DLQ) Stranded Tracking Table
CREATE TABLE IF NOT EXISTS dead_letter_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id VARCHAR(64) NOT NULL UNIQUE REFERENCES workflows(id) ON DELETE CASCADE,
    failure_reason TEXT NOT NULL,
    last_node_id VARCHAR(64),
    payload_snapshot JSONB NOT NULL,
    replayed_by VARCHAR(128),
    stranded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON workflows(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dlq_workflow_id ON dead_letter_queue(workflow_id);