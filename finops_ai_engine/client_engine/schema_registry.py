from enum import StrEnum

class Measures(StrEnum):
    """
    Rigid structural definitions for every aggregatable numerical metric
    exposed by the DailyB2cMetrics Cube schema layer.
    """
    TOTAL_SESSIONS = "DailyB2cMetrics.total_sessions"
    TOTAL_REQUESTS = "DailyB2cMetrics.total_requests"
    TOTAL_ERRORS_5XX = "DailyB2cMetrics.total_errors_5xx"
    CUMULATIVE_RESPONSE_TIME = "DailyB2cMetrics.cumulative_response_time_ms"
    CUMULATIVE_CPU_SECONDS = "DailyB2cMetrics.cumulative_cpu_seconds_consumed"
    FINAL_SESSION_DURATION = "DailyB2cMetrics.final_session_duration_minutes"
    INDIVIDUAL_REVENUE = "DailyB2cMetrics.individual_revenue_usd"
    PREMIUM_UNLOCKS = "DailyB2cMetrics.individual_premium_unlocks"
    MONTHLY_SUBS = "DailyB2cMetrics.individual_monthly_subs"
    ML_COMPUTE_COST = "DailyB2cMetrics.attributed_ml_compute_cost_usd"
    CORE_COMPUTE_COST = "DailyB2cMetrics.attributed_core_compute_cost_usd"
    SHARED_STORAGE_COST = "DailyB2cMetrics.attributed_shared_storage_cost_usd"
    MARKETING_CAC = "DailyB2cMetrics.attributed_marketing_cac_usd"
    NET_PROFIT = "DailyB2cMetrics.net_profit_usd"


class Dimensions(StrEnum):
    """
    Rigid structural tokens for categorization, slicing, and grouping 
    operations across text-based columns.
    """
    SESSION_ID = "DailyB2cMetrics.session_id"
    USER_ID = "DailyB2cMetrics.user_id"
    USER_REGION = "DailyB2cMetrics.user_region"
    MARKETING_CHANNEL = "DailyB2cMetrics.marketing_channel"
    APP_VERSION = "DailyB2cMetrics.app_version"
    DEVICE_TIER = "DailyB2cMetrics.device_tier"
    DEVICE_MODEL = "DailyB2cMetrics.device_model"
    DEVICE_OS = "DailyB2cMetrics.device_os"


class TimeDimensions(StrEnum):
    """
    Strict isolation parameter for date vectors to prevent the engine 
    from misallocating time series fields into standard dimension arrays.
    """
    SESSION_DATE = "DailyB2cMetrics.session_date"
