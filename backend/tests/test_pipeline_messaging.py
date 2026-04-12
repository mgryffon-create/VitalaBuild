"""
Test Pipeline and Messaging Features - Iteration 26
Tests: Hiring Pipeline, Messaging, Nudges, Context Panel, Stage Updates
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


@pytest.fixture(scope="module")
def employer_token():
    """Get employer auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": EMPLOYER_EMAIL,
        "password": EMPLOYER_PASSWORD
    })
    assert response.status_code == 200, f"Employer login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def seeker_token():
    """Get seeker auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SEEKER_EMAIL,
        "password": SEEKER_PASSWORD
    })
    assert response.status_code == 200, f"Seeker login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def employer_headers(employer_token):
    """Headers with employer auth"""
    return {"Authorization": f"Bearer {employer_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def seeker_headers(seeker_token):
    """Headers with seeker auth"""
    return {"Authorization": f"Bearer {seeker_token}", "Content-Type": "application/json"}


class TestPipelineCandidates:
    """Test GET /api/pipeline/candidates endpoint"""
    
    def test_pipeline_candidates_returns_200(self, employer_headers):
        """Pipeline candidates endpoint returns 200 for employer"""
        response = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=employer_headers)
        assert response.status_code == 200
        data = response.json()
        assert "candidates" in data
        assert "stats" in data
    
    def test_pipeline_candidates_has_all_stages(self, employer_headers):
        """Pipeline candidates response has all 5 stages"""
        response = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=employer_headers)
        data = response.json()
        expected_stages = ["interested", "matched", "interviewing", "offer_sent", "hired"]
        for stage in expected_stages:
            assert stage in data["candidates"], f"Missing stage: {stage}"
            assert stage in data["stats"], f"Missing stats for stage: {stage}"
    
    def test_pipeline_candidates_stats_has_total(self, employer_headers):
        """Pipeline stats includes total count"""
        response = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=employer_headers)
        data = response.json()
        assert "total" in data["stats"]
        assert isinstance(data["stats"]["total"], int)
    
    def test_pipeline_candidates_seeker_forbidden(self, seeker_headers):
        """Seeker cannot access pipeline candidates (403)"""
        response = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=seeker_headers)
        assert response.status_code == 403
        assert "Not authorized" in response.json().get("detail", "")


class TestPipelineNudges:
    """Test GET /api/pipeline/nudges endpoint"""
    
    def test_nudges_returns_200(self, employer_headers):
        """Nudges endpoint returns 200 for employer"""
        response = requests.get(f"{BASE_URL}/api/pipeline/nudges", headers=employer_headers)
        assert response.status_code == 200
        data = response.json()
        assert "nudges" in data
        assert "total" in data
    
    def test_nudges_structure(self, employer_headers):
        """Nudges response has correct structure"""
        response = requests.get(f"{BASE_URL}/api/pipeline/nudges", headers=employer_headers)
        data = response.json()
        assert isinstance(data["nudges"], list)
        assert isinstance(data["total"], int)
        assert data["total"] == len(data["nudges"])
    
    def test_nudges_seeker_forbidden(self, seeker_headers):
        """Seeker cannot access nudges (403)"""
        response = requests.get(f"{BASE_URL}/api/pipeline/nudges", headers=seeker_headers)
        assert response.status_code == 403


class TestPipelineStageUpdate:
    """Test PUT /api/pipeline/candidates/{cid}/{jid}/stage endpoint"""
    
    def test_stage_update_valid_stage(self, employer_headers):
        """Stage update with valid stage returns 200"""
        # Use a test candidate ID (may not exist, but endpoint should validate stage first)
        response = requests.put(
            f"{BASE_URL}/api/pipeline/candidates/test-candidate/test-job/stage",
            headers=employer_headers,
            json={"stage": "matched"}
        )
        # Should succeed (upsert) or return 200
        assert response.status_code == 200
    
    def test_stage_update_invalid_stage(self, employer_headers):
        """Stage update with invalid stage returns 400"""
        response = requests.put(
            f"{BASE_URL}/api/pipeline/candidates/test-candidate/test-job/stage",
            headers=employer_headers,
            json={"stage": "invalid_stage"}
        )
        assert response.status_code == 400
        assert "Invalid stage" in response.json().get("detail", "")
    
    def test_stage_update_seeker_forbidden(self, seeker_headers):
        """Seeker cannot update pipeline stage (403)"""
        response = requests.put(
            f"{BASE_URL}/api/pipeline/candidates/test-candidate/test-job/stage",
            headers=seeker_headers,
            json={"stage": "matched"}
        )
        assert response.status_code == 403


class TestPipelineTemplates:
    """Test message templates endpoints"""
    
    def test_get_templates_returns_list(self, employer_headers):
        """GET /api/pipeline/templates returns list of templates"""
        response = requests.get(f"{BASE_URL}/api/pipeline/templates", headers=employer_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 4  # availability, interview_request, application_request, offer_notification
    
    def test_templates_have_key_and_preview(self, employer_headers):
        """Each template has key and preview fields"""
        response = requests.get(f"{BASE_URL}/api/pipeline/templates", headers=employer_headers)
        data = response.json()
        for template in data:
            assert "key" in template
            assert "preview" in template
    
    def test_render_template_availability(self, employer_headers):
        """POST /api/pipeline/templates/render renders availability template"""
        response = requests.post(
            f"{BASE_URL}/api/pipeline/templates/render",
            headers=employer_headers,
            json={"template_key": "availability"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "text" in data
        assert "template_key" in data
        assert data["template_key"] == "availability"
        assert "{name}" in data["text"]  # Placeholder present
    
    def test_render_template_interview_request(self, employer_headers):
        """POST /api/pipeline/templates/render renders interview_request template"""
        response = requests.post(
            f"{BASE_URL}/api/pipeline/templates/render",
            headers=employer_headers,
            json={"template_key": "interview_request"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "{job}" in data["text"]  # Job placeholder present
    
    def test_render_template_invalid_key(self, employer_headers):
        """POST /api/pipeline/templates/render with invalid key returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/pipeline/templates/render",
            headers=employer_headers,
            json={"template_key": "nonexistent_template"}
        )
        assert response.status_code == 404


