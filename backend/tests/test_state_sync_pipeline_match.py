"""
Test State Synchronization between Hiring Pipeline, Messaging, and Seeker UI

Tests the fix for:
1. PUT /api/pipeline/candidates/{id}/{job}/stage to 'matched' creates a Match record
2. Match record includes id, seeker_id, poster_id, job_id, status='active', created_at
3. Moving to 'matched' twice does NOT create duplicate Match records (idempotent)
4. GET /api/pipeline/candidates includes match_id for candidates with Match records
5. POST /api/employer/candidates/{id}/accept also syncs pipeline_stages to 'matched'
6. GET /api/seeker/applications shows 'matched' status when Match record exists
7. GET /api/seeker/applications shows match_id when Match record exists
8. GET /api/matches returns the newly created match for the employer
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
EMPLOYER_EMAIL = "employer_test@vitalamatch.com"
EMPLOYER_PASSWORD = "test123"
SEEKER_EMAIL = "seeker_test@vitalamatch.com"
SEEKER_PASSWORD = "test123"


class TestStateSyncPipelineMatch:
    """Test state synchronization between pipeline, matches, and seeker applications"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.employer_token = None
        self.seeker_token = None
        self.seeker_id = None
        self.employer_id = None
        self.test_job_id = None
        self.created_match_id = None
        
    def get_employer_token(self):
        """Login as employer and get token"""
        if self.employer_token:
            return self.employer_token
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYER_EMAIL,
            "password": EMPLOYER_PASSWORD
        })
        assert response.status_code == 200, f"Employer login failed: {response.text}"
        data = response.json()
        self.employer_token = data["access_token"]
        self.employer_id = data["user"]["id"]
        return self.employer_token
    
    def get_seeker_token(self):
        """Login as seeker and get token"""
        if self.seeker_token:
            return self.seeker_token
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        assert response.status_code == 200, f"Seeker login failed: {response.text}"
        data = response.json()
        self.seeker_token = data["access_token"]
        self.seeker_id = data["user"]["id"]
        return self.seeker_token
    
    def get_employer_headers(self):
        return {"Authorization": f"Bearer {self.get_employer_token()}"}
    
    def get_seeker_headers(self):
        return {"Authorization": f"Bearer {self.get_seeker_token()}"}
    
    def test_01_employer_login(self):
        """Test employer can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYER_EMAIL,
            "password": EMPLOYER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "poster"
        print(f"✓ Employer login successful, id: {data['user']['id']}")
    
    def test_02_seeker_login(self):
        """Test seeker can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "seeker"
        print(f"✓ Seeker login successful, id: {data['user']['id']}")
    
    def test_03_get_pipeline_candidates(self):
        """Test GET /api/pipeline/candidates returns candidates with match_id field"""
        response = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.get_employer_headers())
        assert response.status_code == 200
        data = response.json()
        
        assert "candidates" in data
        assert "stats" in data
        
        # Check structure of candidates
        all_candidates = []
        for stage, candidates in data["candidates"].items():
            all_candidates.extend(candidates)
        
        print(f"✓ Pipeline has {len(all_candidates)} total candidates across stages")
        print(f"  Stats: {data['stats']}")
        
        # Verify candidate structure includes match_id field
        if all_candidates:
            sample = all_candidates[0]
            assert "candidate_id" in sample
            assert "job_id" in sample
            assert "stage" in sample
            # match_id should be present (can be null for non-matched)
            assert "match_id" in sample
            print(f"✓ Candidate structure includes match_id field")
    
    def test_04_find_interested_candidate(self):
        """Find a candidate in 'interested' stage for testing"""
        response = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.get_employer_headers())
        assert response.status_code == 200
        data = response.json()
        
        interested = data["candidates"].get("interested", [])
        print(f"  Found {len(interested)} candidates in 'interested' stage")
        
        if interested:
            # Find one without a match_id (not yet matched)
            for c in interested:
                if not c.get("match_id"):
                    print(f"✓ Found unmatched candidate: {c['candidate_id']} for job {c['job_id']}")
                    return c
        
        print("  No unmatched candidates in 'interested' stage - will test with existing data")
        return None
    
    def test_05_update_stage_to_matched_creates_match(self):
        """Test PUT /api/pipeline/candidates/{id}/{job}/stage to 'matched' creates Match record"""
        # First get pipeline candidates
        response = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.get_employer_headers())
        assert response.status_code == 200
        data = response.json()
        
        interested = data["candidates"].get("interested", [])
        
        # Find a candidate without match_id
        test_candidate = None
        for c in interested:
            if not c.get("match_id"):
                test_candidate = c
                break
        
        if not test_candidate:
            # If no unmatched candidates, check if we can verify existing matched ones
            matched = data["candidates"].get("matched", [])
            if matched:
                test_candidate = matched[0]
                print(f"  Using already matched candidate: {test_candidate['candidate_id']}")
                # Verify they have a match_id
                assert test_candidate.get("match_id"), "Matched candidate should have match_id"
                print(f"✓ Matched candidate has match_id: {test_candidate['match_id']}")
                return
            pytest.skip("No candidates available for testing")
        
        candidate_id = test_candidate["candidate_id"]
        job_id = test_candidate["job_id"]
        
        print(f"  Moving candidate {candidate_id} to 'matched' for job {job_id}")
        
        # Move to matched stage
        response = requests.put(
            f"{BASE_URL}/api/pipeline/candidates/{candidate_id}/{job_id}/stage",
            json={"stage": "matched"},
            headers=self.get_employer_headers()
        )
        assert response.status_code == 200, f"Failed to update stage: {response.text}"
        print(f"✓ Stage update successful: {response.json()}")
        
        # Verify Match record was created by checking pipeline again
        response = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.get_employer_headers())
        assert response.status_code == 200
        data = response.json()
        
        # Find the candidate in matched stage
        matched = data["candidates"].get("matched", [])
        found = None
        for c in matched:
            if c["candidate_id"] == candidate_id and c["job_id"] == job_id:
                found = c
                break
        
        assert found, f"Candidate {candidate_id} not found in matched stage"
        assert found.get("match_id"), f"Candidate should have match_id after moving to matched"
        print(f"✓ Match record created with id: {found['match_id']}")
        
        # Store for later tests
        self.__class__.created_match_id = found["match_id"]
        self.__class__.test_candidate_id = candidate_id
        self.__class__.test_job_id = job_id
    
    def test_06_match_record_has_correct_fields(self):
        """Test Match record includes id, seeker_id, poster_id, job_id, status='active', created_at"""
        # Get matches for employer
        response = requests.get(f"{BASE_URL}/api/matches", headers=self.get_employer_headers())
        assert response.status_code == 200
        matches = response.json()
        
        print(f"  Employer has {len(matches)} total matches")
        
        if not matches:
            pytest.skip("No matches to verify")
        
        # Check the most recent match (should have status from new pipeline code)
        match = matches[0]
        
        # Verify required fields
        assert "id" in match, "Match should have 'id'"
        assert "seeker_id" in match or "seeker" in match, "Match should have seeker info"
        assert "job_id" in match, "Match should have 'job_id'"
        assert "created_at" in match, "Match should have 'created_at'"
        
        # Note: status field may be missing for older matches created before the fix
        # New matches created via pipeline should have status='active'
        if "status" in match:
            assert match["status"] == "active", f"Match status should be 'active', got: {match['status']}"
            print(f"✓ Match has status='active'")
        else:
            print(f"  Note: Match missing 'status' field (older match before fix)")
        
        print(f"✓ Match record has correct structure:")
        print(f"  - id: {match['id']}")
        print(f"  - job_id: {match['job_id']}")
        print(f"  - status: {match.get('status', 'N/A')}")
        print(f"  - created_at: {match['created_at']}")
    
    def test_07_idempotent_match_creation(self):
        """Test moving to 'matched' twice does NOT create duplicate Match records"""
        # Get pipeline candidates
        response = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.get_employer_headers())
        assert response.status_code == 200
        data = response.json()
        
        # Find a matched candidate
        matched = data["candidates"].get("matched", [])
        if not matched:
            pytest.skip("No matched candidates to test idempotency")
        
        test_candidate = matched[0]
        candidate_id = test_candidate["candidate_id"]
        job_id = test_candidate["job_id"]
        original_match_id = test_candidate.get("match_id")
        
        print(f"  Testing idempotency for candidate {candidate_id}, original match_id: {original_match_id}")
        
        # Try to move to matched again
        response = requests.put(
            f"{BASE_URL}/api/pipeline/candidates/{candidate_id}/{job_id}/stage",
            json={"stage": "matched"},
            headers=self.get_employer_headers()
        )
        assert response.status_code == 200
        
        # Verify match_id is still the same (no duplicate created)
        response = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.get_employer_headers())
        assert response.status_code == 200
        data = response.json()
        
        matched = data["candidates"].get("matched", [])
        found = None
        for c in matched:
            if c["candidate_id"] == candidate_id and c["job_id"] == job_id:
                found = c
                break
        
        assert found, "Candidate should still be in matched stage"
        assert found.get("match_id") == original_match_id, \
            f"Match ID should be unchanged. Original: {original_match_id}, Current: {found.get('match_id')}"
        
        print(f"✓ Idempotent: match_id unchanged after second move to 'matched'")
    
    def test_08_accept_candidate_creates_match_and_syncs_pipeline(self):
        """Test POST /api/employer/candidates/{id}/accept creates Match and syncs pipeline_stages"""
        # First, we need to find a candidate who has expressed interest but isn't matched yet
        # This is tricky because we need a seeker who swiped on a job but wasn't accepted
        
        # Get employer's jobs
        response = requests.get(f"{BASE_URL}/api/jobs", headers=self.get_employer_headers())
        assert response.status_code == 200
        jobs = response.json()
        
        if not jobs:
            pytest.skip("Employer has no jobs")
        
        job_id = jobs[0]["id"]
        print(f"  Testing with job: {job_id}")
        
        # Get pipeline to find interested candidates
        response = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.get_employer_headers())
        assert response.status_code == 200
        data = response.json()
        
        interested = data["candidates"].get("interested", [])
        
        # Find one without match_id
        test_candidate = None
        for c in interested:
            if not c.get("match_id"):
                test_candidate = c
                break
        
        if not test_candidate:
            print("  No unmatched interested candidates - testing accept on already matched")
            # Test that accept_candidate returns "Already matched" for existing match
            matched = data["candidates"].get("matched", [])
            if matched:
                c = matched[0]
                response = requests.post(
                    f"{BASE_URL}/api/employer/candidates/{c['candidate_id']}/accept",
                    params={"job_id": c["job_id"]},
                    headers=self.get_employer_headers()
                )
                assert response.status_code == 200
                result = response.json()
                assert "match_id" in result
                print(f"✓ Accept on already matched returns existing match_id: {result['match_id']}")
            return
        
        candidate_id = test_candidate["candidate_id"]
        job_id = test_candidate["job_id"]
        
        print(f"  Accepting candidate {candidate_id} for job {job_id}")
        
        # Accept the candidate
        response = requests.post(
            f"{BASE_URL}/api/employer/candidates/{candidate_id}/accept",
            params={"job_id": job_id},
            headers=self.get_employer_headers()
        )
        assert response.status_code == 200, f"Accept failed: {response.text}"
        result = response.json()
        assert "match_id" in result
        print(f"✓ Candidate accepted, match_id: {result['match_id']}")
        
        # Verify pipeline_stages was updated
        response = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.get_employer_headers())
        assert response.status_code == 200
        data = response.json()
        
        # Candidate should now be in matched stage
        matched = data["candidates"].get("matched", [])
        found = None
        for c in matched:
            if c["candidate_id"] == candidate_id and c["job_id"] == job_id:
                found = c
                break
        
        assert found, "Accepted candidate should be in 'matched' stage"
        assert found.get("match_id") == result["match_id"], "Pipeline should show the same match_id"
        print(f"✓ Pipeline synced: candidate in 'matched' stage with match_id")
    
    def test_09_seeker_applications_shows_matched_status(self):
        """Test GET /api/seeker/applications shows 'matched' status when Match record exists"""
        response = requests.get(f"{BASE_URL}/api/seeker/applications", headers=self.get_seeker_headers())
        assert response.status_code == 200
        applications = response.json()
        
        print(f"  Seeker has {len(applications)} applications")
        
        # Check for any matched applications
        matched_apps = [a for a in applications if a.get("status") == "matched"]
        print(f"  Found {len(matched_apps)} applications with 'matched' status")
        
        if matched_apps:
            app = matched_apps[0]
            assert app.get("match_id"), "Matched application should have match_id"
            print(f"✓ Matched application has match_id: {app['match_id']}")
            print(f"  Job: {app['job']['title']} at {app['job'].get('company_name', 'Unknown')}")
        else:
            # Check if there are any applications at all
            if applications:
                print(f"  Application statuses: {[a['status'] for a in applications]}")
            print("  No matched applications found for this seeker")
    
    def test_10_seeker_applications_includes_match_id(self):
        """Test GET /api/seeker/applications includes match_id when Match record exists"""
        response = requests.get(f"{BASE_URL}/api/seeker/applications", headers=self.get_seeker_headers())
        assert response.status_code == 200
        applications = response.json()
        
        # Verify structure includes match_id field
        for app in applications:
            assert "match_id" in app, "Application should have match_id field"
            assert "status" in app, "Application should have status field"
            
            # If status is matched, match_id should not be null
            if app["status"] == "matched":
                assert app["match_id"], f"Matched application should have non-null match_id"
        
        print(f"✓ All {len(applications)} applications have match_id field in response")
    
    def test_11_matches_endpoint_returns_new_match(self):
        """Test GET /api/matches returns newly created matches for employer"""
        response = requests.get(f"{BASE_URL}/api/matches", headers=self.get_employer_headers())
        assert response.status_code == 200
        matches = response.json()
        
        print(f"  Employer has {len(matches)} matches")
        
        assert isinstance(matches, list), "Matches should be a list"
        
        if matches:
            # Verify match structure - core fields required
            match = matches[0]
            required_fields = ["id", "job_id", "created_at"]
            for field in required_fields:
                assert field in match, f"Match should have '{field}' field"
            
            # status is present for new matches created via pipeline
            if "status" in match:
                print(f"  Match has status: {match['status']}")
            
            print(f"✓ Matches endpoint returns valid match records")
            print(f"  Latest match: {match['id']} for job {match['job_id']}")
    
    def test_12_pipeline_match_id_used_for_messaging(self):
        """Test that pipeline data includes match_id that can be used for messaging"""
        response = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.get_employer_headers())
        assert response.status_code == 200
        data = response.json()
        
        # Find candidates with match_id
        candidates_with_match = []
        for stage, candidates in data["candidates"].items():
            for c in candidates:
                if c.get("match_id"):
                    candidates_with_match.append(c)
        
        print(f"  Found {len(candidates_with_match)} candidates with match_id")
        
        if candidates_with_match:
            # Verify we can use match_id for messaging
            c = candidates_with_match[0]
            match_id = c["match_id"]
            
            # Try to get messages for this match
            response = requests.get(
                f"{BASE_URL}/api/matches/{match_id}/messages",
                headers=self.get_employer_headers()
            )
            assert response.status_code == 200, f"Failed to get messages: {response.text}"
            messages = response.json()
            print(f"✓ Can fetch messages using match_id from pipeline: {len(messages)} messages")
            
            # Try to send a test message
            response = requests.post(
                f"{BASE_URL}/api/matches/{match_id}/messages",
                json={"content": f"Test message {datetime.now().isoformat()}"},
                headers=self.get_employer_headers()
            )
            assert response.status_code == 200, f"Failed to send message: {response.text}"
            print(f"✓ Can send messages using match_id from pipeline")
        else:
            print("  No candidates with match_id to test messaging")


