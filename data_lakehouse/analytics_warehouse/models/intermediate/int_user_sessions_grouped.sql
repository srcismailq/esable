{% set dynamic_features = dbt_utils.get_column_values(
    table=ref('stg_metrics_raw'), 
    column='feature_name',
    default=[]
) if execute else [] %}


with telemetry_events as (
    select * 
    from {{ ref('stg_metrics_raw') }}
    where event_type = 'consumer_telemetry'
),

session_aggregates as (
    select
        session_id,
        user_id,
        partition_log_date as session_date,
        user_region,
        marketing_channel,
        app_version,
        device_tier,
        device_model,
        device_os,
        
        -- Aggregate metric evaluations per session window
        count(*) as total_server_requests,
        count(case when http_status_code >= 500 then 1 end) as total_server_errors_5xx,
        sum(response_time_ms) as cumulative_response_time_ms,
        sum(simulated_cpu_seconds) as cumulative_cpu_seconds_consumed,
        max(session_duration_minutes) as final_session_duration_minutes
        {% for feature in dynamic_features %}
        , count(case when feature_name = '{{ feature }}' then 1 end) as hits_on_{{ feature | replace('-', '_') | lower }}
        {% endfor %}
       

    from telemetry_events
    group by 1, 2, 3, 4, 5, 6, 7, 8, 9

)

select * from session_aggregates
