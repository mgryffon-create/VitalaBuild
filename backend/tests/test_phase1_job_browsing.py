"""
Phase 1 Job Browsing and Matching Flow Tests
Tests for:
- Find Jobs page (swipe/jobs endpoint)
- Swipe actions (like/pass)
- Seeker applications endpoint
- Matches endpoint for employers
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


class TestAuthentication:
    """Authentication tests for seeker and employer"""
    
    def test_seeker_login(self):
        """Test seeker can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "seeker"
        print(f"✓ Seeker login successful: {data['user']['email']}")
    
    def test_employer_login(self):
        """Test employer can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYER_EMAIL,
            "password": EMPLOYER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "poster"
        print(f"✓ Employer login successful: {data['user']['email']}")


class TestSwipeJobs:
    """Tests for GET /api/swipe/jobs endpoint"""
    
    @pytest.fixture
    def seeker_token(self):
        """Get seeker auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Seeker login failed")
        return response.json()["access_token"]
    
    def test_get_swipeable_jobs(self, seeker_token):
        """Test seeker can get jobs to swipe on"""
        response = requests.get(
            f"{BASE_URL}/api/swipe/jobs",
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        assert response.status_code == 200, f"Failed to get jobs: {response.text}"
        jobs = response.json()
        assert isinstance(jobs, list)
        print(f"✓ Got {len(jobs)} swipeable jobs")
        
        # If jobs exist, verify structure
        if len(jobs) > 0:
            job = jobs[0]
            assert "id" in job
            assert "title" in job
            assert "location" in job
            assert "pay_range" in job
            assert "specialty" in job
            assert "description" in job
            print(f"✓ Job card has required fields: title={job['title']}, location={job['location']}")
    
    def test_swipe_jobs_requires_auth(self):
        """Test that swipe/jobs requires authentication"""
        response = requests.get(f"{BASE_URL}/api/swipe/jobs")
        assert response.status_code in [401, 403], "Should require auth"
        print("✓ Swipe jobs endpoint requires authentication")
    
    def test_employer_cannot_swipe_jobs(self):
        """Test that employers cannot access seeker swipe endpoint"""
        # Login as employer
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYER_EMAIL,
            "password": EMPLOYER_PASSWORD
        })
        if login_response.status_code != 200:
            pytest.skip("Employer login failed")
        token = login_response.json()["access_token"]
        
        response = requests.get(
            f"{BASE_URL}/api/swipe/jobs",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 403, "Employers should not access seeker swipe"
        print("✓ Employers correctly blocked from seeker swipe endpoint")


class TestSwipeActions:
    """Tests for POST /api/swipe endpoint"""
    
    @pytest.fixture
    def seeker_token(self):
        """Get seeker auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Seeker login failed")
        return response.json()["access_token"]
    
    @pytest.fixture
    def available_job(self, seeker_token):
        """Get an available job to swipe on"""
        response = requests.get(
            f"{BASE_URL}/api/swipe/jobs",
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        if response.status_code != 200 or len(response.json()) == 0:
            pytest.skip("No jobs available to swipe")
        return response.json()[0]
    
    def test_swipe_like_action(self, seeker_token, available_job):
        """Test seeker can like a job"""
        response = requests.post(
            f"{BASE_URL}/api/swipe",
            headers={"Authorization": f"Bearer {seeker_token}"},
            json={"target_id": available_job["id"], "action": "like"}
        )
        assert response.status_code == 200, f"Swipe failed: {response.text}"
        data = response.json()
        assert "message" in data
        assert data["message"] == "Swipe recorded"
        print(f"✓ Successfully liked job: {available_job['title']}")
    
    def test_swipe_pass_action(self, seeker_token, available_job):
        """Test seeker can pass on a job"""
        response = requests.post(
            f"{BASE_URL}/api/swipe",
            headers={"Authorization": f"Bearer {seeker_token}"},
            json={"target_id": available_job["id"], "action": "pass"}
        )
        assert response.status_code == 200, f"Swipe failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✓ Successfully passed on job: {available_job['title']}")


class TestSeekerApplications:
    """Tests for GET /api/seeker/applications endpoint"""
    
    @pytest.fixture
    def seeker_token(self):
        """Get seeker auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Seeker login failed")
        return response.json()["access_token"]
    
    def test_get_seeker_applications(self, seeker_token):
        """Test seeker can get their applications"""
        response = requests.get(
            f"{BASE_URL}/api/seeker/applications",
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        assert response.status_code == 200, f"Failed to get applications: {response.text}"
        applications = response.json()
        assert isinstance(applications, list)
        print(f"✓ Got {len(applications)} applications")
        
        # If applications exist, verify structure
        if len(applications) > 0:
            app = applications[0]
            assert "id" in app
            assert "job_id" in app
            assert "status" in app
            assert app["status"] in ["pending", "matched", "offer"]
            assert "job" in app
            assert "title" in app["job"]
            print(f"✓ Application has required fields: status={app['status']}, job={app['job']['title']}")
    
    def test_applications_requires_auth(self):
        """Test that applications endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/seeker/applications")
        assert response.status_code in [401, 403], "Should require auth"
        print("✓ Applications endpoint requires authentication")
    
    def test_employer_cannot_access_seeker_applications(self):
        """Test that employers cannot access seeker applications"""
        # Login as employer
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYER_EMAIL,
            "password": EMPLOYER_PASSWORD
        })
        if login_response.status_code != 200:
            pytest.skip("Employer login failed")
        token = login_response.json()["access_token"]
        
        response = requests.get(
            f"{BASE_URL}/api/seeker/applications",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 403, "Employers should not access seeker applications"
        print("✓ Employers correctly blocked from seeker applications endpoint")


class TestEmployerMatches:
    """Tests for GET /api/matches endpoint (employer view)"""
    
    @pytest.fixture
    def employer_token(self):
        """Get employer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYER_EMAIL,
            "password": EMPLOYER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Employer login failed")
        return response.json()["access_token"]
    
    def test_get_employer_matches(self, employer_token):
        """Test employer can get their matches"""
        response = requests.get(
            f"{BASE_URL}/api/matches",
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        assert response.status_code == 200, f"Failed to get matches: {response.text}"
        matches = response.json()
        assert isinstance(matches, list)
        print(f"✓ Got {len(matches)} matches for employer")
    
    def test_matches_requires_auth(self):
        """Test that matches endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/matches")
        assert response.status_code in [401, 403], "Should require auth"
        print("✓ Matches endpoint requires authentication")


class TestJobCardContent:
    """Tests to verify job card content structure"""
    
    @pytest.fixture
    def seeker_token(self):
        """Get seeker auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Seeker login failed")
        return response.json()["access_token"]
    
    def test_job_card_has_all_required_fields(self, seeker_token):
        """Test that job cards have all required display fields"""
        response = requests.get(
            f"{BASE_URL}/api/swipe/jobs",
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        if response.status_code != 200 or len(response.json()) == 0:
            pytest.skip("No jobs available")
        
        job = response.json()[0]
        
        # Required fields for job card display
        required_fields = ["title", "location", "pay_range", "specialty", "description"]
        for field in required_fields:
            assert field in job, f"Missing required field: {field}"
        
        # Pay range should have min/max
        assert "min" in job["pay_range"] or "max" in job["pay_range"], "Pay range should have min or max"
        
        # Optional but expected fields
        optional_fields = ["company_name", "duration", "experience_required", "benefits"]
        present_optional = [f for f in optional_fields if f in job]
        print(f"✓ Job card has all required fields and {len(present_optional)} optional fields")
        print(f"  Title: {job['title']}")
        print(f"  Location: {job['location']}")
        print(f"  Pay: ${job['pay_range'].get('min', 'N/A')}-${job['pay_range'].get('max', 'N/A')}")
        print(f"  Specialty: {job['specialty']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
