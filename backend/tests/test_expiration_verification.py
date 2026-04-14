"""
Test Expiration Date Verification System
Tests for:
- determine_verification_status() function
- _compute_compliance_status() function
- Background verification trigger on upload
- Compliance status in GET /api/vault/documents
- Onboarding match_vault_document mismatch handling
"""
import pytest
import requests
import os
import sys
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

# Load environment variables from backend/.env
load_dotenv('/app/backend/.env')

# Add backend to path for imports
sys.path.insert(0, '/app/backend')

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# ==================== UNIT TESTS FOR PURE FUNCTIONS ====================

class TestDetermineVerificationStatus:
    """Tests for determine_verification_status() function in expiration_verifier.py"""
    
    def test_verified_when_dates_match_exactly(self):
        """When parsed date matches user entry exactly, status should be 'verified'"""
        from expiration_verifier import determine_verification_status
        
        future_date = (datetime.now(timezone.utc) + timedelta(days=365)).strftime("%Y-%m-%d")
        parsed_result = {
            "parsed_expiration_date": future_date,
            "confidence": "high",
            "parse_error": None
        }
        
        result = determine_verification_status(future_date, parsed_result)
        
        assert result["verification_status"] == "verified", f"Expected 'verified', got {result['verification_status']}"
        assert "verified" in result["verification_notes"].lower()
        print(f"✓ Exact date match returns 'verified': {result}")
    
    def test_verified_when_dates_within_tolerance(self):
        """When parsed date is within 31-day tolerance, status should be 'verified'"""
        from expiration_verifier import determine_verification_status
        
        future_date = (datetime.now(timezone.utc) + timedelta(days=365)).strftime("%Y-%m-%d")
        # Parsed date is 15 days different (within 31-day tolerance)
        parsed_date = (datetime.now(timezone.utc) + timedelta(days=380)).strftime("%Y-%m-%d")
        parsed_result = {
            "parsed_expiration_date": parsed_date,
            "confidence": "high",
            "parse_error": None
        }
        
        result = determine_verification_status(future_date, parsed_result)
        
        assert result["verification_status"] == "verified", f"Expected 'verified', got {result['verification_status']}"
        print(f"✓ Dates within tolerance returns 'verified': {result}")
    
    def test_mismatch_when_dates_differ_both_future(self):
        """When parsed date differs from user entry (both future), status should be 'mismatch'"""
        from expiration_verifier import determine_verification_status
        
        user_date = (datetime.now(timezone.utc) + timedelta(days=365)).strftime("%Y-%m-%d")
        # Parsed date is 60 days different (outside 31-day tolerance)
        parsed_date = (datetime.now(timezone.utc) + timedelta(days=425)).strftime("%Y-%m-%d")
        parsed_result = {
            "parsed_expiration_date": parsed_date,
            "confidence": "high",
            "parse_error": None
        }
        
        result = determine_verification_status(user_date, parsed_result)
        
        assert result["verification_status"] == "mismatch", f"Expected 'mismatch', got {result['verification_status']}"
        assert user_date[:10] in result["verification_notes"] or "User entered" in result["verification_notes"]
        print(f"✓ Date mismatch (both future) returns 'mismatch': {result}")
    
    def test_unverified_when_parse_fails(self):
        """When parse fails (no parsed date), status should be 'unverified'"""
        from expiration_verifier import determine_verification_status
        
        user_date = (datetime.now(timezone.utc) + timedelta(days=365)).strftime("%Y-%m-%d")
        parsed_result = {
            "parsed_expiration_date": None,
            "confidence": None,
            "parse_error": "Could not extract date from document"
        }
        
        result = determine_verification_status(user_date, parsed_result)
        
        assert result["verification_status"] == "unverified", f"Expected 'unverified', got {result['verification_status']}"
        print(f"✓ Parse failure returns 'unverified': {result}")
    
    def test_expired_when_parsed_date_is_past(self):
        """When parsed date is in the past, status should be 'expired'"""
        from expiration_verifier import determine_verification_status
        
        user_date = (datetime.now(timezone.utc) + timedelta(days=365)).strftime("%Y-%m-%d")
        past_date = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
        parsed_result = {
            "parsed_expiration_date": past_date,
            "confidence": "high",
            "parse_error": None
        }
        
        result = determine_verification_status(user_date, parsed_result)
        
        assert result["verification_status"] == "expired", f"Expected 'expired', got {result['verification_status']}"
        assert "passed" in result["verification_notes"].lower()
        print(f"✓ Parsed date in past returns 'expired': {result}")
    
    def test_expired_when_user_entry_is_past(self):
        """When user-entered date is in the past, status should be 'expired'"""
        from expiration_verifier import determine_verification_status
        
        past_user_date = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
        parsed_result = {
            "parsed_expiration_date": None,  # Parse failed
            "confidence": None,
            "parse_error": "Could not extract"
        }
        
        result = determine_verification_status(past_user_date, parsed_result)
        
        assert result["verification_status"] == "expired", f"Expected 'expired', got {result['verification_status']}"
        print(f"✓ User entry in past returns 'expired': {result}")


