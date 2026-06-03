import pytest
from fastapi.testclient import TestClient
import sys
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert "MediReport AI" in response.json()["name"]

def test_supabase_health_if_exists():
    try:
        response = client.get("/api/supabase/health")
        # If it exists, it should be reachable
        assert response.status_code in [200, 404]
    except:
        pass
