"""
Compliance System Overhaul Tests
Tests for:
1. Employer Baseline Requirements (GET/PUT /api/employer/compliance-baseline)
2. Job-Specific Requirements (compliance_requirements field on jobs)
3. Pipeline onboarding_progress for hired candidates
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
    if response.status_code != 200:
        pytest.skip(f"Employer login failed: {response.status_code}")
    return response.json().get("access_token")


@pytest.fixture(scope="module")
def seeker_token():
    """Get seeker auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SEEKER_EMAIL,
        "password": SEEKER_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Seeker login failed: {response.status_code}")
    return response.json().get("access_token")


class TestComplianceBaseline:
    """Tests for employer compliance baseline requirements"""

    def test_get_baseline_returns_default(self, employer_token):
        """GET /api/employer/compliance-baseline returns default baseline with 9 requirements"""
        response = requests.get(
            f"{BASE_URL}/api/employer/compliance-baseline",
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "requirements" in data, "Response should have 'requirements' field"
        requirements = data["requirements"]
        
        # Should have 9 baseline requirements
        assert len(requirements) == 9, f"Expected 9 requirements, got {len(requirements)}"
        
        # Verify structure of each requirement
        for req in requirements:
            assert "key" in req, "Each requirement should have 'key'"
            assert "label" in req, "Each requirement should have 'label'"
            assert "enabled" in req, "Each requirement should have 'enabled'"
        
        # Verify expected keys
        expected_keys = ["license", "bls", "acls", "tb_test", "vaccinations", 
                        "i9", "background_check", "drug_screen", "government_id"]
        actual_keys = [r["key"] for r in requirements]
        for key in expected_keys:
            assert key in actual_keys, f"Missing expected key: {key}"

    def test_baseline_default_enabled_states(self, employer_token):
        """Verify default enabled states: 8 enabled, 1 disabled (ACLS)"""
        response = requests.get(
            f"{BASE_URL}/api/employer/compliance-baseline",
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        requirements = data["requirements"]
        
        # Find ACLS - should be disabled by default
        acls = next((r for r in requirements if r["key"] == "acls"), None)
        assert acls is not None, "ACLS requirement should exist"
        assert acls["enabled"] == False, "ACLS should be disabled by default"
        
        # Count enabled requirements
        enabled_count = sum(1 for r in requirements if r["enabled"])
        assert enabled_count == 8, f"Expected 8 enabled requirements, got {enabled_count}"

    def test_put_baseline_saves_custom(self, employer_token):
        """PUT /api/employer/compliance-baseline saves custom baseline"""
        # Create custom baseline with ACLS enabled
        custom_requirements = [
            {"key": "license", "label": "Professional License", "enabled": True},
            {"key": "bls", "label": "BLS Certification", "enabled": True},
            {"key": "acls", "label": "ACLS Certification", "enabled": True},  # Changed to enabled
            {"key": "tb_test", "label": "TB Test / Screening", "enabled": True},
            {"key": "vaccinations", "label": "Vaccination Records", "enabled": False},  # Changed to disabled
            {"key": "i9", "label": "I-9 Employment Eligibility", "enabled": True},
            {"key": "background_check", "label": "Background Check", "enabled": True},
            {"key": "drug_screen", "label": "Drug Screen", "enabled": True},
            {"key": "government_id", "label": "Government-Issued ID", "enabled": True},
        ]
        
        response = requests.put(
            f"{BASE_URL}/api/employer/compliance-baseline",
            headers={"Authorization": f"Bearer {employer_token}"},
            json={"requirements": custom_requirements}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should have 'message'"
        assert "requirements" in data, "Response should have 'requirements'"

    def test_get_baseline_returns_saved_not_default(self, employer_token):
        """GET after PUT returns saved (non-default) baseline"""
        response = requests.get(
            f"{BASE_URL}/api/employer/compliance-baseline",
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Should have is_default: false after saving custom
        assert data.get("is_default") == False, "After PUT, is_default should be False"
        
        requirements = data["requirements"]
        
        # Verify ACLS is now enabled (from our PUT)
        acls = next((r for r in requirements if r["key"] == "acls"), None)
        assert acls is not None, "ACLS requirement should exist"
        assert acls["enabled"] == True, "ACLS should be enabled after our PUT"
        
        # Verify vaccinations is now disabled (from our PUT)
        vaccinations = next((r for r in requirements if r["key"] == "vaccinations"), None)
        assert vaccinations is not None, "Vaccinations requirement should exist"
        assert vaccinations["enabled"] == False, "Vaccinations should be disabled after our PUT"

    def test_seeker_cannot_access_baseline(self, seeker_token):
        """Seeker should not be able to access employer baseline"""
        response = requests.get(
            f"{BASE_URL}/api/employer/compliance-baseline",
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for seeker, got {response.status_code}"


class TestJobComplianceRequirements:
    """Tests for job-specific compliance_requirements field"""

    def test_create_job_with_compliance_requirements(self, employer_token):
        """Jobs can include compliance_requirements field (array of strings)"""
        job_data = {
            "title": "TEST_Compliance_RN",
            "description": "Test job for compliance requirements testing. This is a detailed description that meets the minimum character requirement for job postings.",
            "location": "Los Angeles, CA",
            "specialty": "Registered Nurse (RN) - ICU/Critical Care",
            "shift_type": "Day Shift (7a-7p)",
            "job_type": "Travel Contract",
            "duration": "13 weeks",
            "base_rate": 55,
            "guaranteed_hours": 36,
            "weekly_stipend": 900,
            "start_date": "2026-03-01",
            "experience_required": 2,
            "stipend": "Housing stipend",
            "compliance_requirements": [
                "EPIC EMR training",
                "Fall prevention module",
                "Facility orientation"
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/jobs",
            headers={"Authorization": f"Bearer {employer_token}"},
            json=job_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should have job id"
        assert "compliance_requirements" in data, "Response should have compliance_requirements"
        assert data["compliance_requirements"] == job_data["compliance_requirements"], \
            "compliance_requirements should match what was sent"
        
        # Store job_id for cleanup
        TestJobComplianceRequirements.test_job_id = data["id"]

    def test_get_job_returns_compliance_requirements(self, employer_token):
        """GET job returns compliance_requirements field"""
        job_id = getattr(TestJobComplianceRequirements, 'test_job_id', None)
        if not job_id:
            pytest.skip("No test job created")
        
        response = requests.get(
            f"{BASE_URL}/api/jobs/{job_id}",
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "compliance_requirements" in data, "Job should have compliance_requirements"
        assert isinstance(data["compliance_requirements"], list), "compliance_requirements should be a list"
        assert len(data["compliance_requirements"]) == 3, "Should have 3 compliance requirements"

    def test_update_job_compliance_requirements(self, employer_token):
        """PUT job can update compliance_requirements"""
        job_id = getattr(TestJobComplianceRequirements, 'test_job_id', None)
        if not job_id:
            pytest.skip("No test job created")
        
        # Get current job data
        get_response = requests.get(
            f"{BASE_URL}/api/jobs/{job_id}",
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        job_data = get_response.json()
        
        # Update compliance requirements
        job_data["compliance_requirements"] = [
            "EPIC EMR training",
            "Fall prevention module",
            "Facility orientation",
            "COVID-19 vaccination"  # Added new requirement
        ]
        
        response = requests.put(
            f"{BASE_URL}/api/jobs/{job_id}",
            headers={"Authorization": f"Bearer {employer_token}"},
            json=job_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify update
        verify_response = requests.get(
            f"{BASE_URL}/api/jobs/{job_id}",
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        verify_data = verify_response.json()
        assert len(verify_data["compliance_requirements"]) == 4, "Should have 4 compliance requirements after update"

    def test_cleanup_test_job(self, employer_token):
        """Cleanup: Delete test job"""
        job_id = getattr(TestJobComplianceRequirements, 'test_job_id', None)
        if job_id:
            requests.delete(
                f"{BASE_URL}/api/jobs/{job_id}",
                headers={"Authorization": f"Bearer {employer_token}"}
            )


class TestPipelineOnboardingProgress:
    """Tests for pipeline candidates onboarding_progress field"""

    def test_pipeline_candidates_structure(self, employer_token):
        """Pipeline candidates endpoint returns expected structure"""
        response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates",
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "candidates" in data, "Response should have 'candidates'"
        assert "stats" in data, "Response should have 'stats'"
        
        # Verify stage structure
        candidates = data["candidates"]
        expected_stages = ["interested", "matched", "interviewing", "offer_sent", "hired"]
        for stage in expected_stages:
            assert stage in candidates, f"Missing stage: {stage}"

    def test_hired_candidates_have_onboarding_progress(self, employer_token):
        """Hired stage candidates include onboarding_progress (if they have onboarding_case)"""
        response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates",
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        hired_candidates = data["candidates"].get("hired", [])
        
        # Note: There may be 0 hired candidates currently
        # If there are hired candidates with onboarding cases, verify structure
        for candidate in hired_candidates:
            if candidate.get("onboarding_progress"):
                ob = candidate["onboarding_progress"]
                # Verify onboarding_progress structure
                assert "total" in ob, "onboarding_progress should have 'total'"
                assert "completed" in ob, "onboarding_progress should have 'completed'"
                assert "missing" in ob, "onboarding_progress should have 'missing'"
                assert "expired" in ob, "onboarding_progress should have 'expired'"
                assert "pending_external" in ob, "onboarding_progress should have 'pending_external'"
                assert "percent" in ob, "onboarding_progress should have 'percent'"
                assert "status_label" in ob, "onboarding_progress should have 'status_label'"
                
                # Verify status_label is one of expected values
                assert ob["status_label"] in ["in_progress", "ready", "blocked"], \
                    f"status_label should be in_progress/ready/blocked, got {ob['status_label']}"
                
                # Verify percent is 0-100
                assert 0 <= ob["percent"] <= 100, f"percent should be 0-100, got {ob['percent']}"
        
        # Log for context
        print(f"Found {len(hired_candidates)} hired candidates")
        with_progress = [c for c in hired_candidates if c.get("onboarding_progress")]
        print(f"Of those, {len(with_progress)} have onboarding_progress")

    def test_non_hired_candidates_no_onboarding_progress(self, employer_token):
        """Non-hired candidates should not have onboarding_progress"""
        response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates",
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Check interested, matched, interviewing, offer_sent stages
        for stage in ["interested", "matched", "interviewing", "offer_sent"]:
            candidates = data["candidates"].get(stage, [])
            for candidate in candidates:
                # Non-hired candidates should have onboarding_progress as None
                assert candidate.get("onboarding_progress") is None, \
                    f"Candidate in {stage} stage should not have onboarding_progress"


class TestComplianceBaselineCleanup:
    """Cleanup: Reset baseline to default state"""

    def test_reset_baseline_to_default(self, employer_token):
        """Reset baseline back to default state for other tests"""
        default_requirements = [
            {"key": "license", "label": "Professional License", "enabled": True},
            {"key": "bls", "label": "BLS Certification", "enabled": True},
            {"key": "acls", "label": "ACLS Certification", "enabled": False},
            {"key": "tb_test", "label": "TB Test / Screening", "enabled": True},
            {"key": "vaccinations", "label": "Vaccination Records", "enabled": True},
            {"key": "i9", "label": "I-9 Employment Eligibility", "enabled": True},
            {"key": "background_check", "label": "Background Check", "enabled": True},
            {"key": "drug_screen", "label": "Drug Screen", "enabled": True},
            {"key": "government_id", "label": "Government-Issued ID", "enabled": True},
        ]
        
        response = requests.put(
            f"{BASE_URL}/api/employer/compliance-baseline",
            headers={"Authorization": f"Bearer {employer_token}"},
            json={"requirements": default_requirements}
        )
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
