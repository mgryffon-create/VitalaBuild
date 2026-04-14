"""
Test Match/Conversation Detail Usability Features
- Privacy-gated contact info (pre-match vs post-match)
- Enhanced context endpoint with licenses, work_history, certifications, vault_categories
- Stage-driven actions
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPrivacyGating:
    """Test privacy-gated contact info on /api/pipeline/candidates/{id}/context"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as employer and get pipeline data"""
        # Login as employer
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "employer_test@vitalamatch.com",
            "password": "test123"
        })
        assert login_resp.status_code == 200, f"Employer login failed: {login_resp.text}"
        self.employer_token = login_resp.json()["access_token"]
        self.employer_headers = {"Authorization": f"Bearer {self.employer_token}"}
        
        # Get pipeline candidates
        pipeline_resp = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.employer_headers)
        assert pipeline_resp.status_code == 200, f"Pipeline fetch failed: {pipeline_resp.text}"
        self.pipeline_data = pipeline_resp.json()
        
        # Get interested (pre-match) and matched (post-match) candidates
        self.interested_candidates = self.pipeline_data.get("candidates", {}).get("interested", [])
        self.matched_candidates = self.pipeline_data.get("candidates", {}).get("matched", [])
    
    def test_pre_match_contact_hidden(self):
        """Pre-match (interested stage): contact info should NOT be returned"""
        if not self.interested_candidates:
            pytest.skip("No interested candidates available for testing")
        
        candidate = self.interested_candidates[0]
        candidate_id = candidate["candidate_id"]
        job_id = candidate["job_id"]
        
        resp = requests.get(
            f"{BASE_URL}/api/pipeline/candidates/{candidate_id}/context?job_id={job_id}",
            headers=self.employer_headers
        )
        assert resp.status_code == 200, f"Context fetch failed: {resp.text}"
        data = resp.json()
        
        # Privacy gating assertions
        assert data.get("contact_available") == False, "Pre-match should have contact_available=False"
        assert "phone" not in data, "Pre-match should NOT return phone field"
        assert "email" not in data, "Pre-match should NOT return email field"
        print(f"PASS: Pre-match candidate {data.get('full_name')} - contact info correctly hidden")
    
    def test_post_match_contact_visible(self):
        """Post-match (matched stage): contact info should be returned"""
        if not self.matched_candidates:
            pytest.skip("No matched candidates available for testing")
        
        candidate = self.matched_candidates[0]
        candidate_id = candidate["candidate_id"]
        job_id = candidate["job_id"]
        
        resp = requests.get(
            f"{BASE_URL}/api/pipeline/candidates/{candidate_id}/context?job_id={job_id}",
            headers=self.employer_headers
        )
        assert resp.status_code == 200, f"Context fetch failed: {resp.text}"
        data = resp.json()
        
        # Privacy gating assertions
        assert data.get("contact_available") == True, "Post-match should have contact_available=True"
        # Email should be present (phone may be None if not set)
        assert "email" in data, "Post-match should return email field"
        print(f"PASS: Post-match candidate {data.get('full_name')} - contact_available=True, email={data.get('email')}")


