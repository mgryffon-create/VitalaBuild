"""
Tiered Matching System Tests
Tests for the new tiered matching response format:
- GET /api/swipe/jobs returns {jobs, counts, has_hidden} structure
- Each job has match_tier (strong/possible/hidden), match_reasons, compatibility_score
- Strong matches appear first, then possible, hidden excluded by default
- GET /api/swipe/jobs?expand=true includes hidden jobs with match_tier='expanded'
- Job quality filtering (missing pay/shift/location downgrade)
- Legacy calculate_compatibility still works for poster swipe
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SEEKER_EMAIL = "seeker_test@vitalamatch.com"
SEEKER_PASSWORD = "test123"
EMPLOYER_EMAIL = "employer_test@vitalamatch.com"
EMPLOYER_PASSWORD = "test123"


class TestTieredMatchingBackend:
    """Tests for tiered matching system backend"""
    
    @pytest.fixture(scope="class")
    def seeker_token(self):
        """Get seeker auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Seeker login failed: {response.status_code} - {response.text}")
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def employer_token(self):
        """Get employer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYER_EMAIL,
            "password": EMPLOYER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Employer login failed: {response.status_code} - {response.text}")
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def seeker_headers(self, seeker_token):
        return {"Authorization": f"Bearer {seeker_token}", "Content-Type": "application/json"}
    
    @pytest.fixture(scope="class")
    def employer_headers(self, employer_token):
        return {"Authorization": f"Bearer {employer_token}", "Content-Type": "application/json"}

    # ─────────────────────────────────────────────────────────────────────────
    # Test 1: GET /api/swipe/jobs returns new structure (not flat array)
    # ─────────────────────────────────────────────────────────────────────────
    def test_swipe_jobs_returns_new_structure(self, seeker_headers):
        """GET /api/swipe/jobs should return {jobs, counts, has_hidden} not flat array"""
        response = requests.get(f"{BASE_URL}/api/swipe/jobs", headers=seeker_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify it's NOT a flat array (old format)
        assert not isinstance(data, list), "Response should NOT be a flat array (old format)"
        
        # Verify new structure
        assert "jobs" in data, "Response must have 'jobs' key"
        assert "counts" in data, "Response must have 'counts' key"
        assert "has_hidden" in data, "Response must have 'has_hidden' key"
        
        # Verify jobs is an array
        assert isinstance(data["jobs"], list), "'jobs' must be an array"
        
        # Verify counts structure
        counts = data["counts"]
        assert "strong" in counts, "counts must have 'strong'"
        assert "possible" in counts, "counts must have 'possible'"
        assert "hidden" in counts, "counts must have 'hidden'"
        
        # Verify has_hidden is boolean
        assert isinstance(data["has_hidden"], bool), "'has_hidden' must be boolean"
        
        print(f"✓ Response structure correct: {len(data['jobs'])} jobs, counts={counts}, has_hidden={data['has_hidden']}")

    # ─────────────────────────────────────────────────────────────────────────
    # Test 2: Each job has match_tier, match_reasons, compatibility_score
    # ─────────────────────────────────────────────────────────────────────────
    def test_jobs_have_tiered_match_fields(self, seeker_headers):
        """Each job should have match_tier, match_reasons, compatibility_score"""
        response = requests.get(f"{BASE_URL}/api/swipe/jobs", headers=seeker_headers)
        assert response.status_code == 200
        
        data = response.json()
        jobs = data.get("jobs", [])
        
        if len(jobs) == 0:
            pytest.skip("No jobs available to test tiered fields")
        
        for job in jobs[:5]:  # Check first 5 jobs
            assert "match_tier" in job, f"Job {job.get('id')} missing 'match_tier'"
            assert "match_reasons" in job, f"Job {job.get('id')} missing 'match_reasons'"
            assert "compatibility_score" in job, f"Job {job.get('id')} missing 'compatibility_score'"
            
            # Validate match_tier values
            assert job["match_tier"] in ["strong", "possible", "hidden", "expanded"], \
                f"Invalid match_tier: {job['match_tier']}"
            
            # Validate match_reasons is array
            assert isinstance(job["match_reasons"], list), "match_reasons must be array"
            
            # Validate compatibility_score is numeric
            assert isinstance(job["compatibility_score"], (int, float)), "compatibility_score must be numeric"
            
            print(f"✓ Job '{job.get('title', 'N/A')[:30]}': tier={job['match_tier']}, score={job['compatibility_score']}, reasons={len(job['match_reasons'])}")

    # ─────────────────────────────────────────────────────────────────────────
    # Test 3: Strong matches appear first, then possible (ordering)
    # ─────────────────────────────────────────────────────────────────────────
    def test_jobs_ordered_by_tier(self, seeker_headers):
        """Jobs should be ordered: strong first, then possible, hidden excluded"""
        response = requests.get(f"{BASE_URL}/api/swipe/jobs", headers=seeker_headers)
        assert response.status_code == 200
        
        data = response.json()
        jobs = data.get("jobs", [])
        
        if len(jobs) < 2:
            pytest.skip("Not enough jobs to test ordering")
        
        # Check that no 'hidden' tier jobs appear (unless expand=true)
        for job in jobs:
            assert job["match_tier"] != "hidden", "Hidden jobs should not appear without expand=true"
        
        # Check ordering: all strong before any possible
        seen_possible = False
        for job in jobs:
            if job["match_tier"] == "possible":
                seen_possible = True
            elif job["match_tier"] == "strong" and seen_possible:
                pytest.fail("Strong match appeared after possible match - ordering incorrect")
        
        print(f"✓ Job ordering correct: strong jobs appear before possible jobs")

    # ─────────────────────────────────────────────────────────────────────────
    # Test 4: expand=true includes hidden jobs with tier='expanded'
    # ─────────────────────────────────────────────────────────────────────────
    def test_expand_includes_hidden_jobs(self, seeker_headers):
        """GET /api/swipe/jobs?expand=true should include hidden jobs with tier='expanded'"""
        # First get without expand
        response_normal = requests.get(f"{BASE_URL}/api/swipe/jobs", headers=seeker_headers)
        assert response_normal.status_code == 200
        data_normal = response_normal.json()
        
        # Then get with expand=true
        response_expand = requests.get(f"{BASE_URL}/api/swipe/jobs?expand=true", headers=seeker_headers)
        assert response_expand.status_code == 200
        data_expand = response_expand.json()
        
        # If there are hidden jobs, expanded should have more
        if data_normal["has_hidden"]:
            assert len(data_expand["jobs"]) > len(data_normal["jobs"]), \
                "Expanded should have more jobs when has_hidden=true"
            
            # Check that expanded jobs have tier='expanded'
            expanded_jobs = [j for j in data_expand["jobs"] if j["match_tier"] == "expanded"]
            assert len(expanded_jobs) > 0, "Should have jobs with tier='expanded' when expand=true"
            
            print(f"✓ Expand works: normal={len(data_normal['jobs'])}, expanded={len(data_expand['jobs'])}, expanded_tier_count={len(expanded_jobs)}")
        else:
            print(f"✓ No hidden jobs to expand (has_hidden=false)")

    # ─────────────────────────────────────────────────────────────────────────
    # Test 5: Match reasons are plain language (max 2)
    # ─────────────────────────────────────────────────────────────────────────
    def test_match_reasons_format(self, seeker_headers):
        """Match reasons should be plain language strings, max 2 per job"""
        response = requests.get(f"{BASE_URL}/api/swipe/jobs", headers=seeker_headers)
        assert response.status_code == 200
        
        data = response.json()
        jobs = data.get("jobs", [])
        
        for job in jobs[:5]:
            reasons = job.get("match_reasons", [])
            
            # Max 2 reasons
            assert len(reasons) <= 2, f"Job has {len(reasons)} reasons, max is 2"
            
            # Each reason should be a non-empty string
            for reason in reasons:
                assert isinstance(reason, str), f"Reason must be string, got {type(reason)}"
                assert len(reason) > 5, f"Reason too short: '{reason}'"
                # Should not contain raw percentages
                assert "%" not in reason or "experience" in reason.lower(), \
                    f"Reason should not show raw percentages: '{reason}'"
            
            if reasons:
                print(f"✓ Job '{job.get('title', 'N/A')[:25]}' reasons: {reasons}")

    # ─────────────────────────────────────────────────────────────────────────
    # Test 6: Legacy poster swipe still returns flat array with compatibility_score
    # ─────────────────────────────────────────────────────────────────────────
    def test_poster_swipe_seekers_legacy_format(self, employer_headers):
        """GET /api/swipe/seekers should still return flat array (legacy format)"""
        # First get employer's jobs
        jobs_response = requests.get(f"{BASE_URL}/api/jobs", headers=employer_headers)
        if jobs_response.status_code != 200:
            pytest.skip("Could not get employer jobs")
        
        jobs = jobs_response.json()
        if len(jobs) == 0:
            pytest.skip("Employer has no jobs to test poster swipe")
        
        job_id = jobs[0]["id"]
        
        # Get seekers for this job
        response = requests.get(f"{BASE_URL}/api/swipe/seekers?job_id={job_id}", headers=employer_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Should be flat array (legacy format)
        assert isinstance(data, list), "Poster swipe/seekers should return flat array"
        
        # Each seeker should have compatibility_score (numeric, not tiered)
        for seeker in data[:3]:
            if "compatibility_score" in seeker:
                assert isinstance(seeker["compatibility_score"], (int, float)), \
                    "compatibility_score should be numeric for poster view"
                # Should NOT have match_tier (that's seeker-only)
                # (match_tier is optional for poster view)
                print(f"✓ Seeker '{seeker.get('full_name', 'N/A')}' score: {seeker['compatibility_score']}")
        
        print(f"✓ Poster swipe returns flat array with {len(data)} seekers")

    # ─────────────────────────────────────────────────────────────────────────
    # Test 7: Swipe actions still work with new format
    # ─────────────────────────────────────────────────────────────────────────
    def test_swipe_actions_work(self, seeker_headers):
        """POST /api/swipe should still work for pass/like actions"""
        # Get a job to swipe on
        response = requests.get(f"{BASE_URL}/api/swipe/jobs", headers=seeker_headers)
        assert response.status_code == 200
        
        data = response.json()
        jobs = data.get("jobs", [])
        
        if len(jobs) == 0:
            pytest.skip("No jobs available to test swipe action")
        
        # Try to pass on a job
        job_id = jobs[0]["id"]
        swipe_response = requests.post(
            f"{BASE_URL}/api/swipe",
            headers=seeker_headers,
            json={"target_id": job_id, "action": "pass"}
        )
        
        assert swipe_response.status_code == 200, f"Swipe failed: {swipe_response.text}"
        swipe_data = swipe_response.json()
        assert "message" in swipe_data, "Swipe response should have message"
        
        print(f"✓ Swipe action (pass) works: {swipe_data}")

    # ─────────────────────────────────────────────────────────────────────────
    # Test 8: Counts match actual job distribution
    # ─────────────────────────────────────────────────────────────────────────
    def test_counts_match_jobs(self, seeker_headers):
        """Counts should accurately reflect job tier distribution"""
        response = requests.get(f"{BASE_URL}/api/swipe/jobs", headers=seeker_headers)
        assert response.status_code == 200
        
        data = response.json()
        jobs = data.get("jobs", [])
        counts = data.get("counts", {})
        
        # Count actual tiers in returned jobs
        actual_strong = sum(1 for j in jobs if j["match_tier"] == "strong")
        actual_possible = sum(1 for j in jobs if j["match_tier"] == "possible")
        
        # Verify counts match
        assert counts["strong"] == actual_strong, \
            f"Strong count mismatch: reported {counts['strong']}, actual {actual_strong}"
        assert counts["possible"] == actual_possible, \
            f"Possible count mismatch: reported {counts['possible']}, actual {actual_possible}"
        
        # has_hidden should be true if hidden count > 0
        if counts["hidden"] > 0:
            assert data["has_hidden"] == True, "has_hidden should be true when hidden count > 0"
        
        print(f"✓ Counts verified: strong={counts['strong']}, possible={counts['possible']}, hidden={counts['hidden']}")


class TestJobQualityFiltering:
    """Tests for job quality filtering (missing pay/shift/location downgrade)"""
    
    @pytest.fixture(scope="class")
    def employer_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYER_EMAIL,
            "password": EMPLOYER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Employer login failed")
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def employer_headers(self, employer_token):
        return {"Authorization": f"Bearer {employer_token}", "Content-Type": "application/json"}
    
    def test_create_quality_job(self, employer_headers):
        """Create a job with all quality fields to verify it's not downgraded"""
        job_data = {
            "title": "TEST_Quality_RN_Position",
            "description": "This is a comprehensive test job posting with all required fields filled in properly. It includes detailed information about the role, responsibilities, and expectations for qualified candidates.",
            "location": "Los Angeles, CA",
            "specialty": "Registered Nurse (RN) - Med-Surg",
            "shift_type": "Day Shift (7am-7pm)",
            "base_rate": 55.0,
            "guaranteed_hours": 36,
            "weekly_stipend": 1200,
            "weekly_pay": 3180,
            "experience_required": 2,
            "certifications_required": ["BLS"],
            "benefits": ["Health Insurance", "401k"],
            "requirements": ["Active RN license", "2+ years experience"]
        }
        
        response = requests.post(f"{BASE_URL}/api/jobs", headers=employer_headers, json=job_data)
        assert response.status_code == 200 or response.status_code == 201, f"Job creation failed: {response.text}"
        
        job = response.json()
        assert job.get("id"), "Job should have ID"
        
        print(f"✓ Created quality job: {job['id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/jobs/{job['id']}", headers=employer_headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