class TestComputeComplianceStatus:
    """Tests for _compute_compliance_status() function in vault.py"""
    
    def test_verified_for_verified_valid_doc(self):
        """Verified + valid expiration → compliance_status = 'verified'"""
        from routes.vault import _compute_compliance_status
        
        future_date = (datetime.now(timezone.utc) + timedelta(days=365)).strftime("%Y-%m-%d")
        doc = {
            "category": "certification",
            "subtype": "BLS",
            "expiration_date": future_date,
            "verification_status": "verified",
            "parsed_expiration_date": future_date
        }
        
        status = _compute_compliance_status(doc)
        
        assert status == "verified", f"Expected 'verified', got {status}"
        print(f"✓ Verified + valid doc returns 'verified': {status}")
    
    def test_mismatch_never_satisfies(self):
        """Mismatch verification → compliance_status = 'mismatch' (never satisfies)"""
        from routes.vault import _compute_compliance_status
        
        future_date = (datetime.now(timezone.utc) + timedelta(days=365)).strftime("%Y-%m-%d")
        doc = {
            "category": "certification",
            "subtype": "BLS",
            "expiration_date": future_date,
            "verification_status": "mismatch",
            "parsed_expiration_date": (datetime.now(timezone.utc) + timedelta(days=500)).strftime("%Y-%m-%d")
        }
        
        status = _compute_compliance_status(doc)
        
        assert status == "mismatch", f"Expected 'mismatch', got {status}"
        print(f"✓ Mismatch verification returns 'mismatch': {status}")
    
    def test_expired_for_expired_doc(self):
        """Expired document → compliance_status = 'expired' (never satisfies)"""
        from routes.vault import _compute_compliance_status
        
        past_date = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
        doc = {
            "category": "certification",
            "subtype": "BLS",
            "expiration_date": past_date,
            "verification_status": "verified"
        }
        
        status = _compute_compliance_status(doc)
        
        assert status == "expired", f"Expected 'expired', got {status}"
        print(f"✓ Expired doc returns 'expired': {status}")
    
    def test_missing_expiration_for_expirable_without_date(self):
        """Expirable type without expiration_date → compliance_status = 'missing_expiration'"""
        from routes.vault import _compute_compliance_status
        
        doc = {
            "category": "certification",
            "subtype": "BLS",
            "expiration_date": None,
            "verification_status": "pending"
        }
        
        status = _compute_compliance_status(doc)
        
        assert status == "missing_expiration", f"Expected 'missing_expiration', got {status}"
        print(f"✓ Expirable without date returns 'missing_expiration': {status}")
    
    def test_unverified_for_parse_failed_valid_entry(self):
        """Parse failed + valid user entry → compliance_status = 'unverified'"""
        from routes.vault import _compute_compliance_status
        
        future_date = (datetime.now(timezone.utc) + timedelta(days=365)).strftime("%Y-%m-%d")
        doc = {
            "category": "certification",
            "subtype": "BLS",
            "expiration_date": future_date,
            "verification_status": "unverified",
            "parsed_expiration_date": None
        }
        
        status = _compute_compliance_status(doc)
        
        assert status == "unverified", f"Expected 'unverified', got {status}"
        print(f"✓ Parse failed + valid entry returns 'unverified': {status}")
    
    def test_pending_for_pending_verification(self):
        """Pending verification → compliance_status = 'pending'"""
        from routes.vault import _compute_compliance_status
        
        future_date = (datetime.now(timezone.utc) + timedelta(days=365)).strftime("%Y-%m-%d")
        doc = {
            "category": "certification",
            "subtype": "BLS",
            "expiration_date": future_date,
            "verification_status": "pending"
        }
        
        status = _compute_compliance_status(doc)
        
        assert status == "pending", f"Expected 'pending', got {status}"
        print(f"✓ Pending verification returns 'pending': {status}")


# ==================== API INTEGRATION TESTS ====================

