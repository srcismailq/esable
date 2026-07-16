import requests
import jwt
import datetime
import json

# Configuration pulled directly from your environmental specification
CUBE_SECRET = "cube_secure_token_abc123"
CUBE_URL = "http://localhost:4000/cubejs-api/v1"

def generate_verification_token():
    """Generates a transient security token signed with the cluster secret key."""
    # Using datetime.datetime.now(datetime.timezone.utc) to prevent deprecation warnings in newer PyJWT versions
    payload = {
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=1),
        "iat": datetime.datetime.now(datetime.timezone.utc)
    }
    return jwt.encode(payload, CUBE_SECRET, algorithm="HS256")

def inspect_lakehouse_semantic_layer():
    token = generate_verification_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # --- PHASE 1: SCHEMA METADATA DISCOVERY EVALUATION ---
    print("=" * 60)
    print("PHASE 1: FETCHING RAW SEMANTIC LAYER METADATA")
    print("=" * 60)
    try:
        meta_response = requests.get(f"{CUBE_URL}/meta", headers=headers)
        print(f"HTTP Status Response: {meta_response.status_code}")
        if meta_response.status_code == 200:
            raw_meta = meta_response.json()
            print(json.dumps(raw_meta, indent=2)[:2000])
            print("\n... [OUTPUT TRUNCATED: RUN LOCALLY TO SEE FULL SCHEMA BLOB] ...")
        else:
            print(f"Server Error: {meta_response.text}")
    except Exception as network_err:
        print(f"Connection Failed! Verify port-forwarding on localhost:4000. Error: {network_err}")

    # --- PHASE 2: REAL-WORLD AGGREGATION TEST QUERY ---
    print("\n" + "=" * 60)
    print("PHASE 2: RUNNING ANALYTICAL ALLOCATION QUERY")
    print("=" * 60)
    
    # FIX: Aligned all keys perfectly with your "DailyB2cMetrics" schema names
    verification_query = {
        "query": {
            "measures": [
                "DailyB2cMetrics.individual_revenue_usd",
                "DailyB2cMetrics.net_profit_usd"
            ],
            "dimensions": [
                "DailyB2cMetrics.marketing_channel"
            ],
            "timeDimensions": [
                {
                    "dimension": "DailyB2cMetrics.session_date",
                    "granularity": "day",
                    "dateRange": "Last 30 days"
                }
            ]
        }
    }
    
    try:
        load_response = requests.post(f"{CUBE_URL}/load", headers=headers, json=verification_query)
        print(f"HTTP Status Response: {load_response.status_code}")
        if load_response.status_code == 200:
            print(json.dumps(load_response.json(), indent=2))
        else:
            print(f"Query Execution Error: {load_response.text}")
    except Exception as network_err:
        print(f"Query Pipeline Execution Failed: {network_err}")

if __name__ == "__main__":
    inspect_lakehouse_semantic_layer()
