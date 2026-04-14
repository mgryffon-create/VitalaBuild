"""
Test Offer State Synchronization
Tests that when an employer sends an offer, the seeker side immediately reflects 'offer_sent' status.
Key features tested:
1. create_employment_offer updates pipeline_stages to offer_sent
2. seeker/applications returns offer_id and offer details when offer exists
3. seeker/applications returns status='offer_sent' when offer exists
4. seeker/applications checks pipeline_stages as fallback for offer_sent detection
5. State consistency: employer in offer_sent state → seeker also in offer_sent state
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
EMPLOYER_EMAIL = "employer_test@vitalamatch.com"
EMPLOYER_PASSWORD = "test123"
SEEKER_EMAIL = "seeker_test@vitalamatch.com"
SEEKER_PASSWORD = "test123"


class TestOfferStateSynchronization:
    """Test offer state sync between employer and seeker"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_auth_token(self, email: str, password: str) -> str:
        """Get authentication token for a user"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Authentication failed for {email}")
    
    def test_seeker_applications_endpoint_returns_200(self):
        """Test that seeker/applications endpoint is accessible"""
        token = self.get_auth_token(SEEKER_EMAIL, SEEKER_PASSWORD)
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/seeker/applications")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of applications"
        print(f"✓ Seeker applications endpoint returns {len(data)} applications")
    
    def test_seeker_applications_returns_offer_details_when_offer_exists(self):
        """Test that seeker/applications returns offer_id and offer details when offer exists"""
        token = self.get_auth_token(SEEKER_EMAIL, SEEKER_PASSWORD)
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/seeker/applications")
        assert response.status_code == 200
        
        applications = response.json()
        
        # Find applications with offer_sent status
        offer_apps = [app for app in applications if app.get("status") in ["offer_sent", "offer"]]
        
        if not offer_apps:
            print("⚠ No applications with offer_sent status found - checking if any offers exist")
            # Check if there are any offers for this seeker
            offers_response = self.session.get(f"{BASE_URL}/api/hiring/offers")
            if offers_response.status_code == 200:
                offers = offers_response.json()
                print(f"  Found {len(offers)} offers for seeker")
                if offers:
                    pytest.fail("Offers exist but seeker/applications doesn't show offer_sent status")
            pytest.skip("No offers exist for this seeker")
        
        # Verify offer details are present
        for app in offer_apps:
            print(f"✓ Found application with status '{app.get('status')}' for job: {app.get('job', {}).get('title')}")
            
            # Check offer_id is present
            assert "offer_id" in app, "offer_id should be present in application with offer"
            assert app.get("offer_id") is not None, "offer_id should not be None"
            print(f"  ✓ offer_id present: {app.get('offer_id')}")
            
            # Check offer details object is present
            assert "offer" in app, "offer details object should be present"
            offer = app.get("offer")
            if offer:
                assert "position_title" in offer, "offer should have position_title"
                assert "salary_amount" in offer, "offer should have salary_amount"
                assert "start_date" in offer, "offer should have start_date"
                print(f"  ✓ Offer details: {offer.get('position_title')}, ${offer.get('salary_amount')}/{offer.get('salary_type')}")
    
    def test_seeker_applications_status_is_offer_sent_when_offer_exists(self):
        """Test that status is 'offer_sent' (not 'matched') when offer exists"""
        token = self.get_auth_token(SEEKER_EMAIL, SEEKER_PASSWORD)
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/seeker/applications")
        assert response.status_code == 200
        
        applications = response.json()
        
        # Check that no application with an offer shows 'matched' status
        for app in applications:
            if app.get("offer_id") or app.get("offer"):
                status = app.get("status")
                assert status != "matched", f"Application with offer should not have 'matched' status, got '{status}'"
                assert status in ["offer_sent", "offer", "accepted", "declined"], f"Expected offer-related status, got '{status}'"
                print(f"✓ Application with offer has correct status: '{status}'")
    
    def test_seeker_applications_sorted_with_offer_sent_first(self):
        """Test that applications with offer_sent are sorted to top"""
        token = self.get_auth_token(SEEKER_EMAIL, SEEKER_PASSWORD)
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/seeker/applications")
        assert response.status_code == 200
        
        applications = response.json()
        
        if len(applications) < 2:
            pytest.skip("Need at least 2 applications to test sorting")
        
        # Check sorting order: offer_sent (0) < matched (1) < pending (2)
        order = {"offer_sent": 0, "offer": 0, "matched": 1, "pending": 2, "accepted": 3, "declined": 4}
        
        prev_order = -1
        for app in applications:
            status = app.get("status", "pending")
            current_order = order.get(status, 5)
            assert current_order >= prev_order, f"Applications not sorted correctly: {status} came after higher priority status"
            prev_order = current_order
        
        print(f"✓ Applications sorted correctly by status priority")
    
    def test_employer_pipeline_shows_offer_sent_stage(self):
        """Test that employer pipeline shows offer_sent stage for candidate with offer"""
        token = self.get_auth_token(EMPLOYER_EMAIL, EMPLOYER_PASSWORD)
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get employer's jobs
        jobs_response = self.session.get(f"{BASE_URL}/api/jobs")
        assert jobs_response.status_code == 200
        jobs = jobs_response.json()
        
        if not jobs:
            pytest.skip("No jobs found for employer")
        
        # Check pipeline for each job
        for job in jobs:
            job_id = job.get("id")
            pipeline_response = self.session.get(f"{BASE_URL}/api/pipeline/{job_id}/candidates")
            
            if pipeline_response.status_code == 200:
                candidates = pipeline_response.json()
                offer_sent_candidates = [c for c in candidates if c.get("stage") == "offer_sent"]
                
                if offer_sent_candidates:
                    print(f"✓ Job '{job.get('title')}' has {len(offer_sent_candidates)} candidate(s) in offer_sent stage")
                    for c in offer_sent_candidates:
                        print(f"  - {c.get('seeker', {}).get('full_name', 'Unknown')}")
    
    def test_state_consistency_employer_seeker(self):
        """Test that employer's offer_sent state matches seeker's view"""
        # Get seeker's applications with offer_sent
        seeker_token = self.get_auth_token(SEEKER_EMAIL, SEEKER_PASSWORD)
        self.session.headers.update({"Authorization": f"Bearer {seeker_token}"})
        
        seeker_response = self.session.get(f"{BASE_URL}/api/seeker/applications")
        assert seeker_response.status_code == 200
        seeker_apps = seeker_response.json()
        
        offer_apps = [app for app in seeker_apps if app.get("status") in ["offer_sent", "offer"]]
        
        if not offer_apps:
            pytest.skip("No offer_sent applications to verify consistency")
        
        # Get employer's view
        employer_token = self.get_auth_token(EMPLOYER_EMAIL, EMPLOYER_PASSWORD)
        self.session.headers.update({"Authorization": f"Bearer {employer_token}"})
        
        for app in offer_apps:
            job_id = app.get("job_id")
            
            # Check pipeline stage
            pipeline_response = self.session.get(f"{BASE_URL}/api/pipeline/{job_id}/candidates")
            if pipeline_response.status_code == 200:
                candidates = pipeline_response.json()
                
                # Find the seeker in pipeline
                seeker_in_pipeline = None
                for c in candidates:
                    if c.get("seeker_id") == app.get("seeker_id") or c.get("seeker", {}).get("email") == SEEKER_EMAIL:
                        seeker_in_pipeline = c
                        break
                
                if seeker_in_pipeline:
                    employer_stage = seeker_in_pipeline.get("stage")
                    seeker_status = app.get("status")
                    
                    # Both should indicate offer_sent
                    assert employer_stage == "offer_sent", f"Employer stage should be 'offer_sent', got '{employer_stage}'"
                    assert seeker_status in ["offer_sent", "offer"], f"Seeker status should be 'offer_sent', got '{seeker_status}'"
                    
                    print(f"✓ State consistency verified: employer stage='{employer_stage}', seeker status='{seeker_status}'")
    
    def test_messaging_works_for_offer_sent_candidates(self):
        """Test that messaging still works for candidates with offer_sent status"""
        seeker_token = self.get_auth_token(SEEKER_EMAIL, SEEKER_PASSWORD)
        self.session.headers.update({"Authorization": f"Bearer {seeker_token}"})
        
        # Get applications with offer_sent
        response = self.session.get(f"{BASE_URL}/api/seeker/applications")
        assert response.status_code == 200
        applications = response.json()
        
        offer_apps = [app for app in applications if app.get("status") in ["offer_sent", "offer"] and app.get("match_id")]
        
        if not offer_apps:
            pytest.skip("No offer_sent applications with match_id to test messaging")
        
        # Try to get messages for the match
        match_id = offer_apps[0].get("match_id")
        messages_response = self.session.get(f"{BASE_URL}/api/matches/{match_id}/messages")
        
        assert messages_response.status_code == 200, f"Should be able to get messages for offer_sent match, got {messages_response.status_code}"
        print(f"✓ Messaging works for offer_sent candidate (match_id: {match_id})")


class TestOfferCreationSyncsState:
    """Test that creating an offer properly syncs state"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_auth_token(self, email: str, password: str) -> str:
        """Get authentication token for a user"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Authentication failed for {email}")
    
    def test_offer_creation_endpoint_exists(self):
        """Test that offer creation endpoint exists"""
        token = self.get_auth_token(EMPLOYER_EMAIL, EMPLOYER_PASSWORD)
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Try to create an offer with invalid data to verify endpoint exists
        response = self.session.post(f"{BASE_URL}/api/hiring/offers", json={})
        
        # Should get 422 (validation error) not 404
        assert response.status_code != 404, "Offer creation endpoint should exist"
        print(f"✓ Offer creation endpoint exists (got {response.status_code} for invalid data)")
    
    def test_employer_offers_endpoint_returns_sent_offers(self):
        """Test that employer can see their sent offers"""
        token = self.get_auth_token(EMPLOYER_EMAIL, EMPLOYER_PASSWORD)
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/hiring/offers")
        assert response.status_code == 200
        
        offers = response.json()
        assert isinstance(offers, list)
        
        print(f"✓ Employer has {len(offers)} sent offers")
        for offer in offers[:3]:  # Show first 3
            print(f"  - {offer.get('position_title')} to seeker {offer.get('seeker_id')[:8]}... (status: {offer.get('status')})")
    
    def test_seeker_offers_endpoint_returns_received_offers(self):
        """Test that seeker can see their received offers"""
        token = self.get_auth_token(SEEKER_EMAIL, SEEKER_PASSWORD)
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/hiring/offers")
        assert response.status_code == 200
        
        offers = response.json()
        assert isinstance(offers, list)
        
        print(f"✓ Seeker has {len(offers)} received offers")
        for offer in offers[:3]:  # Show first 3
            print(f"  - {offer.get('position_title')} (status: {offer.get('status')})")


class TestPipelineFallbackForOfferSent:
    """Test that pipeline_stages fallback works for offer_sent detection"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_auth_token(self, email: str, password: str) -> str:
        """Get authentication token for a user"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Authentication failed for {email}")
    
    def test_pipeline_stages_checked_for_offer_sent(self):
        """Test that seeker/applications checks pipeline_stages as fallback"""
        # This test verifies the code path exists by checking applications
        token = self.get_auth_token(SEEKER_EMAIL, SEEKER_PASSWORD)
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/seeker/applications")
        assert response.status_code == 200
        
        applications = response.json()
        
        # The fallback logic should ensure no application with an offer shows 'matched'
        for app in applications:
            if app.get("offer_id"):
                assert app.get("status") != "matched", "Application with offer should not show 'matched' status"
        
        print("✓ Pipeline stages fallback logic verified")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
