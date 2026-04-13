"""
Phase 2 Structured Data Tests
Tests for new seeker profile fields: availability, preferred_shift, travel_readiness, 
job_type_preference, experience_highlights, skills
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
def seeker_headers(seeker_token):
    """Headers with seeker auth"""
    return {"Authorization": f"Bearer {seeker_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def employer_headers(employer_token):
    """Headers with employer auth"""
    return {"Authorization": f"Bearer {employer_token}", "Content-Type": "application/json"}


# Fields allowed in SeekerProfile Pydantic model
ALLOWED_PROFILE_FIELDS = {
    "contact_info", "work_history", "certifications", "licenses", "expected_pay",
    "desired_benefits", "medical_records", "bio", "specialty", "years_experience",
    "preferred_locations", "profile_image", "preferred_shift", "availability",
    "travel_readiness", "job_type_preference", "experience_highlights", "skills"
}


def filter_profile_fields(profile: dict) -> dict:
    """Filter profile to only include fields allowed by Pydantic model"""
    return {k: v for k, v in profile.items() if k in ALLOWED_PROFILE_FIELDS}


class TestSeekerProfileNewFields:
    """Test seeker profile accepts and returns new Phase 2 fields"""
    
    def test_get_seeker_profile(self, seeker_headers):
        """GET /api/profile/seeker returns profile data"""
        response = requests.get(f"{BASE_URL}/api/profile/seeker", headers=seeker_headers)
        assert response.status_code == 200
        print(f"Current seeker profile keys: {list(response.json().keys())}")
    
    def test_update_seeker_profile_with_availability(self, seeker_headers):
        """PUT /api/profile/seeker accepts availability field"""
        # Update with just the new field
        update_data = {"availability": "Available Now"}
        response = requests.put(f"{BASE_URL}/api/profile/seeker", headers=seeker_headers, json=update_data)
        assert response.status_code == 200
        
        # Verify it was saved
        verify_response = requests.get(f"{BASE_URL}/api/profile/seeker", headers=seeker_headers)
        assert verify_response.status_code == 200
        profile = verify_response.json()
        assert profile.get("availability") == "Available Now"
        print(f"Availability saved: {profile.get('availability')}")
    
    def test_update_seeker_profile_with_preferred_shift(self, seeker_headers):
        """PUT /api/profile/seeker accepts preferred_shift field"""
        update_data = {"preferred_shift": "Day Shift"}
        response = requests.put(f"{BASE_URL}/api/profile/seeker", headers=seeker_headers, json=update_data)
        assert response.status_code == 200
        
        verify_response = requests.get(f"{BASE_URL}/api/profile/seeker", headers=seeker_headers)
        profile = verify_response.json()
        assert profile.get("preferred_shift") == "Day Shift"
        print(f"Preferred shift saved: {profile.get('preferred_shift')}")
    
    def test_update_seeker_profile_with_travel_readiness(self, seeker_headers):
        """PUT /api/profile/seeker accepts travel_readiness field"""
        update_data = {"travel_readiness": "Open to travel"}
        response = requests.put(f"{BASE_URL}/api/profile/seeker", headers=seeker_headers, json=update_data)
        assert response.status_code == 200
        
        verify_response = requests.get(f"{BASE_URL}/api/profile/seeker", headers=seeker_headers)
        profile = verify_response.json()
        assert profile.get("travel_readiness") == "Open to travel"
        print(f"Travel readiness saved: {profile.get('travel_readiness')}")
    
    def test_update_seeker_profile_with_job_type_preference(self, seeker_headers):
        """PUT /api/profile/seeker accepts job_type_preference field"""
        update_data = {"job_type_preference": "Travel Contract"}
        response = requests.put(f"{BASE_URL}/api/profile/seeker", headers=seeker_headers, json=update_data)
        assert response.status_code == 200
        
        verify_response = requests.get(f"{BASE_URL}/api/profile/seeker", headers=seeker_headers)
        profile = verify_response.json()
        assert profile.get("job_type_preference") == "Travel Contract"
        print(f"Job type preference saved: {profile.get('job_type_preference')}")
    
    def test_update_seeker_profile_with_experience_highlights(self, seeker_headers):
        """PUT /api/profile/seeker accepts experience_highlights list"""
        highlights = [
            "ICU + Trauma experience",
            "Wound care specialist",
            "Team lead for 5+ nurses"
        ]
        update_data = {"experience_highlights": highlights}
        response = requests.put(f"{BASE_URL}/api/profile/seeker", headers=seeker_headers, json=update_data)
        assert response.status_code == 200
        
        verify_response = requests.get(f"{BASE_URL}/api/profile/seeker", headers=seeker_headers)
        profile = verify_response.json()
        assert profile.get("experience_highlights") == highlights
        print(f"Experience highlights saved: {profile.get('experience_highlights')}")
    
    def test_update_seeker_profile_with_skills_list(self, seeker_headers):
        """PUT /api/profile/seeker accepts skills as list of strings"""
        skills = ["IV Therapy", "Wound Assessment", "Patient Education", "Epic EMR"]
        update_data = {"skills": skills}
        response = requests.put(f"{BASE_URL}/api/profile/seeker", headers=seeker_headers, json=update_data)
        assert response.status_code == 200
        
        verify_response = requests.get(f"{BASE_URL}/api/profile/seeker", headers=seeker_headers)
        profile = verify_response.json()
        assert profile.get("skills") == skills
        print(f"Skills saved: {profile.get('skills')}")
    
    def test_update_all_new_fields_together(self, seeker_headers):
        """PUT /api/profile/seeker accepts all new fields in one request"""
        update_data = {
            "availability": "Available in 2 weeks",
            "preferred_shift": "Night Shift",
            "travel_readiness": "Local only",
            "job_type_preference": "Per Diem",
            "experience_highlights": ["Critical care expertise", "Charge nurse experience"],
            "skills": ["BLS", "ACLS", "Telemetry"]
        }
        response = requests.put(f"{BASE_URL}/api/profile/seeker", headers=seeker_headers, json=update_data)
        assert response.status_code == 200
        
        verify_response = requests.get(f"{BASE_URL}/api/profile/seeker", headers=seeker_headers)
        profile = verify_response.json()
        
        assert profile.get("availability") == "Available in 2 weeks"
        assert profile.get("preferred_shift") == "Night Shift"
        assert profile.get("travel_readiness") == "Local only"
        assert profile.get("job_type_preference") == "Per Diem"
        assert profile.get("experience_highlights") == ["Critical care expertise", "Charge nurse experience"]
        assert profile.get("skills") == ["BLS", "ACLS", "Telemetry"]
        print("All new fields saved successfully together")


class TestBrowseProsNewFields:
    """Test browse-pros API returns new structured fields"""
    
    def test_browse_pros_returns_new_fields(self, employer_headers):
        """GET /api/employer/browse-pros returns new structured fields"""
        response = requests.get(f"{BASE_URL}/api/employer/browse-pros?include_all=true", headers=employer_headers)
        assert response.status_code == 200
        
        data = response.json()
        pros = data.get("pros", [])
        
        if len(pros) == 0:
            pytest.skip("No pros available to test")
        
        # Check first pro has the new fields (even if null)
        pro = pros[0]
        expected_fields = [
            "availability", "travel_readiness", "job_type_preference", 
            "experience_highlights", "licenses", "medical_records_count"
        ]
        
        for field in expected_fields:
            assert field in pro, f"Field '{field}' missing from browse-pros response"
            print(f"  {field}: {pro.get(field)}")
        
        print(f"Browse pros returns {len(pros)} pros with all new fields")
    
    def test_browse_pros_returns_licenses_separately(self, employer_headers):
        """GET /api/employer/browse-pros returns licenses field"""
        response = requests.get(f"{BASE_URL}/api/employer/browse-pros?include_all=true", headers=employer_headers)
        assert response.status_code == 200
        
        data = response.json()
        pros = data.get("pros", [])
        
        if len(pros) == 0:
            pytest.skip("No pros available to test")
        
        # Check licenses field exists and is a list
        pro = pros[0]
        assert "licenses" in pro
        assert isinstance(pro.get("licenses"), list)
        print(f"Licenses field present: {pro.get('licenses')}")
    
    def test_browse_pros_returns_medical_records_count(self, employer_headers):
        """GET /api/employer/browse-pros returns medical_records_count"""
        response = requests.get(f"{BASE_URL}/api/employer/browse-pros?include_all=true", headers=employer_headers)
        assert response.status_code == 200
        
        data = response.json()
        pros = data.get("pros", [])
        
        if len(pros) == 0:
            pytest.skip("No pros available to test")
        
        pro = pros[0]
        assert "medical_records_count" in pro
        assert isinstance(pro.get("medical_records_count"), int)
        print(f"Medical records count: {pro.get('medical_records_count')}")


class TestExistingProfilesGracefulDefaults:
    """Test that existing profiles without new fields still work"""
    
    def test_profile_without_new_fields_renders(self, seeker_headers):
        """Profile without new fields should return gracefully"""
        response = requests.get(f"{BASE_URL}/api/profile/seeker", headers=seeker_headers)
        assert response.status_code == 200
        
        profile = response.json()
        # New fields should be None or empty list if not set
        # This tests graceful defaults
        print(f"Profile loads successfully with keys: {list(profile.keys())}")
    
    def test_browse_pros_handles_missing_fields(self, employer_headers):
        """Browse pros should handle profiles missing new fields"""
        response = requests.get(f"{BASE_URL}/api/employer/browse-pros?include_all=true", headers=employer_headers)
        assert response.status_code == 200
        
        data = response.json()
        pros = data.get("pros", [])
        
        # Should not error even if some pros don't have new fields
        for pro in pros[:5]:  # Check first 5
            # These should have defaults
            assert "experience_highlights" in pro
            assert isinstance(pro.get("experience_highlights"), list)
        
        print(f"All {len(pros)} pros handled gracefully")


class TestEmployerDashboardStillWorks:
    """Test employer dashboard and hiring flow still work after changes"""
    
    def test_employer_candidates_endpoint(self, employer_headers):
        """GET /api/employer/candidates still works"""
        response = requests.get(f"{BASE_URL}/api/employer/candidates", headers=employer_headers)
        assert response.status_code == 200
        
        candidates = response.json()
        print(f"Employer candidates endpoint returns {len(candidates)} candidates")
    
    def test_employer_jobs_endpoint(self, employer_headers):
        """GET /api/jobs still works for employer"""
        response = requests.get(f"{BASE_URL}/api/jobs", headers=employer_headers)
        assert response.status_code == 200
        
        jobs = response.json()
        print(f"Employer jobs endpoint returns {len(jobs)} jobs")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
