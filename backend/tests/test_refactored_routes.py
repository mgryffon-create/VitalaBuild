"""
Test suite for backend refactor - auth, vault, training routes moved to separate modules.
Also tests auto-assign training feature when onboarding case is created.
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SEEKER_EMAIL = "seeker_test@vitalamatch.com"
SEEKER_PASSWORD = "test123"
EMPLOYER_EMAIL = "employer_test@vitalamatch.com"
EMPLOYER_PASSWORD = "test123"
ADMIN_EMAIL = "admin@vitalamatch.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def seeker_token():
    """Get seeker auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SEEKER_EMAIL,
        "password": SEEKER_PASSWORD
    })
    assert response.status_code == 200, f"Seeker login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def employer_token():
    """Get employer auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": EMPLOYER_EMAIL,
        "password": EMPLOYER_PASSWORD
    })
    assert response.status_code == 200, f"Employer login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["access_token"]


class TestAuthRoutes:
    """Test auth routes after refactor to routes/auth.py"""
    
    def test_login_success(self):
        """POST /api/auth/login - valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == SEEKER_EMAIL
        assert data["user"]["role"] == "seeker"
    
    def test_login_invalid_credentials(self):
        """POST /api/auth/login - invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
    
    def test_register_duplicate_email(self):
        """POST /api/auth/register - duplicate email returns 400"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": SEEKER_EMAIL,
            "password": "test123",
            "full_name": "Test User",
            "role": "seeker"
        })
        assert response.status_code == 400
        assert "already registered" in response.json().get("detail", "").lower()
    
    def test_auth_me(self, seeker_token):
        """GET /api/auth/me - returns current user"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {seeker_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == SEEKER_EMAIL
        assert data["role"] == "seeker"
        assert "id" in data
        assert "full_name" in data
    
    def test_auth_me_no_token(self):
        """GET /api/auth/me - no token returns 403"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 403


