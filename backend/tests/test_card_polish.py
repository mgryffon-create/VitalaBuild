"""
Test Card Polish Features:
1. Reason line wording - 'Aligned with your RN specialty' not 'Related RN role'
2. Backend swipe/jobs endpoint returns correct structure
3. Date formatting helper (frontend tests via Playwright)
4. Hours formatting (frontend tests via Playwright)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCardPolishBackend:
    """Backend tests for card polish features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as seeker and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "seeker_test@vitalamatch.com",
            "password": "test123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_swipe_jobs_returns_correct_structure(self):
        """Test that /api/swipe/jobs returns {jobs, counts, has_hidden} structure"""
        response = requests.get(f"{BASE_URL}/api/swipe/jobs", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # Verify structure
        assert "jobs" in data, "Response should have 'jobs' key"
        assert "counts" in data, "Response should have 'counts' key"
        assert "has_hidden" in data, "Response should have 'has_hidden' key"
        
        # Verify jobs is a list
        assert isinstance(data["jobs"], list), "jobs should be a list"
        
        # Verify counts structure
        counts = data["counts"]
        assert "strong" in counts, "counts should have 'strong'"
        assert "possible" in counts, "counts should have 'possible'"
        assert "hidden" in counts, "counts should have 'hidden'"
        
        print(f"PASS: swipe/jobs returns correct structure with {len(data['jobs'])} jobs")
        print(f"  Counts: strong={counts['strong']}, possible={counts['possible']}, hidden={counts['hidden']}")
        print(f"  has_hidden={data['has_hidden']}")
    
    def test_job_has_match_tier_and_reasons(self):
        """Test that each job has match_tier and match_reasons"""
        response = requests.get(f"{BASE_URL}/api/swipe/jobs", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        jobs = data["jobs"]
        
        if len(jobs) == 0:
            pytest.skip("No jobs available to test")
        
        for job in jobs[:5]:  # Check first 5 jobs
            assert "match_tier" in job, f"Job {job.get('id')} missing match_tier"
            assert "match_reasons" in job, f"Job {job.get('id')} missing match_reasons"
            assert job["match_tier"] in ["strong", "possible", "expanded"], f"Invalid tier: {job['match_tier']}"
            assert isinstance(job["match_reasons"], list), "match_reasons should be a list"
            
            print(f"  Job '{job.get('title', 'N/A')[:30]}': tier={job['match_tier']}, reasons={job['match_reasons']}")
        
        print(f"PASS: All checked jobs have match_tier and match_reasons")
    
    def test_reason_wording_no_related_rn_role(self):
        """Test that reason lines use 'Aligned with your RN specialty' not 'Related RN role'"""
        response = requests.get(f"{BASE_URL}/api/swipe/jobs", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        jobs = data["jobs"]
        
        found_aligned_reason = False
        found_bad_wording = False
        
        for job in jobs:
            reasons = job.get("match_reasons", [])
            for reason in reasons:
                reason_lower = reason.lower()
                # Check for bad wording
                if "related rn role" in reason_lower:
                    found_bad_wording = True
                    print(f"  BAD WORDING FOUND: '{reason}' in job '{job.get('title')}'")
                
                # Check for correct wording
                if "aligned with your" in reason_lower and "specialty" in reason_lower:
                    found_aligned_reason = True
                    print(f"  GOOD: Found aligned reason: '{reason}'")
                
                if "matches your" in reason_lower and "specialty" in reason_lower:
                    found_aligned_reason = True
                    print(f"  GOOD: Found matches reason: '{reason}'")
        
        assert not found_bad_wording, "Found deprecated 'Related RN role' wording"
        print(f"PASS: No deprecated 'Related RN role' wording found")
        if found_aligned_reason:
            print(f"PASS: Found correct 'Aligned with your X specialty' wording")
    
    def test_certification_reason_wording(self):
        """Test that certification reasons use 'You hold all required certifications' not 'Has all required certifications'"""
        response = requests.get(f"{BASE_URL}/api/swipe/jobs", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        jobs = data["jobs"]
        
        found_bad_wording = False
        found_good_wording = False
        
        for job in jobs:
            reasons = job.get("match_reasons", [])
            for reason in reasons:
                reason_lower = reason.lower()
                # Check for bad wording
                if "has all required certifications" in reason_lower:
                    found_bad_wording = True
                    print(f"  BAD WORDING: '{reason}'")
                
                # Check for correct wording
                if "you hold all required certifications" in reason_lower:
                    found_good_wording = True
                    print(f"  GOOD: '{reason}'")
        
        assert not found_bad_wording, "Found deprecated 'Has all required certifications' wording"
        print(f"PASS: No deprecated certification wording found")
        if found_good_wording:
            print(f"PASS: Found correct 'You hold all required certifications' wording")
    
    def test_experience_reason_wording(self):
        """Test that experience reasons use 'Meets your X+ year experience requirement' wording"""
        response = requests.get(f"{BASE_URL}/api/swipe/jobs", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        jobs = data["jobs"]
        
        for job in jobs:
            reasons = job.get("match_reasons", [])
            for reason in reasons:
                reason_lower = reason.lower()
                # Check for experience-related reasons
                if "experience" in reason_lower:
                    print(f"  Experience reason: '{reason}'")
                    # Should use "Meets" or "Nearly meets" not "Has"
                    assert "has" not in reason_lower.split()[0], f"Bad wording: '{reason}'"
        
        print(f"PASS: Experience reason wording is correct")
    
    def test_swipe_actions_still_work(self):
        """Test that swipe pass/like actions still work"""
        # Get jobs
        response = requests.get(f"{BASE_URL}/api/swipe/jobs", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        jobs = data["jobs"]
        
        if len(jobs) == 0:
            pytest.skip("No jobs available to test swipe")
        
        # Try to pass on first job
        job_id = jobs[0]["id"]
        swipe_response = requests.post(
            f"{BASE_URL}/api/swipe",
            headers=self.headers,
            json={"target_id": job_id, "action": "pass"}
        )
        
        # Should succeed (200) or already swiped (400)
        assert swipe_response.status_code in [200, 400], f"Swipe failed: {swipe_response.text}"
        print(f"PASS: Swipe action works (status={swipe_response.status_code})")


class TestEmployerLogin:
    """Test employer can still login and access their endpoints"""
    
    def test_employer_login(self):
        """Test employer login works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "employer_test@vitalamatch.com",
            "password": "test123"
        })
        assert response.status_code == 200, f"Employer login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "poster"
        print(f"PASS: Employer login works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
