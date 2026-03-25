"""
Test Phase 1 Employer Workflow:
- Employer dashboard stats (Jobs Posted, Candidates, Offers Sent)
- GET /api/employer/candidates - returns seekers who liked employer's jobs
- POST /api/employer/candidates/{seeker_id}/accept - creates a match
- POST /api/hiring/offers - creates an offer
- GET /api/hiring/offers - returns offers
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


class TestEmployerAuthentication:
    """Test employer login and token retrieval"""
    
    def test_employer_login(self):
        """Employer can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYER_EMAIL,
            "password": EMPLOYER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["role"] == "poster"
        print(f"✓ Employer login successful, user_id: {data['user']['id']}")


class TestEmployerCandidatesEndpoint:
    """Test GET /api/employer/candidates endpoint"""
    
    @pytest.fixture
    def employer_token(self):
        """Get employer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYER_EMAIL,
            "password": EMPLOYER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Employer authentication failed")
    
    @pytest.fixture
    def seeker_token(self):
        """Get seeker auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Seeker authentication failed")
    
    def test_get_candidates_requires_auth(self):
        """GET /api/employer/candidates requires authentication"""
        response = requests.get(f"{BASE_URL}/api/employer/candidates")
        assert response.status_code in [401, 403]  # Either is acceptable for unauthenticated
        print("✓ Candidates endpoint requires authentication")
    
    def test_get_candidates_employer_only(self, seeker_token):
        """GET /api/employer/candidates is employer-only"""
        headers = {"Authorization": f"Bearer {seeker_token}"}
        response = requests.get(f"{BASE_URL}/api/employer/candidates", headers=headers)
        assert response.status_code == 403
        print("✓ Candidates endpoint rejects seekers (403)")
    
    def test_get_candidates_success(self, employer_token):
        """GET /api/employer/candidates returns candidates list"""
        headers = {"Authorization": f"Bearer {employer_token}"}
        response = requests.get(f"{BASE_URL}/api/employer/candidates", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Candidates endpoint returns {len(data)} candidates")
        
        # Verify candidate structure if any exist
        if len(data) > 0:
            candidate = data[0]
            assert "seeker_id" in candidate
            assert "job_id" in candidate
            assert "status" in candidate
            assert "seeker" in candidate
            assert "job" in candidate
            assert candidate["status"] in ["pending", "matched", "offer_sent"]
            print(f"  - First candidate status: {candidate['status']}")
            print(f"  - Seeker: {candidate['seeker'].get('full_name')}")
            print(f"  - Job: {candidate['job'].get('title')}")
        return data


class TestAcceptCandidateEndpoint:
    """Test POST /api/employer/candidates/{seeker_id}/accept endpoint"""
    
    @pytest.fixture
    def employer_token(self):
        """Get employer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYER_EMAIL,
            "password": EMPLOYER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Employer authentication failed")
    
    @pytest.fixture
    def seeker_token(self):
        """Get seeker auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Seeker authentication failed")
    
    def test_accept_requires_auth(self):
        """POST /api/employer/candidates/{seeker_id}/accept requires auth"""
        response = requests.post(f"{BASE_URL}/api/employer/candidates/fake-id/accept?job_id=fake-job")
        assert response.status_code in [401, 403]  # Either is acceptable for unauthenticated
        print("✓ Accept endpoint requires authentication")
    
    def test_accept_employer_only(self, seeker_token):
        """POST /api/employer/candidates/{seeker_id}/accept is employer-only"""
        headers = {"Authorization": f"Bearer {seeker_token}"}
        response = requests.post(
            f"{BASE_URL}/api/employer/candidates/fake-id/accept?job_id=fake-job",
            headers=headers
        )
        assert response.status_code == 403
        print("✓ Accept endpoint rejects seekers (403)")
    
    def test_accept_candidate_flow(self, employer_token):
        """Test accepting a pending candidate creates a match"""
        headers = {"Authorization": f"Bearer {employer_token}"}
        
        # First get candidates
        response = requests.get(f"{BASE_URL}/api/employer/candidates", headers=headers)
        assert response.status_code == 200
        candidates = response.json()
        
        # Find a pending candidate
        pending_candidates = [c for c in candidates if c["status"] == "pending"]
        
        if not pending_candidates:
            print("⚠ No pending candidates to test accept flow - skipping")
            pytest.skip("No pending candidates available")
        
        candidate = pending_candidates[0]
        seeker_id = candidate["seeker_id"]
        job_id = candidate["job_id"]
        
        print(f"  Testing accept for seeker: {candidate['seeker'].get('full_name')}")
        print(f"  Job: {candidate['job'].get('title')}")
        
        # Accept the candidate
        response = requests.post(
            f"{BASE_URL}/api/employer/candidates/{seeker_id}/accept?job_id={job_id}",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "match_id" in data
        print(f"✓ Candidate accepted, match_id: {data['match_id']}")
        
        # Verify status changed to matched
        response = requests.get(f"{BASE_URL}/api/employer/candidates", headers=headers)
        candidates = response.json()
        updated_candidate = next((c for c in candidates if c["seeker_id"] == seeker_id and c["job_id"] == job_id), None)
        
        if updated_candidate:
            assert updated_candidate["status"] in ["matched", "offer_sent"]
            print(f"✓ Candidate status updated to: {updated_candidate['status']}")
        
        return data["match_id"]


class TestHiringOffersEndpoint:
    """Test POST/GET /api/hiring/offers endpoints"""
    
    @pytest.fixture
    def employer_token(self):
        """Get employer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYER_EMAIL,
            "password": EMPLOYER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Employer authentication failed")
    
    @pytest.fixture
    def seeker_token(self):
        """Get seeker auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Seeker authentication failed")
    
    def test_get_offers_requires_auth(self):
        """GET /api/hiring/offers requires authentication"""
        response = requests.get(f"{BASE_URL}/api/hiring/offers")
        assert response.status_code in [401, 403]  # Either is acceptable for unauthenticated
        print("✓ Offers endpoint requires authentication")
    
    def test_get_offers_employer(self, employer_token):
        """GET /api/hiring/offers returns employer's sent offers"""
        headers = {"Authorization": f"Bearer {employer_token}"}
        response = requests.get(f"{BASE_URL}/api/hiring/offers", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Employer has {len(data)} offers sent")
        return data
    
    def test_get_offers_seeker(self, seeker_token):
        """GET /api/hiring/offers returns seeker's received offers"""
        headers = {"Authorization": f"Bearer {seeker_token}"}
        response = requests.get(f"{BASE_URL}/api/hiring/offers", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Seeker has {len(data)} offers received")
        return data
    
    def test_create_offer_requires_auth(self):
        """POST /api/hiring/offers requires authentication"""
        response = requests.post(f"{BASE_URL}/api/hiring/offers", json={})
        assert response.status_code in [401, 403]  # Either is acceptable for unauthenticated
        print("✓ Create offer requires authentication")
    
    def test_create_offer_employer_only(self, seeker_token):
        """POST /api/hiring/offers is employer-only"""
        headers = {"Authorization": f"Bearer {seeker_token}"}
        response = requests.post(f"{BASE_URL}/api/hiring/offers", json={
            "match_id": "fake",
            "job_id": "fake",
            "seeker_id": "fake",
            "position_title": "Test",
            "salary_amount": 50,
            "salary_type": "hourly",
            "start_date": "2026-02-01",
            "expiration_date": "2026-02-15"
        }, headers=headers)
        assert response.status_code == 403
        print("✓ Create offer rejects seekers (403)")
    
    def test_create_offer_flow(self, employer_token):
        """Test creating an offer for a matched candidate"""
        headers = {"Authorization": f"Bearer {employer_token}"}
        
        # Get candidates to find a matched one
        response = requests.get(f"{BASE_URL}/api/employer/candidates", headers=headers)
        assert response.status_code == 200
        candidates = response.json()
        
        # Find a matched candidate (not already offer_sent)
        matched_candidates = [c for c in candidates if c["status"] == "matched"]
        
        if not matched_candidates:
            print("⚠ No matched candidates to test offer flow - skipping")
            pytest.skip("No matched candidates available")
        
        candidate = matched_candidates[0]
        print(f"  Creating offer for: {candidate['seeker'].get('full_name')}")
        print(f"  Job: {candidate['job'].get('title')}")
        print(f"  Match ID: {candidate.get('match_id')}")
        
        # Create the offer
        offer_data = {
            "match_id": candidate["match_id"],
            "job_id": candidate["job_id"],
            "seeker_id": candidate["seeker_id"],
            "position_title": candidate["job"].get("title", "Healthcare Position"),
            "salary_amount": 45.00,
            "salary_type": "hourly",
            "start_date": "2026-04-01",
            "expiration_date": "2026-04-15",
            "conditions": ["Background check", "Drug screening"],
            "benefits_summary": "Health insurance, 401k"
        }
        
        response = requests.post(f"{BASE_URL}/api/hiring/offers", json=offer_data, headers=headers)
        assert response.status_code == 200, f"Create offer failed: {response.text}"
        data = response.json()
        assert "id" in data
        print(f"✓ Offer created successfully, offer_id: {data['id']}")
        
        # Verify offer appears in list
        response = requests.get(f"{BASE_URL}/api/hiring/offers", headers=headers)
        assert response.status_code == 200, f"Get offers failed: {response.text}"
        offers = response.json()
        created_offer = next((o for o in offers if o["id"] == data["id"]), None)
        assert created_offer is not None
        assert created_offer["status"] == "pending"
        print(f"✓ Offer verified in offers list with status: {created_offer['status']}")


class TestEmployerDashboardStats:
    """Test employer dashboard stats endpoints"""
    
    @pytest.fixture
    def employer_token(self):
        """Get employer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYER_EMAIL,
            "password": EMPLOYER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Employer authentication failed")
    
    def test_stats_endpoint(self, employer_token):
        """GET /api/stats returns job stats"""
        headers = {"Authorization": f"Bearer {employer_token}"}
        response = requests.get(f"{BASE_URL}/api/stats", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "active_jobs" in data
        print(f"✓ Stats endpoint returns active_jobs: {data.get('active_jobs')}")
    
    def test_jobs_endpoint(self, employer_token):
        """GET /api/jobs returns employer's jobs"""
        headers = {"Authorization": f"Bearer {employer_token}"}
        response = requests.get(f"{BASE_URL}/api/jobs", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Jobs endpoint returns {len(data)} jobs")
        
        if len(data) > 0:
            job = data[0]
            assert "id" in job
            assert "title" in job
            print(f"  - First job: {job.get('title')}")


class TestEmployerVerificationStatus:
    """Test employer verification status endpoint"""
    
    @pytest.fixture
    def employer_token(self):
        """Get employer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYER_EMAIL,
            "password": EMPLOYER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Employer authentication failed")
    
    def test_verification_status(self, employer_token):
        """GET /api/employer/verification-status returns verification info"""
        headers = {"Authorization": f"Bearer {employer_token}"}
        response = requests.get(f"{BASE_URL}/api/employer/verification-status", headers=headers)
        # May return 200 or 404 depending on if profile exists
        assert response.status_code in [200, 404]
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Verification status: business_email_verified={data.get('business_email_verified')}")
        else:
            print("⚠ No verification status (profile may not exist)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
