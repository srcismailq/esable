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

# Explicitly maps app features directly to backend microservice names for deep drill-down analytics
FEATURE_SERVICE_MAP = {
    "AI_Filter": "ml-filter-service",
    "Feed_Scroll": "core-api-worker",
    "Profile_Edit": "core-api-worker",
    "Checkout_Initiate": "payment-gateway"
}
FEATURES = tuple(FEATURE_SERVICE_MAP.keys())

DEVICES = {
    "Flagship": [("iPhone 15 Pro", "iOS 17.5"), ("Galaxy S24 Ultra", "Android 14")],
    "Budget": [("iPhone SE", "iOS 15.0"), ("Galaxy A15", "Android 11")]
}

def get_app_version(day_offset):
    """
    Smooths out version transitions using a 14-day linear rollout window
    to avoid harsh analytical data cliffs at Year 1 and Year 2 boundaries.
    """
    # Year 1 to Year 2 transition (Around Day 365)
    if 358 <= day_offset <= 372:
        rollout_progress = (day_offset - 358) / 14.0  # 0.0 to 1.0
        return "v1.1.0" if random.random() < rollout_progress else "v1.0.0"
    elif day_offset < 358:
        return "v1.0.0"
        
    # Year 2 to Year 3 transition (Around Day 730)
    if 723 <= day_offset <= 737:
        rollout_progress = (day_offset - 723) / 14.0  # 0.0 to 1.0
        return "v1.2.0" if random.random() < rollout_progress else "v1.1.0"
    elif day_offset < 723:
        return "v1.1.0"
        
    return "v1.2.0"

def generate_daily_session_pool(current_version, carry_over_sessions, pool_size=100):
    """
    Generates a fixed pool of reusable sessions for the day, blending in 
    carried-over sessions from yesterday while enforcing a strict longevity cap.
    """
    session_pool = {}
    
    # 1. Process and inject carried-over sessions (Midnight boundary fix)
    for s_id, s_state in carry_over_sessions.items():
        # Session Leak Trap Fix: Hard-drop any session active for more than 3 consecutive days
        if s_state.get("days_active", 1) >= 3:
            continue
            
        # Increment active days and sync version to current day deployment
        s_state["days_active"] += 1
        s_state["app_version"] = current_version
        session_pool[s_id] = s_state

    # 2. Top up the pool with brand new sessions for the day
    while len(session_pool) < pool_size:
        session_id = f"sess_{uuid.uuid4().hex[:12]}"
        tier = "Budget" if random.random() < 0.3 else "Flagship"
        device_model, device_os = random.choice(DEVICES[tier])
        
        session_pool[session_id] = {
            "user_id": f"user_{random.randint(1000, 9999)}",
            "channel": random.choice(CHANNELS),
            "region": random.choice(REGIONS),
            "app_version": current_version,
            "device_tier": tier,
            "device_model": device_model,
            "device_os": device_os,
            "session_duration_minutes": random.randint(1, 45),
            "days_active": 1  # Brand new session baseline initialization
        }
        
    return session_pool

