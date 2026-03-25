"""
Test Seeker Offers Page - Backend API Tests
Tests for:
- GET /api/hiring/offers - returns enriched offers with job.location and job.specialty
- PUT /api/hiring/offers/{id}/respond - accept/reject handler
- GET /api/seeker/applications - returns correct status for jobs with offers
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SEEKER_EMAIL = "seeker_test@vitalamatch.com"
SEEKER_PASSWORD = "test123"
EMPLOYER_EMAIL = "employer_test@vitalamatch.com"
EMPLOYER_PASSWORD = "test123"

# Known test data
OFFER_ID = "fc42edb9-5e1c-4c11-afca-eba7ebf82d67"
SEEKER_ID = "4b0fd359-6643-4fc2-bb9c-6058b967a379"
JOB_ID = "37befbaf-03b7-4ebf-8962-947da8098cf4"


class TestSeekerOffers:
    """Test seeker offers functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_seeker_token(self):
        """Login as seeker and get token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Seeker login failed: {response.status_code}")
    
    def get_employer_token(self):
        """Login as employer and get token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYER_EMAIL,
            "password": EMPLOYER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Employer login failed: {response.status_code}")
    
    # ==================== GET /api/hiring/offers Tests ====================
    
    def test_get_offers_requires_auth(self):
        """GET /api/hiring/offers requires authentication"""
        response = self.session.get(f"{BASE_URL}/api/hiring/offers")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: GET /api/hiring/offers requires authentication")
    
    def test_get_offers_as_seeker(self):
        """GET /api/hiring/offers returns offers for seeker"""
        token = self.get_seeker_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/hiring/offers")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        offers = response.json()
        assert isinstance(offers, list), "Response should be a list"
        print(f"PASS: GET /api/hiring/offers returns {len(offers)} offers for seeker")
        
        # Check if we have at least one offer
        if len(offers) > 0:
            offer = offers[0]
            print(f"  - First offer ID: {offer.get('id')}")
            print(f"  - Status: {offer.get('status')}")
            print(f"  - Position: {offer.get('position_title')}")
    
    def test_offers_have_enriched_job_data(self):
        """GET /api/hiring/offers returns enriched offers with job.location and job.specialty"""
        token = self.get_seeker_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/hiring/offers")
        assert response.status_code == 200
        
        offers = response.json()
        if len(offers) == 0:
            pytest.skip("No offers found to test enrichment")
        
        offer = offers[0]
        
        # Check that job data is enriched
        assert "job" in offer, "Offer should have 'job' field"
        job = offer.get("job")
        
        if job:
            # Check for location
            assert "location" in job, "Job should have 'location' field"
            print(f"  - Job location: {job.get('location')}")
            
            # Check for specialty
            assert "specialty" in job, "Job should have 'specialty' field"
            print(f"  - Job specialty: {job.get('specialty')}")
        
        # Check for company_name
        assert "company_name" in offer, "Offer should have 'company_name' field"
        print(f"  - Company name: {offer.get('company_name')}")
        
        print("PASS: Offers have enriched job data (location, specialty, company_name)")
    
    def test_offer_has_required_fields(self):
        """Offer should have all required fields for display"""
        token = self.get_seeker_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/hiring/offers")
        assert response.status_code == 200
        
        offers = response.json()
        if len(offers) == 0:
            pytest.skip("No offers found to test fields")
        
        offer = offers[0]
        
        # Required fields for offer card display
        required_fields = [
            "id", "position_title", "salary_amount", "salary_type",
            "start_date", "status", "expiration_date"
        ]
        
        for field in required_fields:
            assert field in offer, f"Offer missing required field: {field}"
            print(f"  - {field}: {offer.get(field)}")
        
        print("PASS: Offer has all required fields")
    
    # ==================== PUT /api/hiring/offers/{id}/respond Tests ====================
    
    def test_respond_requires_auth(self):
        """PUT /api/hiring/offers/{id}/respond requires authentication"""
        response = self.session.put(
            f"{BASE_URL}/api/hiring/offers/{OFFER_ID}/respond",
            json={"accepted": True}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: PUT /api/hiring/offers/{id}/respond requires authentication")
    
    def test_respond_only_seeker_can_respond(self):
        """Only the seeker recipient can respond to an offer"""
        token = self.get_employer_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.put(
            f"{BASE_URL}/api/hiring/offers/{OFFER_ID}/respond",
            json={"accepted": True}
        )
        # Should be 403 because employer is not the recipient
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("PASS: Only seeker recipient can respond to offer")
    
    def test_respond_invalid_offer_id(self):
        """Responding to non-existent offer returns 404"""
        token = self.get_seeker_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.put(
            f"{BASE_URL}/api/hiring/offers/invalid-offer-id/respond",
            json={"accepted": True}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Invalid offer ID returns 404")
    
    def test_respond_accept_offer(self):
        """Accept an offer via PUT /api/hiring/offers/{id}/respond"""
        token = self.get_seeker_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # First check if the offer is still pending
        response = self.session.get(f"{BASE_URL}/api/hiring/offers")
        offers = response.json()
        
        pending_offer = None
        for offer in offers:
            if offer.get("status") == "pending":
                pending_offer = offer
                break
        
        if not pending_offer:
            pytest.skip("No pending offers to test accept flow")
        
        offer_id = pending_offer["id"]
        print(f"  - Testing accept on offer: {offer_id}")
        
        # Accept the offer
        response = self.session.put(
            f"{BASE_URL}/api/hiring/offers/{offer_id}/respond",
            json={"accepted": True, "notes": "Thank you for the opportunity!"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should have 'message' field"
        assert data["message"] == "Offer accepted", f"Expected 'Offer accepted', got {data['message']}"
        
        # Verify employment_id is returned when accepted
        assert "employment_id" in data, "Response should have 'employment_id' when accepted"
        print(f"  - Employment ID created: {data.get('employment_id')}")
        
        # Verify the offer status changed
        response = self.session.get(f"{BASE_URL}/api/hiring/offers")
        offers = response.json()
        
        accepted_offer = next((o for o in offers if o["id"] == offer_id), None)
        assert accepted_offer is not None, "Offer should still exist"
        assert accepted_offer["status"] == "accepted", f"Expected status 'accepted', got {accepted_offer['status']}"
        
        print("PASS: Accept offer flow works correctly")
    
    def test_cannot_respond_to_non_pending_offer(self):
        """Cannot respond to an already accepted/rejected offer"""
        token = self.get_seeker_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get offers and find a non-pending one
        response = self.session.get(f"{BASE_URL}/api/hiring/offers")
        offers = response.json()
        
        non_pending_offer = None
        for offer in offers:
            if offer.get("status") in ["accepted", "rejected", "expired"]:
                non_pending_offer = offer
                break
        
        if not non_pending_offer:
            pytest.skip("No non-pending offers to test")
        
        offer_id = non_pending_offer["id"]
        print(f"  - Testing respond on {non_pending_offer['status']} offer: {offer_id}")
        
        response = self.session.put(
            f"{BASE_URL}/api/hiring/offers/{offer_id}/respond",
            json={"accepted": True}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("PASS: Cannot respond to non-pending offer")
    
    # ==================== GET /api/seeker/applications Tests ====================
    
    def test_seeker_applications_returns_correct_status(self):
        """GET /api/seeker/applications returns correct status for jobs with offers"""
        token = self.get_seeker_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/seeker/applications")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        applications = response.json()
        assert isinstance(applications, list), "Response should be a list"
        print(f"  - Found {len(applications)} applications")
        
        # Check status values
        valid_statuses = ["pending", "matched", "offer_sent", "accepted", "declined"]
        for app in applications:
            status = app.get("status")
            assert status in valid_statuses, f"Invalid status: {status}"
            print(f"  - Job: {app.get('job', {}).get('title')} - Status: {status}")
        
        print("PASS: Seeker applications return correct statuses")
    
    def test_seeker_applications_has_job_details(self):
        """GET /api/seeker/applications includes job details"""
        token = self.get_seeker_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/seeker/applications")
        assert response.status_code == 200
        
        applications = response.json()
        if len(applications) == 0:
            pytest.skip("No applications to test")
        
        app = applications[0]
        assert "job" in app, "Application should have 'job' field"
        
        job = app.get("job", {})
        job_fields = ["title", "company_name", "location", "specialty"]
        for field in job_fields:
            assert field in job, f"Job missing field: {field}"
            print(f"  - {field}: {job.get(field)}")
        
        print("PASS: Seeker applications include job details")


class TestOfferDeclineFlow:
    """Test declining an offer - separate class to avoid conflicts with accept test"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_seeker_token(self):
        """Login as seeker and get token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Seeker login failed: {response.status_code}")
    
    def test_decline_offer_flow(self):
        """Decline an offer via PUT /api/hiring/offers/{id}/respond with accepted=false"""
        token = self.get_seeker_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # First check if there's a pending offer
        response = self.session.get(f"{BASE_URL}/api/hiring/offers")
        offers = response.json()
        
        pending_offer = None
        for offer in offers:
            if offer.get("status") == "pending":
                pending_offer = offer
                break
        
        if not pending_offer:
            pytest.skip("No pending offers to test decline flow")
        
        offer_id = pending_offer["id"]
        print(f"  - Testing decline on offer: {offer_id}")
        
        # Decline the offer
        response = self.session.put(
            f"{BASE_URL}/api/hiring/offers/{offer_id}/respond",
            json={"accepted": False, "notes": "I found another opportunity."}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should have 'message' field"
        assert data["message"] == "Offer rejected", f"Expected 'Offer rejected', got {data['message']}"
        
        # employment_id should be None when declined
        assert data.get("employment_id") is None, "employment_id should be None when declined"
        
        # Verify the offer status changed
        response = self.session.get(f"{BASE_URL}/api/hiring/offers")
        offers = response.json()
        
        declined_offer = next((o for o in offers if o["id"] == offer_id), None)
        assert declined_offer is not None, "Offer should still exist"
        assert declined_offer["status"] == "rejected", f"Expected status 'rejected', got {declined_offer['status']}"
        
        print("PASS: Decline offer flow works correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