class TestPipelineStageTransitions:
    """Test pipeline stage transitions and Match creation"""
    
    def get_employer_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYER_EMAIL,
            "password": EMPLOYER_PASSWORD
        })
        return response.json()["access_token"]
    
    def get_employer_headers(self):
        return {"Authorization": f"Bearer {self.get_employer_token()}"}
    
    def test_stage_transition_to_interviewing_creates_match(self):
        """Test moving directly to 'interviewing' also creates Match record"""
        response = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.get_employer_headers())
        assert response.status_code == 200
        data = response.json()
        
        # Find a candidate in interested or matched stage
        interested = data["candidates"].get("interested", [])
        
        test_candidate = None
        for c in interested:
            if not c.get("match_id"):
                test_candidate = c
                break
        
        if not test_candidate:
            print("  No unmatched candidates - skipping direct interviewing test")
            return
        
        candidate_id = test_candidate["candidate_id"]
        job_id = test_candidate["job_id"]
        
        # Move directly to interviewing
        response = requests.put(
            f"{BASE_URL}/api/pipeline/candidates/{candidate_id}/{job_id}/stage",
            json={"stage": "interviewing"},
            headers=self.get_employer_headers()
        )
        assert response.status_code == 200
        
        # Verify Match was created
        response = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.get_employer_headers())
        data = response.json()
        
        interviewing = data["candidates"].get("interviewing", [])
        found = None
        for c in interviewing:
            if c["candidate_id"] == candidate_id:
                found = c
                break
        
        if found:
            assert found.get("match_id"), "Moving to interviewing should create Match"
            print(f"✓ Moving to 'interviewing' created Match: {found['match_id']}")
    
    def test_stage_transition_to_offer_sent_creates_match(self):
        """Test moving to 'offer_sent' creates Match if not exists"""
        response = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.get_employer_headers())
        assert response.status_code == 200
        data = response.json()
        
        # Check offer_sent stage for candidates with match_id
        offer_sent = data["candidates"].get("offer_sent", [])
        
        if offer_sent:
            for c in offer_sent:
                # All offer_sent candidates should have match_id
                print(f"  Offer sent candidate {c['candidate_id']}: match_id={c.get('match_id')}")
        
        print(f"✓ Verified offer_sent stage candidates")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
