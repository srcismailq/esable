## Esable
A FinOps assistant that lets you query your product's financial health in simple plain english, without having to manually query a db. 

Just ask "which marketing channels are producing the highest return on investment in the last 6 months?" and see data grounded in your telemetry.

> 💡 **Architectural Pragmatism: Why Postgres for a "Lakehouse"?**
> 
> In a production enterprise environment, this engine would sit on top of a true distributed cloud data lakehouse (e.g., AWS S3/Iceberg + Snowflake, Databricks, or BigQuery). 
> 
> For this local sandbox, **PostgreSQL with `jsonb` is used to simulate a Medallion Architecture** without requiring expensive cloud infrastructure or complex external authentication. The 3-tier dbt pipeline mirrors production lakehouse stages exactly:
> * **Staging Tier (`stg_metrics_raw`)** acts as the **Bronze Layer**, isolating semi-structured raw telemetry dumps.
> * **Intermediate Tier (`int_user_sessions_grouped`)** acts as the **Silver Layer**, sessionizing and cleaning the records.
> * **Analytical Marts (`fact_daily_b2c_metrics`)** acts as the **Gold Layer**, serving highly optimized, cost-allocated dimensions to the Cube.js semantic engine.
> 
> This approach keeps the entire stack completely self-contained, **100% free to run**, and capable of spinning up locally in Minikube in under 5 minutes.


