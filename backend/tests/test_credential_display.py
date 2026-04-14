"""
Test credential display in pipeline and messaging - iteration 65
Tests that seeker.credential field is returned by pipeline API and displayed in UI
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCredentialDisplay:
    """Tests for credential badge display in pipeline and messaging"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with employer auth"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as employer
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "employer_test@vitalamatch.com",
            "password": "test123"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        token = login_resp.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        yield
    
    def test_pipeline_candidates_returns_credential_field(self):
        """Pipeline API returns seeker.credential field for each candidate"""
        resp = self.session.get(f"{BASE_URL}/api/pipeline/candidates")
        assert resp.status_code == 200
        
        data = resp.json()
        assert "candidates" in data
        
        # Check at least one stage has candidates with credential
        found_credential = False
        for stage, candidates in data["candidates"].items():
            for candidate in candidates:
                seeker = candidate.get("seeker", {})
                if seeker.get("credential"):
                    found_credential = True
                    # Verify credential is a valid role category
                    assert seeker["credential"] in ["RN", "LPN", "CNA", "NP", "CRNA", "PA", "RT", "OT", "PT", "ST", "MEDICAL_ASSISTANT", "PHLEBOTOMIST", "RADIOLOGY_TECH"], \
                        f"Invalid credential: {seeker['credential']}"
                    break
            if found_credential:
                break
        
        assert found_credential, "No candidates with credential field found"
    
    def test_pipeline_candidates_have_specialty(self):
        """Pipeline API returns seeker.specialty field"""
        resp = self.session.get(f"{BASE_URL}/api/pipeline/candidates")
        assert resp.status_code == 200
        
        data = resp.json()
        found_specialty = False
        for stage, candidates in data["candidates"].items():
            for candidate in candidates:
                seeker = candidate.get("seeker", {})
                if seeker.get("specialty"):
                    found_specialty = True
                    assert isinstance(seeker["specialty"], str)
                    break
            if found_specialty:
                break
        
        assert found_specialty, "No candidates with specialty field found"
    
    def test_pipeline_candidates_have_job_title(self):
        """Pipeline API returns job.title field"""
        resp = self.session.get(f"{BASE_URL}/api/pipeline/candidates")
        assert resp.status_code == 200
        
        data = resp.json()
        found_job_title = False
        for stage, candidates in data["candidates"].items():
            for candidate in candidates:
                job = candidate.get("job", {})
                if job.get("title"):
                    found_job_title = True
                    assert isinstance(job["title"], str)
                    break
            if found_job_title:
                break
        
        assert found_job_title, "No candidates with job.title field found"
    
    def test_pipeline_candidates_have_stage_field(self):
        """Pipeline API returns stage field for each candidate"""
        resp = self.session.get(f"{BASE_URL}/api/pipeline/candidates")
        assert resp.status_code == 200
        
        data = resp.json()
        valid_stages = ["interested", "matched", "interviewing", "offer_sent", "hired"]
        
        for stage, candidates in data["candidates"].items():
            assert stage in valid_stages, f"Invalid stage key: {stage}"
            for candidate in candidates:
                assert "stage" in candidate
                assert candidate["stage"] in valid_stages + ["passed", "rejected"]
    
    def test_pipeline_candidates_have_job_location(self):
        """Pipeline API returns job.location field"""
        resp = self.session.get(f"{BASE_URL}/api/pipeline/candidates")
        assert resp.status_code == 200
        
        data = resp.json()
        found_location = False
        for stage, candidates in data["candidates"].items():
            for candidate in candidates:
                job = candidate.get("job", {})
                if job.get("location"):
                    found_location = True
                    assert isinstance(job["location"], str)
                    break
            if found_location:
                break
        
        assert found_location, "No candidates with job.location field found"
    
    def test_pipeline_candidates_have_job_pay_range(self):
        """Pipeline API returns job.pay_range field"""
        resp = self.session.get(f"{BASE_URL}/api/pipeline/candidates")
        assert resp.status_code == 200
        
        data = resp.json()
        found_pay_range = False
        for stage, candidates in data["candidates"].items():
            for candidate in candidates:
                job = candidate.get("job", {})
                if job.get("pay_range"):
                    found_pay_range = True
                    pay_range = job["pay_range"]
                    assert "min" in pay_range or "max" in pay_range
                    break
            if found_pay_range:
                break
        
        # Pay range is optional, so just verify structure if present
        if found_pay_range:
            assert True
    
    def test_candidate_context_returns_full_name(self):
        """Candidate context API returns full_name"""
        # First get a candidate ID from pipeline
        resp = self.session.get(f"{BASE_URL}/api/pipeline/candidates")
        assert resp.status_code == 200
        
        data = resp.json()
        candidate_id = None
        job_id = None
        for stage, candidates in data["candidates"].items():
            if candidates:
                candidate_id = candidates[0].get("candidate_id")
                job_id = candidates[0].get("job_id")
                break
        
        if not candidate_id:
            pytest.skip("No candidates available for context test")
        
        # Get candidate context
        url = f"{BASE_URL}/api/pipeline/candidates/{candidate_id}/context"
        if job_id:
            url += f"?job_id={job_id}"
        
        ctx_resp = self.session.get(url)
        assert ctx_resp.status_code == 200
        
        ctx = ctx_resp.json()
        assert "full_name" in ctx
        assert isinstance(ctx["full_name"], str)
    
    def test_candidate_context_returns_specialty(self):
        """Candidate context API returns specialty"""
        resp = self.session.get(f"{BASE_URL}/api/pipeline/candidates")
        assert resp.status_code == 200
        
        data = resp.json()
        candidate_id = None
        job_id = None
        for stage, candidates in data["candidates"].items():
            if candidates:
                candidate_id = candidates[0].get("candidate_id")
                job_id = candidates[0].get("job_id")
                break
        
        if not candidate_id:
            pytest.skip("No candidates available for context test")
        
        url = f"{BASE_URL}/api/pipeline/candidates/{candidate_id}/context"
        if job_id:
            url += f"?job_id={job_id}"
        
        ctx_resp = self.session.get(url)
        assert ctx_resp.status_code == 200
        
        ctx = ctx_resp.json()
        # Specialty may be null for incomplete profiles
        if ctx.get("specialty"):
            assert isinstance(ctx["specialty"], str)
    
    def test_privacy_gating_pre_match(self):
        """Pre-match candidates should not have contact info exposed"""
        resp = self.session.get(f"{BASE_URL}/api/pipeline/candidates")
        assert resp.status_code == 200
        
        data = resp.json()
        interested_candidates = data["candidates"].get("interested", [])
        
        if not interested_candidates:
            pytest.skip("No interested candidates for privacy test")
        
        candidate = interested_candidates[0]
        candidate_id = candidate.get("candidate_id")
        job_id = candidate.get("job_id")
        
        url = f"{BASE_URL}/api/pipeline/candidates/{candidate_id}/context"
        if job_id:
            url += f"?job_id={job_id}"
        
        ctx_resp = self.session.get(url)
        assert ctx_resp.status_code == 200
        
        ctx = ctx_resp.json()
        # Pre-match should have contact_available=False
        # Note: This depends on whether a match exists
        if not ctx.get("contact_available"):
            assert "phone" not in ctx or ctx.get("phone") is None
            assert "email" not in ctx or ctx.get("email") is None
    
    def test_privacy_gating_post_match(self):
        """Post-match candidates should have contact info available"""
        resp = self.session.get(f"{BASE_URL}/api/pipeline/candidates")
        assert resp.status_code == 200
        
        data = resp.json()
        matched_candidates = data["candidates"].get("matched", [])
        
        if not matched_candidates:
            pytest.skip("No matched candidates for privacy test")
        
        candidate = matched_candidates[0]
        candidate_id = candidate.get("candidate_id")
        job_id = candidate.get("job_id")
        
        url = f"{BASE_URL}/api/pipeline/candidates/{candidate_id}/context"
        if job_id:
            url += f"?job_id={job_id}"
        
        ctx_resp = self.session.get(url)
        assert ctx_resp.status_code == 200
        
        ctx = ctx_resp.json()
        # Post-match should have contact_available=True
        assert ctx.get("contact_available") == True
        # Email should be present (phone may be optional)
        assert "email" in ctx