class TestCandidateContext:
    """Test GET /api/pipeline/candidates/{cid}/context endpoint"""
    
    def test_context_returns_candidate_info(self, employer_headers):
        """Context endpoint returns candidate information"""
        # Use John Doe's ID from matches
        candidate_id = "bd58c6d2-12aa-4bb1-a674-4b12252570d4"
        response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates/{candidate_id}/context",
            headers=employer_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "candidate_id" in data
        assert "full_name" in data
        assert "email" in data
        assert "vault_docs" in data
        assert "references" in data
        assert "training" in data
    
    def test_context_references_structure(self, employer_headers):
        """Context references has correct structure"""
        candidate_id = "bd58c6d2-12aa-4bb1-a674-4b12252570d4"
        response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates/{candidate_id}/context",
            headers=employer_headers
        )
        data = response.json()
        refs = data["references"]
        assert "total" in refs
        assert "verified" in refs
        assert "top" in refs
        assert isinstance(refs["top"], list)
    
    def test_context_training_structure(self, employer_headers):
        """Context training has correct structure"""
        candidate_id = "bd58c6d2-12aa-4bb1-a674-4b12252570d4"
        response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates/{candidate_id}/context",
            headers=employer_headers
        )
        data = response.json()
        training = data["training"]
        assert "total" in training
        assert "completed" in training
        assert "compliance_rate" in training
    
    def test_context_nonexistent_candidate(self, employer_headers):
        """Context for nonexistent candidate returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates/nonexistent-id/context",
            headers=employer_headers
        )
        assert response.status_code == 404
    
    def test_context_seeker_forbidden(self, seeker_headers):
        """Seeker cannot access candidate context (403)"""
        candidate_id = "bd58c6d2-12aa-4bb1-a674-4b12252570d4"
        response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates/{candidate_id}/context",
            headers=seeker_headers
        )
        assert response.status_code == 403


class TestMatchesMessaging:
    """Test matches and messaging endpoints for employer messaging page"""
    
    def test_matches_returns_list(self, employer_headers):
        """GET /api/matches returns list of matches"""
        response = requests.get(f"{BASE_URL}/api/matches", headers=employer_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_matches_have_seeker_info(self, employer_headers):
        """Matches include seeker information"""
        response = requests.get(f"{BASE_URL}/api/matches", headers=employer_headers)
        data = response.json()
        if len(data) > 0:
            match = data[0]
            assert "seeker" in match
            assert "job" in match
            assert "id" in match
    
    def test_match_messages_endpoint(self, employer_headers):
        """GET /api/matches/{id}/messages returns messages"""
        # First get a match ID
        matches_response = requests.get(f"{BASE_URL}/api/matches", headers=employer_headers)
        matches = matches_response.json()
        if len(matches) > 0:
            match_id = matches[0]["id"]
            response = requests.get(f"{BASE_URL}/api/matches/{match_id}/messages", headers=employer_headers)
            assert response.status_code == 200
            assert isinstance(response.json(), list)


class TestJobsForExternalLinks:
    """Test jobs endpoint for external application links"""
    
    def test_jobs_returns_list(self, employer_headers):
        """GET /api/jobs returns list of jobs"""
        response = requests.get(f"{BASE_URL}/api/jobs", headers=employer_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_job_detail_endpoint(self, employer_headers):
        """GET /api/jobs/{id} returns job details"""
        # First get a job ID
        jobs_response = requests.get(f"{BASE_URL}/api/jobs", headers=employer_headers)
        jobs = jobs_response.json()
        if len(jobs) > 0:
            job_id = jobs[0]["id"]
            response = requests.get(f"{BASE_URL}/api/jobs/{job_id}", headers=employer_headers)
            assert response.status_code == 200
            data = response.json()
            assert "id" in data
            assert "title" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
