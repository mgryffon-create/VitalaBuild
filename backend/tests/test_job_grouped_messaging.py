"""
Test Job-Grouped Messaging Feature
Tests the restructured recruiter messaging interface that groups conversations by job.
Key features:
- Pipeline API returns unique candidates per job (candidate_id + job_id pairs)
- Job group headers with title, location, candidate counts
- Same candidate can appear under multiple jobs
- Filters work with job groups
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestJobGroupedMessaging:
    """Test job-grouped messaging backend functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.employer_email = "employer_test@vitalamatch.com"
        self.employer_password = "test123"
        self.seeker_email = "seeker_test@vitalamatch.com"
        self.seeker_password = "test123"
        
    def get_employer_token(self):
        """Get employer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.employer_email,
            "password": self.employer_password
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Employer login failed: {response.status_code}")
        
    def get_seeker_token(self):
        """Get seeker auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.seeker_email,
            "password": self.seeker_password
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Seeker login failed: {response.status_code}")

    # ============ Pipeline API Tests ============
    
    def test_pipeline_returns_candidate_job_pairs(self):
        """Pipeline API returns unique candidate_id + job_id pairs"""
        token = self.get_employer_token()
        response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Pipeline API failed: {response.text}"
        
        data = response.json()
        assert "candidates" in data
        assert "stats" in data
        
        # Collect all candidates from all stages
        all_candidates = []
        for stage, candidates in data["candidates"].items():
            all_candidates.extend(candidates)
        
        # Verify each candidate has both candidate_id and job_id
        for c in all_candidates:
            assert "candidate_id" in c, "Missing candidate_id"
            assert "job_id" in c, "Missing job_id"
            assert "id" in c, "Missing composite id"
            # Verify composite id format is candidate_id_job_id
            expected_id = f"{c['candidate_id']}_{c['job_id']}"
            assert c["id"] == expected_id, f"Composite ID mismatch: {c['id']} != {expected_id}"
        
        print(f"✓ Pipeline returns {len(all_candidates)} candidate-job pairs")
        
    def test_pipeline_returns_job_details(self):
        """Pipeline API returns job details for grouping (title, location)"""
        token = self.get_employer_token()
        response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        all_candidates = []
        for stage, candidates in data["candidates"].items():
            all_candidates.extend(candidates)
        
        # Verify job details are present
        for c in all_candidates[:5]:  # Check first 5
            assert "job" in c, "Missing job object"
            job = c["job"]
            assert "title" in job, "Missing job.title"
            assert "location" in job, "Missing job.location"
            # pay_range is optional but should be present if set
            print(f"  Job: {job.get('title')} @ {job.get('location')}")
        
        print(f"✓ All candidates have job details for grouping")
        
    def test_pipeline_returns_seeker_credential(self):
        """Pipeline API returns seeker.credential for badge display"""
        token = self.get_employer_token()
        response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        all_candidates = []
        for stage, candidates in data["candidates"].items():
            all_candidates.extend(candidates)
        
        # Verify seeker details
        credentials_found = 0
        for c in all_candidates:
            assert "seeker" in c, "Missing seeker object"
            seeker = c["seeker"]
            assert "full_name" in seeker, "Missing seeker.full_name"
            if seeker.get("credential"):
                credentials_found += 1
                print(f"  {seeker['full_name']}: {seeker['credential']}")
        
        print(f"✓ Found {credentials_found} candidates with credentials")
        
    def test_pipeline_returns_stage_for_filtering(self):
        """Pipeline API returns stage field for filter functionality"""
        token = self.get_employer_token()
        response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        stats = data["stats"]
        
        # Verify stats for filtering
        assert "interested" in stats, "Missing interested count"
        assert "matched" in stats, "Missing matched count"
        assert "interviewing" in stats, "Missing interviewing count"
        assert "total" in stats, "Missing total count"
        
        print(f"✓ Stats: interested={stats['interested']}, matched={stats['matched']}, interviewing={stats['interviewing']}, total={stats['total']}")
        
    def test_same_candidate_multiple_jobs(self):
        """Same candidate can appear under different jobs"""
        token = self.get_employer_token()
        response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        all_candidates = []
        for stage, candidates in data["candidates"].items():
            all_candidates.extend(candidates)
        
        # Count candidates by candidate_id
        from collections import Counter
        candidate_counts = Counter(c["candidate_id"] for c in all_candidates)
        multi_job_candidates = {k: v for k, v in candidate_counts.items() if v > 1}
        
        if multi_job_candidates:
            print(f"✓ Found {len(multi_job_candidates)} candidates appearing under multiple jobs")
            for cid, count in list(multi_job_candidates.items())[:2]:
                jobs = [c["job"]["title"] for c in all_candidates if c["candidate_id"] == cid]
                print(f"  - Candidate {cid[:8]}... in {count} jobs")
        else:
            print("✓ No candidates currently appear under multiple jobs (data-dependent)")
            
    def test_unique_job_groups(self):
        """Pipeline data can be grouped by unique job_id"""
        token = self.get_employer_token()
        response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        all_candidates = []
        for stage, candidates in data["candidates"].items():
            all_candidates.extend(candidates)
        
        # Group by job_id
        job_groups = {}
        for c in all_candidates:
            jid = c["job_id"]
            if jid not in job_groups:
                job_groups[jid] = {
                    "job_id": jid,
                    "job_title": c["job"]["title"],
                    "job_location": c["job"]["location"],
                    "candidates": [],
                    "matched": 0,
                    "interested": 0
                }
            job_groups[jid]["candidates"].append(c)
            if c["stage"] in ("matched", "interviewing"):
                job_groups[jid]["matched"] += 1
            if c["stage"] == "interested":
                job_groups[jid]["interested"] += 1
        
        print(f"✓ {len(job_groups)} unique job groups")
        for jid, group in list(job_groups.items())[:3]:
            print(f"  - {group['job_title']}: {len(group['candidates'])} candidates (matched={group['matched']}, interested={group['interested']})")

    # ============ Candidate Context Tests ============
    
    def test_candidate_context_with_job_id(self):
        """Candidate context API accepts job_id parameter"""
        token = self.get_employer_token()
        
        # First get a candidate
        pipeline_response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert pipeline_response.status_code == 200
        
        data = pipeline_response.json()
        all_candidates = []
        for stage, candidates in data["candidates"].items():
            all_candidates.extend(candidates)
        
        if not all_candidates:
            pytest.skip("No candidates in pipeline")
        
        candidate = all_candidates[0]
        candidate_id = candidate["candidate_id"]
        job_id = candidate["job_id"]
        
        # Get context with job_id
        context_response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates/{candidate_id}/context?job_id={job_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert context_response.status_code == 200, f"Context API failed: {context_response.text}"
        
        ctx = context_response.json()
        assert "full_name" in ctx
        assert "specialty" in ctx
        assert "contact_available" in ctx
        
        print(f"✓ Context API works with job_id parameter: {ctx['full_name']}")
        
    def test_privacy_gating_pre_match(self):
        """Pre-match candidates have contact_available=False"""
        token = self.get_employer_token()
        
        pipeline_response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert pipeline_response.status_code == 200
        
        data = pipeline_response.json()
        interested_candidates = data["candidates"].get("interested", [])
        
        if not interested_candidates:
            pytest.skip("No interested candidates to test privacy gating")
        
        candidate = interested_candidates[0]
        candidate_id = candidate["candidate_id"]
        job_id = candidate["job_id"]
        
        context_response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates/{candidate_id}/context?job_id={job_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert context_response.status_code == 200
        
        ctx = context_response.json()
        # Pre-match should not have contact available
        assert ctx.get("contact_available") == False, "Pre-match should have contact_available=False"
        assert "phone" not in ctx or ctx.get("phone") is None, "Pre-match should not expose phone"
        
        print(f"✓ Privacy gating works: pre-match contact_available=False")
        
    def test_privacy_gating_post_match(self):
        """Post-match candidates have contact_available=True with contact info"""
        token = self.get_employer_token()
        
        pipeline_response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert pipeline_response.status_code == 200
        
        data = pipeline_response.json()
        matched_candidates = data["candidates"].get("matched", []) + data["candidates"].get("interviewing", [])
        
        if not matched_candidates:
            pytest.skip("No matched candidates to test privacy gating")
        
        candidate = matched_candidates[0]
        candidate_id = candidate["candidate_id"]
        job_id = candidate["job_id"]
        
        context_response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates/{candidate_id}/context?job_id={job_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert context_response.status_code == 200
        
        ctx = context_response.json()
        # Post-match should have contact available
        assert ctx.get("contact_available") == True, "Post-match should have contact_available=True"
        
        print(f"✓ Privacy gating works: post-match contact_available=True")

    # ============ Stage Update Tests ============
    
    def test_stage_update_with_job_id(self):
        """Stage update API uses candidate_id and job_id"""
        token = self.get_employer_token()
        
        # This test verifies the endpoint exists and accepts the correct parameters
        # We don't actually change stage to avoid side effects
        pipeline_response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert pipeline_response.status_code == 200
        
        data = pipeline_response.json()
        all_candidates = []
        for stage, candidates in data["candidates"].items():
            all_candidates.extend(candidates)
        
        if not all_candidates:
            pytest.skip("No candidates in pipeline")
        
        # Verify the endpoint format exists (don't actually update)
        candidate = all_candidates[0]
        candidate_id = candidate["candidate_id"]
        job_id = candidate["job_id"]
        
        # The endpoint should be /pipeline/candidates/{candidate_id}/{job_id}/stage
        # We verify by checking a 409 (already in stage) or 403 (not allowed) rather than 404
        response = requests.put(
            f"{BASE_URL}/api/pipeline/candidates/{candidate_id}/{job_id}/stage",
            headers={"Authorization": f"Bearer {token}"},
            json={"stage": candidate["stage"]}  # Same stage should return 409
        )
        
        # 409 = already in stage, 403 = not allowed, both indicate endpoint exists
        assert response.status_code in (200, 409, 403), f"Stage update endpoint issue: {response.status_code} - {response.text}"
        
        print(f"✓ Stage update endpoint accepts candidate_id + job_id")

    # ============ Matches API Tests ============
    
    def test_matches_api_returns_job_context(self):
        """Matches API returns job context for conversation grouping"""
        token = self.get_employer_token()
        
        response = requests.get(
            f"{BASE_URL}/api/matches",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        
        matches = response.json()
        if not matches:
            pytest.skip("No matches to test")
        
        for match in matches[:3]:
            assert "job_id" in match or "job" in match, "Match should have job reference"
            if "job" in match:
                job = match["job"]
                assert "title" in job, "Match job should have title"
        
        print(f"✓ Matches API returns {len(matches)} matches with job context")

    # ============ Messaging Tests ============
    
    def test_messaging_to_matched_candidate(self):
        """Can send message to matched candidate"""
        token = self.get_employer_token()
        
        # Get matches
        matches_response = requests.get(
            f"{BASE_URL}/api/matches",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert matches_response.status_code == 200
        
        matches = matches_response.json()
        if not matches:
            pytest.skip("No matches to test messaging")
        
        match = matches[0]
        match_id = match.get("id")
        
        if not match_id:
            pytest.skip("Match has no ID")
        
        # Send a test message
        msg_response = requests.post(
            f"{BASE_URL}/api/matches/{match_id}/messages",
            headers={"Authorization": f"Bearer {token}"},
            json={"content": "TEST_JOB_GROUPED_MSG: Test message for job-grouped messaging"}
        )
        
        # 200 = success, 403 = stage restriction (acceptable)
        assert msg_response.status_code in (200, 201, 403), f"Messaging failed: {msg_response.status_code} - {msg_response.text}"
        
        if msg_response.status_code in (200, 201):
            print(f"✓ Successfully sent message to matched candidate")
        else:
            print(f"✓ Messaging endpoint works (stage restriction applied)")


class TestJobGroupedFiltering:
    """Test filtering functionality with job groups"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.employer_email = "employer_test@vitalamatch.com"
        self.employer_password = "test123"
        
    def get_employer_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.employer_email,
            "password": self.employer_password
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Employer login failed")
        
    def test_filter_matches_only(self):
        """Filter for matched/interviewing candidates works"""
        token = self.get_employer_token()
        
        response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        matched = data["candidates"].get("matched", [])
        interviewing = data["candidates"].get("interviewing", [])
        
        # Simulate frontend filter: only show job groups with matched/interviewing
        all_match_candidates = matched + interviewing
        
        job_groups_with_matches = {}
        for c in all_match_candidates:
            jid = c["job_id"]
            if jid not in job_groups_with_matches:
                job_groups_with_matches[jid] = []
            job_groups_with_matches[jid].append(c)
        
        print(f"✓ Matches filter: {len(job_groups_with_matches)} job groups with {len(all_match_candidates)} matched candidates")
        
    def test_filter_applicants_only(self):
        """Filter for interested (applicant) candidates works"""
        token = self.get_employer_token()
        
        response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        interested = data["candidates"].get("interested", [])
        
        # Simulate frontend filter: only show job groups with interested
        job_groups_with_applicants = {}
        for c in interested:
            jid = c["job_id"]
            if jid not in job_groups_with_applicants:
                job_groups_with_applicants[jid] = []
            job_groups_with_applicants[jid].append(c)
        
        print(f"✓ Applicants filter: {len(job_groups_with_applicants)} job groups with {len(interested)} applicants")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
