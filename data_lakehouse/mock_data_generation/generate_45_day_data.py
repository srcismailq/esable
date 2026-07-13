import json
import random
import datetime
import psycopg2
from psycopg2.extras import execute_values
import uuid

# Connection string mapping to your active Minikube port-forward tunnel
DB_CONN = "host=localhost port=5432 dbname=metrics_lakehouse user=lakehouse_admin password=lakehouse_secure_pass123"

# Domain boundaries for realistic analytical data generation
CHANNELS = ["TikTok_Ads", "Instagram_Organic", "Meta_Ads", "Google_Paid", "Direct_Traffic"]
REGIONS = ["US-East", "US-West", "EU-West", "AP-South"]
VERSIONS = ["v1.0.0", "v1.1.0", "v1.2.0"]

# Explicitly maps app features directly to backend microservice names for deep drill-down analytics
FEATURE_SERVICE_MAP = {
    "AI_Filter": "ml-filter-service",
    "Feed_Scroll": "core-api-worker",
    "Profile_Edit": "core-api-worker",
    "Checkout_Initiate": "payment-gateway"
}

# FIXED: Pre-calculated static sequence outside the loop to eliminate 45,000+ redundant memory allocations
FEATURES = tuple(FEATURE_SERVICE_MAP.keys())

DEVICES = {
    "Flagship": [("iPhone 15 Pro", "iOS 17.5"), ("Galaxy S24 Ultra", "Android 14")],
    "Budget": [("iPhone SE", "iOS 15.0"), ("Galaxy A15", "Android 11")]
}

def generate_telemetry_payloads(target_date, records_count=1200):
    payloads = []
    session_registry = {}
    
    for _ in range(records_count):
        session_id = f"sess_{uuid.uuid4().hex[:12]}"
        
        # 2. NEW: If it's a brand new session, roll the dice ONCE and lock it down
        if session_id not in session_registry:
            tier = "Budget" if random.random() < 0.3 else "Flagship"
            device_model, device_os = random.choice(DEVICES[tier])
            
            session_registry[session_id] = {
                "user_id": f"user_{random.randint(1000, 9999)}",
                "channel": random.choice(CHANNELS),
                "region": random.choice(REGIONS),
                "app_version": random.choice(VERSIONS),
                "device_tier": tier,
                "device_model": device_model,
                "device_os": device_os,
                "session_duration_minutes": random.randint(1, 45) 
            }
            
        # 3. NEW: Pull the stable, locked attributes out of the registry
        session_state = session_registry[session_id]
        
        user_id = session_state["user_id"]
        channel = session_state["channel"]
        region = session_state["region"]
        app_version = session_state["app_version"]
        tier = session_state["device_tier"]
        device_model = session_state["device_model"]
        device_os = session_state["device_os"]
        session_duration_minutes = session_state["session_duration_minutes"]



        # FIXED: Utilizing the pre-computed static tuple for an O(1) instant memory read
        feature = random.choice(FEATURES)
        service_name = FEATURE_SERVICE_MAP[feature]
        
        
        
        
        status_code = 200
        response_time = random.randint(40, 180)
        
        # Scenario 1: Version performance degradation
        if app_version == "v1.0.0" and random.random() < 0.25:
            status_code = 500
            response_time = random.randint(1500, 4500)
            
        # Scenario 2: Feature resource consumption scaling
        cpu_seconds = random.uniform(0.5, 2.5) if feature == "AI_Filter" else random.uniform(0.01, 0.09)
        
        payload = {
            "event_type": "consumer_telemetry",
            "session_id": session_id,
            "user_id": user_id,
            "user_region": region,
            "marketing_channel": channel,
            "app_version": app_version,
            "device_tier": tier,
            "device_model": device_model,
            "device_os": device_os,
            "feature_name": feature,
            "associated_service": service_name,
            "http_status_code": status_code,
            "response_time_ms": response_time,
            "simulated_cpu_seconds": round(cpu_seconds, 4),
            "session_duration_minutes": session_duration_minutes
        }
        
        # Append parent telemetry payload FIRST to maintain cause-and-effect sequencing
        payloads.append((target_date, json.dumps(payload)))
        
        # Scenario 3: Closed-loop checkout conversions
        if feature == "Checkout_Initiate" and status_code == 200 and random.random() < 0.40:
            purchase_payload = {
                "event_type": "consumer_purchase",
                "purchase_id": f"inv_{random.randint(100000, 999999)}",
                "user_id": user_id,
                "purchase_amount_usd": random.choice([4.99, 9.99, 14.99, 29.99, 69.99, 99.99]),
                "purchase_category": random.choice(["premium_filter_unlock", "monthly_subscription"])
            }
            # Append downstream purchase payload SECOND so it receives a sequentially higher ID handle
            payloads.append((target_date, json.dumps(purchase_payload)))
            
    return payloads