class TestEnhancedContextEndpoint:
    """Test enhanced context endpoint returns all required fields"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as employer"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "employer_test@vitalamatch.com",
            "password": "test123"
        })
        assert login_resp.status_code == 200
        self.employer_token = login_resp.json()["access_token"]
        self.employer_headers = {"Authorization": f"Bearer {self.employer_token}"}
        
        # Get a candidate
        pipeline_resp = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.employer_headers)
        assert pipeline_resp.status_code == 200
        all_candidates = []
        for stage_candidates in pipeline_resp.json().get("candidates", {}).values():
            all_candidates.extend(stage_candidates)
        self.test_candidate = all_candidates[0] if all_candidates else None
    
    def test_context_returns_full_name(self):
        """Context endpoint returns full_name"""
        if not self.test_candidate:
            pytest.skip("No candidates available")
        
        resp = requests.get(
            f"{BASE_URL}/api/pipeline/candidates/{self.test_candidate['candidate_id']}/context",
            headers=self.employer_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "full_name" in data, "Missing full_name"
        assert data["full_name"], "full_name should not be empty"
        print(f"PASS: full_name = {data['full_name']}")
    
    def test_context_returns_specialty(self):
        """Context endpoint returns specialty"""
        if not self.test_candidate:
            pytest.skip("No candidates available")
        
        resp = requests.get(
            f"{BASE_URL}/api/pipeline/candidates/{self.test_candidate['candidate_id']}/context",
            headers=self.employer_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "specialty" in data, "Missing specialty field"
        print(f"PASS: specialty = {data.get('specialty')}")
    
    def test_context_returns_city_state(self):
        """Context endpoint returns city_state"""
        if not self.test_candidate:
            pytest.skip("No candidates available")
        
        resp = requests.get(
            f"{BASE_URL}/api/pipeline/candidates/{self.test_candidate['candidate_id']}/context",
            headers=self.employer_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "city_state" in data, "Missing city_state field"
        print(f"PASS: city_state = {data.get('city_state')}")
    
    def test_context_returns_licenses(self):
        """Context endpoint returns licenses array"""
        if not self.test_candidate:
            pytest.skip("No candidates available")
        
        resp = requests.get(
            f"{BASE_URL}/api/pipeline/candidates/{self.test_candidate['candidate_id']}/context",
            headers=self.employer_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "licenses" in data, "Missing licenses field"
        assert isinstance(data["licenses"], list), "licenses should be a list"
        print(f"PASS: licenses = {len(data['licenses'])} items")
    
    def test_context_returns_certifications(self):
        """Context endpoint returns certifications array"""
        if not self.test_candidate:
            pytest.skip("No candidates available")
        
        resp = requests.get(
            f"{BASE_URL}/api/pipeline/candidates/{self.test_candidate['candidate_id']}/context",
            headers=self.employer_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "certifications" in data, "Missing certifications field"
        assert isinstance(data["certifications"], list), "certifications should be a list"
        print(f"PASS: certifications = {len(data['certifications'])} items")
    
    def test_context_returns_work_history(self):
        """Context endpoint returns work_history array"""
        if not self.test_candidate:
            pytest.skip("No candidates available")
        
        resp = requests.get(
            f"{BASE_URL}/api/pipeline/candidates/{self.test_candidate['candidate_id']}/context",
            headers=self.employer_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "work_history" in data, "Missing work_history field"
        assert isinstance(data["work_history"], list), "work_history should be a list"
        print(f"PASS: work_history = {len(data['work_history'])} items")
    
    def test_context_returns_vault_categories(self):
        """Context endpoint returns vault_categories array"""
        if not self.test_candidate:
            pytest.skip("No candidates available")
        
        resp = requests.get(
            f"{BASE_URL}/api/pipeline/candidates/{self.test_candidate['candidate_id']}/context",
            headers=self.employer_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "vault_categories" in data, "Missing vault_categories field"
        assert isinstance(data["vault_categories"], list), "vault_categories should be a list"
        print(f"PASS: vault_categories = {data['vault_categories']}")
    
    def test_context_returns_references(self):
        """Context endpoint returns references object with total, verified, top"""
        if not self.test_candidate:
            pytest.skip("No candidates available")
        
        resp = requests.get(
            f"{BASE_URL}/api/pipeline/candidates/{self.test_candidate['candidate_id']}/context",
            headers=self.employer_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "references" in data, "Missing references field"
        refs = data["references"]
        assert "total" in refs, "Missing references.total"
        assert "verified" in refs, "Missing references.verified"
        assert "top" in refs, "Missing references.top"
        print(f"PASS: references = {refs['verified']}/{refs['total']} verified")
    
    def test_context_returns_compliance_ready(self):
        """Context endpoint returns compliance_ready boolean"""
        if not self.test_candidate:
            pytest.skip("No candidates available")
        
        resp = requests.get(
            f"{BASE_URL}/api/pipeline/candidates/{self.test_candidate['candidate_id']}/context",
            headers=self.employer_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "compliance_ready" in data, "Missing compliance_ready field"
        assert isinstance(data["compliance_ready"], bool), "compliance_ready should be boolean"
        print(f"PASS: compliance_ready = {data['compliance_ready']}")


class TestPipelineCandidatesEnriched:
    """Test pipeline candidates endpoint returns enriched data for conversation list"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as employer"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "employer_test@vitalamatch.com",
            "password": "test123"
        })
        assert login_resp.status_code == 200
        self.employer_token = login_resp.json()["access_token"]
        self.employer_headers = {"Authorization": f"Bearer {self.employer_token}"}
    
    def test_candidates_have_job_title(self):
        """Pipeline candidates include job.title for conversation list"""
        resp = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.employer_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        # Check first candidate from any stage
        for stage, candidates in data.get("candidates", {}).items():
            if candidates:
                c = candidates[0]
                assert "job" in c, f"Missing job object in {stage} candidate"
                assert "title" in c["job"], f"Missing job.title in {stage} candidate"
                print(f"PASS: {stage} candidate has job.title = {c['job'].get('title')}")
                break
    
    def test_candidates_have_job_location(self):
        """Pipeline candidates include job.location"""
        resp = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.employer_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        for stage, candidates in data.get("candidates", {}).items():
            if candidates:
                c = candidates[0]
                assert "location" in c.get("job", {}), f"Missing job.location in {stage} candidate"
                print(f"PASS: {stage} candidate has job.location = {c['job'].get('location')}")
                break
    
    def test_candidates_have_job_pay_range(self):
        """Pipeline candidates include job.pay_range"""
        resp = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.employer_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        for stage, candidates in data.get("candidates", {}).items():
            if candidates:
                c = candidates[0]
                assert "pay_range" in c.get("job", {}), f"Missing job.pay_range in {stage} candidate"
                print(f"PASS: {stage} candidate has job.pay_range = {c['job'].get('pay_range')}")
                break
    
    def test_candidates_have_seeker_specialty(self):
        """Pipeline candidates include seeker.specialty"""
        resp = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.employer_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        for stage, candidates in data.get("candidates", {}).items():
            if candidates:
                c = candidates[0]
                assert "seeker" in c, f"Missing seeker object in {stage} candidate"
                assert "specialty" in c["seeker"], f"Missing seeker.specialty in {stage} candidate"
                print(f"PASS: {stage} candidate has seeker.specialty = {c['seeker'].get('specialty')}")
                break


