"""
Test Vault Document Expiration Validation & Compliance Status
Tests for:
- Expirable document types (certification, license, identification) MUST have expiration_date
- Non-expirable types (medical, compliance, resume) can be saved without expiration
- Expired documents are allowed but marked as 'expired' compliance_status
- compliance_status computed dynamically: complete, expired, missing_expiration, review_needed
- GET /api/vault/expirable-types returns expirable categories and subtypes
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SEEKER_EMAIL = "seeker_test@vitalamatch.com"
SEEKER_PASSWORD = "test123"


class TestVaultExpirationValidation:
    """Test vault document expiration validation rules"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: login as seeker and store token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as seeker
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json().get("access_token")
        assert self.token, "No access_token in login response"
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Track created doc IDs for cleanup
        self.created_doc_ids = []
        yield
        
        # Cleanup: delete all test documents created
        for doc_id in self.created_doc_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/vault/documents/{doc_id}")
            except:
                pass
    
    # ─────────────────────────────────────────────────────────────────────────
    # Test: Expirable types MUST have expiration_date (400 if missing)
    # ─────────────────────────────────────────────────────────────────────────
    
    def test_certification_without_expiration_blocked(self):
        """POST certification without expiration_date → 400"""
        resp = self.session.post(f"{BASE_URL}/api/vault/documents", json={
            "category": "certification",
            "subtype": "BLS",
            "file_url": "/test/bls.pdf"
        })
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        assert "expiration" in resp.json().get("detail", "").lower(), f"Expected expiration error: {resp.text}"
        print("✓ Certification without expiration blocked (400)")
    
    def test_license_without_expiration_blocked(self):
        """POST license without expiration_date → 400"""
        resp = self.session.post(f"{BASE_URL}/api/vault/documents", json={
            "category": "license",
            "subtype": "RN License",
            "file_url": "/test/rn_license.pdf"
        })
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        assert "expiration" in resp.json().get("detail", "").lower()
        print("✓ License without expiration blocked (400)")
    
    def test_identification_without_expiration_blocked(self):
        """POST identification without expiration_date → 400"""
        resp = self.session.post(f"{BASE_URL}/api/vault/documents", json={
            "category": "identification",
            "subtype": "Driver's License",
            "file_url": "/test/drivers_license.pdf"
        })
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        assert "expiration" in resp.json().get("detail", "").lower()
        print("✓ Identification without expiration blocked (400)")
    
    # ─────────────────────────────────────────────────────────────────────────
    # Test: Expirable types WITH expiration_date → 200 success
    # ─────────────────────────────────────────────────────────────────────────
    
    def test_certification_with_expiration_allowed(self):
        """POST certification with expiration_date → 200"""
        future_date = (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")
        resp = self.session.post(f"{BASE_URL}/api/vault/documents", json={
            "category": "certification",
            "subtype": "BLS",
            "file_url": "/test/bls_valid.pdf",
            "expiration_date": future_date
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        doc_id = resp.json().get("id")
        assert doc_id, "No document ID returned"
        self.created_doc_ids.append(doc_id)
        print(f"✓ Certification with expiration allowed (200), id={doc_id}")
    
    def test_license_with_expiration_allowed(self):
        """POST license with expiration_date → 200"""
        future_date = (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")
        resp = self.session.post(f"{BASE_URL}/api/vault/documents", json={
            "category": "license",
            "subtype": "RN License",
            "file_url": "/test/rn_license_valid.pdf",
            "expiration_date": future_date
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        doc_id = resp.json().get("id")
        self.created_doc_ids.append(doc_id)
        print(f"✓ License with expiration allowed (200), id={doc_id}")
    
    def test_identification_with_expiration_allowed(self):
        """POST identification with expiration_date → 200"""
        future_date = (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")
        resp = self.session.post(f"{BASE_URL}/api/vault/documents", json={
            "category": "identification",
            "subtype": "Passport",
            "file_url": "/test/passport_valid.pdf",
            "expiration_date": future_date
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        doc_id = resp.json().get("id")
        self.created_doc_ids.append(doc_id)
        print(f"✓ Identification with expiration allowed (200), id={doc_id}")
    
    # ─────────────────────────────────────────────────────────────────────────
    # Test: Non-expirable types WITHOUT expiration_date → 200 allowed
    # ─────────────────────────────────────────────────────────────────────────
    
    def test_medical_without_expiration_allowed(self):
        """POST medical document without expiration_date → 200 allowed"""
        resp = self.session.post(f"{BASE_URL}/api/vault/documents", json={
            "category": "medical",
            "subtype": "TB Test",
            "file_url": "/test/tb_test.pdf"
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        doc_id = resp.json().get("id")
        self.created_doc_ids.append(doc_id)
        print(f"✓ Medical without expiration allowed (200), id={doc_id}")
    
    def test_compliance_without_expiration_allowed(self):
        """POST compliance document without expiration_date → 200 allowed"""
        resp = self.session.post(f"{BASE_URL}/api/vault/documents", json={
            "category": "compliance",
            "subtype": "Background Check",
            "file_url": "/test/background_check.pdf"
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        doc_id = resp.json().get("id")
        self.created_doc_ids.append(doc_id)
        print(f"✓ Compliance without expiration allowed (200), id={doc_id}")
    
    def test_health_screen_without_expiration_allowed(self):
        """POST health_screen document without expiration_date → 200 allowed"""
        # Note: 'resume' is not a valid VAULT_CATEGORY, using 'compliance' instead
        resp = self.session.post(f"{BASE_URL}/api/vault/documents", json={
            "category": "compliance",
            "subtype": "Drug Screen",
            "file_url": "/test/drug_screen.pdf"
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        doc_id = resp.json().get("id")
        self.created_doc_ids.append(doc_id)
        print(f"✓ Compliance (Drug Screen) without expiration allowed (200), id={doc_id}")
    
    # ─────────────────────────────────────────────────────────────────────────
    # Test: Expired documents allowed (for recordkeeping) but marked 'expired'
    # ─────────────────────────────────────────────────────────────────────────
    
    def test_expired_document_allowed_for_recordkeeping(self):
        """POST document with past expiration_date → 200 allowed (for recordkeeping)"""
        past_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        resp = self.session.post(f"{BASE_URL}/api/vault/documents", json={
            "category": "certification",
            "subtype": "ACLS",
            "file_url": "/test/acls_expired.pdf",
            "expiration_date": past_date
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        doc_id = resp.json().get("id")
        self.created_doc_ids.append(doc_id)
        print(f"✓ Expired document allowed for recordkeeping (200), id={doc_id}")
        
        # Verify compliance_status is 'expired' when fetched
        get_resp = self.session.get(f"{BASE_URL}/api/vault/documents/{doc_id}")
        assert get_resp.status_code == 200
        doc_data = get_resp.json()
        assert doc_data.get("compliance_status") == "expired", f"Expected 'expired', got {doc_data.get('compliance_status')}"
        print(f"✓ Expired document has compliance_status='expired'")


class TestVaultComplianceStatus:
    """Test compliance_status computation on GET"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: login as seeker"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        assert login_resp.status_code == 200
        self.token = login_resp.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        self.created_doc_ids = []
        yield
        
        for doc_id in self.created_doc_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/vault/documents/{doc_id}")
            except:
                pass
    
    def test_get_documents_returns_compliance_status(self):
        """GET /api/vault/documents returns compliance_status for each doc"""
        resp = self.session.get(f"{BASE_URL}/api/vault/documents")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        docs = resp.json()
        assert isinstance(docs, list), "Expected list of documents"
        
        # Check that each doc has compliance_status
        for doc in docs:
            assert "compliance_status" in doc, f"Document {doc.get('id')} missing compliance_status"
            assert doc["compliance_status"] in ["complete", "expired", "missing_expiration", "review_needed"], \
                f"Invalid compliance_status: {doc['compliance_status']}"
        print(f"✓ GET /api/vault/documents returns compliance_status for {len(docs)} docs")
    
    def test_compliance_status_review_needed_for_new_docs(self):
        """compliance_status = 'review_needed' for newly created documents (pending verification)
        
        Note: Users cannot update verification_status directly - it's admin-controlled.
        New documents default to 'pending' verification, which maps to 'review_needed' compliance_status.
        """
        future_date = (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")
        
        # Create a document (default verification_status is 'pending')
        resp = self.session.post(f"{BASE_URL}/api/vault/documents", json={
            "category": "certification",
            "subtype": "CPR",
            "file_url": "/test/cpr_valid.pdf",
            "expiration_date": future_date
        })
        assert resp.status_code == 200
        doc_id = resp.json().get("id")
        self.created_doc_ids.append(doc_id)
        
        # Fetch and check compliance_status - should be 'review_needed' since verification is pending
        get_resp = self.session.get(f"{BASE_URL}/api/vault/documents/{doc_id}")
        assert get_resp.status_code == 200
        doc_data = get_resp.json()
        # New docs have pending verification → review_needed compliance_status
        assert doc_data.get("compliance_status") == "review_needed", f"Expected 'review_needed', got {doc_data.get('compliance_status')}"
        assert doc_data.get("verification_status") == "pending", f"Expected 'pending', got {doc_data.get('verification_status')}"
        print(f"✓ New document has compliance_status='review_needed' (pending verification)")
    
    def test_compliance_status_review_needed_for_pending(self):
        """compliance_status = 'review_needed' for pending verification"""
        future_date = (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")
        
        # Create a document (default verification_status is 'pending')
        resp = self.session.post(f"{BASE_URL}/api/vault/documents", json={
            "category": "certification",
            "subtype": "PALS",
            "file_url": "/test/pals_pending.pdf",
            "expiration_date": future_date
        })
        assert resp.status_code == 200
        doc_id = resp.json().get("id")
        self.created_doc_ids.append(doc_id)
        
        # Fetch and check compliance_status
        get_resp = self.session.get(f"{BASE_URL}/api/vault/documents/{doc_id}")
        assert get_resp.status_code == 200
        doc_data = get_resp.json()
        assert doc_data.get("compliance_status") == "review_needed", f"Expected 'review_needed', got {doc_data.get('compliance_status')}"
        print(f"✓ Pending verification document has compliance_status='review_needed'")
    
    def test_compliance_status_expired_for_expired_docs(self):
        """compliance_status = 'expired' for expired documents"""
        past_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        
        resp = self.session.post(f"{BASE_URL}/api/vault/documents", json={
            "category": "license",
            "subtype": "CNA License",
            "file_url": "/test/cna_license_expired.pdf",
            "expiration_date": past_date
        })
        assert resp.status_code == 200
        doc_id = resp.json().get("id")
        self.created_doc_ids.append(doc_id)
        
        get_resp = self.session.get(f"{BASE_URL}/api/vault/documents/{doc_id}")
        assert get_resp.status_code == 200
        doc_data = get_resp.json()
        assert doc_data.get("compliance_status") == "expired", f"Expected 'expired', got {doc_data.get('compliance_status')}"
        print(f"✓ Expired document has compliance_status='expired'")


class TestVaultExpirableTypesEndpoint:
    """Test GET /api/vault/expirable-types endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: login as seeker"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        assert login_resp.status_code == 200
        self.token = login_resp.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_expirable_types_endpoint_returns_data(self):
        """GET /api/vault/expirable-types returns expirable categories and subtypes"""
        resp = self.session.get(f"{BASE_URL}/api/vault/expirable-types")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        assert "expirable_subtypes" in data, "Missing expirable_subtypes"
        assert "expirable_categories" in data, "Missing expirable_categories"
        
        # Verify expected categories
        categories = data["expirable_categories"]
        assert "certification" in categories, "certification should be expirable"
        assert "license" in categories, "license should be expirable"
        assert "identification" in categories, "identification should be expirable"
        
        # Verify some expected subtypes
        subtypes = data["expirable_subtypes"]
        assert "BLS" in subtypes, "BLS should be expirable subtype"
        assert "RN License" in subtypes or "RN_license" in subtypes, "RN License should be expirable"
        
        print(f"✓ GET /api/vault/expirable-types returns {len(categories)} categories, {len(subtypes)} subtypes")


class TestVaultUploadEndpointValidation:
    """Test POST /api/vault/upload with expiration validation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: login as seeker"""
        self.session = requests.Session()
        
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        }, headers={"Content-Type": "application/json"})
        assert login_resp.status_code == 200
        self.token = login_resp.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        self.created_doc_ids = []
        yield
        
        for doc_id in self.created_doc_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/vault/documents/{doc_id}")
            except:
                pass
    
    def test_upload_certification_without_expiration_blocked(self):
        """POST /api/vault/upload with certification + no expiration → 400"""
        # Create a minimal test file
        files = {
            'file': ('test_cert.pdf', b'%PDF-1.4 test content', 'application/pdf')
        }
        data = {
            'category': 'certification',
            'subtype': 'BLS'
        }
        
        resp = self.session.post(f"{BASE_URL}/api/vault/upload", files=files, data=data)
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        assert "expiration" in resp.json().get("detail", "").lower()
        print("✓ Upload certification without expiration blocked (400)")
    
    def test_upload_certification_with_expiration_allowed(self):
        """POST /api/vault/upload with certification + expiration → 200"""
        future_date = (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")
        
        files = {
            'file': ('test_cert_valid.pdf', b'%PDF-1.4 test content', 'application/pdf')
        }
        data = {
            'category': 'certification',
            'subtype': 'BLS',
            'expiration_date': future_date
        }
        
        resp = self.session.post(f"{BASE_URL}/api/vault/upload", files=files, data=data)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        doc_id = resp.json().get("id")
        self.created_doc_ids.append(doc_id)
        print(f"✓ Upload certification with expiration allowed (200), id={doc_id}")
    
    def test_upload_medical_without_expiration_allowed(self):
        """POST /api/vault/upload with medical (non-expirable) + no expiration → 200"""
        files = {
            'file': ('test_medical.pdf', b'%PDF-1.4 test content', 'application/pdf')
        }
        data = {
            'category': 'medical',
            'subtype': 'TB Test'
        }
        
        resp = self.session.post(f"{BASE_URL}/api/vault/upload", files=files, data=data)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        doc_id = resp.json().get("id")
        self.created_doc_ids.append(doc_id)
        print(f"✓ Upload medical without expiration allowed (200), id={doc_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