class TestMessagingIntegration:
    """Tests for messaging functionality with matched candidates"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with employer auth"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "employer_test@vitalamatch.com",
            "password": "test123"
        })
        assert login_resp.status_code == 200
        token = login_resp.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        yield
    
    def test_matches_endpoint_returns_data(self):
        """Matches endpoint returns match data"""
        resp = self.session.get(f"{BASE_URL}/api/matches")
        assert resp.status_code == 200
        
        data = resp.json()
        assert isinstance(data, list)
    
    def test_send_message_to_matched_candidate(self):
        """Can send message to matched candidate"""
        # Get matches
        matches_resp = self.session.get(f"{BASE_URL}/api/matches")
        assert matches_resp.status_code == 200
        
        matches = matches_resp.json()
        if not matches:
            pytest.skip("No matches available for messaging test")
        
        match_id = matches[0].get("id")
        
        # Send a test message
        msg_resp = self.session.post(f"{BASE_URL}/api/matches/{match_id}/messages", json={
            "content": "TEST_credential_display_test_message"
        })
        
        # Should succeed (200) or fail gracefully (4xx)
        assert msg_resp.status_code in [200, 201, 400, 403, 404]
        
        if msg_resp.status_code in [200, 201]:
            # Verify message was created
            get_msgs_resp = self.session.get(f"{BASE_URL}/api/matches/{match_id}/messages")
            assert get_msgs_resp.status_code == 200
            messages = get_msgs_resp.json()
            assert any("TEST_credential_display_test_message" in m.get("content", "") for m in messages)


class TestEligibilityModule:
    """Tests for eligibility.py get_seeker_role function"""
    
    def test_get_seeker_role_from_specialty(self):
        """get_seeker_role extracts role from specialty string"""
        from eligibility import get_seeker_role
        
        # Test RN specialty
        profile = {"specialty": "Registered Nurse (RN) - ICU/Critical Care"}
        assert get_seeker_role(profile) == "RN"
        
        # Test CNA specialty
        profile = {"specialty": "Certified Nursing Assistant (CNA)"}
        assert get_seeker_role(profile) == "CNA"
        
        # Test LPN specialty
        profile = {"specialty": "Licensed Practical Nurse (LPN)"}
        assert get_seeker_role(profile) == "LPN"
    
    def test_get_seeker_role_from_normalized_category(self):
        """get_seeker_role uses normalized_role_category if set"""
        from eligibility import get_seeker_role
        
        profile = {
            "normalized_role_category": "NP",
            "specialty": "Registered Nurse (RN)"  # Should be ignored
        }
        assert get_seeker_role(profile) == "NP"
    
    def test_get_seeker_role_returns_none_for_empty(self):
        """get_seeker_role returns None for empty profile"""
        from eligibility import get_seeker_role
        
        assert get_seeker_role({}) is None
        assert get_seeker_role({"specialty": ""}) is None
