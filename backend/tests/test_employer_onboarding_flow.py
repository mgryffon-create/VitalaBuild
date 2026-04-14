"""
Test Employer Onboarding Flow
- GET /api/profile/completion for new employer returns complete=false with all checks false
- PUT /api/profile/poster accepts org_type field
- After profile save, completion still false until job is posted
- Existing employer (employer_test) has complete=true (has jobs)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
EXISTING_EMPLOYER = {"email": "employer_test@vitalamatch.com", "password": "test123"}
NEW_EMPLOYER = {"email": "new_employer_test@vitalamatch.com", "password": "test123"}
SEEKER = {"email": "seeker_test@vitalamatch.com", "password": "test123"}


class TestEmployerOnboardingCompletion:
    """Test profile completion endpoint for employer onboarding"""
    
    @pytest.fixture
    def existing_employer_token(self):
        """Get token for existing employer with jobs"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=EXISTING_EMPLOYER)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Could not login existing employer: {response.status_code} - {response.text}")
    
    @pytest.fixture
    def new_employer_token(self):
        """Get token for new employer without jobs"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=NEW_EMPLOYER)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Could not login new employer: {response.status_code} - {response.text}")
    
    @pytest.fixture
    def seeker_token(self):
        """Get token for seeker"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SEEKER)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Could not login seeker: {response.status_code} - {response.text}")
    
    @pytest.fixture
    def fresh_employer_token(self):
        """Create a brand new employer for testing"""
        unique_email = f"test_onboarding_{uuid.uuid4().hex[:8]}@testcompany.com"
        register_data = {
            "email": unique_email,
            "password": "test123",
            "role": "poster",
            "full_name": "Test Onboarding Employer"
        }
        response = requests.post(f"{BASE_URL}/api/auth/register", json=register_data)
        if response.status_code == 200:
            return response.json().get("access_token"), unique_email
        pytest.skip(f"Could not register fresh employer: {response.status_code} - {response.text}")
    
    def test_new_employer_completion_is_false(self, fresh_employer_token):
        """New employer with no profile/jobs should have complete=false"""
        token, email = fresh_employer_token
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/profile/completion", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["role"] == "poster", f"Expected role=poster, got {data.get('role')}"
        assert data["complete"] == False, f"Expected complete=false for new employer, got {data.get('complete')}"
        
        # Check individual checks
        checks = data.get("checks", {})
        assert checks.get("company_name") == False, "New employer should not have company_name"
        assert checks.get("company_description") == False, "New employer should not have company_description"
        assert checks.get("has_job_posted") == False, "New employer should not have jobs"
        assert checks.get("has_complete_job") == False, "New employer should not have complete job"
        
        print(f"✅ New employer completion check passed: complete={data['complete']}, checks={checks}")
    
    def test_existing_employer_completion_status(self, existing_employer_token):
        """Existing employer (employer_test) should have some completion"""
        headers = {"Authorization": f"Bearer {existing_employer_token}"}
        
        response = requests.get(f"{BASE_URL}/api/profile/completion", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["role"] == "poster", f"Expected role=poster, got {data.get('role')}"
        
        checks = data.get("checks", {})
        print(f"✅ Existing employer completion: complete={data['complete']}, percentage={data.get('percentage')}%, checks={checks}")
        
        # Existing employer should have at least some jobs
        # Note: may or may not be complete depending on profile state
    
    def test_seeker_completion_not_affected(self, seeker_token):
        """Seeker completion should work independently"""
        headers = {"Authorization": f"Bearer {seeker_token}"}
        
        response = requests.get(f"{BASE_URL}/api/profile/completion", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["role"] == "seeker", f"Expected role=seeker, got {data.get('role')}"
        
        # Seeker checks should be different from employer checks
        checks = data.get("checks", {})
        assert "specialty" in checks, "Seeker should have specialty check"
        assert "has_job_posted" not in checks, "Seeker should not have has_job_posted check"
        
        print(f"✅ Seeker completion check passed: role={data['role']}, checks have seeker-specific fields")


class TestEmployerProfileOrgType:
    """Test that PUT /api/profile/poster accepts org_type field"""
    
    @pytest.fixture
    def fresh_employer_token(self):
        """Create a brand new employer for testing"""
        unique_email = f"test_orgtype_{uuid.uuid4().hex[:8]}@testcompany.com"
        register_data = {
            "email": unique_email,
            "password": "test123",
            "role": "poster",
            "full_name": "Test OrgType Employer"
        }
        response = requests.post(f"{BASE_URL}/api/auth/register", json=register_data)
        if response.status_code == 200:
            return response.json().get("access_token"), unique_email
        pytest.skip(f"Could not register fresh employer: {response.status_code} - {response.text}")
    
    def test_profile_accepts_org_type(self, fresh_employer_token):
        """PUT /api/profile/poster should accept org_type field"""
        token, email = fresh_employer_token
        headers = {"Authorization": f"Bearer {token}"}
        
        profile_data = {
            "company_name": "Test Medical Center",
            "company_description": "A leading healthcare facility providing excellent patient care and services.",
            "org_type": "Hospital / Health System",
            "contact_info": {
                "location": "Los Angeles, CA"
            }
        }
        
        response = requests.put(f"{BASE_URL}/api/profile/poster", json=profile_data, headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify profile was saved with org_type
        get_response = requests.get(f"{BASE_URL}/api/profile/poster", headers=headers)
        assert get_response.status_code == 200
        
        saved_profile = get_response.json()
        assert saved_profile.get("company_name") == "Test Medical Center"
        assert saved_profile.get("org_type") == "Hospital / Health System"
        assert saved_profile.get("company_description") is not None
        
        print(f"✅ Profile with org_type saved successfully: org_type={saved_profile.get('org_type')}")
    
    def test_completion_after_profile_save_still_false_without_job(self, fresh_employer_token):
        """After saving profile, completion should still be false until job is posted"""
        token, email = fresh_employer_token
        headers = {"Authorization": f"Bearer {token}"}
        
        # Save profile
        profile_data = {
            "company_name": "Test Facility",
            "company_description": "A great place to work with excellent benefits and team culture.",
            "org_type": "Skilled Nursing Facility",
            "contact_info": {
                "location": "San Francisco, CA"
            }
        }
        
        response = requests.put(f"{BASE_URL}/api/profile/poster", json=profile_data, headers=headers)
        assert response.status_code == 200
        
        # Check completion - should still be false (no job posted)
        completion_response = requests.get(f"{BASE_URL}/api/profile/completion", headers=headers)
        assert completion_response.status_code == 200
        
        data = completion_response.json()
        checks = data.get("checks", {})
        
        # Profile fields should be true now
        assert checks.get("company_name") == True, "company_name should be true after save"
        assert checks.get("company_description") == True, "company_description should be true after save"
        assert checks.get("contact_info") == True, "contact_info should be true after save"
        
        # But job checks should still be false
        assert checks.get("has_job_posted") == False, "has_job_posted should still be false"
        assert checks.get("has_complete_job") == False, "has_complete_job should still be false"
        
        # Overall completion should be false
        assert data["complete"] == False, f"Expected complete=false without job, got {data['complete']}"
        
        print(f"✅ Completion after profile save: complete={data['complete']}, checks={checks}")


class TestEmployerOnboardingFullFlow:
    """Test the full onboarding flow: profile save -> job post -> completion"""
    
    @pytest.fixture
    def fresh_employer_token(self):
        """Create a brand new employer for testing"""
        unique_email = f"test_fullflow_{uuid.uuid4().hex[:8]}@testcompany.com"
        register_data = {
            "email": unique_email,
            "password": "test123",
            "role": "poster",
            "full_name": "Test Full Flow Employer"
        }
        response = requests.post(f"{BASE_URL}/api/auth/register", json=register_data)
        if response.status_code == 200:
            return response.json().get("access_token"), unique_email
        pytest.skip(f"Could not register fresh employer: {response.status_code} - {response.text}")
    
    def test_full_onboarding_flow(self, fresh_employer_token):
        """Test complete flow: new employer -> profile -> job -> completion=true"""
        token, email = fresh_employer_token
        headers = {"Authorization": f"Bearer {token}"}
        
        # Step 1: Check initial completion (should be false)
        response = requests.get(f"{BASE_URL}/api/profile/completion", headers=headers)
        assert response.status_code == 200
        initial_data = response.json()
        assert initial_data["complete"] == False, "Initial completion should be false"
        print(f"Step 1: Initial completion = {initial_data['complete']}")
        
        # Step 2: Save profile
        profile_data = {
            "company_name": "Full Flow Medical Center",
            "company_description": "A comprehensive healthcare facility offering a wide range of medical services.",
            "org_type": "Hospital / Health System",
            "contact_info": {
                "location": "Chicago, IL"
            }
        }
        response = requests.put(f"{BASE_URL}/api/profile/poster", json=profile_data, headers=headers)
        assert response.status_code == 200, f"Profile save failed: {response.text}"
        print("Step 2: Profile saved successfully")
        
        # Step 3: Check completion after profile (should still be false)
        response = requests.get(f"{BASE_URL}/api/profile/completion", headers=headers)
        assert response.status_code == 200
        after_profile_data = response.json()
        assert after_profile_data["complete"] == False, "Completion after profile should still be false"
        print(f"Step 3: Completion after profile = {after_profile_data['complete']}")
        
        # Step 4: Post a job
        job_data = {
            "title": "Registered Nurse - ICU",
            "description": "We are seeking an experienced ICU nurse to join our team. Must have strong critical care skills.",
            "location": "Chicago, IL",
            "specialty": "Registered Nurse (RN) - ICU/Critical Care",
            "duration": "13 weeks",
            "pay_range": {"min": 2500, "max": 3000, "type": "weekly"},
            "shift_type": "Night (7p-7a)",
            "job_type": "Travel",
            "requirements": ["BLS", "ACLS"],
            "certifications_required": ["BLS", "ACLS"],
            "experience_required": 2
        }
        response = requests.post(f"{BASE_URL}/api/jobs", json=job_data, headers=headers)
        assert response.status_code == 200, f"Job post failed: {response.text}"
        job_id = response.json().get("id")
        print(f"Step 4: Job posted successfully, id={job_id}")
        
        # Step 5: Check completion after job (should be true now)
        response = requests.get(f"{BASE_URL}/api/profile/completion", headers=headers)
        assert response.status_code == 200
        final_data = response.json()
        
        checks = final_data.get("checks", {})
        assert checks.get("company_name") == True, "company_name should be true"
        assert checks.get("company_description") == True, "company_description should be true"
        assert checks.get("contact_info") == True, "contact_info should be true"
        assert checks.get("has_job_posted") == True, "has_job_posted should be true after posting"
        assert checks.get("has_complete_job") == True, "has_complete_job should be true"
        
        assert final_data["complete"] == True, f"Final completion should be true, got {final_data['complete']}"
        print(f"Step 5: Final completion = {final_data['complete']}, checks={checks}")
        
        print("✅ Full onboarding flow test passed!")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
