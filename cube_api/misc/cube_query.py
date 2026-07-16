import time
import jwt
import requests

# =====================================================================
# 1. SECURITY & CONNECTION CONFIGURATIONS
# =====================================================================
CUBE_API_URL = "http://localhost:4000/cubejs-api/v1/load"
CUBE_SECRET = "cube_secure_token_abc123"

# Generate an authorized JSON Web Token (JWT) handshake package
payload = {
    "iat": int(time.time()),
    "exp": int(time.time()) + 3600  # Token stays valid for exactly 1 hour
}
encoded_jwt = jwt.encode(payload, CUBE_SECRET, algorithm="HS256")

headers = {
    "Authorization": f"Bearer {encoded_jwt}",
    "Content-Type": "application/json"
}

# =====================================================================
# 2. THE LLM-READY ANALYTICAL QUERY DEFINITION (FIXED KEYS)
# =====================================================================
query_payload = {
    "query": {
        "measures": [
            "DailyB2cMetrics.net_profit_usd",      # FIXED: Matches active YAML key
            "DailyB2cMetrics.total_errors_5xx"     # FIXED: Matches active YAML key
        ],
        "dimensions": [
            "DailyB2cMetrics.app_version"          # FIXED: Matches active YAML key
        ],
        "order": {
            "DailyB2cMetrics.net_profit_usd": "desc"
        }
    }
}

# =====================================================================
# 3. EXECUTION & MATRIX RUNTIME DUMP
# =====================================================================
print("📡 Connecting to Cube API gateway via port-forward link...")
response = requests.post(CUBE_API_URL, json=query_payload, headers=headers)

if response.status_code == 200:
    data_matrix = response.json()
    print("\n✅ Query Executed Successfully! Database Matrix Output:\n")
    
    # Check if Cube is still loading data from the lakehouse in the background
    if "data" in data_matrix:
        for row in data_matrix["data"]:
            app_ver = row.get("DailyB2cMetrics.app_version")
            net_profit = row.get("DailyB2cMetrics.net_profit_usd")
            err_count = row.get("DailyB2cMetrics.total_errors_5xx")
            print(f"📱 App Version: {app_ver} | 💰 Net Profit: ${net_profit} | ⚠️ 5xx Errors: {err_count}")
    else:
        print("⏳ Cube is processing or pre-aggregating data. Re-run script in a few seconds.")
else:
    print(f"\n❌ API Connection Failed with Status Code: {response.status_code}")
    print(response.text)