def run_pipeline():
    print("🚀 Connecting to Minikube PostgreSQL Lakehouse...")
    
    try:
        with psycopg2.connect(DB_CONN) as conn:
            with conn.cursor() as cursor:
                
                print("🧹 Truncating target landing store to guarantee an idempotent fresh reload...")
                cursor.execute("TRUNCATE TABLE raw_metrics_store RESTART IDENTITY;")
                conn.commit()
                
                # Establish our historical baseline timeline (1,095 days ago moving forward)
                total_days = 1095
                base_date = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=total_days)
                
                # Dynamic buffers to guarantee a flat Python RAM signature
                weekly_batch = []
                carry_over_sessions = {}
                
                print(f"⏳ Processing 3 years ({total_days} days) chronologically in weekly streaming blocks...")
                
                for day_offset in range(total_days):
                    current_date = base_date + datetime.timedelta(days=day_offset)
                    day_of_week = current_date.weekday()  # 5 = Saturday, 6 = Sunday
                    is_weekend = day_of_week >= 5
                    
                    # Compute Linear Traffic Volumetrics + Safety Caps
                    # Starts at 200 records, adds 1 per day, ceilings firmly at 1,200 rows/day max
                    base_records = min(200 + day_offset, 1200)
                    if is_weekend:
                        base_records = int(base_records * 1.3)  # 30% weekend volume spike
                        
                    current_version = get_app_version(day_offset)
                    
                    # Instantiate daily pool with metadata filters active
                    session_pool = generate_daily_session_pool(current_version, carry_over_sessions, pool_size=100)
                    session_ids = list(session_pool.keys())
                    
                    # --- Generate Telemetry Events ---
                    for _ in range(base_records):
                        # Multi-click funnel engine: Pull from our stable daily pool
                        session_id = random.choice(session_ids)
                        session_state = session_pool[session_id]
                        
                        feature = random.choice(FEATURES)
                        service_name = FEATURE_SERVICE_MAP[feature]
                        
                        status_code = 200
                        response_time = random.randint(40, 180)
                        
                        # Scenario 1: Version performance degradation (Inherited bug inside v1.0.0)
                        if session_state["app_version"] == "v1.0.0" and random.random() < 0.25:
                            status_code = 500
                            response_time = random.randint(1500, 4500)
                            
                        # Scenario 2: Feature resource consumption scaling
                        cpu_seconds = random.uniform(0.5, 2.5) if feature == "AI_Filter" else random.uniform(0.01, 0.09)
                        
                        payload = {
                            "event_type": "consumer_telemetry",
                            "session_id": session_id,
                            "user_id": session_state["user_id"],
                            "user_region": session_state["region"],
                            "marketing_channel": session_state["channel"],
                            "app_version": session_state["app_version"],
                            "device_tier": session_state["device_tier"],
                            "device_model": session_state["device_model"],
                            "device_os": session_state["device_os"],
                            "feature_name": feature,
                            "associated_service": service_name,
                            "http_status_code": status_code,
                            "response_time_ms": response_time,
                            "simulated_cpu_seconds": round(cpu_seconds, 4),
                            "session_duration_minutes": session_state["session_duration_minutes"]
                        }
                        
                        weekly_batch.append((current_date, json.dumps(payload)))
                        
                        # Scenario 3: Closed-loop checkout conversions (40% conversion funnel math)
                        if feature == "Checkout_Initiate" and status_code == 200 and random.random() < 0.40:
                            purchase_payload = {
                                "event_type": "consumer_purchase",
                                "purchase_id": f"inv_{random.randint(100000, 999999)}",
                                "user_id": session_state["user_id"],
                                "purchase_amount_usd": random.choice([4.99, 9.99, 14.99, 29.99, 69.99, 99.99]),
                                "purchase_category": random.choice(["premium_filter_unlock", "monthly_subscription"])
                            }
                            weekly_batch.append((current_date, json.dumps(purchase_payload)))
                    
                    # --- Generate Invoice Events ---
                    log_date_str = current_date.strftime("%Y-%m-%d")
                    
                    # Marketing expenses
                    for platform in ["TikTok_Ads", "Meta_Ads", "Google_Paid"]:
                        spend_multiplier = 1.4 if is_weekend else 1.0
                        weekly_batch.append((current_date, json.dumps({
                            "event_type": "marketing_invoice",
                            "log_date": log_date_str,
                            "ad_platform": platform,
                            "daily_spend_usd": round(random.uniform(150.00, 850.00) * spend_multiplier, 2)
                        })))
                        
                    # Scenario 4: Scattered Infrastructure Cost Anomalies
                    # Simulates a runaway cloud loop near the final leg of the timeline (Days 1050-1055)
                    cost_multiplier = 4.5 if (1050 <= day_offset <= 1055) else 1.0
                    
                    services_to_bill = [
                        {"name": "core-api-worker", "base_comp": 300.0, "base_stor": 50.0},
                        {"name": "payment-gateway", "base_comp": 100.0, "base_stor": 30.0},
                        {"name": "ml-filter-service", "base_comp": 500.0 * cost_multiplier, "base_stor": 150.0}
                    ]
                    
                    for srv in services_to_bill:
                        weekly_batch.append((current_date, json.dumps({
                            "event_type": "cloud_invoice",
                            "log_date": log_date_str,
                            "service_identifier": srv["name"],
                            "global_compute_cost_usd": round(random.uniform(srv["base_comp"] * 0.8, srv["base_comp"] * 1.2), 2),
                            "global_storage_cost_usd": round(random.uniform(srv["base_stor"] * 0.9, srv["base_stor"] * 1.1), 2)
                        })))
                    
                    # Capture exactly 10% of sessions to carry over past midnight into tomorrow's loop execution
                    carry_over_count = max(1, int(len(session_ids) * 0.10))
                    carry_over_keys = random.sample(session_ids, carry_over_count)
                    carry_over_sessions = {k: session_pool[k] for k in carry_over_keys}
                    
                    # --- Network & RAM Safeguard Streaming Flush ---
                    # Every 7 days (or on the final day), push the chunk over the port-forward tunnel and clear memory
                    if (day_offset + 1) % 7 == 0 or (day_offset + 1) == total_days:
                        print(f"📦 Streaming batch to Minikube... Chronological Milestone: Day {day_offset + 1}/{total_days} ({current_date.strftime('%Y-%m-%d')})")
                        
                        insert_query = "INSERT INTO raw_metrics_store (captured_at, metrics_payload) VALUES %s"
                        execute_values(cursor, insert_query, weekly_batch)
                        conn.commit()
                        
                        # Wipe array clean to reset local Python memory footprint to zero
                        weekly_batch.clear()
                        
        print("\n🎉 Success! Memory-safe 3-year raw data lakehouse ingestion complete.")
        print("💡 Open up your terminal, fire off your dbt run, and check out your fresh semantic data layer insights!")
        
    except psycopg2.Error as db_err:
        print(f"❌ Database execution failure: {db_err}")
    except Exception as err:
        print(f"❌ Pipeline failed due to runtime error: {err}")

if __name__ == "__main__":
    run_pipeline()
