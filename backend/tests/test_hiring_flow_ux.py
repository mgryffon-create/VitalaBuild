"""
Test Hiring Flow UX - Pipeline API and State-Driven Actions
Tests for iteration 63: Profile Preview Modal, state-driven buttons, pass/reject flow
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPipelineAPIEnrichedData:
    """Test that pipeline API returns enriched candidate data"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as employer and get token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "employer_test@vitalamatch.com",
            "password": "test123"
        })
        if login_resp.status_code == 200:
            self.token = login_resp.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Could not login as employer")
    
    def test_pipeline_candidates_returns_vault_categories(self):
        """Pipeline response should include vault_categories for each candidate"""
        resp = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.headers)
        assert resp.status_code == 200
        data = resp.json()
        
        # Check structure
        assert "candidates" in data
        assert "stats" in data
        
        # Find any candidate with data
        all_candidates = []
        for stage, candidates in data["candidates"].items():
            all_candidates.extend(candidates)
        
        if len(all_candidates) > 0:
            candidate = all_candidates[0]
            # vault_categories should be present (may be empty list)
            assert "vault_categories" in candidate, "vault_categories field missing from candidate"
            assert isinstance(candidate["vault_categories"], list)
            print(f"✓ vault_categories present: {candidate['vault_categories']}")
    
    def test_pipeline_candidates_returns_messages_count(self):
        """Pipeline response should include messages_count for each candidate"""
        resp = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.headers)
        assert resp.status_code == 200
        data = resp.json()
        
        all_candidates = []
        for stage, candidates in data["candidates"].items():
            all_candidates.extend(candidates)
        
        if len(all_candidates) > 0:
            candidate = all_candidates[0]
            assert "messages_count" in candidate, "messages_count field missing from candidate"
            assert isinstance(candidate["messages_count"], int)
            print(f"✓ messages_count present: {candidate['messages_count']}")
    
    def test_pipeline_candidates_returns_certifications(self):
        """Pipeline response should include certifications in seeker object"""
        resp = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.headers)
        assert resp.status_code == 200
        data = resp.json()
        
        all_candidates = []
        for stage, candidates in data["candidates"].items():
            all_candidates.extend(candidates)
        
        if len(all_candidates) > 0:
            candidate = all_candidates[0]
            assert "seeker" in candidate
            assert "certifications" in candidate["seeker"], "certifications field missing from seeker"
            print(f"✓ certifications present: {candidate['seeker']['certifications']}")
    
    def test_pipeline_candidates_returns_job_pay_range(self):
        """Pipeline response should include pay_range in job object"""
        resp = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.headers)
        assert resp.status_code == 200
        data = resp.json()
        
        all_candidates = []
        for stage, candidates in data["candidates"].items():
            all_candidates.extend(candidates)
        
        if len(all_candidates) > 0:
            candidate = all_candidates[0]
            assert "job" in candidate
            assert "pay_range" in candidate["job"], "pay_range field missing from job"
            print(f"✓ pay_range present: {candidate['job']['pay_range']}")
    
    def test_pipeline_candidates_returns_job_shift_type(self):
        """Pipeline response should include shift_type in job object"""
        resp = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.headers)
        assert resp.status_code == 200
        data = resp.json()
        
        all_candidates = []
        for stage, candidates in data["candidates"].items():
            all_candidates.extend(candidates)
        
        if len(all_candidates) > 0:
            candidate = all_candidates[0]
            assert "job" in candidate
            assert "shift_type" in candidate["job"], "shift_type field missing from job"
            print(f"✓ shift_type present: {candidate['job']['shift_type']}")


