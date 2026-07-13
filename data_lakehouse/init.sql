-- Create the main landing database if it doesn't exist
CREATE DATABASE metrics_lakehouse;

-- Switch context to ensure the table builds inside the correct database during container boot
\c metrics_lakehouse;

-- Create the single, open Data Lake landing table
CREATE TABLE IF NOT EXISTS raw_metrics_store (
    -- Modern SQL standard supporting high-throughput ingestion without ID overflow
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metrics_payload JSONB NOT NULL
);

-- Apply a B-Tree index on the timestamp column for efficient batch timeline slicing
CREATE INDEX IF NOT EXISTS idx_raw_metrics_captured_at ON raw_metrics_store (captured_at DESC);

-- LOCAL TESTING NOTE: This GIN index is included ONLY for local developer troubleshooting.
-- PROD NOTE: Remove this index in production to maximize ingestion write speeds, 
-- as analysts will query downstream dbt/columnar marts rather than raw JSONB.
CREATE INDEX IF NOT EXISTS idx_raw_metrics_payload_gin ON raw_metrics_store USING gin (metrics_payload);