class TestSeekerApplications:
    """Test seeker applications endpoint for matches page"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as seeker"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "seeker_test@vitalamatch.com",
            "password": "test123"
        })
        assert login_resp.status_code == 200
        self.seeker_token = login_resp.json()["access_token"]
        self.seeker_headers = {"Authorization": f"Bearer {self.seeker_token}"}
    
    def test_seeker_applications_returns_job_title(self):
        """Seeker applications include job.title"""
        resp = requests.get(f"{BASE_URL}/api/seeker/applications", headers=self.seeker_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        if not data:
            pytest.skip("No applications for seeker")
        
        app = data[0]
        assert "job" in app, "Missing job object in application"
        assert "title" in app["job"], "Missing job.title in application"
        print(f"PASS: Application has job.title = {app['job'].get('title')}")
    
    def test_seeker_applications_returns_company_name(self):
        """Seeker applications include job.company_name"""
        resp = requests.get(f"{BASE_URL}/api/seeker/applications", headers=self.seeker_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        if not data:
            pytest.skip("No applications for seeker")
        
        app = data[0]
        # company_name may be in job object
        job = app.get("job", {})
        assert "company_name" in job or "company_name" in app, "Missing company_name"
        print(f"PASS: Application has company_name = {job.get('company_name') or app.get('company_name')}")
    
    def test_seeker_applications_returns_location(self):
        """Seeker applications include job.location"""
        resp = requests.get(f"{BASE_URL}/api/seeker/applications", headers=self.seeker_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        if not data:
            pytest.skip("No applications for seeker")
        
        app = data[0]
        job = app.get("job", {})
        assert "location" in job, "Missing job.location"
        print(f"PASS: Application has job.location = {job.get('location')}")
    
    def test_seeker_applications_returns_pay_range(self):
        """Seeker applications include job.pay_range"""
        resp = requests.get(f"{BASE_URL}/api/seeker/applications", headers=self.seeker_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        if not data:
            pytest.skip("No applications for seeker")
        
        app = data[0]
        job = app.get("job", {})
        assert "pay_range" in job, "Missing job.pay_range"
        print(f"PASS: Application has job.pay_range = {job.get('pay_range')}")
    
    def test_seeker_applications_returns_status(self):
        """Seeker applications include status field"""
        resp = requests.get(f"{BASE_URL}/api/seeker/applications", headers=self.seeker_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        if not data:
            pytest.skip("No applications for seeker")
        
        app = data[0]
        assert "status" in app, "Missing status field"
        print(f"PASS: Application has status = {app.get('status')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
