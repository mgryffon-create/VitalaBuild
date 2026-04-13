"""
Test suite for Onboarding Gate and Profile Completion features
Tests:
- GET /api/profile/completion endpoint for seeker and poster roles
- Profile completion structure validation (8 checks for seeker, 5 for poster)
- OnboardingGate blocking behavior for incomplete profiles
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SEEKER_EMAIL = "seeker_test@vitalamatch.com"
SEEKER_PASSWORD = "test123"
EMPLOYER_EMAIL = "employer_test@vitalamatch.com"
EMPLOYER_PASSWORD = "test123"


class TestProfileCompletionEndpoint:
    """Tests for GET /api/profile/completion endpoint"""
    
    @pytest.fixture
    def seeker_token(self):
        """Get seeker authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        assert response.status_code == 200, f"Seeker login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture
    def employer_token(self):
        """Get employer authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYER_EMAIL,
            "password": EMPLOYER_PASSWORD
        })
        assert response.status_code == 200, f"Employer login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture
    def incomplete_seeker_token(self):
        """Register a new seeker with incomplete profile"""
        timestamp = int(datetime.now().timestamp())
        email = f"test_incomplete_{timestamp}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "test123",
            "role": "seeker",
            "full_name": "Test Incomplete Seeker"
        })
        assert response.status_code == 200, f"Registration failed: {response.text}"
        return response.json()["access_token"]
    
    def test_seeker_profile_completion_structure(self, seeker_token):
        """Test that seeker profile completion returns correct structure with 8 checks"""
        response = requests.get(
            f"{BASE_URL}/api/profile/completion",
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "role" in data
        assert data["role"] == "seeker"
        assert "complete" in data
        assert "percentage" in data
        assert "filled" in data
        assert "total" in data
        assert "checks" in data
        
        # Verify 8 checks for seeker
        assert data["total"] == 8
        expected_checks = [
            "specialty",
            "years_experience",
            "availability",
            "preferred_shift",
            "travel_readiness",
            "job_type_preference",
            "experience_highlights",
            "certifications_or_licenses"
        ]
        for check in expected_checks:
            assert check in data["checks"], f"Missing check: {check}"
        
        print(f"Seeker profile completion: {data['percentage']}% ({data['filled']}/{data['total']})")
    
    def test_poster_profile_completion_structure(self, employer_token):
        """Test that poster profile completion returns correct structure with 5 checks"""
        response = requests.get(
            f"{BASE_URL}/api/profile/completion",
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "role" in data
        assert data["role"] == "poster"
        assert "complete" in data
        assert "percentage" in data
        assert "filled" in data
        assert "total" in data
        assert "checks" in data
        
        # Verify 5 checks for poster
        assert data["total"] == 5
        expected_checks = [
            "company_name",
            "company_description",
            "contact_info",
            "has_job_posted",
            "has_complete_job"
        ]
        for check in expected_checks:
            assert check in data["checks"], f"Missing check: {check}"
        
        print(f"Poster profile completion: {data['percentage']}% ({data['filled']}/{data['total']})")
    
    def test_incomplete_seeker_has_zero_completion(self, incomplete_seeker_token):
        """Test that a newly registered seeker has 0% completion"""
        response = requests.get(
            f"{BASE_URL}/api/profile/completion",
            headers={"Authorization": f"Bearer {incomplete_seeker_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["complete"] == False
        assert data["percentage"] == 0
        assert data["filled"] == 0
        assert data["total"] == 8
        
        # All checks should be False
        for check, value in data["checks"].items():
            assert value == False, f"Check {check} should be False for incomplete profile"
        
        print("New seeker correctly shows 0% completion")
    
    def test_complete_seeker_has_100_completion(self, seeker_token):
        """Test that the test seeker has 100% completion"""
        response = requests.get(
            f"{BASE_URL}/api/profile/completion",
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["complete"] == True
        assert data["percentage"] == 100
        assert data["filled"] == 8
        
        print("Test seeker correctly shows 100% completion")
    
    def test_complete_poster_has_100_completion(self, employer_token):
        """Test that the test employer has 100% completion"""
        response = requests.get(
            f"{BASE_URL}/api/profile/completion",
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["complete"] == True
        assert data["percentage"] == 100
        assert data["filled"] == 5
        
        print("Test employer correctly shows 100% completion")
    
    def test_profile_completion_requires_auth(self):
        """Test that profile completion endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/profile/completion")
        assert response.status_code in [401, 403]
        print("Profile completion correctly requires authentication")


class TestSeekerDashboard:
    """Tests for Seeker Dashboard API calls"""
    
    @pytest.fixture
    def seeker_token(self):
        """Get seeker authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_seeker_stats_endpoint(self, seeker_token):
        """Test that seeker stats endpoint works"""
        response = requests.get(
            f"{BASE_URL}/api/stats",
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        assert response.status_code == 200
        print("Seeker stats endpoint working")
    
    def test_seeker_profile_endpoint(self, seeker_token):
        """Test that seeker profile endpoint works"""
        response = requests.get(
            f"{BASE_URL}/api/profile/seeker",
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        assert response.status_code == 200
        print("Seeker profile endpoint working")
    
    def test_seeker_matches_endpoint(self, seeker_token):
        """Test that matches endpoint works"""
        response = requests.get(
            f"{BASE_URL}/api/matches",
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        assert response.status_code == 200
        print("Matches endpoint working")


class TestPosterDashboard:
    """Tests for Poster Dashboard API calls"""
    
    @pytest.fixture
    def employer_token(self):
        """Get employer authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYER_EMAIL,
            "password": EMPLOYER_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_poster_stats_endpoint(self, employer_token):
        """Test that poster stats endpoint works"""
        response = requests.get(
            f"{BASE_URL}/api/stats",
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        assert response.status_code == 200
        print("Poster stats endpoint working")
    
    def test_poster_jobs_endpoint(self, employer_token):
        """Test that poster jobs endpoint works"""
        response = requests.get(
            f"{BASE_URL}/api/jobs",
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        assert response.status_code == 200
        print("Poster jobs endpoint working")
    
    def test_poster_profile_endpoint(self, employer_token):
        """Test that poster profile endpoint works"""
        response = requests.get(
            f"{BASE_URL}/api/profile/poster",
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        assert response.status_code == 200
        print("Poster profile endpoint working")


class TestOnboardingGateRoutes:
    """Tests for routes that should be gated by OnboardingGate"""
    
    @pytest.fixture
    def seeker_token(self):
        """Get seeker authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_swipe_jobs_endpoint_works(self, seeker_token):
        """Test that swipe jobs endpoint works for authenticated seeker"""
        response = requests.get(
            f"{BASE_URL}/api/swipe/jobs",
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        assert response.status_code == 200
        print("Swipe jobs endpoint working")
    
    def test_hiring_offers_endpoint_works(self, seeker_token):
        """Test that hiring offers endpoint works"""
        response = requests.get(
            f"{BASE_URL}/api/hiring/offers",
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        assert response.status_code == 200
        print("Hiring offers endpoint working")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
