import sys
import os
import json
from fastapi.testclient import TestClient

# Align search path boundaries cleanly across directory structures
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from client_engine.server import server

def test_server_health_endpoint_returns_healthy_status():
    """Command the server to verify infrastructure readiness."""
    with TestClient(server) as client:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}

def test_config_info_endpoint_exposes_active_llm_model():
    """Command the server to expose configuration metadata needed by the UI."""
    with TestClient(server) as client:
        response = client.get("/api/config/info")
        assert response.status_code == 200
        assert "llm_model" in response.json()

def test_query_endpoint_rejects_completely_empty_string():
    """Command the server to execute an empty query and assert boundary intercept."""
    with TestClient(server) as client:
        response = client.post("/api/query", json={"user_query": ""})
        assert response.status_code == 422
        assert "empty" in str(response.json()).lower()

def test_query_endpoint_rejects_whitespace_only_string():
    """Command the server to execute a whitespace query and assert boundary intercept."""
    with TestClient(server) as client:
        response = client.post("/api/query", json={"user_query": "     "})
        assert response.status_code == 422
        assert "empty" in str(response.json()).lower()

def test_query_endpoint_rejects_missing_payload_key():
    """Command the server to handle an unrecognised schema block and assert failure."""
    with TestClient(server) as client:
        response = client.post("/api/query", json={"wrong_key": "valid string"})
        assert response.status_code == 422

def test_query_endpoint_executes_valid_transaction_successfully():
    """SOCIABLE TEST: Command the server to run a valid end-to-end transaction."""
    with TestClient(server) as client:
        payload = {"user_query": "Show last month's operational spend"}
        response = client.post("/api/query", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert "final_answer" in data
        assert "cube_json_query" in data
        assert data["error_message"] is None

def test_query_endpoint_with_stream_true_yields_incremental_state_snapshots():
    """TDD RED TEST: Command the unified endpoint to stream complete state snapshots when stream=True."""
    with TestClient(server) as client:
        payload = {
            "user_query": "Show last month's operational spend",
            "stream": True
        }
        
        # Connect using the streaming verb
        with client.stream("POST", "/api/query", json=payload) as response:
            assert response.status_code == 200
            assert response.headers["content-type"].startswith("text/event-stream")
            
            snapshots = []
            for line in response.iter_lines():
                if line.startswith("data:"):
                    # Strip the SSE prefix and parse the full JSON snapshot
                    json_str = line.replace("data:", "").strip()
                    snapshot = json.loads(json_str)
                    
                    # Verify every single chunk complies exactly with the QueryResponse schema keys
                    assert "cube_json_query" in snapshot
                    assert "final_answer" in snapshot
                    assert "error_message" in snapshot
                    snapshots.append(snapshot)
            
            # Assert that we received multiple frames of data as the engine processed the request
            assert len(snapshots) >= 2, "Stream should emit multiple state diff snapshots over time"
            
            # Assert that the final snapshot matches a fully realized end-to-end response
            final_snapshot = snapshots[-1]
            assert final_snapshot["final_answer"] is not None
            assert final_snapshot["error_message"] is None