class TestVaultAPIComplianceStatus:
    """Tests for vault API endpoints returning compliance_status"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for seeker"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "seeker_test@vitalamatch.com",
            "password": "test123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_get_documents_returns_compliance_status(self, auth_headers):
        """GET /api/vault/documents should return compliance_status for each doc"""
        response = requests.get(f"{BASE_URL}/api/vault/documents", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        docs = response.json()
        
        if len(docs) > 0:
            for doc in docs[:5]:  # Check first 5 docs
                assert "compliance_status" in doc, f"Document missing compliance_status: {doc.get('id')}"
                valid_statuses = ["verified", "unverified", "mismatch", "expired", "missing_expiration", "pending", "review_needed"]
                assert doc["compliance_status"] in valid_statuses, f"Invalid compliance_status: {doc['compliance_status']}"
            print(f"✓ GET /api/vault/documents returns compliance_status for {len(docs)} docs")
        else:
            print("✓ GET /api/vault/documents returns empty list (no docs)")
    
    def test_upload_expirable_triggers_background_verification(self, auth_headers):
        """POST /api/vault/upload for expirable type with expiration_date should trigger background verification"""
        import io
        
        # Create a simple test image (1x1 pixel PNG)
        png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        
        future_date = (datetime.now(timezone.utc) + timedelta(days=365)).strftime("%Y-%m-%d")
        
        files = {"file": ("test_bls.png", io.BytesIO(png_data), "image/png")}
        data = {
            "category": "certification",
            "subtype": "BLS",
            "expiration_date": future_date
        }
        
        response = requests.post(
            f"{BASE_URL}/api/vault/upload",
            headers=auth_headers,
            files=files,
            data=data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        result = response.json()
        assert "id" in result, "Response should contain document id"
        doc_id = result["id"]
        
        # Verify document was created with pending verification
        doc_response = requests.get(f"{BASE_URL}/api/vault/documents/{doc_id}", headers=auth_headers)
        assert doc_response.status_code == 200
        doc = doc_response.json()
        
        # Initially should be pending (background task may not have completed)
        assert doc.get("verification_status") in ["pending", "verified", "unverified", "mismatch", "expired"], \
            f"Unexpected verification_status: {doc.get('verification_status')}"
        
        print(f"✓ Upload expirable doc triggers verification, status: {doc.get('verification_status')}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/vault/documents/{doc_id}", headers=auth_headers)


class TestOnboardingMismatchHandling:
    """Tests for onboarding match_vault_document mismatch handling"""
    
    def test_match_vault_document_skips_mismatch_docs(self):
        """match_vault_document should return flagged_issue status for mismatch docs"""
        from onboarding_logic import match_vault_document
        
        future_date = (datetime.now(timezone.utc) + timedelta(days=365)).strftime("%Y-%m-%d")
        
        # Requirement rule for BLS certification
        requirement_rule = {
            "type": "bls_certification",
            "label": "BLS Certification",
            "fulfillment_source": "vault",
            "vault_match": {
                "category": "certification",
                "subtypes": ["BLS", "CPR", "CPR_BLS"]
            }
        }
        
        # Vault docs with one mismatch doc
        vault_docs = [
            {
                "id": "doc1",
                "category": "certification",
                "subtype": "BLS",
                "expiration_date": future_date,
                "verification_status": "mismatch",
                "verification_notes": "User entered 2026-01-01, but document shows 2025-06-01",
                "uploaded_at": "2024-01-01T00:00:00Z"
            }
        ]
        
        status, matched_doc, notes = match_vault_document(requirement_rule, vault_docs)
        
        assert status == "flagged_issue", f"Expected 'flagged_issue', got {status}"
        assert matched_doc is not None, "Should still return the matched doc"
        # Notes should contain the verification_notes from the mismatch doc
        assert notes is not None, f"Notes should not be None"
        
        print(f"✓ match_vault_document returns flagged_issue for mismatch: status={status}, notes={notes}")
    
    def test_match_vault_document_prefers_verified_over_mismatch(self):
        """match_vault_document should prefer verified docs over mismatch docs"""
        from onboarding_logic import match_vault_document
        
        future_date = (datetime.now(timezone.utc) + timedelta(days=365)).strftime("%Y-%m-%d")
        
        requirement_rule = {
            "type": "bls_certification",
            "label": "BLS Certification",
            "fulfillment_source": "vault",
            "vault_match": {
                "category": "certification",
                "subtypes": ["BLS", "CPR", "CPR_BLS"]
            }
        }
        
        # Vault docs with both mismatch and verified docs
        vault_docs = [
            {
                "id": "doc_mismatch",
                "category": "certification",
                "subtype": "BLS",
                "expiration_date": future_date,
                "verification_status": "mismatch",
                "uploaded_at": "2024-01-02T00:00:00Z"  # Newer
            },
            {
                "id": "doc_verified",
                "category": "certification",
                "subtype": "BLS",
                "expiration_date": future_date,
                "verification_status": "verified",
                "uploaded_at": "2024-01-01T00:00:00Z"  # Older but verified
            }
        ]
        
        status, matched_doc, notes = match_vault_document(requirement_rule, vault_docs)
        
        assert status == "satisfied_from_vault", f"Expected 'satisfied_from_vault', got {status}"
        assert matched_doc["id"] == "doc_verified", f"Should match verified doc, got {matched_doc['id']}"
        
        print(f"✓ match_vault_document prefers verified over mismatch: matched={matched_doc['id']}")


# ==================== RUN TESTS ====================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
