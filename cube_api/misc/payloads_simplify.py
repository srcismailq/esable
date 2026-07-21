import requests
import jwt
import datetime
import json
#import warnings
#from jwt.exceptions import InsecureKeyLengthWarning

# Suppress the local insecure key length warning to keep terminal clean
#warnings.filterwarnings("ignore", category=InsecureKeyLengthWarning)

CUBE_SECRET = "cube_secure_token_abc123"
CUBE_URL = "http://localhost:4000/cubejs-api/v1"

def generate_verification_token():
    payload = {
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=1),
        "iat": datetime.datetime.now(datetime.timezone.utc)
    }
    return jwt.encode(payload, CUBE_SECRET, algorithm="HS256")

def inspect_rich_semantic_layer():
    token = generate_verification_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    print("=" * 60)
    print("🎯 EXTRACTING PRODUCTION AI CONTEXT SHIELD")
    print("=" * 60)
    
    try:
        meta_response = requests.get(f"{CUBE_URL}/meta", headers=headers)
        if meta_response.status_code != 200:
            print(f"❌ Server Error: {meta_response.status_code} - {meta_response.text}")
            return
            
        raw_meta = meta_response.json()
        cubes = raw_meta.get("cubes", [])
        
        rich_schema = {}
        for cube in cubes:
            cube_name = cube.get("name")
            rich_schema[cube_name] = {
                "measures": [],
                "dimensions": [],
                "timeDimensions": []
            }
            
            # Map Measures with Semantic Types and Titles
            for m in cube.get("measures", []):
                rich_schema[cube_name]["measures"].append({
                    "name": m.get("name"),
                    "title": m.get("title"),
                    "type": m.get("type")
                })
                
            # Separate Standard Attributes from Time-series Dimensions
            for d in cube.get("dimensions", []):
                dim_data = {
                    "name": d.get("name"),
                    "title": d.get("title"),
                    "type": d.get("type")
                }
                
                if d.get("type") == "time":
                    rich_schema[cube_name]["timeDimensions"].append(dim_data)
                else:
                    # Provide the actual filter operators the LLM can safely use for this column
                    dim_data["suggested_operators"] = d.get("operators", ["equals", "notEquals", "set", "notSet"])
                    rich_schema[cube_name]["dimensions"].append(dim_data)
            
        print(json.dumps(rich_schema, indent=2))
        print("=" * 60)
        print("✅ Production schema context generated successfully.")
        
    except Exception as network_err:
        print(f"❌ Connection Failed! Error: {network_err}")

if __name__ == "__main__":
    inspect_rich_semantic_layer()