def generate_invoice_payloads(target_date, day_offset):
    invoices = []
    log_date_str = target_date.strftime("%Y-%m-%d")
    
    # Marketing invoices
    for platform in ["TikTok_Ads", "Meta_Ads", "Google_Paid"]:
        invoices.append((target_date, json.dumps({
            "event_type": "marketing_invoice",
            "log_date": log_date_str,
            "ad_platform": platform,
            "daily_spend_usd": round(random.uniform(150.00, 850.00), 2)
        })))
        
    # Scenario 4: Anomaly Generation (Simulates a service cost skyrocket 15 days ago)
    cost_multiplier = 4.5 if (12 <= day_offset <= 16) else 1.0
    
    services_to_bill = [
        {"name": "core-api-worker", "base_comp": 300.0, "base_stor": 50.0},
        {"name": "payment-gateway", "base_comp": 100.0, "base_stor": 30.0},
        {"name": "ml-filter-service", "base_comp": 500.0 * cost_multiplier, "base_stor": 150.0}
    ]
    
    for srv in services_to_bill:
        invoices.append((target_date, json.dumps({
            "event_type": "cloud_invoice",
            "log_date": log_date_str,
            "service_identifier": srv["name"],
            "global_compute_cost_usd": round(random.uniform(srv["base_comp"] * 0.8, srv["base_comp"] * 1.2), 2),
            "global_storage_cost_usd": round(random.uniform(srv["base_stor"] * 0.9, srv["base_stor"] * 1.1), 2)
        })))
    
    return invoices

def run_pipeline():
    print("🚀 Connecting to Minikube PostgreSQL Lakehouse...")
    
    try:
        with psycopg2.connect(DB_CONN) as conn:
            with conn.cursor() as cursor:
                
                print("🧹 Truncating target landing store to guarantee an idempotent fresh reload...")
                cursor.execute("TRUNCATE TABLE raw_metrics_store RESTART IDENTITY;")
                
                base_date = datetime.datetime.now(datetime.timezone.utc)
                all_records = []
                
                print("⏳ Accumulating 45-day high-fidelity historical data matrix locally...")
                for day in range(45):
                    current_date = base_date - datetime.timedelta(days=day)
                    
                    all_records.extend(generate_telemetry_payloads(current_date, records_count=1000))
                    all_records.extend(generate_invoice_payloads(current_date, day_offset=day))
                
                print(f"📦 Bulk inserting {len(all_records)} records into the raw lakehouse store...")
                
                insert_query = "INSERT INTO raw_metrics_store (captured_at, metrics_payload) VALUES %s"
                execute_values(cursor, insert_query, all_records)
                
        print("🎉 Success! High-performance idempotent ingestion complete. Resources released safely.")
        
    except psycopg2.Error as db_err:
        print(f"❌ Database execution failure: {db_err}")
    except Exception as err:
        print(f"❌ Pipeline failed due to runtime error: {err}")

if __name__ == "__main__":
    run_pipeline()
