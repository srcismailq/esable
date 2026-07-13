with raw_source as (
    select
        id as raw_record_id,
        -- This is our native, high-precision Postgres database column
        captured_at as ingestion_timestamp,
        metrics_payload
    from {{ source('raw_lakehouse', 'raw_metrics_store') }}
),

unpacked_payloads as (
    select
        raw_record_id,
        ingestion_timestamp,
        
        -- FIXED SOLUTION 1: Map the structured parent column directly as the timeline timestamp
        ingestion_timestamp as payload_timestamp,
        
        -- Extract the root event type handle required for downstream routing
        metrics_payload->>'event_type' as event_type,
        metrics_payload->>'user_id' as user_id,
        
        -- Unpack Consumer Telemetry attributes
        metrics_payload->>'session_id' as session_id,
        metrics_payload->>'user_region' as user_region,
        metrics_payload->>'marketing_channel' as marketing_channel,
        metrics_payload->>'app_version' as app_version,
        metrics_payload->>'device_tier' as device_tier,
        metrics_payload->>'device_model' as device_model,
        metrics_payload->>'device_os' as device_os,
        metrics_payload->>'feature_name' as feature_name,
        metrics_payload->>'associated_service' as associated_service,
        (metrics_payload->>'http_status_code')::integer as http_status_code,
        (metrics_payload->>'response_time_ms')::integer as response_time_ms,
        (metrics_payload->>'simulated_cpu_seconds')::numeric(10, 4) as simulated_cpu_seconds,
        (metrics_payload->>'session_duration_minutes')::integer as session_duration_minutes,
        
        -- Unpack Consumer Purchase attributes
        metrics_payload->>'purchase_id' as purchase_id,
        (metrics_payload->>'purchase_amount_usd')::numeric(10, 2) as purchase_amount_usd,
        metrics_payload->>'purchase_category' as purchase_category,
        
        -- Unpack Marketing Invoice attributes
        metrics_payload->>'ad_platform' as ad_platform,
        (metrics_payload->>'daily_spend_usd')::numeric(10, 2) as daily_spend_usd,
        
        -- Unpack Cloud Invoice attributes
        metrics_payload->>'service_identifier' as service_identifier,
        (metrics_payload->>'global_compute_cost_usd')::numeric(10, 2) as global_compute_cost_usd,
        (metrics_payload->>'global_storage_cost_usd')::numeric(10, 2) as global_storage_cost_usd,
        
        -- FIXED SOLUTION 2: Safely combine strings and timestamps, then enforce a native, optimized DATE data type
        coalesce(
            metrics_payload->>'log_date',
            ingestion_timestamp::date::text
        )::date as partition_log_date

    from raw_source
)

select * from unpacked_payloads