⚡ **Quick Links**: [Architectural Guardrails](#-1-architectural-guardrails) | [Data Transformation & Cost Allocation](#-2-data-transformation--proportional-cost-allocation) | [Infrastructure Topology](#-3-sandboxed-storage--infrastructure-topology) | [Installation Runbook](#setup)
------------------------------
## 🔎 1. Architectural Guardrails
Placing a traditional natural language interface directly over an analytical database creates severe production vulnerabilities: schema drift/hallucination, positional inversion of parameters inside generated arrays, and prompt injections that can thrash cluster compute.
This platform completely strips the LLM of conversational autonomy, treating the model as a strict translation compiler backed by deterministic runtime constraints.
## A. Logit-Layer Constrained Decoding
To eliminate field invention, the engine locks the remote model's logit-layer sampling options directly to compile-time source code constants.

* The Mechanic: Native Python Enums represent your verified data warehouse targets (Measures, Dimensions, TimeDimensions). These form a master schema layer managed via pydantic==2.13.4.
* The Execution Path: The runtime extracts the dynamic JSON structure via CubeQueryModel.model_json_schema() and injects it straight into the Groq API payload config:

response_format={"type": "json_schema", "json_schema": {"strict": True, "schema": target_json_schema}}

* The Rationale: Activating strict: True forces the inference engine to limit its logit decoding. Tokens missing from your codebase Enums are mathematically assigned a sampling probability weight of zero, stopping hallucinations before text generation begins.

## B. Array Geometry Locking & Post-Processing Gates

* The Mechanic: Multi-dimensional sorting rules are explicitly typed using native Python tuples inside the Pydantic schema: List[tuple[str, Literal["asc", "desc"]]].
* The Execution Path: Pydantic builds this down to an OpenAPI schema utilizing strict prefixItems constraints. On the return path, a local @model_validator(mode="after") interceptor isolates the array to catch duplicate sort conditions or corrupted token strings.
* The Rationale: This physically prevents the LLM from swapping structural array index positions (e.g., flipping the column target and the sort direction string) while providing a client-side defensive boundary before requests hit internal microservices.

## C. Stateless Execution Loops & Circuit Breaking
Traditional agent architectures maintain long-lived state tables or append-only message logs, resulting in bloated prompt envelopes, infinite self-correction loops, and zombie background processes.

* The Mechanic: Tracking context is managed via a strict TypedDict (EngineState) containing only five immutable keys: user_query, cube_json_query, api_response, final_answer, and error_message.
* The Execution Path: Built on langgraph==1.2.11, every transaction executes as an atomic, clean-slate event using key overwrites. Long-lived connection instances (AsyncGroq and httpx.AsyncClient) are passed cleanly into execution blocks via RunnableConfig envelopes.
* The Rationale: Eliminating history accumulators guarantees zero context drift and flat token consumption bills. Network timeouts or validation faults write immediately to error_message, triggering a centralized conditional edge routing function (route_circuit_breaker) that terminates the graph run (END) instantly to shield internal cluster infrastructure.

------------------------------
## 📊 2. Data Transformation & Proportional Cost Allocation
High-frequency telemetry data streams cannot be parsed by downstream semantic API layers without hitting schema fragmentation or nested column compilation faults. This project implements a decoupled, multi-tier compilation pipeline via dbt-postgres==1.11.0 to sanitize records and distribute global enterprise operational spend accurately down to individual user rows.
## A. The 3-Tier dbt Architecture

* Tier 1: Staging (stg_metrics_raw.sql): Isolates raw unstructured JSONB landing payloads. Extracts target data points via explicit JSON operators (metrics_payload->>'key'), enforces strict numeric casting, and sanitizes timelines using fallback rules: coalesce(metrics_payload->>'log_date', ingestion_timestamp::date::text)::date.
* Tier 2: Intermediate Sessionization (int_user_sessions_grouped.sql): Aggregates continuous request volumes, hardware performance latencies, and server-side errors, grouping metrics by unique session windows. Uses dynamic Jinja loops to scan live records and automatically compile structured feature tracking fields on the fly without breaking backward compatibility.
* Tier 3: Analytical Marts (fact_daily_b2c_metrics.sql): Houses the cost distribution tables. Isolates daily corporate infrastructure invoices, computing allocations using clean relational LEFT JOIN statements to optimize the Postgres query planner.

## B. Proportional Cost Allocation Specifications
To distribute flat business overhead precisely across granular tracking dimensions, the engine executes four distinct mathematical distribution models with built-in zero-division safety rules (nullif(..., 0)):

### B. Proportional Cost Allocation Engine
To distribute flat business overhead precisely across granular tracking dimensions, the engine executes four automated distribution models with built-in zero-division safety rules:

* **Machine Learning Compute Footprint:** Tracks individual session CPU execution times against total daily cluster consumption to attribute proportionate resource costs.
* **Core Application Server Traffic Load:** Distributes primary compute bills relative to a session's request volume against system global traffic.
* **Infrastructure Storage Scaling Overhead:** Spreads flat database storage overhead evenly across active user nodes, grouped by their specific hardware device footprints.
* **User Acquisition Cost (CAC) Amortization:** Maps high-level company marketing spend flatly across all recorded user transactions for that calendar day.
* **Absolute Row Net Profit Dimension:** Combines granular revenue streams and allocated infrastructure cost outputs to calculate a true, verified net profit margin field for every record. 

------------------------------
## ⎈ 3. Sandboxed Storage & Infrastructure Topology
Deploying semantic design frameworks like Cube.js inside Kubernetes introduces configuration management issues. Standard ConfigMap mounts leverage an internal Kubelet subsystem that builds an expansive folder hierarchy of hidden directories and tracking symlinks to enable hot-reloads. Semantic file engines recursively parse these paths as duplicate files, throwing fatal schema registration collisions.
## A. The Kubernetes InitContainer Sandbox Pattern
The platform cleanly decouples live storage volumes from active runtime clients by executing a three-stage file extraction sandbox:

   1. Volume Layout: The deployment configuration provisions two independent storage entities: a native Kubernetes ConfigMap (configmap-volume) containing your semantic layer schemas and a temporary unmanaged memory block (shared-model-volume) structured as an emptyDir: {}.
   2. The Extraction Phase: A lightweight, isolated busybox:1.36 initialization container maps both volumes and runs a strict flat file extraction command:
   
   cp /mnt/configmap/DailyB2Cmetrics.yaml /cube/conf/model/DailyB2Cmetrics.yaml
   
   3. Application Bootstrapping: The copy step resolves the underlying symlinks, extracting the model files cleanly. The initialization container exits, and the main application container (cubejs/cube:v0.36) fires up, mounting the unmanaged emptyDir as its sole schema directory. Its file scanner detects a single text file, bypassing registration crashes.

## B. Environment Blueprint Reference Specification
```json
{
  "infrastructure_cluster": {
    "orchestrator": "Minikube",
    "compute_allocation": { "cpus": 4, "memory_mb": 8192 }
  },
  "database_tier": {
    "engine": "PostgreSQL 15-Alpine",
    "simulated_role": "Local Lakehouse Sandbox (Medallion Pattern)",
    "deployment_type": "StatefulSet",
    "storage": {
      "class": "standard",
      "access_mode": "ReadWriteOnce",
      "capacity": "2Gi"
    },
    "networking": { "service_type": "ClusterIP", "internal_port": 5432 }
  },
  "semantic_tier": {
    "engine": "Cube.js v0.36",
    "deployment_type": "Deployment",
    "sandboxing": {
      "init_image": "busybox:1.36",
      "shared_volume": "emptyDir",
      "source_volume": "ConfigMap"
    },
    "networking": { "service_type": "ClusterIP", "internal_port": 4000 }
  }
}
```
*** 
## <a id="setup"></a> 🛠️ 4. Installation Runbook

Follow this chronological sequence to provision the local infrastructure, simulate three years of raw telemetry data, and launch the conversational FinOps engine.

### 1. Provision Cluster Infrastructure
Spin up a localized Kubernetes cluster with adequate hardware resources and deploy your data lakehouse and semantic layer manifests.

```bash
# Note: Initial Setup for individual pods may take a while, if pods seem stuck, wait for 2-3 minutes. 

# Start Minikube with dedicated resources
minikube start --cpus=4 --memory=8192

# Deploy Postgres Lakehouse Persistence Tier
cd data_lakehouse
kubectl create configmap postgres-init-config --from-file=init.sql
kubectl apply -f postgres-pvc.yaml
kubectl apply -f postgres-lakehouse.yaml


# Deploy Cube.js Semantic API Layer (Bypasses symlink collisions via InitContainer)
cd ../cube_api
kubectl create configmap cube-schema-config --from-file=DailyB2CMetrics.yml
kubectl apply -f cube-deployment.yaml
```

### 2. Forward Network Tunnels
Route container traffic out of your isolated Minikube network to your local host runtime. 

> 💡 **Note:** Open a separate terminal window or tab to run these commands so they can remain active in the background. Wait for the pods to change status to Running before executing these.

```bash
kubectl port-forward svc/cubejs-service 4000:4000
# In another terminal window:
kubectl port-forward svc/postgres-lakehouse-service 5432:5432
```

### 3. Initialize Python Virtual Environment
Navigate back to your project root to initialize a unified virtual environment. This shared space isolates all global dependencies for your dbt core models, the raw mock data generator, and the conversational AI client.

```bash
# Jump up to the project root directory
cd ..

# Initialize the shared virtual environment at the root level
python -m venv venv

# Activate the virtual environment
# On macOS/Linux:
source venv/bin/activate 
# On Windows:
venv\Scripts\activate

# Install all workspace dependencies from the root directory
pip install -r requirements.txt
```

### 4. Seed the 3-Year Chronological Simulated Lakehouse
Execute your background pipeline script to truncate the landing tables and inject a memory-safe, 3-year chronological stream of simulated application telemetry, weekend volume spikes, code version rollouts, and infrastructure invoice anomalies.

```bash
cd data_lakehouse/mock_data_generation
python generate_3_year_data.py
```

### 5. Compile and Execute dbt Analytical Marts
Since your database credentials map to a local playground environment, your profiles configurations are checked in right at the project root directory. Compile your models and execute automated data assertions effortlessly without modifying a global system file.

```bash
cd ../analytics_warehouse

# Run dbt using the checked-in local profiles directory layout
dbt deps
dbt debug --profiles-dir .
dbt run --profiles-dir .
```

### 6. Launch the Conversational AI Runtime
Configure your environment access tokens to match the application's strict Pydantic validation rules, and open the interactive command-line workspace.

Create your local variable envelope configurations:
```bash
# Create a local .env file inside: finops_ai_client/.env

# The target AI model variant hosted on Groq Cloud
LLM_MODEL="openai/gpt-oss-20b"
GROQ_API_KEY="gsk_your_validated_groq_cloud_key"

# Semantic Layer Tunnel Target (Minikube Local Gateway)
CUBE_API_URL="http://localhost:4000/cubejs-api/v1/load"
CUBEJS_API_SECRET="cube_secure_token_abc123"
```

Fire off the thread-isolated terminal runloop:
```bash
cd ../../finops_ai_engine
python -m client_engine.cli
```