class TestPipelineStageTransitions:
    """Test stage transitions and state-driven actions"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as employer and get token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "employer_test@vitalamatch.com",
            "password": "test123"
        })
        if login_resp.status_code == 200:
            self.token = login_resp.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Could not login as employer")
    
    def test_stages_include_passed_and_rejected(self):
        """Backend STAGES should include 'passed' and 'rejected'"""
        # This is a code-level check - we verify by trying to set stage to 'passed'
        resp = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.headers)
        assert resp.status_code == 200
        data = resp.json()
        
        # Find an interested candidate to test pass action
        interested = data["candidates"].get("interested", [])
        if len(interested) > 0:
            candidate = interested[0]
            # Try to pass the candidate
            pass_resp = requests.put(
                f"{BASE_URL}/api/pipeline/candidates/{candidate['candidate_id']}/{candidate['job_id']}/stage",
                headers=self.headers,
                json={"stage": "passed"}
            )
            # Should succeed (200) or conflict (409 if already passed)
            assert pass_resp.status_code in [200, 409], f"Pass action failed: {pass_resp.text}"
            print(f"✓ 'passed' stage is valid: {pass_resp.status_code}")
        else:
            print("⚠ No interested candidates to test pass action")
    
    def test_passed_candidates_filtered_from_active_pipeline(self):
        """Passed candidates should not appear in active pipeline view"""
        resp = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.headers)
        assert resp.status_code == 200
        data = resp.json()
        
        # Check that no candidate in any active stage has stage='passed' or 'rejected'
        for stage_name, candidates in data["candidates"].items():
            for c in candidates:
                assert c["stage"] not in ("passed", "rejected"), \
                    f"Found {c['stage']} candidate in active pipeline view"
        print("✓ Passed/rejected candidates filtered from active pipeline")
    
    def test_invalid_stage_returns_400(self):
        """Invalid stage value should return 400"""
        resp = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.headers)
        data = resp.json()
        
        interested = data["candidates"].get("interested", [])
        if len(interested) > 0:
            candidate = interested[0]
            invalid_resp = requests.put(
                f"{BASE_URL}/api/pipeline/candidates/{candidate['candidate_id']}/{candidate['job_id']}/stage",
                headers=self.headers,
                json={"stage": "invalid_stage_xyz"}
            )
            assert invalid_resp.status_code == 400, f"Expected 400 for invalid stage, got {invalid_resp.status_code}"
            print("✓ Invalid stage returns 400")
        else:
            print("⚠ No interested candidates to test invalid stage")
    
    def test_duplicate_stage_returns_409(self):
        """Moving to same stage should return 409 conflict"""
        resp = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.headers)
        data = resp.json()
        
        # Find a matched candidate
        matched = data["candidates"].get("matched", [])
        if len(matched) > 0:
            candidate = matched[0]
            # Try to move to 'matched' again
            dup_resp = requests.put(
                f"{BASE_URL}/api/pipeline/candidates/{candidate['candidate_id']}/{candidate['job_id']}/stage",
                headers=self.headers,
                json={"stage": "matched"}
            )
            assert dup_resp.status_code == 409, f"Expected 409 for duplicate stage, got {dup_resp.status_code}"
            print("✓ Duplicate stage returns 409")
        else:
            print("⚠ No matched candidates to test duplicate stage")


class TestPipelineErrorMessages:
    """Test actionable error messages"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as employer and get token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "employer_test@vitalamatch.com",
            "password": "test123"
        })
        if login_resp.status_code == 200:
            self.token = login_resp.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Could not login as employer")
    
    def test_nonexistent_candidate_returns_404(self):
        """Non-existent candidate should return 404 with actionable message"""
        resp = requests.put(
            f"{BASE_URL}/api/pipeline/candidates/nonexistent-id-123/fake-job-456/stage",
            headers=self.headers,
            json={"stage": "matched"}
        )
        # Should be 404 or 403 (depending on implementation)
        assert resp.status_code in [404, 403], f"Expected 404/403, got {resp.status_code}"
        print(f"✓ Non-existent candidate returns {resp.status_code}")
    
    def test_unauthorized_access_returns_403(self):
        """Seeker trying to access pipeline should get 403"""
        # Login as seeker
        seeker_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "seeker_test@vitalamatch.com",
            "password": "test123"
        })
        if seeker_login.status_code != 200:
            pytest.skip("Could not login as seeker")
        
        seeker_token = seeker_login.json().get("access_token")
        seeker_headers = {"Authorization": f"Bearer {seeker_token}"}
        
        resp = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=seeker_headers)
        assert resp.status_code == 403, f"Expected 403 for seeker, got {resp.status_code}"
        print("✓ Seeker access to pipeline returns 403")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
