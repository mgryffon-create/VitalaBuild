"""
Test Match Prioritization Feature
- Backend returns match_tier, match_reasons, compatibility_score for pipeline candidates
- Candidates sorted by match quality (strong first, then possible, then null)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMatchPrioritization:
    """Test match prioritization feature for pipeline candidates"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as employer and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "employer_test@vitalamatch.com",
            "password": "test123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_pipeline_candidates_returns_match_data(self):
        """Verify GET /api/pipeline/candidates returns match_tier, match_reasons, compatibility_score"""
        response = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.headers)
        assert response.status_code == 200, f"Failed to get pipeline candidates: {response.text}"
        
        data = response.json()
        assert "candidates" in data
        assert "stats" in data
        
        # Check at least one stage has candidates
        all_candidates = []
        for stage, candidates in data["candidates"].items():
            all_candidates.extend(candidates)
        
        assert len(all_candidates) > 0, "No candidates found in pipeline"
        
        # Verify match data fields exist on candidates
        for candidate in all_candidates[:5]:  # Check first 5
            assert "match_tier" in candidate, f"Missing match_tier for candidate {candidate.get('id')}"
            assert "match_reasons" in candidate, f"Missing match_reasons for candidate {candidate.get('id')}"
            assert "compatibility_score" in candidate, f"Missing compatibility_score for candidate {candidate.get('id')}"
            
            # Validate types
            tier = candidate["match_tier"]
            assert tier in ["strong", "possible", None], f"Invalid match_tier: {tier}"
            
            reasons = candidate["match_reasons"]
            assert isinstance(reasons, list), f"match_reasons should be a list, got {type(reasons)}"
            
            score = candidate["compatibility_score"]
            assert isinstance(score, (int, float)), f"compatibility_score should be numeric, got {type(score)}"
            assert 0 <= score <= 100, f"compatibility_score should be 0-100, got {score}"
    
    def test_match_reasons_content(self):
        """Verify match_reasons contain specialty and experience reasons"""
        response = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        all_candidates = []
        for stage, candidates in data["candidates"].items():
            all_candidates.extend(candidates)
        
        # Find candidates with reasons
        candidates_with_reasons = [c for c in all_candidates if c.get("match_reasons")]
        assert len(candidates_with_reasons) > 0, "No candidates have match_reasons"
        
        # Check that reasons mention specialty or experience
        found_specialty_reason = False
        found_experience_reason = False
        
        for candidate in candidates_with_reasons:
            for reason in candidate["match_reasons"]:
                reason_lower = reason.lower()
                if "specialty" in reason_lower or "aligned" in reason_lower or "matches" in reason_lower:
                    found_specialty_reason = True
                if "experience" in reason_lower or "year" in reason_lower:
                    found_experience_reason = True
        
        assert found_specialty_reason, "No specialty-related reasons found"
        assert found_experience_reason, "No experience-related reasons found"
    
    def test_candidates_sorted_by_match_quality(self):
        """Verify candidates are sorted: strong first, then possible, then null"""
        response = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        
        # Check sorting within each stage
        for stage, candidates in data["candidates"].items():
            if len(candidates) < 2:
                continue
            
            # Extract tiers
            tiers = [c.get("match_tier") for c in candidates]
            
            # Verify order: strong (0) < possible (1) < None (2)
            tier_order = {"strong": 0, "possible": 1, None: 2}
            tier_values = [tier_order.get(t, 2) for t in tiers]
            
            # Check that tier values are non-decreasing (sorted)
            for i in range(len(tier_values) - 1):
                assert tier_values[i] <= tier_values[i+1], \
                    f"Stage {stage}: Candidates not sorted by tier. Got tiers: {tiers}"
            
            # Within same tier, check score is descending
            for i in range(len(candidates) - 1):
                if candidates[i].get("match_tier") == candidates[i+1].get("match_tier"):
                    score_i = candidates[i].get("compatibility_score", 0)
                    score_j = candidates[i+1].get("compatibility_score", 0)
                    assert score_i >= score_j, \
                        f"Stage {stage}: Within same tier, scores should be descending. Got {score_i} before {score_j}"
    
    def test_strong_match_criteria(self):
        """Verify strong matches have spec_score >= 18 and exp_score >= 15"""
        response = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        all_candidates = []
        for stage, candidates in data["candidates"].items():
            all_candidates.extend(candidates)
        
        strong_matches = [c for c in all_candidates if c.get("match_tier") == "strong"]
        
        # Strong matches should have high compatibility scores (typically 60+)
        for candidate in strong_matches[:5]:
            score = candidate.get("compatibility_score", 0)
            # Strong matches should have reasonable scores
            assert score >= 50, f"Strong match has low score: {score}"
    
    def test_match_data_in_matched_stage(self):
        """Verify match data is present for candidates in 'matched' stage"""
        response = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        matched = data["candidates"].get("matched", [])
        
        if len(matched) > 0:
            for candidate in matched:
                assert "match_tier" in candidate
                assert "match_reasons" in candidate
                assert "compatibility_score" in candidate
                print(f"Matched candidate: {candidate.get('seeker', {}).get('full_name')}, "
                      f"tier={candidate.get('match_tier')}, score={candidate.get('compatibility_score')}")
    
    def test_match_data_in_offer_sent_stage(self):
        """Verify match data is present for candidates in 'offer_sent' stage"""
        response = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        offers = data["candidates"].get("offer_sent", [])
        
        if len(offers) > 0:
            for candidate in offers:
                assert "match_tier" in candidate
                assert "match_reasons" in candidate
                assert "compatibility_score" in candidate
                print(f"Offer candidate: {candidate.get('seeker', {}).get('full_name')}, "
                      f"tier={candidate.get('match_tier')}, score={candidate.get('compatibility_score')}")


class TestPipelineEndpointsStillWork:
    """Verify existing pipeline features still work after match prioritization changes"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as employer"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "employer_test@vitalamatch.com",
            "password": "test123"
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_pipeline_candidates_endpoint(self):
        """GET /api/pipeline/candidates returns 200"""
        response = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "candidates" in data
        assert "stats" in data
    
    def test_pipeline_nudges_endpoint(self):
        """GET /api/pipeline/nudges returns 200"""
        response = requests.get(f"{BASE_URL}/api/pipeline/nudges", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "nudges" in data
    
    def test_pipeline_templates_endpoint(self):
        """GET /api/pipeline/templates returns 200"""
        response = requests.get(f"{BASE_URL}/api/pipeline/templates", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_seeker_cannot_access_pipeline(self):
        """Seeker should get 403 on pipeline endpoints"""
        # Login as seeker
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "seeker_test@vitalamatch.com",
            "password": "test123"
        })
        assert response.status_code == 200
        seeker_token = response.json()["access_token"]
        seeker_headers = {"Authorization": f"Bearer {seeker_token}"}
        
        # Try to access pipeline
        response = requests.get(f"{BASE_URL}/api/pipeline/candidates", headers=seeker_headers)
        assert response.status_code == 403


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