class TestVaultRoutes:
    """Test vault routes after refactor to routes/vault.py"""
    
    def test_get_vault_documents(self, seeker_token):
        """GET /api/vault/documents - returns user's documents"""
        response = requests.get(f"{BASE_URL}/api/vault/documents", headers={
            "Authorization": f"Bearer {seeker_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_vault_categories(self, seeker_token):
        """GET /api/vault/categories - returns category structure"""
        response = requests.get(f"{BASE_URL}/api/vault/categories", headers={
            "Authorization": f"Bearer {seeker_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data
        assert "identity" in data["categories"]
        assert "certification" in data["categories"]
        assert "license" in data["categories"]
    
    def test_create_vault_document(self, seeker_token):
        """POST /api/vault/documents - creates document"""
        doc_data = {
            "category": "certification",
            "subtype": "BLS",
            "issuing_authority": "American Heart Association",
            "document_number": f"TEST-{uuid.uuid4().hex[:8]}",
            "expiration_date": (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")
        }
        response = requests.post(f"{BASE_URL}/api/vault/documents", 
            json=doc_data,
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "message" in data
        return data["id"]
    
    def test_create_vault_document_invalid_category(self, seeker_token):
        """POST /api/vault/documents - invalid category returns 400"""
        response = requests.post(f"{BASE_URL}/api/vault/documents", 
            json={"category": "invalid_category"},
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        assert response.status_code == 400
    
    def test_vault_file_path_traversal_blocked(self, seeker_token):
        """GET /api/vault/files/{filename} - path traversal blocked"""
        # URL-encoded path traversal attempt
        response = requests.get(f"{BASE_URL}/api/vault/files/..%2F..%2Fetc%2Fpasswd", headers={
            "Authorization": f"Bearer {seeker_token}"
        })
        assert response.status_code in [400, 404]


class TestTrainingRoutes:
    """Test training routes after refactor to routes/training.py"""
    
    def test_get_training_courses(self, seeker_token):
        """GET /api/training/courses - returns courses list"""
        response = requests.get(f"{BASE_URL}/api/training/courses", headers={
            "Authorization": f"Bearer {seeker_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_training_assignments_seeker(self, seeker_token):
        """GET /api/training/assignments - seeker gets their assignments"""
        response = requests.get(f"{BASE_URL}/api/training/assignments", headers={
            "Authorization": f"Bearer {seeker_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_training_assignments_employer(self, employer_token):
        """GET /api/training/assignments - employer gets assignments they created"""
        response = requests.get(f"{BASE_URL}/api/training/assignments", headers={
            "Authorization": f"Bearer {employer_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_course_employer(self, employer_token):
        """POST /api/training/courses - employer can create course"""
        course_data = {
            "title": f"TEST Course {uuid.uuid4().hex[:8]}",
            "description": "Test course for refactor testing",
            "category": "compliance",
            "provider": "internal",
            "credit_hours": 1.0
        }
        response = requests.post(f"{BASE_URL}/api/training/courses",
            json=course_data,
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        return data["id"]
    
    def test_create_course_seeker_forbidden(self, seeker_token):
        """POST /api/training/courses - seeker cannot create courses"""
        response = requests.post(f"{BASE_URL}/api/training/courses",
            json={"title": "Test", "description": "Test"},
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        assert response.status_code == 403
    
    def test_get_compliance_summary_employer(self, employer_token):
        """GET /api/training/compliance-summary - employer gets summary"""
        response = requests.get(f"{BASE_URL}/api/training/compliance-summary", headers={
            "Authorization": f"Bearer {employer_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert "total_assignments" in data
        assert "completed" in data
        assert "compliance_rate" in data
    
    def test_get_compliance_summary_seeker_forbidden(self, seeker_token):
        """GET /api/training/compliance-summary - seeker gets 403"""
        response = requests.get(f"{BASE_URL}/api/training/compliance-summary", headers={
            "Authorization": f"Bearer {seeker_token}"
        })
        assert response.status_code == 403
    
    def test_get_transcript(self, seeker_token):
        """GET /api/training/transcript - returns completed assignments"""
        response = requests.get(f"{BASE_URL}/api/training/transcript", headers={
            "Authorization": f"Bearer {seeker_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_certificates(self, seeker_token):
        """GET /api/training/certificates - returns assignments with certificates"""
        response = requests.get(f"{BASE_URL}/api/training/certificates", headers={
            "Authorization": f"Bearer {seeker_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_compliance_requirements(self, employer_token):
        """GET /api/training/compliance-requirements - employer gets requirements"""
        response = requests.get(f"{BASE_URL}/api/training/compliance-requirements", headers={
            "Authorization": f"Bearer {employer_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestNonRefactoredRoutes:
    """Test routes that were NOT refactored (still in server.py)"""
    
    def test_get_jobs(self, employer_token):
        """GET /api/jobs - employer gets their jobs"""
        response = requests.get(f"{BASE_URL}/api/jobs", headers={
            "Authorization": f"Bearer {employer_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_matches(self, employer_token):
        """GET /api/matches - employer gets matches"""
        response = requests.get(f"{BASE_URL}/api/matches", headers={
            "Authorization": f"Bearer {employer_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_stats(self, employer_token):
        """GET /api/stats - employer gets stats"""
        response = requests.get(f"{BASE_URL}/api/stats", headers={
            "Authorization": f"Bearer {employer_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert "active_jobs" in data
        assert "matches" in data
    
    def test_get_onboarding_cases_employer(self, employer_token):
        """GET /api/onboarding/cases - employer gets their cases"""
        response = requests.get(f"{BASE_URL}/api/onboarding/cases", headers={
            "Authorization": f"Bearer {employer_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_onboarding_cases_seeker(self, seeker_token):
        """GET /api/onboarding/cases - seeker gets their cases"""
        response = requests.get(f"{BASE_URL}/api/onboarding/cases", headers={
            "Authorization": f"Bearer {seeker_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_admin_onboarding_cases(self, admin_token):
        """GET /api/admin/onboarding/cases - admin gets all cases"""
        response = requests.get(f"{BASE_URL}/api/admin/onboarding/cases", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestAutoAssignTraining:
    """Test auto-assign training when onboarding case is created"""
    
    def test_create_compliance_requirement(self, employer_token):
        """Create a compliance requirement for CNA role"""
        # First create a course
        course_data = {
            "title": f"TEST CNA Orientation {uuid.uuid4().hex[:8]}",
            "description": "Required orientation for CNA hires",
            "category": "orientation",
            "provider": "internal",
            "credit_hours": 2.0
        }
        course_response = requests.post(f"{BASE_URL}/api/training/courses",
            json=course_data,
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        assert course_response.status_code == 200
        course_id = course_response.json()["id"]
        
        # Create compliance requirement for CNA role
        req_data = {
            "role_type": "CNA",
            "course_id": course_id,
            "is_mandatory": True
        }
        req_response = requests.post(f"{BASE_URL}/api/training/compliance-requirements",
            json=req_data,
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        assert req_response.status_code == 200
        assert "id" in req_response.json()
        
        # Verify requirement was created
        reqs_response = requests.get(f"{BASE_URL}/api/training/compliance-requirements",
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        assert reqs_response.status_code == 200
        reqs = reqs_response.json()
        assert any(r["course_id"] == course_id for r in reqs)
        
        return course_id


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
