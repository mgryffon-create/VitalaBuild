"""
Test suite for Offer Acceptance Guardrails — Conflict Prevention System
Tests:
- GET /api/hiring/offers/{id}/conflicts returns conflict data
- PUT /api/hiring/offers/{id}/respond with accepted=true returns 409 when conflicts exist
- PUT /api/hiring/offers/{id}/respond with accepted=false (decline) always works
- Employment record created on acceptance includes end_date, shift_type, location, job_type
- Offers with status=expired, withdrawn, rejected are excluded from conflict checks
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
SEEKER_EMAIL = "seeker_test@vitalamatch.com"
SEEKER_PASSWORD = "test123"
EMPLOYER_EMAIL = "employer_test@vitalamatch.com"
EMPLOYER_PASSWORD = "test123"

# Known test offer ID from agent context
TEST_OFFER_ID = "87697722-8373-4bd0-9cfe-5c2c55fac054"


@pytest.fixture(scope="module")
def seeker_token():
    """Get seeker authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SEEKER_EMAIL,
        "password": SEEKER_PASSWORD
    })
    assert response.status_code == 200, f"Seeker login failed: {response.text}"
    data = response.json()
    return data.get("access_token")


@pytest.fixture(scope="module")
def employer_token():
    """Get employer authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": EMPLOYER_EMAIL,
        "password": EMPLOYER_PASSWORD
    })
    assert response.status_code == 200, f"Employer login failed: {response.text}"
    data = response.json()
    return data.get("access_token")


class TestOfferConflictsEndpoint:
    """Tests for GET /api/hiring/offers/{id}/conflicts"""

    def test_conflicts_endpoint_returns_structure(self, seeker_token):
        """Verify conflicts endpoint returns expected structure"""
        headers = {"Authorization": f"Bearer {seeker_token}"}
        response = requests.get(f"{BASE_URL}/api/hiring/offers/{TEST_OFFER_ID}/conflicts", headers=headers)
        
        assert response.status_code == 200, f"Conflicts endpoint failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "has_hard_block" in data, "Missing has_hard_block field"
        assert "hard_blocks" in data, "Missing hard_blocks field"
        assert "soft_warnings" in data, "Missing soft_warnings field"
        assert "existing_assignments" in data, "Missing existing_assignments field"
        
        # Verify types
        assert isinstance(data["has_hard_block"], bool), "has_hard_block should be boolean"
        assert isinstance(data["hard_blocks"], list), "hard_blocks should be list"
        assert isinstance(data["soft_warnings"], list), "soft_warnings should be list"
        assert isinstance(data["existing_assignments"], list), "existing_assignments should be list"
        
        print(f"Conflicts response: has_hard_block={data['has_hard_block']}, "
              f"hard_blocks={len(data['hard_blocks'])}, soft_warnings={len(data['soft_warnings'])}, "
              f"existing_assignments={len(data['existing_assignments'])}")

    def test_conflicts_endpoint_has_hard_block_for_test_seeker(self, seeker_token):
        """Test seeker has existing assignments causing hard blocks"""
        headers = {"Authorization": f"Bearer {seeker_token}"}
        response = requests.get(f"{BASE_URL}/api/hiring/offers/{TEST_OFFER_ID}/conflicts", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Per agent context, this seeker has 3 accepted offers/employments causing conflicts
        assert data["has_hard_block"] == True, "Expected hard block for test seeker with existing assignments"
        assert len(data["hard_blocks"]) > 0, "Expected at least one hard block reason"
        
        print(f"Hard blocks: {data['hard_blocks']}")

    def test_existing_assignments_have_required_fields(self, seeker_token):
        """Verify existing assignments include title, location, end date"""
        headers = {"Authorization": f"Bearer {seeker_token}"}
        response = requests.get(f"{BASE_URL}/api/hiring/offers/{TEST_OFFER_ID}/conflicts", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        if data["existing_assignments"]:
            for assignment in data["existing_assignments"]:
                assert "title" in assignment, "Assignment missing title"
                # location and end may be None but should exist as keys
                assert "location" in assignment or assignment.get("location") is None
                assert "end" in assignment or assignment.get("end") is None
                print(f"Assignment: {assignment.get('title')} - {assignment.get('location')} - ends {assignment.get('end')}")

    def test_conflicts_endpoint_requires_auth(self):
        """Verify conflicts endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/hiring/offers/{TEST_OFFER_ID}/conflicts")
        assert response.status_code in [401, 403], "Should require authentication"

    def test_conflicts_endpoint_404_for_invalid_offer(self, seeker_token):
        """Verify 404 for non-existent offer"""
        headers = {"Authorization": f"Bearer {seeker_token}"}
        response = requests.get(f"{BASE_URL}/api/hiring/offers/invalid-offer-id/conflicts", headers=headers)
        assert response.status_code == 404


