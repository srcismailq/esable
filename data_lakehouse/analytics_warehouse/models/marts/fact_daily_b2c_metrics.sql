-- FIXED: Execution guard applied to protect bootstrapping runs
{% set dynamic_features = dbt_utils.get_column_values(
    table=ref('stg_metrics_raw'), 
    column='feature_name',
    default=[]
) if execute else [] %}

with session_base as (
    select * from {{ ref('int_user_sessions_grouped') }}
),

purchases_base as (
    select
        user_id,
        payload_timestamp::date as purchase_date,
        sum(purchase_amount_usd) as total_revenue_usd,
        count(case when purchase_category = 'premium_filter_unlock' then 1 end) as total_premium_filter_unlocks,
        count(case when purchase_category = 'monthly_subscription' then 1 end) as total_monthly_subscriptions
    from {{ ref('stg_metrics_raw') }}
    where event_type = 'consumer_purchase'
    group by 1, 2
),

-- FIXED: Marketing spend aggregated cleanly at the date level to eliminate row loop subqueries
marketing_daily as (
    select
        partition_log_date as billing_date,
        sum(daily_spend_usd) as total_marketing_spend_usd
    from {{ ref('stg_metrics_raw') }}
    where event_type = 'marketing_invoice'
    group by 1
),

-- FIXED: Cloud costs pivoted by service at the date level to allow fast hash joins
cloud_daily as (
    select
        partition_log_date as billing_date,
        sum(case when service_identifier = 'ml-filter-service' then global_compute_cost_usd else 0 end) as ml_compute_cost_usd,
        sum(case when service_identifier = 'core-api-worker' then global_compute_cost_usd else 0 end) as core_compute_cost_usd,
        sum(global_storage_cost_usd) as shared_storage_cost_usd
    from {{ ref('stg_metrics_raw') }}
    where event_type = 'cloud_invoice'
    group by 1
),

global_daily_baselines as (
    select
        session_date,
        device_tier,
        sum(total_server_requests) as global_total_requests,
        sum(cumulative_cpu_seconds_consumed) as global_total_cpu_seconds,
        count(*) as total_sessions_in_tier
    from session_base
    group by 1, 2
),

daily_session_counts as (
    select
        session_date,
        count(*) as global_total_sessions
    from session_base
    group by 1
),

final_metrics_allocated as (
    select
        s.session_date,
        s.session_id,
        s.user_id,
        s.user_region,
        s.marketing_channel,
        s.app_version,
        s.device_tier,
        s.device_model,
        s.device_os,
        
        s.total_server_requests,
        s.total_server_errors_5xx,
        s.cumulative_response_time_ms,
        s.cumulative_cpu_seconds_consumed,
        s.final_session_duration_minutes,
        
        -- FIXED: Pull the pre-calculated dynamic feature metrics from our intermediate layer instantly
        {% for feature in dynamic_features %}
        s.hits_on_{{ feature | replace('-', '_') | lower }},
        {% endfor %}

        coalesce(p.total_revenue_usd, 0.00) as individual_revenue_usd,
        coalesce(p.total_premium_filter_unlocks, 0) as individual_premium_unlocks,
        coalesce(p.total_monthly_subscriptions, 0) as individual_monthly_subs,
        
        -- FIXED: Proportional cost allocation engine using high-performance relational joins
        round(
            (s.cumulative_cpu_seconds_consumed / nullif(g.global_total_cpu_seconds, 0)) * coalesce(c.ml_compute_cost_usd, 0.00),
            4
        ) as attributed_ml_compute_cost_usd,
        
        round(
            (s.total_server_requests / nullif(g.global_total_requests, 0)) * coalesce(c.core_compute_cost_usd, 0.00),
            4
        ) as attributed_core_compute_cost_usd,
        
        round(
            (1.0 / nullif(g.total_sessions_in_tier, 0)) * coalesce(c.shared_storage_cost_usd, 0.00),
            4
        ) as attributed_shared_storage_cost_usd,

        -- FIXED: Attribute marketing costs proportionally per session to satisfy your balance sheet requirements
        round(
            coalesce(m.total_marketing_spend_usd, 0.00) / nullif(dsc.global_total_sessions, 0),
            4
        ) as attributed_marketing_cac_usd

    from session_base s
    left join purchases_base p 
      on s.user_id = p.user_id 
     and s.session_date = p.purchase_date
    left join global_daily_baselines g 
      on s.session_date = g.session_date 
     and s.device_tier = g.device_tier
    left join daily_session_counts dsc
      on s.session_date = dsc.session_date
    -- Clean relational joins to completely eliminate correlated scalar subqueries
    left join cloud_daily c 
      on s.session_date = c.billing_date
    left join marketing_daily m 
      on s.session_date = m.billing_date
)

select 
    *,
    -- FIXED: Net margin calculation accounting for both infrastructure footprints AND user acquisition costs
    (individual_revenue_usd - (attributed_ml_compute_cost_usd + attributed_core_compute_cost_usd + attributed_shared_storage_cost_usd + attributed_marketing_cac_usd)) as calculated_net_profit_usd
from final_metrics_allocated
