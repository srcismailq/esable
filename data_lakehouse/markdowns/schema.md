## Schema & Ingestion Log Spec: raw_metrics_store
This directory handles the raw ingestion layer configuration. All incoming data streams drop directly into a single open-schema table before dbt transformation.
## 1. Table Schema

* id (SERIAL / INT): Primary key. Automatic incrementing row tracker.
* captured_at (TIMESTAMP): The exact UTC timestamp when the record reached the database.
* metrics_payload (JSONB): Unstructured JSON block holding granular event fields, partitioned by the event_type key.

------------------------------
## 2. Payload Event Types## A. Consumer Telemetry (event_type: "consumer_telemetry")

* session_id: Unique active app instance ID string (e.g., sess_a1b2c3d4e5f6).
* user_id: Customer ID string (user_1000 to user_9999).
* user_region: Regional cluster (US-East, US-West, EU-West, AP-South).
* marketing_channel: Attribution source (TikTok_Ads, Instagram_Organic, Meta_Ads, Google_Paid, Direct_Traffic).
* app_version: Software build version (v1.0.0, v1.1.0, v1.2.0).
* device_tier: Hardware classification (Flagship or Budget).
* device_model: Exact phone model (e.g., iPhone 15 Pro, Galaxy A15).
* device_os: Operating system build (e.g., iOS 17.5, Android 11).
* feature_name: Client UI component (AI_Filter, Feed_Scroll, Profile_Edit, Checkout_Initiate).
* associated_service: Target backend microservice (ml-filter-service, core-api-worker, payment-gateway).
* http_status_code: Server response code (200 or 500).
* response_time_ms: Processing latency.
* simulated_cpu_seconds: Float tracking processing strain (high for AI_Filter; low for standard routes).
* session_duration_minutes: Active session length.

## B. Consumer Purchase (event_type: "consumer_purchase")

* purchase_id: Invoice identifier string prefixed with inv_.
* user_id: Customer ID matching the originating telemetry session.
* purchase_amount_usd: Transacted value (4.99, 9.99, 14.99, 29.99, 69.99, 99.99).
* purchase_category: Items purchased (premium_filter_unlock, monthly_subscription).

## C. Marketing Invoice (event_type: "marketing_invoice")

* log_date: Calendar date string (YYYY-MM-DD).
* ad_platform: Advertising network (TikTok_Ads, Meta_Ads, Google_Paid).
* daily_spend_usd: Budget consumed (scales 40% higher on weekends in the 3-year model).

## D. Cloud Invoice (event_type: "cloud_invoice")

* log_date: Calendar date string (YYYY-MM-DD).
* service_identifier: Microservice identity (core-api-worker, payment-gateway, ml-filter-service).
* global_compute_cost_usd: Node and container runtime processing charges.
* global_storage_cost_usd: Disk, database, and object storage charges.

------------------------------
## 3. Comparative Pipeline Execution Logic

📌 Usage Note:

* Use generate_45_day_data.py for simpler testing, verifying local environment connectivity, and rapid schema development.
* Use generate_3_year_data.py for advanced testing, optimizing production dbt scaling strategies, and validating time-series models across historical macro shifts.

| Feature / Metric | 45-Day Script (generate_45_day_data.py) | 3-Year Script (generate_3_year_data.py) |
|---|---|---|
| Timeline Span | Fixed 45 days backwards from current date. | Chronological 1,095 days (3 years) forward. |
| Record Volumetrics | Static 1,000 telemetry records per day. | Linear growth from 200 up to 1,200 rows/day cap. |
| Weekend Spikes | None (uniform daily volume). | +30% volume spike on Saturdays and Sundays. |
| Session Persistence | Regenerated completely fresh per day. | Stateful 10% midnight rollover; 3-day max cap. |
| Version Transition | Randomly distributed per record daily. | 14-day linear rollout window at boundary shifts. |
| Cost Anomaly Window | Hardcoded spike on days 12–16. | Runaway compute spike on days 1050–1055 (4.5x). |
| Memory Management | Accumulates all 45 days in RAM before bulk insert. | Streaming weekly batches (7-day flushes) to save RAM. |

