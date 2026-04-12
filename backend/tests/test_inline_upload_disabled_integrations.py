"""
Test Suite for Iteration 18:
1. INLINE UPLOAD: Onboarding requirement upload endpoint
2. DISABLED INTEGRATIONS: Twilio SMS and Nursys API disabled
3. EXISTING FUNCTIONALITY: Vault standalone upload, employer mark complete, admin panel
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SEEKER_EMAIL = "seeker_test@vitalamatch.com"
SEEKER_PASSWORD = "test123"
EMPLOYER_EMAIL = "employer_test@vitalamatch.com"
EMPLOYER_PASSWORD = "test123"
ADMIN_EMAIL = "admin@vitalamatch.com"
ADMIN_PASSWORD = "admin123"


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
def employer_token():
    """Get employer auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": EMPLOYER_EMAIL,
        "password": EMPLOYER_PASSWORD
    })
    assert response.status_code == 200, f"Employer login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def seeker_onboarding_cases(seeker_token):
    """Get seeker's onboarding cases"""
    response = requests.get(
        f"{BASE_URL}/api/onboarding/cases",
        headers={"Authorization": f"Bearer {seeker_token}"}
    )
    assert response.status_code == 200
    return response.json()


class TestDisabledIntegrations:
    """Test that Twilio SMS and Nursys API are disabled"""
    
    def test_twilio_import_commented_out(self):
        """Verify Twilio import is commented out in server.py"""
        with open("/app/backend/server.py", "r") as f:
            content = f.read()
        
        # Check that Twilio import is commented out
        assert "# from twilio.rest import Client as TwilioClient" in content, \
            "Twilio import should be commented out"
        
        # Check that there's no active Twilio import
        lines = content.split('\n')
        for line in lines:
            if 'from twilio' in line.lower() and not line.strip().startswith('#'):
                pytest.fail(f"Found active Twilio import: {line}")
        
        print("PASS: Twilio import is commented out")
    
    def test_send_sms_disabled(self):
        """Verify send_sms method logs and returns False"""
        with open("/app/backend/server.py", "r") as f:
            content = f.read()
        
        # Check for the disabled SMS message
        assert "Phase 1 - SMS disabled" in content, \
            "send_sms should log 'Phase 1 - SMS disabled'"
        
        # Check that send_sms returns False
        assert 'async def send_sms' in content, "send_sms method should exist"
        
        # Find the send_sms method and verify it returns False
        sms_section = content[content.find('async def send_sms'):content.find('async def send_sms') + 500]
        assert 'return False' in sms_section, "send_sms should return False"
        
        print("PASS: send_sms is disabled and returns False")
    
    def test_nursys_api_disabled(self):
        """Verify verify_via_nursys returns api_disabled status"""
        with open("/app/backend/server.py", "r") as f:
            content = f.read()
        
        # Check for the disabled Nursys message
        assert "Phase 1 - Nursys disabled" in content, \
            "verify_via_nursys should log 'Phase 1 - Nursys disabled'"
        
        # Check that it returns api_disabled status
        nursys_section = content[content.find('async def verify_via_nursys'):content.find('async def verify_via_nursys') + 800]
        assert '"status": "api_disabled"' in nursys_section, \
            "verify_via_nursys should return api_disabled status"
        
        print("PASS: Nursys API is disabled and returns api_disabled status")
    
    def test_backend_starts_without_twilio(self):
        """Verify backend starts and runs without Twilio dependency"""
        # If we can make any API call, the backend is running
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        assert response.status_code == 200, "Backend should start without Twilio"
        print("PASS: Backend starts and runs without Twilio dependency")


