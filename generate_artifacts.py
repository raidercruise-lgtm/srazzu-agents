"""
API Specification & DX Asset Generator
--------------------------------------
Exports openapi.json from the active engine and formats environment variables
for Postman collection importing.
"""
import urllib.request
import json
import os

OPENAPI_URL = "http://localhost:8000/openapi.json"
OUTPUT_OPENAPI = "openapi.json"
OUTPUT_POSTMAN_ENV = "AOC_Engine_Postman_Env.json"

def export_assets():
    print(f"Fetching OpenAPI schema from {OPENAPI_URL}...")
    try:
        with urllib.request.urlopen(OPENAPI_URL) as response:
            schema = json.loads(response.read().decode())
            
        with open(OUTPUT_OPENAPI, "w", encoding="utf-8") as f:
            json.dump(schema, f, indent=2)
            
        print(f"✓ Created {OUTPUT_OPENAPI}")
        
        # Create matching Postman Environment File
        postman_env = {
            "id": "aoc-engine-env",
            "name": "AOC Workforce Engine - Local Environment",
            "values": [
                {
                    "key": "baseUrl",
                    "value": "http://localhost:8000",
                    "type": "default",
                    "enabled": True
                },
                {
                    "key": "workflow_id",
                    "value": "",
                    "type": "default",
                    "enabled": True
                },
                {
                    "key": "node_id",
                    "value": "worker-node-01",
                    "type": "default",
                    "enabled": True
                }
            ],
            "_postman_variable_scope": "environment"
        }
        
        with open(OUTPUT_POSTMAN_ENV, "w", encoding="utf-8") as f:
            json.dump(postman_env, f, indent=2)
            
        print(f"✓ Created {OUTPUT_POSTMAN_ENV}")
        
    except Exception as e:
        print(f"❌ Failed to fetch OpenAPI schema: {e}")

if __name__ == "__main__":
    export_assets()