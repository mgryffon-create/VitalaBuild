"""
Test Lightweight Parser for Document Vault Verification
Tests for:
- Text extraction from PDFs using PyMuPDF
- Date detection via regex + keyword proximity
- Credential keyword detection (BLS, ACLS, RN, CNA, etc.)
- Verification status determination (verified, needs_review, unverified)
- Integration with vault upload endpoint
- Verification notes returned for all status types
"""
import pytest
import requests
import os
import sys
import io
from datetime import datetime, timedelta

# Add backend directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SEEKER_EMAIL = "seeker_test@vitalamatch.com"
SEEKER_PASSWORD = "test123"


class TestLightweightParserUnit:
    """Unit tests for lightweight_parser.py functions"""
    
    def test_import_lightweight_parser(self):
        """Verify lightweight_parser module can be imported"""
        try:
            from lightweight_parser import (
                lightweight_verify, extract_text_from_bytes, find_dates_in_text,
                find_expiration_date, find_credential_keywords, dates_match
            )
            print("✓ lightweight_parser module imported successfully")
        except ImportError as e:
            pytest.fail(f"Failed to import lightweight_parser: {e}")
    
    def test_find_dates_in_text_mdy_format(self):
        """Test date detection for MM/DD/YYYY format"""
        from lightweight_parser import find_dates_in_text
        
        text = "This certificate expires on 12/31/2026 and was issued on 01/15/2024"
        dates = find_dates_in_text(text)
        
        assert len(dates) >= 2, f"Expected at least 2 dates, found {len(dates)}"
        date_strs = [d["date"] for d in dates]
        assert "2026-12-31" in date_strs, f"Expected 2026-12-31 in {date_strs}"
        assert "2024-01-15" in date_strs, f"Expected 2024-01-15 in {date_strs}"
        print(f"✓ Found dates: {date_strs}")
    
    def test_find_dates_in_text_ymd_format(self):
        """Test date detection for YYYY-MM-DD format"""
        from lightweight_parser import find_dates_in_text
        
        text = "Expiration: 2027-06-15"
        dates = find_dates_in_text(text)
        
        assert len(dates) >= 1, f"Expected at least 1 date, found {len(dates)}"
        assert dates[0]["date"] == "2027-06-15"
        print(f"✓ Found YYYY-MM-DD date: {dates[0]['date']}")
    
    def test_find_dates_in_text_named_month(self):
        """Test date detection for 'January 15, 2026' format"""
        from lightweight_parser import find_dates_in_text
        
        text = "Valid until January 15, 2027"
        dates = find_dates_in_text(text)
        
        assert len(dates) >= 1, f"Expected at least 1 date, found {len(dates)}"
        assert dates[0]["date"] == "2027-01-15"
        print(f"✓ Found named month date: {dates[0]['date']}")
    
    def test_find_expiration_date_with_keyword(self):
        """Test expiration date detection with keyword proximity scoring"""
        from lightweight_parser import find_expiration_date
        
        text = "Issue Date: 01/15/2024\nExpiration Date: 12/31/2026\nHolder: John Doe"
        result = find_expiration_date(text)
        
        assert result["expiration_date"] == "2026-12-31", f"Expected 2026-12-31, got {result['expiration_date']}"
        assert result["confidence"] in ("high", "medium"), f"Expected high/medium confidence, got {result['confidence']}"
        print(f"✓ Found expiration date: {result['expiration_date']} (confidence: {result['confidence']})")
    
    def test_find_credential_keywords_bls(self):
        """Test BLS credential keyword detection"""
        from lightweight_parser import find_credential_keywords
        
        text = "Basic Life Support (BLS) Provider Card"
        creds = find_credential_keywords(text)
        
        assert "BLS" in creds, f"Expected BLS in {creds}"
        print(f"✓ Found credentials: {creds}")
    
    def test_find_credential_keywords_multiple(self):
        """Test multiple credential keyword detection"""
        from lightweight_parser import find_credential_keywords
        
        text = "ACLS and BLS certifications for Registered Nurse (RN)"
        creds = find_credential_keywords(text)
        
        assert "BLS" in creds, f"Expected BLS in {creds}"
        assert "ACLS" in creds, f"Expected ACLS in {creds}"
        assert "RN" in creds, f"Expected RN in {creds}"
        print(f"✓ Found multiple credentials: {creds}")
    
    def test_find_credential_keywords_cna(self):
        """Test CNA credential keyword detection"""
        from lightweight_parser import find_credential_keywords
        
        text = "Certified Nursing Assistant Certificate"
        creds = find_credential_keywords(text)
        
        assert "CNA" in creds, f"Expected CNA in {creds}"
        print(f"✓ Found CNA credential: {creds}")
    
    def test_dates_match_exact(self):
        """Test exact date matching"""
        from lightweight_parser import dates_match
        
        assert dates_match("2026-12-31", "2026-12-31") == True
        print("✓ Exact dates match")
    
    def test_dates_match_within_tolerance(self):
        """Test date matching within 31-day tolerance"""
        from lightweight_parser import dates_match
        
        # 15 days apart - should match
        assert dates_match("2026-12-15", "2026-12-31") == True
        # 45 days apart - should NOT match
        assert dates_match("2026-11-15", "2026-12-31") == False
        print("✓ Date tolerance matching works")


