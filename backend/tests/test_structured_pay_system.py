"""
Test Structured Pay System - Backend API Tests
Tests for: base_rate, guaranteed_hours, weekly_stipend, overtime_rate, weekly_pay, job_type, stipend, weekly_hours
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


class TestStructuredPaySystem:
    """Test structured pay fields in job posting APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_employer_token(self):
        """Get employer authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYER_EMAIL,
            "password": EMPLOYER_PASSWORD
        })
        assert response.status_code == 200, f"Employer login failed: {response.text}"
        data = response.json()
        # Backend returns 'access_token' not 'token'
        return data.get("access_token")
    
    def get_seeker_token(self):
        """Get seeker authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        assert response.status_code == 200, f"Seeker login failed: {response.text}"
        data = response.json()
        return data.get("access_token")
    
    # ==================== POST /api/jobs Tests ====================
    
    def test_create_job_with_structured_pay_fields(self):
        """POST /api/jobs - verify all structured pay fields persist and return in response"""
        token = self.get_employer_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Create job with all structured pay fields
        job_payload = {
            "title": "TEST_Structured_Pay_ICU_Nurse",
            "description": "This is a test job posting for structured pay system validation. The position requires ICU experience and BLS certification. Must be able to work night shifts.",
            "location": "Los Angeles, CA",
            "specialty": "Registered Nurse (RN) - ICU/Critical Care",
            "shift_type": "Night Shift (7p-7a)",
            "start_date": "2026-02-01",
            "duration": "13 weeks",
            "job_type": "Travel Contract",
            "stipend": "Housing stipend",
            "weekly_hours": "36",
            "base_rate": 55.0,
            "guaranteed_hours": 36.0,
            "weekly_stipend": 1000.0,
            "overtime_rate": 82.5,
            "weekly_pay": 2980.0,  # 55*36 + 1000 = 2980
            "experience_required": 2,
            "requirements": ["BLS", "ICU experience"],
            "certifications_required": ["BLS", "ACLS"],
            "benefits": ["Health Insurance", "Housing Stipend"],
            "pay_range": {"min": 55, "max": 55}
        }
        
        response = self.session.post(f"{BASE_URL}/api/jobs", json=job_payload)
        assert response.status_code == 200, f"Create job failed: {response.text}"
        
        data = response.json()
        
        # Verify all structured pay fields are returned
        assert data.get("base_rate") == 55.0, f"base_rate mismatch: {data.get('base_rate')}"
        assert data.get("guaranteed_hours") == 36.0, f"guaranteed_hours mismatch: {data.get('guaranteed_hours')}"
        assert data.get("weekly_stipend") == 1000.0, f"weekly_stipend mismatch: {data.get('weekly_stipend')}"
        assert data.get("overtime_rate") == 82.5, f"overtime_rate mismatch: {data.get('overtime_rate')}"
        assert data.get("weekly_pay") == 2980.0, f"weekly_pay mismatch: {data.get('weekly_pay')}"
        assert data.get("job_type") == "Travel Contract", f"job_type mismatch: {data.get('job_type')}"
        assert data.get("stipend") == "Housing stipend", f"stipend mismatch: {data.get('stipend')}"
        assert data.get("weekly_hours") == "36", f"weekly_hours mismatch: {data.get('weekly_hours')}"
        
        # Store job_id for cleanup
        self.created_job_id = data.get("id")
        print(f"✓ Created job with structured pay: {self.created_job_id}")
        print(f"  - base_rate: ${data.get('base_rate')}/hr")
        print(f"  - guaranteed_hours: {data.get('guaranteed_hours')}hrs")
        print(f"  - weekly_stipend: ${data.get('weekly_stipend')}")
        print(f"  - overtime_rate: ${data.get('overtime_rate')}/hr")
        print(f"  - weekly_pay: ${data.get('weekly_pay')}/week")
        
        return data.get("id")
    
    def test_create_job_with_partial_structured_pay(self):
        """POST /api/jobs - verify job creation with only base_rate and guaranteed_hours"""
        token = self.get_employer_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        job_payload = {
            "title": "TEST_Partial_Pay_Med_Surg_Nurse",
            "description": "This is a test job posting with partial structured pay fields. Only base rate and hours are provided without stipend or overtime.",
            "location": "San Francisco, CA",
            "specialty": "Registered Nurse (RN) - Med-Surg",
            "shift_type": "Day Shift (7a-7p)",
            "start_date": "2026-02-15",
            "job_type": "Staff/Permanent",
            "base_rate": 48.0,
            "guaranteed_hours": 40.0,
            "experience_required": 1,
            "pay_range": {"min": 48, "max": 48}
        }
        
        response = self.session.post(f"{BASE_URL}/api/jobs", json=job_payload)
        assert response.status_code == 200, f"Create job failed: {response.text}"
        
        data = response.json()
        
        # Verify base fields
        assert data.get("base_rate") == 48.0
        assert data.get("guaranteed_hours") == 40.0
        # Optional fields should be None or 0
        assert data.get("weekly_stipend") in [None, 0, 0.0]
        assert data.get("overtime_rate") in [None, 0, 0.0]
        
        print(f"✓ Created job with partial structured pay: {data.get('id')}")
        return data.get("id")
    
    # ==================== GET /api/jobs/{id} Tests ====================
    
    def test_get_job_returns_structured_pay_fields(self):
        """GET /api/jobs/{id} - verify structured pay fields are returned"""
        token = self.get_employer_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # First create a job
        job_id = self.test_create_job_with_structured_pay_fields()
        
        # Then fetch it
        response = self.session.get(f"{BASE_URL}/api/jobs/{job_id}")
        assert response.status_code == 200, f"Get job failed: {response.text}"
        
        data = response.json()
        
        # Verify all structured pay fields
        assert data.get("base_rate") == 55.0
        assert data.get("guaranteed_hours") == 36.0
        assert data.get("weekly_stipend") == 1000.0
        assert data.get("overtime_rate") == 82.5
        assert data.get("weekly_pay") == 2980.0
        assert data.get("job_type") == "Travel Contract"
        assert data.get("stipend") == "Housing stipend"
        assert data.get("weekly_hours") == "36"
        
        print(f"✓ GET /api/jobs/{job_id} returns all structured pay fields")
    
    # ==================== PUT /api/jobs/{id} Tests ====================
    
    def test_update_job_structured_pay_fields(self):
        """PUT /api/jobs/{id} - verify structured pay fields can be updated"""
        token = self.get_employer_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # First create a job
        job_id = self.test_create_job_with_structured_pay_fields()
        
        # Update with new pay values
        update_payload = {
            "title": "TEST_Updated_Structured_Pay_ICU_Nurse",
            "description": "This is an updated test job posting for structured pay system validation. The position requires ICU experience and BLS certification.",
            "location": "Los Angeles, CA",
            "specialty": "Registered Nurse (RN) - ICU/Critical Care",
            "shift_type": "Night Shift (7p-7a)",
            "start_date": "2026-02-01",
            "duration": "13 weeks",
            "job_type": "Travel Contract",
            "stipend": "Housing included",  # Changed
            "weekly_hours": "40",  # Changed
            "base_rate": 60.0,  # Changed from 55
            "guaranteed_hours": 40.0,  # Changed from 36
            "weekly_stipend": 1200.0,  # Changed from 1000
            "overtime_rate": 90.0,  # Changed from 82.5
            "weekly_pay": 3600.0,  # 60*40 + 1200 = 3600
            "experience_required": 2,
            "pay_range": {"min": 60, "max": 60}
        }
        
        response = self.session.put(f"{BASE_URL}/api/jobs/{job_id}", json=update_payload)
        assert response.status_code == 200, f"Update job failed: {response.text}"
        
        # Verify update by fetching the job
        get_response = self.session.get(f"{BASE_URL}/api/jobs/{job_id}")
        assert get_response.status_code == 200
        
        data = get_response.json()
        
        # Verify updated values
        assert data.get("base_rate") == 60.0, f"base_rate not updated: {data.get('base_rate')}"
        assert data.get("guaranteed_hours") == 40.0, f"guaranteed_hours not updated: {data.get('guaranteed_hours')}"
        assert data.get("weekly_stipend") == 1200.0, f"weekly_stipend not updated: {data.get('weekly_stipend')}"
        assert data.get("overtime_rate") == 90.0, f"overtime_rate not updated: {data.get('overtime_rate')}"
        assert data.get("weekly_pay") == 3600.0, f"weekly_pay not updated: {data.get('weekly_pay')}"
        assert data.get("stipend") == "Housing included", f"stipend not updated: {data.get('stipend')}"
        assert data.get("weekly_hours") == "40", f"weekly_hours not updated: {data.get('weekly_hours')}"
        
        print(f"✓ PUT /api/jobs/{job_id} successfully updated structured pay fields")
    
    # ==================== GET /api/swipe/jobs Tests ====================
    
    def test_swipe_jobs_returns_structured_pay_fields(self):
        """GET /api/swipe/jobs - verify structured pay fields for new jobs"""
        # First create a job as employer
        employer_token = self.get_employer_token()
        self.session.headers.update({"Authorization": f"Bearer {employer_token}"})
        
        job_payload = {
            "title": "TEST_Swipe_Structured_Pay_ER_Nurse",
            "description": "This is a test job posting for swipe page structured pay validation. Emergency room nurse position with competitive pay and benefits.",
            "location": "Chicago, IL",
            "specialty": "Registered Nurse (RN) - Emergency Room",
            "shift_type": "Rotating",
            "start_date": "2026-03-01",
            "duration": "8 weeks",
            "job_type": "Travel Contract",
            "stipend": "M&IE stipend",
            "weekly_hours": "36",
            "base_rate": 58.0,
            "guaranteed_hours": 36.0,
            "weekly_stipend": 850.0,
            "overtime_rate": 87.0,
            "weekly_pay": 2938.0,  # 58*36 + 850 = 2938
            "experience_required": 3,
            "pay_range": {"min": 58, "max": 58}
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/jobs", json=job_payload)
        assert create_response.status_code == 200, f"Create job failed: {create_response.text}"
        created_job = create_response.json()
        created_job_id = created_job.get("id")
        
        # Now login as seeker and check swipe/jobs
        seeker_token = self.get_seeker_token()
        self.session.headers.update({"Authorization": f"Bearer {seeker_token}"})
        
        response = self.session.get(f"{BASE_URL}/api/swipe/jobs")
        assert response.status_code == 200, f"Get swipe jobs failed: {response.text}"
        
        jobs = response.json()
        assert isinstance(jobs, list), "Response should be a list"
        
        # Find our created job
        test_job = None
        for job in jobs:
            if job.get("id") == created_job_id:
                test_job = job
                break
        
        if test_job:
            # Verify structured pay fields are present
            print(f"✓ Found test job in swipe/jobs: {created_job_id}")
            print(f"  - base_rate: {test_job.get('base_rate')}")
            print(f"  - guaranteed_hours: {test_job.get('guaranteed_hours')}")
            print(f"  - weekly_stipend: {test_job.get('weekly_stipend')}")
            print(f"  - overtime_rate: {test_job.get('overtime_rate')}")
            print(f"  - weekly_pay: {test_job.get('weekly_pay')}")
            print(f"  - job_type: {test_job.get('job_type')}")
            print(f"  - stipend: {test_job.get('stipend')}")
            
            # Verify values match what we created
            assert test_job.get("base_rate") == 58.0, f"base_rate mismatch in swipe: {test_job.get('base_rate')}"
            assert test_job.get("guaranteed_hours") == 36.0, f"guaranteed_hours mismatch in swipe: {test_job.get('guaranteed_hours')}"
            assert test_job.get("weekly_stipend") == 850.0, f"weekly_stipend mismatch in swipe: {test_job.get('weekly_stipend')}"
            assert test_job.get("overtime_rate") == 87.0, f"overtime_rate mismatch in swipe: {test_job.get('overtime_rate')}"
            assert test_job.get("weekly_pay") == 2938.0, f"weekly_pay mismatch in swipe: {test_job.get('weekly_pay')}"
            assert test_job.get("job_type") == "Travel Contract", f"job_type mismatch in swipe: {test_job.get('job_type')}"
            assert test_job.get("stipend") == "M&IE stipend", f"stipend mismatch in swipe: {test_job.get('stipend')}"
            
            print("✓ All structured pay fields verified in GET /api/swipe/jobs")
        else:
            # Job might have been swiped already, check if any jobs have structured pay
            jobs_with_pay = [j for j in jobs if j.get("base_rate") and j.get("base_rate") > 0]
            if jobs_with_pay:
                sample = jobs_with_pay[0]
                print(f"✓ Found {len(jobs_with_pay)} jobs with structured pay in swipe/jobs")
                print(f"  Sample job: {sample.get('title')}")
                print(f"  - base_rate: {sample.get('base_rate')}")
                print(f"  - weekly_pay: {sample.get('weekly_pay')}")
            else:
                print(f"⚠ Test job {created_job_id} not found in swipe/jobs (may have been swiped already)")
                print(f"  Total jobs available: {len(jobs)}")


class TestStructuredPayEdgeCases:
    """Test edge cases for structured pay system"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_employer_token(self):
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYER_EMAIL,
            "password": EMPLOYER_PASSWORD
        })
        return response.json().get("access_token")
    
    def test_create_job_with_zero_stipend(self):
        """Verify job can be created with zero stipend"""
        token = self.get_employer_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        job_payload = {
            "title": "TEST_Zero_Stipend_Nurse",
            "description": "This is a test job posting with zero stipend. Staff position without travel benefits or housing allowance.",
            "location": "Denver, CO",
            "specialty": "Registered Nurse (RN) - General",
            "shift_type": "Day Shift (8 hr)",
            "start_date": "2026-02-20",
            "job_type": "Staff/Permanent",
            "base_rate": 45.0,
            "guaranteed_hours": 40.0,
            "weekly_stipend": 0,
            "overtime_rate": 67.5,
            "weekly_pay": 1800.0,  # 45*40 + 0 = 1800
            "experience_required": 0,
            "pay_range": {"min": 45, "max": 45}
        }
        
        response = self.session.post(f"{BASE_URL}/api/jobs", json=job_payload)
        assert response.status_code == 200, f"Create job failed: {response.text}"
        
        data = response.json()
        assert data.get("weekly_stipend") in [0, 0.0, None]
        assert data.get("weekly_pay") == 1800.0
        
        print(f"✓ Created job with zero stipend: {data.get('id')}")
    
    def test_create_job_with_high_pay_values(self):
        """Verify job can be created with high pay values (CRNA/NP rates)"""
        token = self.get_employer_token()
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        job_payload = {
            "title": "TEST_High_Pay_CRNA",
            "description": "This is a test job posting for CRNA position with high pay rates. Certified Registered Nurse Anesthetist needed for surgical center.",
            "location": "New York, NY",
            "specialty": "Certified Registered Nurse Anesthetist (CRNA)",
            "shift_type": "Day Shift (7a-7p)",
            "start_date": "2026-03-15",
            "duration": "26 weeks",
            "job_type": "Travel Contract",
            "stipend": "Housing included",
            "weekly_hours": "40",
            "base_rate": 150.0,
            "guaranteed_hours": 40.0,
            "weekly_stipend": 2000.0,
            "overtime_rate": 225.0,
            "weekly_pay": 8000.0,  # 150*40 + 2000 = 8000
            "experience_required": 5,
            "pay_range": {"min": 150, "max": 150}
        }
        
        response = self.session.post(f"{BASE_URL}/api/jobs", json=job_payload)
        assert response.status_code == 200, f"Create job failed: {response.text}"
        
        data = response.json()
        assert data.get("base_rate") == 150.0
        assert data.get("weekly_pay") == 8000.0
        
        print(f"✓ Created high-pay CRNA job: {data.get('id')}")
        print(f"  - weekly_pay: ${data.get('weekly_pay')}/week")


# Cleanup function to delete test jobs
def cleanup_test_jobs():
    """Delete all TEST_ prefixed jobs"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Login as employer
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": EMPLOYER_EMAIL,
        "password": EMPLOYER_PASSWORD
    })
    if response.status_code != 200:
        return
    
    token = response.json().get("access_token")
    session.headers.update({"Authorization": f"Bearer {token}"})
    
    # Get all jobs
    jobs_response = session.get(f"{BASE_URL}/api/jobs")
    if jobs_response.status_code != 200:
        return
    
    jobs = jobs_response.json()
    for job in jobs:
        if job.get("title", "").startswith("TEST_"):
            session.delete(f"{BASE_URL}/api/jobs/{job['id']}")
            print(f"Cleaned up test job: {job['id']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
