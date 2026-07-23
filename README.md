# Esable

An AI FinOps layer deployed on Minikube. It uses a stateful LangGraph AI agent to query a Cube.js semantic layer, which runs over a dbt transformation pipeline fed by a Postgres JSONB data lakehouse.

---

## Architecture

```text
[ THE RUNTIME QUERY PATH ]                  [ THE BACKGROUND BATCH PATH ]

      [ User CLI ]                                [ App/Cloud Logs ]
           │                                              │
           ▼                                              ▼
  [ finops_ai_client ] <──> [ Groq LLM ]            [ data_lakehouse ]
           │               (Constrained)            (Raw JSONB Tables)
           │                                              │
           ▼ (Cube JSON Query)                            │ (dbt run / Batch)
     [ cube_api ]                                         ▼
   (Semantic Layer)                          [ analytics_warehouse ]
           │                                 (Materialized Mart Tables)
           │                                              │
           └───────────> [ Reads From ] <─────────────────┘
```

---

## Project Layout

```text
.
├── data_lakehouse/            
│   └── analytics_warehouse/   # dbt project root
│       ├── dbt_project.yml    
│       └── models/            # Staging, Intermediate, Marts
├── cube_api/                  # Cube code & manifests
│   └── schema/                # DailyB2cMetrics.yml
└── finops_ai_client/          # Python AI code root
    └── client_engine/         # config, translator, synthesizer, graph_engine, cli
```

---

## Database Schema

The Postgres landing table uses three columns: `id` (Serial), `captured_at` (Timestamp), and `metrics_payload` (JSONB). The payload stores 4 distinct data shapes differentiated by `event_type`:

1. **consumer_telemetry**: `session_id`, `user_id`, `user_region`, `marketing_channel`, `app_version`, `device_model`, `device_os`, `api_endpoint`, `feature_name`, `http_status_code`, `response_time_ms`, `simulated_cpu_seconds`, `session_duration_minutes`.
2. **consumer_purchase**: `purchase_id`, `user_id`, `purchase_amount_usd`, `purchase_category`.
3. **marketing_invoice**: `log_date`, `ad_platform`, `daily_spend_usd`.
4. **cloud_invoice**: `log_date`, `global_compute_cost_usd`, `global_storage_cost_usd`.

---

## dbt Pipeline

Configured in `dbt_project.yml` across 3 processing tiers:

* **Staging** (`models/staging/`): Unpacks JSONB keys with explicit type-casting. Applies data quality tests (`not_null`, `unique`).
* **Intermediate** (`models/intermediate/`): Groups telemetry records to build an analytical user-session backbone.
* **Marts** (`models/marts/`): Runs a Proportional Cost Allocation Engine. Calculates infrastructure spend decimals per user action based on CPU seconds. Uses Jinja loops to dynamically expand feature columns.

---

## Cube.js Mapping

```yaml
cubes:
  - name: DailyB2cMetrics
    sql: SELECT * FROM analytics_marts.fact_daily_b2c_metrics

    refresh_key:
      sql: SELECT MAX(session_date) FROM analytics_marts.fact_daily_b2c_metrics

    measures:
      - name: total_sessions
        type: count
      - name: total_requests
        sql: total_server_requests
        type: sum
      - name: total_errors_5xx
        sql: total_server_errors_5xx
        type: sum
      - name: cumulative_cpu_seconds_consumed
        sql: cumulative_cpu_seconds_consumed
        type: sum
      - name: individual_revenue_usd
        sql: individual_revenue_usd
        type: sum
        format: currency
      - name: net_profit_usd
        sql: calculated_net_profit_usd
        type: sum
        format: currency

    dimensions:
      - name: session_id
        sql: session_id
        type: string
        primary_key: true
      - name: user_id
        sql: user_id
        type: string
      - name: session_date
        sql: session_date
        type: time
```

---

## AI Engine Constraints

* **translator.py**: Enforces strict Pydantic parsing (`strict: True`) to guarantee the LLM outputs valid JSON query arrays matching Cube schema Enums.
* **synthesizer.py**: Set to `temperature: 0.0` with strict XML prompt shielding. Forbidden from executing internal calculations; acts solely as a data narrator.
* **graph_engine.py**: LangGraph engine using unified circuit-breaker edges to mathematically block prompt loops.
* **cli.py**: Thread-delegated async loop shell. Handles inputs inside `asyncio.to_thread` to isolate interruptions without creating background zombie tasks.

---

## Installation & Setup

### 1. Provision Infrastructure

```bash
minikube start --cpus=4 --memory=8192

# Deploy Postgres Lakehouse
cd data_lakehouse
kubectl apply -f postgres_pvc.yaml
kubectl apply -f postgres-lakehouse.yaml

# Deploy Cube API Layer
cd ../cube_api
kubectl apply -f cube-deployment.yaml
kubectl apply -f dailymetricsb2c.yaml
```

### 2. Forward Network Tunnels

Open a terminal split or background process to route traffic:

```bash
kubectl port-forward svc/cube-api-service 4000:4000
kubectl port-forward svc/postgres-lakehouse-service 5432:5432
```

### 3. Run dbt Transforms

Add your target properties to your global dbt configuration file (`~/.dbt/profiles.yml`):

```yaml
analytics_warehouse:
  outputs:
    dev:
      type: postgres
      host: 127.0.0.1
      port: 5432
      user: lakehouse_admin
      password: lakehouse_secure_pass123
      dbname: postgres
      schema: analytics_marts
      threads: 4
  target: dev
```

Execute the compilation:

```bash
cd data_lakehouse/analytics_warehouse
dbt debug
dbt run
dbt test
```

### 4. Initialize AI Runtime

```bash
cd ../../finops_ai_client
python -m venv venv
# On macOS/Linux:
source venv/bin/activate 
# On Windows:
# venv\Scripts\activate

pip install -r requirements.txt
```

Configure environment variables:

```bash
# finops_ai_client/.env
CUBE_API_URL="http://localhost:4000/cubejs-api/v1"
CUBE_API_SECRET="your_cube_jwt_generation_secret"
GROQ_API_KEY="gsk_your_validated_groq_cloud_key"
MODEL_TARGET="llama3-70b-8192"
```

Launch the system:

```bash
python -m client_engine.cli
```