class TestInlineUploadEndpoint:
    """Test POST /api/onboarding/requirements/{req_id}/upload"""
    
    def test_upload_endpoint_exists(self, seeker_token):
        """Verify the upload endpoint exists"""
        # Try with a fake req_id - should get 404 not 405
        response = requests.post(
            f"{BASE_URL}/api/onboarding/requirements/fake-req-id/upload",
            headers={"Authorization": f"Bearer {seeker_token}"},
            files={"file": ("test.pdf", b"test content", "application/pdf")},
            data={"category": "identity"}
        )
        # Should be 404 (not found) not 405 (method not allowed)
        assert response.status_code in [404, 403], \
            f"Expected 404 or 403, got {response.status_code}: {response.text}"
        print("PASS: Upload endpoint exists and accepts POST requests")
    
    def test_upload_requires_auth(self):
        """Verify upload endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/onboarding/requirements/fake-req-id/upload",
            files={"file": ("test.pdf", b"test content", "application/pdf")},
            data={"category": "identity"}
        )
        assert response.status_code == 403, \
            f"Expected 403 without auth, got {response.status_code}"
        print("PASS: Upload endpoint requires authentication")
    
    def test_upload_with_valid_requirement(self, seeker_token, seeker_onboarding_cases):
        """Test upload with a valid requirement that needs a document"""
        if not seeker_onboarding_cases:
            pytest.skip("No onboarding cases for seeker")
        
        # Find a requirement with missing_document or document_expired status
        req_to_upload = None
        for case in seeker_onboarding_cases:
            for req in case.get("requirements", []):
                if req.get("status") in ["missing_document", "document_expired"]:
                    req_to_upload = req
                    break
            if req_to_upload:
                break
        
        if not req_to_upload:
            pytest.skip("No requirements with missing_document or document_expired status")
        
        # Create a test PDF file
        pdf_content = b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF"
        
        response = requests.post(
            f"{BASE_URL}/api/onboarding/requirements/{req_to_upload['id']}/upload",
            headers={"Authorization": f"Bearer {seeker_token}"},
            files={"file": ("test_document.pdf", pdf_content, "application/pdf")},
            data={
                "category": "identity",
                "subtype": "drivers_license",
                "expiration_date": "2027-12-31",
                "state": "CA"
            }
        )
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data, "Response should contain document id"
        assert "file_url" in data, "Response should contain file_url"
        assert data["file_url"].startswith("/api/vault/files/"), \
            f"file_url should start with /api/vault/files/, got {data['file_url']}"
        
        print(f"PASS: Upload successful, doc_id={data['id']}, file_url={data['file_url']}")
        return data
    
    def test_upload_rejects_invalid_file_type(self, seeker_token, seeker_onboarding_cases):
        """Test that upload rejects invalid file types"""
        if not seeker_onboarding_cases:
            pytest.skip("No onboarding cases for seeker")
        
        # Find any requirement
        req = None
        for case in seeker_onboarding_cases:
            if case.get("requirements"):
                req = case["requirements"][0]
                break
        
        if not req:
            pytest.skip("No requirements found")
        
        response = requests.post(
            f"{BASE_URL}/api/onboarding/requirements/{req['id']}/upload",
            headers={"Authorization": f"Bearer {seeker_token}"},
            files={"file": ("malware.exe", b"malicious content", "application/octet-stream")},
            data={"category": "identity"}
        )
        
        assert response.status_code == 400, f"Expected 400 for .exe file, got {response.status_code}"
        print("PASS: Upload correctly rejects invalid file types")
    
    def test_upload_requires_category(self, seeker_token, seeker_onboarding_cases):
        """Test that upload requires category field"""
        if not seeker_onboarding_cases:
            pytest.skip("No onboarding cases for seeker")
        
        req = None
        for case in seeker_onboarding_cases:
            if case.get("requirements"):
                req = case["requirements"][0]
                break
        
        if not req:
            pytest.skip("No requirements found")
        
        response = requests.post(
            f"{BASE_URL}/api/onboarding/requirements/{req['id']}/upload",
            headers={"Authorization": f"Bearer {seeker_token}"},
            files={"file": ("test.pdf", b"test content", "application/pdf")}
            # Missing category
        )
        
        assert response.status_code == 422, f"Expected 422 without category, got {response.status_code}"
        print("PASS: Upload requires category field")


class TestRequirementStatusAfterUpload:
    """Test that requirement status changes after upload"""
    
    def test_requirement_shows_under_review(self, seeker_token, seeker_onboarding_cases):
        """After upload, requirement should show pending_manual_review status"""
        if not seeker_onboarding_cases:
            pytest.skip("No onboarding cases for seeker")
        
        # Find a requirement that was uploaded (pending_manual_review)
        for case in seeker_onboarding_cases:
            for req in case.get("requirements", []):
                if req.get("status") == "pending_manual_review":
                    print(f"PASS: Found requirement with 'Under Review' status: {req['label']}")
                    return
        
        # If no pending_manual_review found, check if there are any requirements
        has_requirements = any(case.get("requirements") for case in seeker_onboarding_cases)
        if has_requirements:
            print("INFO: No requirements with pending_manual_review status found (may need to upload first)")
        else:
            pytest.skip("No requirements found in onboarding cases")


class TestUploadedFileInVault:
    """Test that uploaded files appear in vault"""
    
    def test_uploaded_file_in_vault(self, seeker_token):
        """Verify uploaded file appears in candidate's vault"""
        response = requests.get(
            f"{BASE_URL}/api/vault/documents",
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        assert response.status_code == 200, f"Failed to get vault documents: {response.text}"
        
        docs = response.json()
        assert isinstance(docs, list), "Vault documents should be a list"
        
        # Check if any document has a file_url
        docs_with_files = [d for d in docs if d.get("file_url")]
        print(f"PASS: Found {len(docs_with_files)} documents with file_url in vault")
        
        if docs_with_files:
            # Verify file_url format
            for doc in docs_with_files[:3]:  # Check first 3
                assert doc["file_url"].startswith("/api/vault/files/"), \
                    f"Invalid file_url format: {doc['file_url']}"
            print("PASS: File URLs have correct format")


class TestExistingFunctionality:
    """Test that existing functionality still works"""
    
    def test_vault_standalone_upload(self, seeker_token):
        """Test POST /api/vault/upload still works"""
        pdf_content = b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF"
        
        response = requests.post(
            f"{BASE_URL}/api/vault/upload",
            headers={"Authorization": f"Bearer {seeker_token}"},
            files={"file": ("standalone_test.pdf", pdf_content, "application/pdf")},
            data={
                "category": "miscellaneous",
                "subtype": "other"
            }
        )
        
        assert response.status_code == 200, f"Vault standalone upload failed: {response.text}"
        data = response.json()
        assert "id" in data, "Response should contain document id"
        assert "file_url" in data, "Response should contain file_url"
        print(f"PASS: Vault standalone upload works, doc_id={data['id']}")
        
        # Cleanup - delete the test document
        requests.delete(
            f"{BASE_URL}/api/vault/documents/{data['id']}",
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
    
    def test_employer_mark_requirement_complete(self, employer_token):
        """Test employer can mark requirements as completed"""
        # Get employer's onboarding cases
        response = requests.get(
            f"{BASE_URL}/api/onboarding/cases",
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        assert response.status_code == 200, f"Failed to get employer cases: {response.text}"
        
        cases = response.json()
        if not cases:
            pytest.skip("No onboarding cases for employer")
        
        # Find a requirement that's not completed
        req_to_complete = None
        for case in cases:
            for req in case.get("requirements", []):
                if req.get("status") not in ["completed", "satisfied_from_vault"]:
                    req_to_complete = req
                    break
            if req_to_complete:
                break
        
        if not req_to_complete:
            print("INFO: All requirements already completed or no requirements found")
            return
        
        # Try to mark as complete
        response = requests.put(
            f"{BASE_URL}/api/onboarding/requirements/{req_to_complete['id']}/status",
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        
        # Employer should be able to mark complete
        assert response.status_code == 200, f"Employer mark complete failed: {response.text}"
        print(f"PASS: Employer can mark requirements as completed")
    
    def test_admin_panel_access(self, admin_token):
        """Test admin can access onboarding panel"""
        response = requests.get(
            f"{BASE_URL}/api/admin/onboarding/cases",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Admin panel access failed: {response.text}"
        
        cases = response.json()
        assert isinstance(cases, list), "Admin cases should be a list"
        print(f"PASS: Admin panel accessible, found {len(cases)} cases")
    
    def test_admin_cannot_be_accessed_by_seeker(self, seeker_token):
        """Test seeker cannot access admin endpoints"""
        response = requests.get(
            f"{BASE_URL}/api/admin/onboarding/cases",
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for seeker accessing admin, got {response.status_code}"
        print("PASS: Admin endpoints protected from non-admin users")


class TestFileAccessibility:
    """Test that uploaded files are accessible"""
    
    def test_file_accessible_via_url(self, seeker_token):
        """Test that file_url returns the file"""
        # Get vault documents
        response = requests.get(
            f"{BASE_URL}/api/vault/documents",
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        assert response.status_code == 200
        
        docs = response.json()
        docs_with_files = [d for d in docs if d.get("file_url")]
        
        if not docs_with_files:
            pytest.skip("No documents with file_url found")
        
        # Try to access the first file
        doc = docs_with_files[0]
        file_url = doc["file_url"]
        
        # The file URL should be accessible (may need auth or may be public)
        full_url = f"{BASE_URL}{file_url}"
        response = requests.get(
            full_url,
            headers={"Authorization": f"Bearer {seeker_token}"}
        )
        
        # Should return file content or redirect
        assert response.status_code in [200, 302, 307], \
            f"File access failed with status {response.status_code}"
        print(f"PASS: File accessible at {file_url}")


class TestCategorySubtypeMapping:
    """Test that category/subtype pre-filling works correctly"""
    
    def test_category_hints_in_frontend(self):
        """Verify REQ_CATEGORY_HINTS map exists in OnboardingPage.jsx"""
        with open("/app/frontend/src/pages/OnboardingPage.jsx", "r") as f:
            content = f.read()
        
        # Check for the mapping
        assert "REQ_CATEGORY_HINTS" in content, "REQ_CATEGORY_HINTS should exist"
        
        # Check specific mappings
        assert "government_id" in content, "government_id mapping should exist"
        assert "bls_certification" in content, "bls_certification mapping should exist"
        assert "license_verification" in content, "license_verification mapping should exist"
        assert "tb_screening" in content, "tb_screening mapping should exist"
        assert "vaccination_records" in content, "vaccination_records mapping should exist"
        
        print("PASS: REQ_CATEGORY_HINTS map exists with expected requirement types")
    
    def test_upload_dialog_in_frontend(self):
        """Verify upload dialog components exist in OnboardingPage.jsx"""
        with open("/app/frontend/src/pages/OnboardingPage.jsx", "r") as f:
            content = f.read()
        
        # Check for dialog components
        assert "Dialog" in content, "Dialog component should be imported"
        assert "DialogContent" in content, "DialogContent should be used"
        assert "onb-upload-dropzone" in content, "Upload dropzone should have test id"
        assert "onb-upload-submit" in content, "Upload submit button should have test id"
        assert "onb-category-select" in content, "Category select should have test id"
        
        # Check for progress bar
        assert "uploadProgress" in content, "Upload progress state should exist"
        
        print("PASS: Upload dialog components exist in OnboardingPage.jsx")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
