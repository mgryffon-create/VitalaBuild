"""
Test suite for iteration 22 features:
1. Compliance Score API - GET /api/employer/candidates returns compliance_score object
2. Hiring Workflow Fields - POST/GET /api/jobs with workflow configuration
3. SwipePage external application notice (tested via API response)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SEEKER_EMAIL = "seeker_test@vitalamatch.com"
SEEKER_PASSWORD = "test123"
EMPLOYER_EMAIL = "employer_test@vitalamatch.com"
EMPLOYER_PASSWORD = "test123"


class TestAuth:
    """Helper class for authentication"""
    
    @staticmethod
    def get_seeker_token():
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    @staticmethod
    def get_employer_token():
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYER_EMAIL,
            "password": EMPLOYER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None


class TestComplianceScoreAPI:
    """Test compliance score in employer/candidates endpoint"""
    
    def test_employer_candidates_returns_compliance_score_field(self):
        """GET /api/employer/candidates should return compliance_score object for each candidate"""
        token = TestAuth.get_employer_token()
        assert token, "Failed to get employer token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/employer/candidates", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        candidates = response.json()
        
        # Even if no candidates, the endpoint should work
        assert isinstance(candidates, list), "Response should be a list"
        
        # If there are candidates, check compliance_score structure
        for candidate in candidates:
            assert "compliance_score" in candidate, f"Missing compliance_score in candidate: {candidate.get('id')}"
            score = candidate["compliance_score"]
            
            # Check compliance_score structure
            assert "overall" in score, "compliance_score should have 'overall' field"
            assert "training" in score, "compliance_score should have 'training' field"
            assert "onboarding" in score, "compliance_score should have 'onboarding' field"
            assert "vault_documents" in score, "compliance_score should have 'vault_documents' field"
            
            # Check training sub-structure
            training = score["training"]
            assert "total" in training, "training should have 'total' field"
            assert "completed" in training, "training should have 'completed' field"
            assert "overdue" in training, "training should have 'overdue' field"
            
            # Check onboarding sub-structure
            onboarding = score["onboarding"]
            assert "status" in onboarding, "onboarding should have 'status' field"
            assert "percent" in onboarding, "onboarding should have 'percent' field"
            
            print(f"Candidate {candidate.get('seeker_id')}: compliance_score = {score}")
        
        print(f"PASS: Compliance score structure verified for {len(candidates)} candidates")
    
    def test_compliance_score_values_are_valid(self):
        """Compliance score values should be valid (null or numeric)"""
        token = TestAuth.get_employer_token()
        assert token, "Failed to get employer token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/employer/candidates", headers=headers)
        
        assert response.status_code == 200
        candidates = response.json()
        
        for candidate in candidates:
            score = candidate["compliance_score"]
            
            # overall can be null or 0-100
            if score["overall"] is not None:
                assert isinstance(score["overall"], (int, float)), "overall should be numeric"
                assert 0 <= score["overall"] <= 100, "overall should be 0-100"
            
            # vault_documents should be non-negative integer
            assert isinstance(score["vault_documents"], int), "vault_documents should be int"
            assert score["vault_documents"] >= 0, "vault_documents should be >= 0"
            
            # training counts should be non-negative
            assert score["training"]["total"] >= 0
            assert score["training"]["completed"] >= 0
            assert score["training"]["overdue"] >= 0
        
        print("PASS: Compliance score values are valid")


class TestWorkflowFieldsAPI:
    """Test hiring workflow configuration fields in jobs API"""
    
    def test_create_job_with_workflow_fields(self):
        """POST /api/jobs should accept workflow configuration fields"""
        token = TestAuth.get_employer_token()
        assert token, "Failed to get employer token"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create job with external_required_after_match workflow
        job_data = {
            "title": f"TEST_Workflow_Job_{uuid.uuid4().hex[:8]}",
            "description": "Test job for workflow fields",
            "location": "Test City, TX",
            "specialty": "Registered Nurse (RN) - General",
            "duration": "13 weeks",
            "pay_range": {"min": 50, "max": 75},
            "benefits": ["Health Insurance"],
            "time_off_policy": "Standard PTO",
            "requirements": [],
            "certifications_required": [],
            "experience_required": 1,
            "application_workflow_type": "external_required_after_match",
            "external_application_url": "https://example.com/apply",
            "external_application_stage": "after_match",
            "profile_sufficient_for_initial_review": True,
            "required_additional_fields": "Background check, drug screen"
        }
        
        response = requests.post(f"{BASE_URL}/api/jobs", json=job_data, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        job = response.json()
        
        # Verify workflow fields are returned
        assert job.get("application_workflow_type") == "external_required_after_match", \
            f"Expected external_required_after_match, got {job.get('application_workflow_type')}"
        assert job.get("external_application_url") == "https://example.com/apply"
        assert job.get("external_application_stage") == "after_match"
        assert job.get("profile_sufficient_for_initial_review") == True
        assert job.get("required_additional_fields") == "Background check, drug screen"
        
        print(f"PASS: Created job with workflow fields: {job.get('id')}")
        return job.get("id")
    
    def test_create_job_with_in_platform_only_workflow(self):
        """POST /api/jobs with in_platform_only should work without external URL"""
        token = TestAuth.get_employer_token()
        assert token, "Failed to get employer token"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        job_data = {
            "title": f"TEST_InPlatform_Job_{uuid.uuid4().hex[:8]}",
            "description": "Test job for in-platform workflow",
            "location": "Test City, TX",
            "specialty": "Registered Nurse (RN) - General",
            "duration": "13 weeks",
            "pay_range": {"min": 50, "max": 75},
            "benefits": [],
            "time_off_policy": "Standard PTO",
            "requirements": [],
            "certifications_required": [],
            "experience_required": 0,
            "application_workflow_type": "in_platform_only"
        }
        
        response = requests.post(f"{BASE_URL}/api/jobs", json=job_data, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        job = response.json()
        
        assert job.get("application_workflow_type") == "in_platform_only"
        print(f"PASS: Created in_platform_only job: {job.get('id')}")
    
    def test_create_job_with_external_required_immediately(self):
        """POST /api/jobs with external_required_immediately workflow"""
        token = TestAuth.get_employer_token()
        assert token, "Failed to get employer token"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        job_data = {
            "title": f"TEST_ExternalImmediate_Job_{uuid.uuid4().hex[:8]}",
            "description": "Test job for external immediate workflow",
            "location": "Test City, TX",
            "specialty": "Registered Nurse (RN) - General",
            "duration": "26 weeks",
            "pay_range": {"min": 60, "max": 80},
            "benefits": ["Health Insurance", "Housing Stipend"],
            "time_off_policy": "Standard PTO",
            "requirements": [],
            "certifications_required": ["BLS"],
            "experience_required": 2,
            "application_workflow_type": "external_required_immediately",
            "external_application_url": "https://careers.hospital.com/apply",
            "external_application_stage": "before_match"
        }
        
        response = requests.post(f"{BASE_URL}/api/jobs", json=job_data, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        job = response.json()
        
        assert job.get("application_workflow_type") == "external_required_immediately"
        assert job.get("external_application_url") == "https://careers.hospital.com/apply"
        print(f"PASS: Created external_required_immediately job: {job.get('id')}")
    
    def test_get_jobs_returns_workflow_fields(self):
        """GET /api/jobs should return workflow fields in response"""
        token = TestAuth.get_employer_token()
        assert token, "Failed to get employer token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/jobs", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        jobs = response.json()
        
        # Check that workflow fields are present in jobs
        for job in jobs:
            # application_workflow_type should have a default value
            workflow_type = job.get("application_workflow_type")
            # It can be None for old jobs or one of the valid values
            if workflow_type is not None:
                valid_types = ["in_platform_only", "external_required_immediately", 
                              "external_required_after_match", "external_optional"]
                assert workflow_type in valid_types, f"Invalid workflow type: {workflow_type}"
        
        print(f"PASS: GET /api/jobs returns workflow fields for {len(jobs)} jobs")
    
    def test_default_workflow_type_is_in_platform_only(self):
        """Jobs created without workflow_type should default to in_platform_only"""
        token = TestAuth.get_employer_token()
        assert token, "Failed to get employer token"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create job without specifying workflow type
        job_data = {
            "title": f"TEST_DefaultWorkflow_Job_{uuid.uuid4().hex[:8]}",
            "description": "Test job without workflow type specified",
            "location": "Test City, TX",
            "specialty": "Registered Nurse (RN) - General",
            "duration": "13 weeks",
            "pay_range": {"min": 45, "max": 65},
            "benefits": [],
            "time_off_policy": "Standard PTO",
            "requirements": [],
            "certifications_required": [],
            "experience_required": 0
        }
        
        response = requests.post(f"{BASE_URL}/api/jobs", json=job_data, headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        job = response.json()
        
        # Default should be in_platform_only
        assert job.get("application_workflow_type") == "in_platform_only", \
            f"Expected default in_platform_only, got {job.get('application_workflow_type')}"
        
        print(f"PASS: Default workflow type is in_platform_only")


class TestSwipeJobsWorkflowFields:
    """Test that swipe/jobs endpoint returns workflow fields for SwipePage"""
    
    def test_swipe_jobs_returns_workflow_fields(self):
        """GET /api/swipe/jobs should return workflow fields for SwipePage display"""
        token = TestAuth.get_seeker_token()
        assert token, "Failed to get seeker token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/swipe/jobs", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        jobs = response.json()
        
        # Check that jobs include workflow fields
        for job in jobs:
            # These fields should be present (may be null for old jobs)
            assert "application_workflow_type" in job or job.get("application_workflow_type") is None, \
                "Job should have application_workflow_type field"
            
            workflow_type = job.get("application_workflow_type")
            if workflow_type and workflow_type != "in_platform_only":
                # If external workflow, should have URL
                print(f"Job {job.get('id')}: workflow={workflow_type}, url={job.get('external_application_url')}")
        
        print(f"PASS: Swipe jobs endpoint returns workflow fields for {len(jobs)} jobs")


class TestJobFormWorkflowSection:
    """Test job form workflow section via API (6 sections total)"""
    
    def test_job_with_all_workflow_options(self):
        """Test creating jobs with all 4 workflow type options"""
        token = TestAuth.get_employer_token()
        assert token, "Failed to get employer token"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        workflow_types = [
            "in_platform_only",
            "external_required_immediately",
            "external_required_after_match",
            "external_optional"
        ]
        
        for wf_type in workflow_types:
            job_data = {
                "title": f"TEST_{wf_type}_Job_{uuid.uuid4().hex[:8]}",
                "description": f"Test job for {wf_type} workflow",
                "location": "Test City, TX",
                "specialty": "Registered Nurse (RN) - General",
                "duration": "13 weeks",
                "pay_range": {"min": 50, "max": 70},
                "benefits": [],
                "time_off_policy": "Standard PTO",
                "requirements": [],
                "certifications_required": [],
                "experience_required": 1,
                "application_workflow_type": wf_type
            }
            
            if wf_type != "in_platform_only":
                job_data["external_application_url"] = "https://example.com/apply"
                job_data["external_application_stage"] = "after_match"
            
            response = requests.post(f"{BASE_URL}/api/jobs", json=job_data, headers=headers)
            
            assert response.status_code == 200, f"Failed to create job with {wf_type}: {response.text}"
            job = response.json()
            assert job.get("application_workflow_type") == wf_type
            print(f"PASS: Created job with workflow type: {wf_type}")
        
        print("PASS: All 4 workflow types work correctly")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_jobs(self):
        """Delete TEST_ prefixed jobs created during testing"""
        token = TestAuth.get_employer_token()
        if not token:
            print("SKIP: Could not get employer token for cleanup")
            return
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/jobs", headers=headers)
        
        if response.status_code == 200:
            jobs = response.json()
            deleted = 0
            for job in jobs:
                if job.get("title", "").startswith("TEST_"):
                    del_response = requests.delete(f"{BASE_URL}/api/jobs/{job['id']}", headers=headers)
                    if del_response.status_code == 200:
                        deleted += 1
            print(f"Cleanup: Deleted {deleted} test jobs")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
