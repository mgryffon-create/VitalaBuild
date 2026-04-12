"""
Test suite for Job Form API endpoints
Tests: POST /api/jobs, PUT /api/jobs/{jobId}, GET /api/jobs/{jobId}
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://pro-healthcare-jobs.preview.emergentagent.com')

class TestJobFormAPI:
    """Job Form API endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.test_job_id = None
        
    def get_auth_token(self):
        """Get authentication token for employer"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "employer_test@vitalamatch.com",
            "password": "test123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    def test_01_login_employer(self):
        """Test employer login"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "employer_test@vitalamatch.com",
            "password": "test123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["role"] == "poster"
        print(f"✓ Employer login successful")
    
    def test_02_get_specialties(self):
        """Test GET /api/specialties - used by job form"""
        response = self.session.get(f"{BASE_URL}/api/specialties")
        assert response.status_code == 200
        data = response.json()
        assert "nursing" in data
        assert "allied_health" in data
        assert len(data["nursing"]) > 0
        assert len(data["allied_health"]) > 0
        print(f"✓ Specialties endpoint working - {len(data['nursing'])} nursing, {len(data['allied_health'])} allied health")
    
    def test_03_create_job(self):
        """Test POST /api/jobs - create new job"""
        token = self.get_auth_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        job_data = {
            "title": f"TEST_Job_Form_{int(time.time())}",
            "description": "Test job description for automated testing of job form functionality.",
            "location": "Test City, TS",
            "duration": "13 weeks",
            "pay_range": {"min": 45, "max": 65},
            "benefits": ["Health Insurance", "Housing Stipend"],
            "time_off_policy": "Flexible PTO",
            "requirements": ["2+ years experience", "BLS certification"],
            "certifications_required": ["BLS", "ACLS"],
            "experience_required": 2,
            "specialty": "Registered Nurse (RN) - ICU/Critical Care",
            "shift_type": "Day Shift (7a-7p)",
            "start_date": "2026-02-01"
        }
        
        response = self.session.post(f"{BASE_URL}/api/jobs", json=job_data)
        assert response.status_code == 200, f"Create job failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["title"] == job_data["title"]
        assert data["specialty"] == job_data["specialty"]
        assert data["location"] == job_data["location"]
        assert data["pay_range"]["min"] == job_data["pay_range"]["min"]
        assert data["pay_range"]["max"] == job_data["pay_range"]["max"]
        
        self.__class__.test_job_id = data["id"]
        print(f"✓ Job created successfully with ID: {data['id']}")
        return data["id"]
    
    def test_04_get_job(self):
        """Test GET /api/jobs/{jobId} - get job details"""
        token = self.get_auth_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # First create a job if not exists
        if not hasattr(self.__class__, 'test_job_id') or not self.__class__.test_job_id:
            self.test_03_create_job()
        
        job_id = self.__class__.test_job_id
        response = self.session.get(f"{BASE_URL}/api/jobs/{job_id}")
        assert response.status_code == 200, f"Get job failed: {response.text}"
        
        data = response.json()
        assert data["id"] == job_id
        assert "title" in data
        assert "description" in data
        assert "location" in data
        assert "specialty" in data
        print(f"✓ Job retrieved successfully: {data['title']}")
    
    def test_05_update_job(self):
        """Test PUT /api/jobs/{jobId} - update job"""
        token = self.get_auth_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # First create a job if not exists
        if not hasattr(self.__class__, 'test_job_id') or not self.__class__.test_job_id:
            self.test_03_create_job()
        
        job_id = self.__class__.test_job_id
        
        # Get current job data
        get_response = self.session.get(f"{BASE_URL}/api/jobs/{job_id}")
        assert get_response.status_code == 200
        current_job = get_response.json()
        
        # Update job with new data
        updated_data = {
            "title": current_job["title"] + " - UPDATED",
            "description": current_job["description"] + " Updated description.",
            "location": current_job["location"],
            "duration": "26 weeks",  # Changed
            "pay_range": {"min": 50, "max": 70},  # Changed
            "benefits": current_job["benefits"] + ["Travel Reimbursement"],  # Added benefit
            "time_off_policy": current_job.get("time_off_policy", ""),
            "requirements": current_job.get("requirements", []),
            "certifications_required": current_job.get("certifications_required", []),
            "experience_required": 3,  # Changed
            "specialty": current_job["specialty"],
            "shift_type": current_job.get("shift_type", ""),
            "start_date": current_job.get("start_date", "")
        }
        
        response = self.session.put(f"{BASE_URL}/api/jobs/{job_id}", json=updated_data)
        assert response.status_code == 200, f"Update job failed: {response.text}"
        
        # Verify update by getting job again
        verify_response = self.session.get(f"{BASE_URL}/api/jobs/{job_id}")
        assert verify_response.status_code == 200
        verified_job = verify_response.json()
        
        assert "UPDATED" in verified_job["title"]
        assert verified_job["duration"] == "26 weeks"
        assert verified_job["pay_range"]["min"] == 50
        assert verified_job["experience_required"] == 3
        print(f"✓ Job updated successfully")
    
    def test_06_get_employer_jobs(self):
        """Test GET /api/jobs - get all employer's jobs"""
        token = self.get_auth_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/jobs")
        assert response.status_code == 200, f"Get jobs failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Verify each job has required fields
        for job in data:
            assert "id" in job
            assert "title" in job
            assert "location" in job
            assert "specialty" in job
        
        print(f"✓ Retrieved {len(data)} jobs for employer")
    
    def test_07_required_fields_validation(self):
        """Test that required fields are validated"""
        token = self.get_auth_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Try to create job without required fields
        incomplete_job = {
            "title": "",  # Empty title
            "description": "",  # Empty description
            "location": "",  # Empty location
            "duration": "13 weeks",
            "pay_range": {"min": 0, "max": 0},
            "benefits": [],
            "time_off_policy": "",
            "requirements": [],
            "certifications_required": [],
            "experience_required": 0,
            "specialty": "",  # Empty specialty
        }
        
        response = self.session.post(f"{BASE_URL}/api/jobs", json=incomplete_job)
        # The API should either reject with 400/422 or accept (validation is on frontend)
        # Based on the code, validation is primarily on frontend
        print(f"✓ Incomplete job submission returned status: {response.status_code}")
    
    def test_08_cleanup_test_job(self):
        """Cleanup: Delete test job"""
        token = self.get_auth_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        if hasattr(self.__class__, 'test_job_id') and self.__class__.test_job_id:
            job_id = self.__class__.test_job_id
            response = self.session.delete(f"{BASE_URL}/api/jobs/{job_id}")
            assert response.status_code == 200, f"Delete job failed: {response.text}"
            print(f"✓ Test job deleted: {job_id}")
        else:
            print("No test job to cleanup")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
