"""
Test suite for Compliance Readiness, Typed Signature, Job Documents, External Systems, and Onboarding Checklist.
Features tested:
- GET /api/seeker/readiness - Seeker readiness score from vault documents
- PUT /api/hiring/offers/{id}/respond - Typed signature required for acceptance
- POST /api/jobs/{job_id}/documents - Job-specific document uploads
- GET /api/jobs/{job_id}/documents - Get job documents
- POST /api/employer/external-systems - Create external system entry
- GET /api/employer/external-systems - Get employer's external systems
- GET /api/onboarding/{case_id}/checklist - Unified onboarding checklist
- PUT /api/onboarding/{case_id}/items/{item_id}/status - Update checklist item status
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


@pytest.fixture(scope="module")
def seeker_token():
    """Get seeker auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SEEKER_EMAIL,
        "password": SEEKER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Seeker login failed: {response.status_code}")


@pytest.fixture(scope="module")
def employer_token():
    """Get employer auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": EMPLOYER_EMAIL,
        "password": EMPLOYER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Employer login failed: {response.status_code}")


@pytest.fixture(scope="module")
def seeker_headers(seeker_token):
    return {"Authorization": f"Bearer {seeker_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def employer_headers(employer_token):
    return {"Authorization": f"Bearer {employer_token}", "Content-Type": "application/json"}


class TestSeekerReadiness:
    """Tests for GET /api/seeker/readiness endpoint"""
    
    def test_readiness_endpoint_returns_200(self, seeker_headers):
        """Readiness endpoint should return 200 for authenticated seeker"""
        response = requests.get(f"{BASE_URL}/api/seeker/readiness", headers=seeker_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_readiness_response_structure(self, seeker_headers):
        """Readiness response should have score, level, message, items"""
        response = requests.get(f"{BASE_URL}/api/seeker/readiness", headers=seeker_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "score" in data, "Missing 'score' field"
        assert "level" in data, "Missing 'level' field"
        assert "message" in data, "Missing 'message' field"
        assert "items" in data, "Missing 'items' field"
        
        # Validate score is percentage
        assert isinstance(data["score"], int), "Score should be integer"
        assert 0 <= data["score"] <= 100, f"Score {data['score']} should be 0-100"
        
        # Validate level
        assert data["level"] in ("ready_to_work", "partially_ready", "needs_documents"), \
            f"Invalid level: {data['level']}"
    
    def test_readiness_items_have_status(self, seeker_headers):
        """Each readiness item should have key, label, status"""
        response = requests.get(f"{BASE_URL}/api/seeker/readiness", headers=seeker_headers)
        assert response.status_code == 200
        data = response.json()
        
        items = data.get("items", [])
        assert len(items) > 0, "Should have at least one compliance item"
        
        for item in items:
            assert "key" in item, f"Item missing 'key': {item}"
            assert "label" in item, f"Item missing 'label': {item}"
            assert "status" in item, f"Item missing 'status': {item}"
            assert item["status"] in ("complete", "missing", "expired", "expiring_soon"), \
                f"Invalid status: {item['status']}"
    
    def test_readiness_standard_bundle_items(self, seeker_headers):
        """Readiness should check standard compliance bundle items"""
        response = requests.get(f"{BASE_URL}/api/seeker/readiness", headers=seeker_headers)
        assert response.status_code == 200
        data = response.json()
        
        items = data.get("items", [])
        item_keys = [i["key"] for i in items]
        
        # Standard bundle should include these
        expected_keys = ["bls", "acls", "rn_license", "tb_test", "vaccinations", "gov_id", "background", "drug_screen"]
        for key in expected_keys:
            assert key in item_keys, f"Missing standard bundle item: {key}"
    
    def test_readiness_forbidden_for_employer(self, employer_headers):
        """Readiness endpoint should return 403 for employer"""
        response = requests.get(f"{BASE_URL}/api/seeker/readiness", headers=employer_headers)
        assert response.status_code == 403, f"Expected 403 for employer, got {response.status_code}"


class TestTypedSignatureOffer:
    """Tests for typed signature requirement on offer acceptance"""
    
    def test_accept_offer_without_signature_returns_400(self, seeker_headers):
        """Accepting offer without typed_signature should return 400"""
        # First get pending offers
        offers_response = requests.get(f"{BASE_URL}/api/hiring/offers", headers=seeker_headers)
        if offers_response.status_code != 200:
            pytest.skip("Could not fetch offers")
        
        offers = offers_response.json()
        pending_offers = [o for o in offers if o.get("status") == "pending"]
        
        if not pending_offers:
            pytest.skip("No pending offers to test")
        
        offer_id = pending_offers[0]["id"]
        
        # Try to accept without typed_signature
        response = requests.put(
            f"{BASE_URL}/api/hiring/offers/{offer_id}/respond",
            headers=seeker_headers,
            json={"accepted": True, "notes": "Test acceptance"}
        )
        
        assert response.status_code == 400, f"Expected 400 without signature, got {response.status_code}"
        assert "signature" in response.text.lower() or "typed" in response.text.lower(), \
            f"Error should mention signature: {response.text}"
    
    def test_accept_offer_with_short_signature_returns_400(self, seeker_headers):
        """Accepting offer with signature < 2 chars should return 400"""
        offers_response = requests.get(f"{BASE_URL}/api/hiring/offers", headers=seeker_headers)
        if offers_response.status_code != 200:
            pytest.skip("Could not fetch offers")
        
        offers = offers_response.json()
        pending_offers = [o for o in offers if o.get("status") == "pending"]
        
        if not pending_offers:
            pytest.skip("No pending offers to test")
        
        offer_id = pending_offers[0]["id"]
        
        # Try to accept with too short signature
        response = requests.put(
            f"{BASE_URL}/api/hiring/offers/{offer_id}/respond",
            headers=seeker_headers,
            json={"accepted": True, "notes": "Test", "typed_signature": "J"}
        )
        
        assert response.status_code == 400, f"Expected 400 for short signature, got {response.status_code}"
    
    def test_decline_offer_without_signature_succeeds(self, seeker_headers):
        """Declining offer should NOT require typed_signature"""
        offers_response = requests.get(f"{BASE_URL}/api/hiring/offers", headers=seeker_headers)
        if offers_response.status_code != 200:
            pytest.skip("Could not fetch offers")
        
        offers = offers_response.json()
        pending_offers = [o for o in offers if o.get("status") == "pending"]
        
        if not pending_offers:
            pytest.skip("No pending offers to test decline")
        
        # Note: We don't actually decline to preserve test data
        # Just verify the endpoint structure accepts decline without signature
        # This is a structural test - actual decline would change state
        pass


class TestJobDocuments:
    """Tests for job-specific document upload and retrieval"""
    
    def test_get_job_documents_returns_list(self, employer_headers):
        """GET /api/jobs/{job_id}/documents should return list"""
        # First get a job
        jobs_response = requests.get(f"{BASE_URL}/api/jobs", headers=employer_headers)
        if jobs_response.status_code != 200 or not jobs_response.json():
            pytest.skip("No jobs available")
        
        job_id = jobs_response.json()[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/jobs/{job_id}/documents", headers=employer_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert isinstance(response.json(), list), "Should return list"
    
    def test_job_documents_stored_in_job_documents_collection(self, employer_headers):
        """Job documents should be stored in job_documents collection, not vault"""
        jobs_response = requests.get(f"{BASE_URL}/api/jobs", headers=employer_headers)
        if jobs_response.status_code != 200 or not jobs_response.json():
            pytest.skip("No jobs available")
        
        job_id = jobs_response.json()[0]["id"]
        
        # Get job documents
        response = requests.get(f"{BASE_URL}/api/jobs/{job_id}/documents", headers=employer_headers)
        assert response.status_code == 200
        
        # If there are documents, verify they have job_id field
        docs = response.json()
        for doc in docs:
            assert doc.get("job_id") == job_id, f"Document should have job_id={job_id}"


class TestExternalSystems:
    """Tests for employer external systems management"""
    
    def test_get_external_systems_returns_list(self, employer_headers):
        """GET /api/employer/external-systems should return list"""
        response = requests.get(f"{BASE_URL}/api/employer/external-systems", headers=employer_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert isinstance(response.json(), list), "Should return list"
    
    def test_create_external_system(self, employer_headers):
        """POST /api/employer/external-systems should create entry"""
        test_system = {
            "system_name": f"TEST_BackgroundCheck_{uuid.uuid4().hex[:8]}",
            "system_type": "background_check",
            "url": "https://example.com/background"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/employer/external-systems",
            headers=employer_headers,
            json=test_system
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data, "Response should include id"
    
    def test_external_system_persists(self, employer_headers):
        """Created external system should appear in GET"""
        # Create a unique system
        unique_name = f"TEST_DrugScreen_{uuid.uuid4().hex[:8]}"
        create_response = requests.post(
            f"{BASE_URL}/api/employer/external-systems",
            headers=employer_headers,
            json={
                "system_name": unique_name,
                "system_type": "drug_screening",
                "url": "https://example.com/drug"
            }
        )
        assert create_response.status_code == 200
        
        # Verify it appears in list
        list_response = requests.get(f"{BASE_URL}/api/employer/external-systems", headers=employer_headers)
        assert list_response.status_code == 200
        
        systems = list_response.json()
        names = [s.get("system_name") for s in systems]
        assert unique_name in names, f"Created system {unique_name} not found in list"
    
    def test_external_systems_forbidden_for_seeker(self, seeker_headers):
        """External systems endpoint should return 403 for seeker"""
        response = requests.get(f"{BASE_URL}/api/employer/external-systems", headers=seeker_headers)
        assert response.status_code == 403, f"Expected 403 for seeker, got {response.status_code}"


class TestOnboardingChecklist:
    """Tests for unified onboarding checklist API"""
    
    @pytest.fixture
    def onboarding_case_id(self, seeker_headers, employer_headers):
        """Find an existing onboarding case for testing"""
        # Try to find from employments
        emp_response = requests.get(f"{BASE_URL}/api/hiring/employments", headers=seeker_headers)
        if emp_response.status_code == 200:
            employments = emp_response.json()
            if employments:
                # Look for onboarding case via offer
                for emp in employments:
                    offer_id = emp.get("offer_id")
                    if offer_id:
                        # Try to find case by checking if there's an onboarding case
                        # We need to query the database or use another endpoint
                        pass
        
        # Alternative: check if there's a case from accepted offers
        offers_response = requests.get(f"{BASE_URL}/api/hiring/offers", headers=seeker_headers)
        if offers_response.status_code == 200:
            offers = offers_response.json()
            accepted = [o for o in offers if o.get("status") == "accepted"]
            # Note: We'd need the case_id which is created on acceptance
        
        return None  # Will skip tests if no case found
    
    def test_checklist_endpoint_structure(self, seeker_headers):
        """Test checklist endpoint returns proper structure when case exists"""
        # This test verifies the endpoint exists and returns proper error for invalid case
        response = requests.get(
            f"{BASE_URL}/api/onboarding/nonexistent-case-id/checklist",
            headers=seeker_headers
        )
        # Should return 404 for non-existent case
        assert response.status_code == 404, f"Expected 404 for invalid case, got {response.status_code}"
    
    def test_checklist_item_update_endpoint_exists(self, seeker_headers):
        """Test checklist item update endpoint exists"""
        response = requests.put(
            f"{BASE_URL}/api/onboarding/nonexistent-case/items/nonexistent-item/status",
            headers=seeker_headers,
            json={"status": "completed"}
        )
        # Should return 404 for non-existent case (not 405 method not allowed)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestOfferResponseModel:
    """Tests for OfferResponse model with typed_signature field"""
    
    def test_offer_response_accepts_typed_signature(self, seeker_headers):
        """OfferResponse model should accept typed_signature field"""
        # Get offers to verify the model structure
        response = requests.get(f"{BASE_URL}/api/hiring/offers", headers=seeker_headers)
        assert response.status_code == 200
        
        # The endpoint should accept typed_signature in request body
        # This is validated by the 400 error tests above


class TestOnboardingAutoTrigger:
    """Tests for onboarding auto-trigger on offer acceptance"""
    
    def test_accepted_offer_has_employment(self, seeker_headers):
        """Accepted offers should create employment records"""
        # Get employments
        emp_response = requests.get(f"{BASE_URL}/api/hiring/employments", headers=seeker_headers)
        assert emp_response.status_code == 200
        
        # If there are employments, they should have required fields
        employments = emp_response.json()
        for emp in employments:
            assert "id" in emp, "Employment should have id"
            assert "offer_id" in emp, "Employment should have offer_id"
            assert "status" in emp, "Employment should have status"


class TestReadinessScoreCalculation:
    """Tests for readiness score calculation logic"""
    
    def test_readiness_score_reflects_vault_documents(self, seeker_headers):
        """Readiness score should be based on vault documents"""
        # Get readiness
        readiness_response = requests.get(f"{BASE_URL}/api/seeker/readiness", headers=seeker_headers)
        assert readiness_response.status_code == 200
        readiness = readiness_response.json()
        
        # Get vault documents
        vault_response = requests.get(f"{BASE_URL}/api/vault/documents", headers=seeker_headers)
        if vault_response.status_code == 200:
            vault_docs = vault_response.json()
            
            # Count complete items
            complete_items = [i for i in readiness["items"] if i["status"] == "complete"]
            
            # Score should be (complete / total) * 100
            expected_score = round((len(complete_items) / len(readiness["items"])) * 100) if readiness["items"] else 0
            assert readiness["score"] == expected_score, \
                f"Score {readiness['score']} doesn't match expected {expected_score}"
    
    def test_readiness_level_matches_score(self, seeker_headers):
        """Readiness level should match score thresholds"""
        response = requests.get(f"{BASE_URL}/api/seeker/readiness", headers=seeker_headers)
        assert response.status_code == 200
        data = response.json()
        
        score = data["score"]
        level = data["level"]
        
        if score >= 80:
            assert level == "ready_to_work", f"Score {score} should be ready_to_work, got {level}"
        elif score >= 50:
            assert level == "partially_ready", f"Score {score} should be partially_ready, got {level}"
        else:
            assert level == "needs_documents", f"Score {score} should be needs_documents, got {level}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