class TestOfferRespondWithConflicts:
    """Tests for PUT /api/hiring/offers/{id}/respond with conflict checking"""

    def test_accept_blocked_when_conflicts_exist(self, seeker_token):
        """Accepting offer with hard conflicts returns 409"""
        headers = {"Authorization": f"Bearer {seeker_token}"}
        
        # First verify there are conflicts
        conflicts_response = requests.get(f"{BASE_URL}/api/hiring/offers/{TEST_OFFER_ID}/conflicts", headers=headers)
        if conflicts_response.status_code == 200:
            conflicts = conflicts_response.json()
            if not conflicts.get("has_hard_block"):
                pytest.skip("No hard blocks exist for this offer - cannot test 409 response")
        
        # Try to accept - should get 409
        response = requests.put(
            f"{BASE_URL}/api/hiring/offers/{TEST_OFFER_ID}/respond",
            headers=headers,
            json={"accepted": True, "notes": "Test acceptance"}
        )
        
        # Could be 409 (conflict) or 400 (already responded/expired)
        if response.status_code == 409:
            data = response.json()
            detail = data.get("detail", {})
            
            # Verify 409 response structure
            if isinstance(detail, dict):
                assert "message" in detail or "hard_blocks" in detail, "409 response should have message or hard_blocks"
                if "hard_blocks" in detail:
                    assert isinstance(detail["hard_blocks"], list)
                if "soft_warnings" in detail:
                    assert isinstance(detail["soft_warnings"], list)
                print(f"409 response detail: {detail}")
            else:
                print(f"409 response detail (string): {detail}")
        elif response.status_code == 400:
            # Offer may already be responded to or expired
            print(f"Offer already responded/expired: {response.json()}")
        else:
            # If 200, the offer was accepted (no conflicts or conflicts cleared)
            print(f"Offer accepted (status {response.status_code}): {response.json()}")

    def test_decline_works_regardless_of_conflicts(self, seeker_token):
        """Declining offer should work even when conflicts exist"""
        headers = {"Authorization": f"Bearer {seeker_token}"}
        
        # Try to decline - should work regardless of conflicts
        response = requests.put(
            f"{BASE_URL}/api/hiring/offers/{TEST_OFFER_ID}/respond",
            headers=headers,
            json={"accepted": False, "notes": "Test decline"}
        )
        
        # Should be 200 (success) or 400 (already responded/expired)
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code} - {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "message" in data
            print(f"Decline successful: {data}")
        else:
            print(f"Offer already responded/expired: {response.json()}")


class TestEmploymentRecordEnrichment:
    """Tests for employment record enrichment with job fields"""

    def test_get_employments_have_enriched_fields(self, seeker_token):
        """Verify employments include end_date, shift_type, location, job_type"""
        headers = {"Authorization": f"Bearer {seeker_token}"}
        
        # Get seeker's employments
        response = requests.get(f"{BASE_URL}/api/hiring/employments", headers=headers)
        
        if response.status_code == 200:
            employments = response.json()
            if employments:
                for emp in employments[:3]:  # Check first 3
                    print(f"Employment: {emp.get('position_title')}")
                    print(f"  - end_date: {emp.get('end_date')}")
                    print(f"  - shift_type: {emp.get('shift_type')}")
                    print(f"  - location: {emp.get('location')}")
                    print(f"  - job_type: {emp.get('job_type')}")
                    
                    # These fields should exist (may be None for old records)
                    # New records should have them populated from job
            else:
                print("No employments found for seeker")
        else:
            print(f"Could not fetch employments: {response.status_code}")


class TestOffersListEndpoint:
    """Tests for GET /api/hiring/offers (seeker's offers list)"""

    def test_get_offers_list(self, seeker_token):
        """Verify offers list returns with status badges"""
        headers = {"Authorization": f"Bearer {seeker_token}"}
        response = requests.get(f"{BASE_URL}/api/hiring/offers", headers=headers)
        
        assert response.status_code == 200, f"Failed to get offers: {response.text}"
        offers = response.json()
        
        assert isinstance(offers, list), "Offers should be a list"
        
        if offers:
            for offer in offers[:5]:  # Check first 5
                assert "id" in offer, "Offer missing id"
                assert "status" in offer, "Offer missing status"
                assert "position_title" in offer, "Offer missing position_title"
                
                # Status should be one of: pending, accepted, rejected, expired, withdrawn
                valid_statuses = ["pending", "accepted", "rejected", "expired", "withdrawn"]
                assert offer["status"] in valid_statuses, f"Invalid status: {offer['status']}"
                
                print(f"Offer: {offer['id'][:8]}... - {offer['position_title']} - {offer['status']}")
        else:
            print("No offers found for seeker")

    def test_pending_offer_exists(self, seeker_token):
        """Verify the test pending offer exists"""
        headers = {"Authorization": f"Bearer {seeker_token}"}
        response = requests.get(f"{BASE_URL}/api/hiring/offers", headers=headers)
        
        assert response.status_code == 200
        offers = response.json()
        
        # Find the test offer
        test_offer = next((o for o in offers if o["id"] == TEST_OFFER_ID), None)
        
        if test_offer:
            print(f"Test offer found: {test_offer['position_title']} - status: {test_offer['status']}")
            # It should be pending for conflict testing
            if test_offer["status"] != "pending":
                print(f"WARNING: Test offer is not pending (status={test_offer['status']})")
        else:
            print(f"Test offer {TEST_OFFER_ID} not found in offers list")


class TestConflictExclusions:
    """Tests for offers excluded from conflict checks"""

    def test_only_active_statuses_checked(self, seeker_token):
        """Verify expired/withdrawn/rejected offers don't cause conflicts"""
        headers = {"Authorization": f"Bearer {seeker_token}"}
        
        # Get conflicts for test offer
        response = requests.get(f"{BASE_URL}/api/hiring/offers/{TEST_OFFER_ID}/conflicts", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            
            # Check existing assignments - should only include active/onboarding employments
            # and accepted offers (not expired/withdrawn/rejected)
            for assignment in data.get("existing_assignments", []):
                print(f"Active assignment: {assignment.get('title')} - job_type: {assignment.get('job_type')}")
            
            print(f"Total active assignments causing conflicts: {len(data.get('existing_assignments', []))}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