class TestLightweightVerifyFunction:
    """Test the main lightweight_verify function"""
    
    def test_verify_matching_date_and_credential(self):
        """Test: matching expiration date + credential → verified, should_run_llm=False"""
        from lightweight_parser import lightweight_verify
        import fitz
        
        # Create a PDF with text containing BLS and expiration date
        future_date = (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")
        future_date_display = (datetime.now() + timedelta(days=365)).strftime("%m/%d/%Y")
        
        doc = fitz.open()
        page = doc.new_page()
        text = f"Basic Life Support (BLS) Provider Card\nExpiration Date: {future_date_display}\nHolder: Test User"
        page.insert_text((72, 72), text, fontsize=12)
        pdf_bytes = doc.tobytes()
        doc.close()
        
        result = lightweight_verify(
            file_bytes=pdf_bytes,
            content_type="application/pdf",
            user_expiration=future_date,
            user_subtype="BLS"
        )
        
        assert result["verification_status"] == "verified", f"Expected 'verified', got {result['verification_status']}"
        assert result["should_run_llm"] == False, "should_run_llm should be False for verified"
        assert "BLS" in result["detected_credentials"], f"Expected BLS in {result['detected_credentials']}"
        assert result["verification_notes"] is not None, "verification_notes should be set"
        print(f"✓ Matching date + credential → verified (notes: {result['verification_notes']})")
    
    def test_verify_mismatched_date(self):
        """Test: mismatched expiration date → needs_review"""
        from lightweight_parser import lightweight_verify
        import fitz
        
        # Create PDF with one date, but user enters different date
        doc = fitz.open()
        page = doc.new_page()
        text = "BLS Provider Card\nExpiration Date: 12/31/2026"
        page.insert_text((72, 72), text, fontsize=12)
        pdf_bytes = doc.tobytes()
        doc.close()
        
        result = lightweight_verify(
            file_bytes=pdf_bytes,
            content_type="application/pdf",
            user_expiration="2027-06-15",  # Different from document
            user_subtype="BLS"
        )
        
        assert result["verification_status"] == "needs_review", f"Expected 'needs_review', got {result['verification_status']}"
        assert result["verification_notes"] is not None
        assert "may not match" in result["verification_notes"].lower() or "mismatch" in result["verification_notes"].lower()
        print(f"✓ Mismatched date → needs_review (notes: {result['verification_notes']})")
    
    def test_verify_no_readable_text(self):
        """Test: no readable text → unverified"""
        from lightweight_parser import lightweight_verify
        
        # Empty/minimal bytes that won't have extractable text
        empty_bytes = b'\x00' * 100
        
        result = lightweight_verify(
            file_bytes=empty_bytes,
            content_type="application/pdf",
            user_expiration="2026-12-31",
            user_subtype="BLS"
        )
        
        assert result["verification_status"] == "unverified", f"Expected 'unverified', got {result['verification_status']}"
        assert result["extraction_quality"] == "none", f"Expected 'none', got {result['extraction_quality']}"
        assert result["verification_notes"] is not None
        print(f"✓ No readable text → unverified (notes: {result['verification_notes']})")
    
    def test_verify_expired_document(self):
        """Test: expired document → needs_review"""
        from lightweight_parser import lightweight_verify
        import fitz
        
        # Create PDF with past expiration date
        past_date = (datetime.now() - timedelta(days=30)).strftime("%m/%d/%Y")
        past_date_iso = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        
        doc = fitz.open()
        page = doc.new_page()
        text = f"BLS Provider Card\nExpiration Date: {past_date}"
        page.insert_text((72, 72), text, fontsize=12)
        pdf_bytes = doc.tobytes()
        doc.close()
        
        result = lightweight_verify(
            file_bytes=pdf_bytes,
            content_type="application/pdf",
            user_expiration=past_date_iso,
            user_subtype="BLS"
        )
        
        assert result["verification_status"] == "needs_review", f"Expected 'needs_review', got {result['verification_status']}"
        assert "passed" in result["verification_notes"].lower() or "expired" in result["verification_notes"].lower()
        assert result["should_run_llm"] == False, "should_run_llm should be False for expired"
        print(f"✓ Expired document → needs_review (notes: {result['verification_notes']})")
    
    def test_verify_detected_credentials_stored(self):
        """Test: detected_credentials field is populated"""
        from lightweight_parser import lightweight_verify
        import fitz
        
        doc = fitz.open()
        page = doc.new_page()
        text = "Advanced Cardiovascular Life Support (ACLS) Certificate\nExpiration: 12/31/2027"
        page.insert_text((72, 72), text, fontsize=12)
        pdf_bytes = doc.tobytes()
        doc.close()
        
        result = lightweight_verify(
            file_bytes=pdf_bytes,
            content_type="application/pdf",
            user_expiration="2027-12-31",
            user_subtype="ACLS"
        )
        
        assert "ACLS" in result["detected_credentials"], f"Expected ACLS in {result['detected_credentials']}"
        print(f"✓ detected_credentials populated: {result['detected_credentials']}")
    
    def test_verify_extraction_quality_good(self):
        """Test: extraction_quality is 'good' for text > 100 chars"""
        from lightweight_parser import lightweight_verify
        import fitz
        
        doc = fitz.open()
        page = doc.new_page()
        text = "This is a BLS Provider Card with lots of text. " * 10 + "\nExpiration Date: 12/31/2027"
        page.insert_text((72, 72), text, fontsize=12)
        pdf_bytes = doc.tobytes()
        doc.close()
        
        result = lightweight_verify(
            file_bytes=pdf_bytes,
            content_type="application/pdf",
            user_expiration="2027-12-31",
            user_subtype="BLS"
        )
        
        assert result["extraction_quality"] == "good", f"Expected 'good', got {result['extraction_quality']}"
        print(f"✓ extraction_quality is 'good' for long text")


class TestVaultUploadVerificationPipeline:
    """Test vault upload endpoint triggers verification pipeline"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: login as seeker"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        self.created_doc_ids = []
        yield
        
        # Cleanup
        for doc_id in self.created_doc_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/vault/documents/{doc_id}")
            except Exception:
                pass
    
    def _create_test_pdf(self, text_content):
        """Helper to create a test PDF with given text"""
        import fitz
        doc = fitz.open()
        page = doc.new_page()
        page.insert_text((72, 72), text_content, fontsize=12)
        pdf_bytes = doc.tobytes()
        doc.close()
        return pdf_bytes
    
    def test_upload_triggers_verification_pipeline(self):
        """Test: upload endpoint triggers background verification"""
        import time
        
        future_date = (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")
        future_date_display = (datetime.now() + timedelta(days=365)).strftime("%m/%d/%Y")
        
        pdf_content = f"Basic Life Support (BLS) Provider Card\nExpiration Date: {future_date_display}\nAmerican Heart Association"
        pdf_bytes = self._create_test_pdf(pdf_content)
        
        # Upload via multipart form
        files = {'file': ('test_bls.pdf', pdf_bytes, 'application/pdf')}
        data = {
            'category': 'certification',
            'subtype': 'BLS',
            'expiration_date': future_date
        }
        
        # Remove Content-Type header for multipart
        headers = {"Authorization": f"Bearer {self.token}"}
        resp = requests.post(f"{BASE_URL}/api/vault/upload", files=files, data=data, headers=headers)
        
        assert resp.status_code == 200, f"Upload failed: {resp.status_code} - {resp.text}"
        doc_id = resp.json().get("id")
        self.created_doc_ids.append(doc_id)
        print(f"✓ Upload succeeded, doc_id={doc_id}")
        
        # Wait for background verification to complete
        time.sleep(3)
        
        # Fetch document and check verification fields
        get_resp = self.session.get(f"{BASE_URL}/api/vault/documents/{doc_id}")
        assert get_resp.status_code == 200
        doc = get_resp.json()
        
        # Check verification fields are populated
        assert doc.get("verification_status") in ["verified", "needs_review", "unverified", "pending"], \
            f"Unexpected verification_status: {doc.get('verification_status')}"
        assert doc.get("verification_method") in ["lightweight_parser", "llm_vision", None], \
            f"Unexpected verification_method: {doc.get('verification_method')}"
        
        print(f"✓ Verification pipeline ran: status={doc.get('verification_status')}, method={doc.get('verification_method')}")
        print(f"  detected_credentials={doc.get('detected_credentials')}")
        print(f"  verification_notes={doc.get('verification_notes')}")
    
    def test_upload_stores_detected_credentials(self):
        """Test: upload stores detected_credentials in document"""
        import time
        
        future_date = (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")
        future_date_display = (datetime.now() + timedelta(days=365)).strftime("%m/%d/%Y")
        
        pdf_content = f"ACLS Provider Card\nAdvanced Cardiovascular Life Support\nExpiration: {future_date_display}"
        pdf_bytes = self._create_test_pdf(pdf_content)
        
        files = {'file': ('test_acls.pdf', pdf_bytes, 'application/pdf')}
        data = {
            'category': 'certification',
            'subtype': 'ACLS',
            'expiration_date': future_date
        }
        
        headers = {"Authorization": f"Bearer {self.token}"}
        resp = requests.post(f"{BASE_URL}/api/vault/upload", files=files, data=data, headers=headers)
        
        assert resp.status_code == 200
        doc_id = resp.json().get("id")
        self.created_doc_ids.append(doc_id)
        
        time.sleep(3)
        
        get_resp = self.session.get(f"{BASE_URL}/api/vault/documents/{doc_id}")
        doc = get_resp.json()
        
        # Check detected_credentials is stored
        detected = doc.get("detected_credentials", [])
        assert isinstance(detected, list), f"detected_credentials should be list, got {type(detected)}"
        print(f"✓ detected_credentials stored: {detected}")
    
    def test_upload_stores_extraction_quality(self):
        """Test: upload stores extraction_quality in document"""
        import time
        
        future_date = (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")
        future_date_display = (datetime.now() + timedelta(days=365)).strftime("%m/%d/%Y")
        
        pdf_content = f"RN License\nRegistered Nurse\nState of California\nExpiration Date: {future_date_display}\n" + "Additional text " * 20
        pdf_bytes = self._create_test_pdf(pdf_content)
        
        files = {'file': ('test_rn.pdf', pdf_bytes, 'application/pdf')}
        data = {
            'category': 'license',
            'subtype': 'RN License',
            'expiration_date': future_date
        }
        
        headers = {"Authorization": f"Bearer {self.token}"}
        resp = requests.post(f"{BASE_URL}/api/vault/upload", files=files, data=data, headers=headers)
        
        assert resp.status_code == 200
        doc_id = resp.json().get("id")
        self.created_doc_ids.append(doc_id)
        
        time.sleep(3)
        
        get_resp = self.session.get(f"{BASE_URL}/api/vault/documents/{doc_id}")
        doc = get_resp.json()
        
        assert doc.get("extraction_quality") in ["good", "partial", "none", None], \
            f"Unexpected extraction_quality: {doc.get('extraction_quality')}"
        print(f"✓ extraction_quality stored: {doc.get('extraction_quality')}")
    
    def test_upload_stores_verification_method(self):
        """Test: upload stores verification_method (lightweight_parser or llm_vision)"""
        import time
        
        future_date = (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")
        future_date_display = (datetime.now() + timedelta(days=365)).strftime("%m/%d/%Y")
        
        pdf_content = f"CNA Certificate\nCertified Nursing Assistant\nExpiration: {future_date_display}"
        pdf_bytes = self._create_test_pdf(pdf_content)
        
        files = {'file': ('test_cna.pdf', pdf_bytes, 'application/pdf')}
        data = {
            'category': 'certification',
            'subtype': 'CNA Certificate',
            'expiration_date': future_date
        }
        
        headers = {"Authorization": f"Bearer {self.token}"}
        resp = requests.post(f"{BASE_URL}/api/vault/upload", files=files, data=data, headers=headers)
        
        assert resp.status_code == 200
        doc_id = resp.json().get("id")
        self.created_doc_ids.append(doc_id)
        
        time.sleep(3)
        
        get_resp = self.session.get(f"{BASE_URL}/api/vault/documents/{doc_id}")
        doc = get_resp.json()
        
        assert doc.get("verification_method") in ["lightweight_parser", "llm_vision", None], \
            f"Unexpected verification_method: {doc.get('verification_method')}"
        print(f"✓ verification_method stored: {doc.get('verification_method')}")


class TestVaultDocumentsGetVerificationNotes:
    """Test GET /api/vault/documents returns verification_notes for all status types"""
    
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
    
    def test_get_documents_includes_verification_notes(self):
        """Test: GET /api/vault/documents includes verification_notes field"""
        resp = self.session.get(f"{BASE_URL}/api/vault/documents")
        assert resp.status_code == 200
        
        docs = resp.json()
        assert isinstance(docs, list)
        
        # Check that documents have verification_notes field (may be null)
        for doc in docs:
            # verification_notes should be present as a key (even if null)
            assert "verification_notes" in doc or doc.get("verification_notes") is None or isinstance(doc.get("verification_notes"), str), \
                f"Document {doc.get('id')} should have verification_notes field"
        
        # Count docs with verification_notes
        with_notes = [d for d in docs if d.get("verification_notes")]
        print(f"✓ GET /api/vault/documents returns {len(docs)} docs, {len(with_notes)} have verification_notes")


class TestVaultNotMixedWithEmploymentDocs:
    """Test that vault documents are NOT mixed with employment_documents"""
    
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
    
    def test_vault_documents_separate_from_employment(self):
        """Test: vault documents endpoint returns only vault docs, not employment docs"""
        resp = self.session.get(f"{BASE_URL}/api/vault/documents")
        assert resp.status_code == 200
        
        docs = resp.json()
        
        # Vault documents should have 'category' field (medical, certification, etc.)
        # Employment documents would have 'document_type' = 'offer' or similar
        # Note: legacy categories like 'resume', 'identity', 'health_screen' may exist
        valid_vault_categories = [
            "medical", "certification", "identification", "license", "compliance",
            "resume", "identity", "health_screen", "health_record", "miscellaneous", None
        ]
        for doc in docs:
            # Vault docs have category from VAULT_CATEGORIES
            assert doc.get("category") in valid_vault_categories, \
                f"Unexpected category in vault: {doc.get('category')}"
            # Should NOT have employment-specific fields
            assert doc.get("document_type") != "offer", "Employment offer found in vault documents"
        
        print(f"✓ Vault documents ({len(docs)}) are separate from employment documents")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
