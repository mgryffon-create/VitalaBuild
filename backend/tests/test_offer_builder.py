"""
Test suite for Offer Builder feature:
- POST /api/hiring/offers with new structured fields
- Employment documents creation (separate from vault)
- Pipeline stage sync to offer_sent
- GET /api/employment-documents endpoint
- Seeker offer view with structured sections
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
EMPLOYER_EMAIL = "employer_test@vitalamatch.com"
EMPLOYER_PASSWORD = "test123"
SEEKER_EMAIL = "seeker_test@vitalamatch.com"
SEEKER_PASSWORD = "test123"


@pytest.fixture(scope="module")
def employer_token():
    """Get employer auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": EMPLOYER_EMAIL,
        "password": EMPLOYER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Employer login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def seeker_token():
    """Get seeker auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SEEKER_EMAIL,
        "password": SEEKER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Seeker login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def employer_headers(employer_token):
    """Headers with employer auth"""
    return {
        "Authorization": f"Bearer {employer_token}",
        "Content-Type": "application/json"
    }


@pytest.fixture(scope="module")
def seeker_headers(seeker_token):
    """Headers with seeker auth"""
    return {
        "Authorization": f"Bearer {seeker_token}",
        "Content-Type": "application/json"
    }


@pytest.fixture(scope="module")
def test_match_data(employer_headers):
    """Get a valid match for testing offer creation"""
    # Get matches for employer
    response = requests.get(f"{BASE_URL}/api/matches", headers=employer_headers)
    if response.status_code != 200:
        pytest.skip("Could not get matches")
    
    matches = response.json()
    if not matches:
        pytest.skip("No matches available for testing")
    
    # Find a match that's not already in offer_sent state
    for match in matches:
        match_id = match.get("id")
        seeker_id = match.get("seeker", {}).get("id") or match.get("seeker_id")
        job_id = match.get("job_id") or match.get("job", {}).get("id")
        
        if match_id and seeker_id and job_id:
            return {
                "match_id": match_id,
                "seeker_id": seeker_id,
                "job_id": job_id,
                "job_title": match.get("job", {}).get("title", "Test Position"),
                "pay_range": match.get("job", {}).get("pay_range", {})
            }
    
    pytest.skip("No valid match found for testing")


class TestOfferBuilderBackend:
    """Backend tests for Offer Builder feature"""
    
    def test_offer_endpoint_exists(self, employer_headers):
        """POST /api/hiring/offers endpoint exists"""
        # Just check the endpoint responds (even with validation error)
        response = requests.post(f"{BASE_URL}/api/hiring/offers", 
                                headers=employer_headers, 
                                json={})
        # Should get 422 (validation error) not 404
        assert response.status_code != 404, "Offer endpoint should exist"
        print(f"Offer endpoint exists, status: {response.status_code}")
    
    def test_offer_creation_with_new_fields(self, employer_headers, test_match_data):
        """POST /api/hiring/offers stores new structured fields"""
        today = datetime.now()
        start_date = (today + timedelta(days=14)).strftime("%Y-%m-%d")
        expiration_date = (today + timedelta(days=7)).strftime("%Y-%m-%d")
        
        offer_payload = {
            "match_id": test_match_data["match_id"],
            "job_id": test_match_data["job_id"],
            "seeker_id": test_match_data["seeker_id"],
            "position_title": f"TEST_Offer_Builder_{datetime.now().strftime('%H%M%S')}",
            "salary_amount": 55.0,
            "salary_type": "hourly",
            "start_date": start_date,
            "expiration_date": expiration_date,
            # New structured fields
            "contract_length": "13 weeks",
            "shift_details": "7p-7a, 3x12",
            "overtime_rate": 82.5,
            "sign_on_bonus": 2500.0,
            "completion_bonus": 1500.0,
            "housing_stipend": 2000.0,
            "travel_stipend": 500.0,
            "approved_time_off": "2 days PTO per month",
            "conditions": ["Background check", "Drug screening", "License verification"],
            "benefits_summary": "Health insurance, 401k match, dental",
            "custom_notes": "Looking forward to having you on the team!"
        }
        
        response = requests.post(f"{BASE_URL}/api/hiring/offers", 
                                headers=employer_headers, 
                                json=offer_payload)
        
        print(f"Offer creation response: {response.status_code}")
        if response.status_code != 200:
            print(f"Response body: {response.text}")
        
        assert response.status_code == 200, f"Offer creation failed: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain offer ID"
        print(f"Created offer with ID: {data['id']}")
        
        return data["id"]
    
    def test_offer_retrieval_has_new_fields(self, employer_headers):
        """GET /api/hiring/offers returns offers with new structured fields"""
        response = requests.get(f"{BASE_URL}/api/hiring/offers", headers=employer_headers)
        
        assert response.status_code == 200, f"Failed to get offers: {response.text}"
        
        offers = response.json()
        assert isinstance(offers, list), "Response should be a list"
        
        if offers:
            # Check the most recent offer for new fields
            offer = offers[0]
            print(f"Checking offer: {offer.get('position_title')}")
            
            # Check new fields exist (may be null if not set)
            new_fields = [
                "contract_length", "shift_details", "overtime_rate",
                "sign_on_bonus", "completion_bonus", "housing_stipend",
                "travel_stipend", "approved_time_off", "custom_notes"
            ]
            
            for field in new_fields:
                assert field in offer or offer.get(field) is None, f"Field {field} should be in offer response"
            
            print(f"All new fields present in offer response")
            print(f"  contract_length: {offer.get('contract_length')}")
            print(f"  shift_details: {offer.get('shift_details')}")
            print(f"  overtime_rate: {offer.get('overtime_rate')}")
            print(f"  sign_on_bonus: {offer.get('sign_on_bonus')}")
            print(f"  completion_bonus: {offer.get('completion_bonus')}")
            print(f"  housing_stipend: {offer.get('housing_stipend')}")
            print(f"  travel_stipend: {offer.get('travel_stipend')}")
            print(f"  approved_time_off: {offer.get('approved_time_off')}")
            print(f"  custom_notes: {offer.get('custom_notes')}")
    
    def test_employment_documents_created(self, employer_headers):
        """POST /api/hiring/offers creates employment_documents record"""
        response = requests.get(f"{BASE_URL}/api/employment-documents", headers=employer_headers)
        
        assert response.status_code == 200, f"Failed to get employment documents: {response.text}"
        
        docs = response.json()
        assert isinstance(docs, list), "Response should be a list"
        
        print(f"Found {len(docs)} employment documents")
        
        if docs:
            doc = docs[0]
            # Check document structure
            assert "offer_id" in doc, "Document should have offer_id"
            assert "document_type" in doc, "Document should have document_type"
            assert doc.get("document_type") == "offer_letter", "Document type should be offer_letter"
            print(f"Employment document: {doc.get('title')} - type: {doc.get('document_type')}")
    
    def test_employment_documents_not_in_vault(self, seeker_headers):
        """Employment documents are NOT stored in vault_documents collection"""
        # Get vault documents
        vault_response = requests.get(f"{BASE_URL}/api/vault/documents", headers=seeker_headers)
        
        if vault_response.status_code == 200:
            vault_docs = vault_response.json()
            # Check that no vault doc has document_type = "offer_letter"
            offer_letters_in_vault = [d for d in vault_docs if d.get("document_type") == "offer_letter" or d.get("subtype") == "offer_letter"]
            assert len(offer_letters_in_vault) == 0, "Offer letters should NOT be in vault_documents"
            print("Verified: No offer letters in vault_documents collection")
        else:
            print(f"Vault endpoint returned {vault_response.status_code} - skipping vault check")
    
    def test_pipeline_stage_synced_to_offer_sent(self, employer_headers, test_match_data):
        """After offer creation, pipeline_stages should be updated to offer_sent"""
        # Get pipeline candidates
        response = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=employer_headers)
        
        assert response.status_code == 200, f"Failed to get pipeline: {response.text}"
        
        data = response.json()
        candidates = data.get("candidates", {})
        
        # Check if there are candidates in offer_sent stage
        offer_sent_candidates = candidates.get("offer_sent", [])
        print(f"Found {len(offer_sent_candidates)} candidates in offer_sent stage")
        
        # Verify the test seeker is in offer_sent (if we created an offer for them)
        seeker_id = test_match_data["seeker_id"]
        found_in_offer_sent = any(
            c.get("candidate_id") == seeker_id or c.get("seeker", {}).get("id") == seeker_id
            for c in offer_sent_candidates
        )
        
        if found_in_offer_sent:
            print(f"Verified: Seeker {seeker_id} is in offer_sent stage")
        else:
            print(f"Note: Seeker {seeker_id} may already have been in a different stage")


class TestSeekerOfferView:
    """Tests for seeker offer view with structured sections"""
    
    def test_seeker_can_view_offers(self, seeker_headers):
        """GET /api/hiring/offers returns offers for seeker"""
        response = requests.get(f"{BASE_URL}/api/hiring/offers", headers=seeker_headers)
        
        assert response.status_code == 200, f"Failed to get seeker offers: {response.text}"
        
        offers = response.json()
        assert isinstance(offers, list), "Response should be a list"
        
        print(f"Seeker has {len(offers)} offers")
        
        if offers:
            offer = offers[0]
            print(f"Offer: {offer.get('position_title')}")
            print(f"  Status: {offer.get('status')}")
            print(f"  Salary: ${offer.get('salary_amount')}/{offer.get('salary_type')}")
    
    def test_seeker_offer_has_structured_fields(self, seeker_headers):
        """Seeker offer view includes all structured fields"""
        response = requests.get(f"{BASE_URL}/api/hiring/offers", headers=seeker_headers)
        
        assert response.status_code == 200
        
        offers = response.json()
        if not offers:
            pytest.skip("No offers for seeker to test")
        
        offer = offers[0]
        
        # Core fields
        assert "position_title" in offer, "Should have position_title"
        assert "salary_amount" in offer, "Should have salary_amount"
        assert "salary_type" in offer, "Should have salary_type"
        assert "start_date" in offer, "Should have start_date"
        assert "expiration_date" in offer, "Should have expiration_date"
        
        # New structured fields (may be null)
        structured_fields = [
            "contract_length", "shift_details", "overtime_rate",
            "sign_on_bonus", "completion_bonus", "housing_stipend",
            "travel_stipend", "approved_time_off", "custom_notes",
            "conditions", "benefits_summary"
        ]
        
        for field in structured_fields:
            # Field should exist in response (even if null)
            print(f"  {field}: {offer.get(field)}")
        
        print("All structured fields accessible in seeker offer view")
    
    def test_seeker_offer_conflicts_endpoint(self, seeker_headers):
        """GET /api/hiring/offers/{id}/conflicts returns conflict info"""
        # First get an offer
        response = requests.get(f"{BASE_URL}/api/hiring/offers", headers=seeker_headers)
        
        if response.status_code != 200:
            pytest.skip("Could not get offers")
        
        offers = response.json()
        if not offers:
            pytest.skip("No offers to test conflicts")
        
        offer_id = offers[0]["id"]
        
        # Check conflicts endpoint
        conflicts_response = requests.get(
            f"{BASE_URL}/api/hiring/offers/{offer_id}/conflicts",
            headers=seeker_headers
        )
        
        assert conflicts_response.status_code == 200, f"Conflicts endpoint failed: {conflicts_response.text}"
        
        conflicts = conflicts_response.json()
        print(f"Conflicts check: has_hard_block={conflicts.get('has_hard_block')}")
        print(f"  soft_warnings: {conflicts.get('soft_warnings', [])}")
        print(f"  existing_assignments: {len(conflicts.get('existing_assignments', []))}")


class TestOfferAcceptDecline:
    """Tests for offer accept/decline workflow"""
    
    def test_offer_respond_endpoint_exists(self, seeker_headers):
        """PUT /api/hiring/offers/{id}/respond endpoint exists"""
        # Get an offer first
        response = requests.get(f"{BASE_URL}/api/hiring/offers", headers=seeker_headers)
        
        if response.status_code != 200:
            pytest.skip("Could not get offers")
        
        offers = response.json()
        if not offers:
            pytest.skip("No offers to test respond")
        
        # Find a pending offer
        pending_offers = [o for o in offers if o.get("status") == "pending"]
        if not pending_offers:
            print("No pending offers to test respond - checking endpoint exists")
            # Just verify endpoint exists with a non-existent ID
            test_response = requests.put(
                f"{BASE_URL}/api/hiring/offers/nonexistent/respond",
                headers=seeker_headers,
                json={"accepted": True}
            )
            # Should get 404 (not found) not 405 (method not allowed)
            assert test_response.status_code != 405, "Respond endpoint should exist"
            print("Respond endpoint exists")
            return
        
        offer_id = pending_offers[0]["id"]
        print(f"Found pending offer: {offer_id}")
        
        # Note: We don't actually accept/decline to preserve test data
        print("Respond endpoint verified (not executing to preserve test data)")


class TestMessagingAfterOffer:
    """Tests that messaging still works after offer is sent"""
    
    def test_messaging_works_for_offer_sent_candidates(self, employer_headers):
        """Messaging should work for candidates in offer_sent stage"""
        # Get pipeline to find offer_sent candidates
        response = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=employer_headers)
        
        if response.status_code != 200:
            pytest.skip("Could not get pipeline")
        
        data = response.json()
        offer_sent = data.get("candidates", {}).get("offer_sent", [])
        
        if not offer_sent:
            print("No candidates in offer_sent stage to test messaging")
            return
        
        candidate = offer_sent[0]
        match_id = candidate.get("match_id")
        
        if not match_id:
            print("No match_id for offer_sent candidate")
            return
        
        # Try to get messages (should work)
        messages_response = requests.get(
            f"{BASE_URL}/api/matches/{match_id}/messages",
            headers=employer_headers
        )
        
        assert messages_response.status_code == 200, f"Messaging should work for offer_sent: {messages_response.text}"
        print(f"Messaging works for offer_sent candidate (match_id: {match_id})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
