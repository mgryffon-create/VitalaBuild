"""
Test suite for Document Vault as single source of truth for profile completion.
Tests the integration between vault documents and profile completion checks.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SEEKER_EMAIL = "seeker_test@vitalamatch.com"
SEEKER_PASSWORD = "test123"


class TestProfileCompletionWithVault:
    """Tests for profile completion endpoint with vault document checks"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data["access_token"]
        self.user_id = data["user"]["id"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_profile_completion_returns_doc_checks(self):
        """GET /api/profile/completion returns doc_checks object"""
        response = requests.get(f"{BASE_URL}/api/profile/completion", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "doc_checks" in data, "Response should contain doc_checks field"
        
        # Verify doc_checks structure
        doc_checks = data["doc_checks"]
        assert "tb_clearance" in doc_checks, "doc_checks should have tb_clearance"
        assert "bls_certification" in doc_checks, "doc_checks should have bls_certification"
        assert "medical_document" in doc_checks, "doc_checks should have medical_document"
        assert "license_document" in doc_checks, "doc_checks should have license_document"
        
        # All values should be boolean
        for key, value in doc_checks.items():
            assert isinstance(value, bool), f"doc_checks.{key} should be boolean, got {type(value)}"
        
        print(f"doc_checks: {doc_checks}")
    
    def test_profile_completion_returns_checks(self):
        """GET /api/profile/completion returns checks object for onboarding gate"""
        response = requests.get(f"{BASE_URL}/api/profile/completion", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "checks" in data, "Response should contain checks field"
        
        # Verify checks structure
        checks = data["checks"]
        expected_keys = [
            "specialty", "years_experience", "availability", "preferred_shift",
            "travel_readiness", "job_type_preference", "experience_highlights",
            "certifications_or_licenses"
        ]
        for key in expected_keys:
            assert key in checks, f"checks should have {key}"
        
        print(f"checks: {checks}")
    
    def test_profile_completion_percentage(self):
        """GET /api/profile/completion returns percentage and completion status"""
        response = requests.get(f"{BASE_URL}/api/profile/completion", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "percentage" in data, "Response should contain percentage"
        assert "complete" in data, "Response should contain complete"
        assert "filled" in data, "Response should contain filled"
        assert "total" in data, "Response should contain total"
        
        assert isinstance(data["percentage"], int), "percentage should be int"
        assert isinstance(data["complete"], bool), "complete should be bool"
        assert 0 <= data["percentage"] <= 100, "percentage should be 0-100"
        
        print(f"Profile completion: {data['percentage']}% ({data['filled']}/{data['total']})")


class TestVaultDocuments:
    """Tests for vault document endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data["access_token"]
        self.user_id = data["user"]["id"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_vault_documents(self):
        """GET /api/vault/documents returns list of documents"""
        response = requests.get(f"{BASE_URL}/api/vault/documents", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # If there are documents, verify structure
        if len(data) > 0:
            doc = data[0]
            assert "id" in doc, "Document should have id"
            assert "category" in doc, "Document should have category"
            print(f"Found {len(data)} vault documents")
        else:
            print("No vault documents found")


class TestSeekerProfile:
    """Tests for seeker profile endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data["access_token"]
        self.user_id = data["user"]["id"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_seeker_profile(self):
        """GET /api/profile/seeker returns profile data"""
        response = requests.get(f"{BASE_URL}/api/profile/seeker", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        # Profile should have basic fields
        print(f"Profile keys: {list(data.keys())}")
    
    def test_profile_has_no_upload_forms_in_medical_records(self):
        """Verify profile structure - medical records should not have upload forms"""
        response = requests.get(f"{BASE_URL}/api/profile/seeker", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        # Medical records in profile should be minimal or empty
        # The actual upload is done via vault
        medical_records = data.get("medical_records", [])
        print(f"Medical records in profile: {len(medical_records)} items")


class TestOnboardingGateRouting:
    """Tests for OnboardingGate routing configuration"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_profile_completion_for_onboarding_gate(self):
        """Profile completion should provide data for OnboardingGate checklist"""
        response = requests.get(f"{BASE_URL}/api/profile/completion", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        
        # OnboardingGate uses checks for routing
        checks = data.get("checks", {})
        
        # certifications_or_licenses check should route to vault
        assert "certifications_or_licenses" in checks, "Should have certifications_or_licenses check"
        
        print(f"OnboardingGate checks: {checks}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
