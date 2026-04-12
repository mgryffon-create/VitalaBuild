"""
Test suite for Portable Reference System and AI Resume Parser features.
Tests CRUD operations, verification flow, employer view, and resume parsing.
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SEEKER_EMAIL = "seeker_test@vitalamatch.com"
SEEKER_PASSWORD = "test123"
EMPLOYER_EMAIL = "employer_test@vitalamatch.com"
EMPLOYER_PASSWORD = "test123"
ADMIN_EMAIL = "admin@vitalamatch.com"
ADMIN_PASSWORD = "admin123"


# Module-level fixtures
@pytest.fixture(scope="module")
def seeker_auth():
    """Get seeker authentication token and user info"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SEEKER_EMAIL,
        "password": SEEKER_PASSWORD
    })
    assert response.status_code == 200, f"Seeker login failed: {response.text}"
    data = response.json()
    return {
        "token": data.get("access_token") or data.get("token"),
        "user": data.get("user")
    }


@pytest.fixture(scope="module")
def employer_auth():
    """Get employer authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": EMPLOYER_EMAIL,
        "password": EMPLOYER_PASSWORD
    })
    assert response.status_code == 200, f"Employer login failed: {response.text}"
    data = response.json()
    return {
        "token": data.get("access_token") or data.get("token"),
        "user": data.get("user")
    }


@pytest.fixture(scope="module")
def admin_auth():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    data = response.json()
    return {
        "token": data.get("access_token") or data.get("token"),
        "user": data.get("user")
    }


# Store test data across tests
class TestData:
    created_ref_id = None
    verification_token = None
    parse_id = None


class TestReferencesAPI:
    """Test Portable Reference System CRUD operations"""
    
    def test_01_get_references_empty_or_existing(self, seeker_auth):
        """GET /api/references returns candidate's references"""
        response = requests.get(
            f"{BASE_URL}/api/references",
            headers={"Authorization": f"Bearer {seeker_auth['token']}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} existing references")
    
    def test_02_create_reference(self, seeker_auth):
        """POST /api/references creates a reference with required fields"""
        payload = {
            "full_name": "TEST_John Smith",
            "relationship": "supervisor",
            "facility_name": "TEST Memorial Hospital",
            "email": "test_john_smith@example.com",
            "phone": "(555) 123-4567",
            "title": "Charge Nurse"
        }
        response = requests.post(
            f"{BASE_URL}/api/references",
            headers={"Authorization": f"Bearer {seeker_auth['token']}"},
            json=payload
        )
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert data.get("message") == "Reference added"
        TestData.created_ref_id = data["id"]
        print(f"Created reference with ID: {data['id']}")
    
    def test_03_get_references_includes_new(self, seeker_auth):
        """GET /api/references returns the newly created reference"""
        response = requests.get(
            f"{BASE_URL}/api/references",
            headers={"Authorization": f"Bearer {seeker_auth['token']}"}
        )
        assert response.status_code == 200
        data = response.json()
        ref_ids = [r["id"] for r in data]
        assert TestData.created_ref_id in ref_ids
        
        # Verify reference data
        ref = next(r for r in data if r["id"] == TestData.created_ref_id)
        assert ref["full_name"] == "TEST_John Smith"
        assert ref["relationship"] == "supervisor"
        assert ref["facility_name"] == "TEST Memorial Hospital"
        assert ref["email"] == "test_john_smith@example.com"
        assert ref["verification_status"] == "unverified"
        print(f"Reference verified: {ref['full_name']}")
    
    def test_04_update_reference(self, seeker_auth):
        """PUT /api/references/{id} updates reference fields"""
        payload = {
            "title": "Head Nurse",
            "phone": "(555) 999-8888"
        }
        response = requests.put(
            f"{BASE_URL}/api/references/{TestData.created_ref_id}",
            headers={"Authorization": f"Bearer {seeker_auth['token']}"},
            json=payload
        )
        assert response.status_code == 200
        assert response.json().get("message") == "Reference updated"
        
        # Verify update persisted
        get_response = requests.get(
            f"{BASE_URL}/api/references",
            headers={"Authorization": f"Bearer {seeker_auth['token']}"}
        )
        ref = next(r for r in get_response.json() if r["id"] == TestData.created_ref_id)
        assert ref["title"] == "Head Nurse"
        assert ref["phone"] == "(555) 999-8888"
        print("Reference updated successfully")
    
    def test_05_request_verification(self, seeker_auth):
        """POST /api/references/{id}/request-verification sets status to pending and generates token"""
        response = requests.post(
            f"{BASE_URL}/api/references/{TestData.created_ref_id}/request-verification",
            headers={"Authorization": f"Bearer {seeker_auth['token']}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data.get("message") == "Verification request sent"
        TestData.verification_token = data["token"]
        print(f"Verification token: {data['token'][:20]}...")
        
        # Verify status changed to pending
        get_response = requests.get(
            f"{BASE_URL}/api/references",
            headers={"Authorization": f"Bearer {seeker_auth['token']}"}
        )
        ref = next(r for r in get_response.json() if r["id"] == TestData.created_ref_id)
        assert ref["verification_status"] == "pending"
    
    def test_06_get_verification_details_public(self):
        """GET /api/references/verify/{token} returns verification details (public endpoint)"""
        response = requests.get(
            f"{BASE_URL}/api/references/verify/{TestData.verification_token}"
        )
        assert response.status_code == 200
        data = response.json()
        assert "reference_name" in data
        assert "candidate_name" in data
        assert "relationship" in data
        assert data["reference_name"] == "TEST_John Smith"
        print(f"Verification details: {data}")
    
    def test_07_submit_verification_public(self, seeker_auth):
        """POST /api/references/verify/{token} submits verification and marks as verified"""
        payload = {
            "confirms_identity": True,
            "confirms_relationship": True,
            "feedback": "Great colleague, highly recommend!",
            "rating": 5
        }
        response = requests.post(
            f"{BASE_URL}/api/references/verify/{TestData.verification_token}",
            json=payload
        )
        assert response.status_code == 200
        assert "Verification submitted" in response.json().get("message", "")
        
        # Verify status changed to verified
        get_response = requests.get(
            f"{BASE_URL}/api/references",
            headers={"Authorization": f"Bearer {seeker_auth['token']}"}
        )
        ref = next(r for r in get_response.json() if r["id"] == TestData.created_ref_id)
        assert ref["verification_status"] == "verified"
        assert ref["feedback"] == "Great colleague, highly recommend!"
        assert ref["rating"] == 5
        print("Reference verified successfully")
    
    def test_08_employer_view_candidate_references(self, employer_auth, seeker_auth):
        """GET /api/references/candidate/{id} for employer view (requires poster/admin role)"""
        candidate_id = seeker_auth["user"]["id"]
        response = requests.get(
            f"{BASE_URL}/api/references/candidate/{candidate_id}",
            headers={"Authorization": f"Bearer {employer_auth['token']}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should not include verification_token
        for ref in data:
            assert "verification_token" not in ref or ref.get("verification_token") is None
        print(f"Employer can view {len(data)} references for candidate")
    
    def test_09_admin_view_candidate_references(self, admin_auth, seeker_auth):
        """GET /api/references/candidate/{id} for admin view"""
        candidate_id = seeker_auth["user"]["id"]
        response = requests.get(
            f"{BASE_URL}/api/references/candidate/{candidate_id}",
            headers={"Authorization": f"Bearer {admin_auth['token']}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Admin can view {len(data)} references for candidate")
    
    def test_10_seeker_cannot_view_other_candidate_references(self, seeker_auth):
        """Seekers cannot access other candidates' references via /candidate/{id}"""
        # Use a fake candidate ID
        fake_candidate_id = "fake-candidate-id-12345"
        response = requests.get(
            f"{BASE_URL}/api/references/candidate/{fake_candidate_id}",
            headers={"Authorization": f"Bearer {seeker_auth['token']}"}
        )
        assert response.status_code == 403
        print("Seeker correctly denied access to other candidate's references")
    
    def test_11_get_reference_packet(self, employer_auth, seeker_auth):
        """GET /api/references/packet/{id} returns structured reference summary"""
        candidate_id = seeker_auth["user"]["id"]
        response = requests.get(
            f"{BASE_URL}/api/references/packet/{candidate_id}",
            headers={"Authorization": f"Bearer {employer_auth['token']}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "candidate_name" in data
        assert "total_references" in data
        assert "verified_count" in data
        assert "references" in data
        assert isinstance(data["references"], list)
        print(f"Reference packet: {data['total_references']} total, {data['verified_count']} verified")
    
    def test_12_delete_reference(self, seeker_auth):
        """DELETE /api/references/{id} removes reference"""
        response = requests.delete(
            f"{BASE_URL}/api/references/{TestData.created_ref_id}",
            headers={"Authorization": f"Bearer {seeker_auth['token']}"}
        )
        assert response.status_code == 200
        assert response.json().get("message") == "Reference deleted"
        
        # Verify deletion
        get_response = requests.get(
            f"{BASE_URL}/api/references",
            headers={"Authorization": f"Bearer {seeker_auth['token']}"}
        )
        ref_ids = [r["id"] for r in get_response.json()]
        assert TestData.created_ref_id not in ref_ids
        print("Reference deleted successfully")


class TestResumeParserAPI:
    """Test AI Resume Parser endpoints"""
    
    def test_01_parse_text_endpoint(self, seeker_auth):
        """POST /api/resume/parse/text accepts resume text and returns parsed structured JSON"""
        sample_resume = """
        JANE DOE, CNA
        123 Main Street, Austin, TX 78701
        Phone: (512) 555-1234 | Email: jane.doe@email.com
        
        PROFESSIONAL SUMMARY
        Certified Nursing Assistant with 5+ years of experience in long-term care and acute settings.
        Skilled in patient care, vital signs monitoring, and electronic health records (Epic, Cerner).
        
        LICENSES & CERTIFICATIONS
        - CNA License #123456, Texas, Expires 12/2026
        - BLS Certification, American Heart Association, Expires 06/2025
        - CPR Certified
        
        WORK EXPERIENCE
        
        Travel CNA - Medical Staffing Solutions (Agency)
        January 2022 - Present
        - Multiple assignments across Texas facilities
        - Sunrise Senior Living, Austin, TX (3 months)
        - Memorial Hermann, Houston, TX (6 months)
        - Baylor Scott & White, Dallas, TX (4 months)
        
        CNA - Sunset Nursing Home
        June 2019 - December 2021
        - Provided daily care for 15+ residents
        - Monitored vital signs and documented in Epic
        - Assisted with ADLs, mobility, and feeding
        
        EDUCATION
        Certified Nursing Assistant Program
        Austin Community College, 2019
        
        SKILLS
        - Patient Care, ADLs, Vital Signs
        - Epic, Cerner EHR
        - Catheter Care, Trach Care
        - Spanish (Conversational)
        """
        
        response = requests.post(
            f"{BASE_URL}/api/resume/parse/text",
            headers={"Authorization": f"Bearer {seeker_auth['token']}"},
            json={"text": sample_resume}
        )
        assert response.status_code == 200, f"Parse failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "parsed_profile" in data
        assert "parse_id" in data
        TestData.parse_id = data["parse_id"]
        
        parsed = data["parsed_profile"]
        
        # Check for expected fields (may have error if LLM key not configured)
        if "error" not in parsed:
            print(f"Parsed profile keys: {list(parsed.keys())}")
            # Verify key fields are present
            assert "full_name" in parsed or "_parse_metadata" in parsed
            if "specialties" in parsed:
                print(f"Specialties: {parsed.get('specialties', [])}")
            if "licenses" in parsed:
                print(f"Licenses: {parsed.get('licenses', [])}")
            if "certifications" in parsed:
                print(f"Certifications: {parsed.get('certifications', [])}")
            if "employment_groups" in parsed:
                print(f"Employment groups: {len(parsed.get('employment_groups', []))}")
                # Check for travel contract grouping
                for group in parsed.get('employment_groups', []):
                    if group.get('group_type') == 'travel_contract_group':
                        print(f"Found travel contract group: {group.get('display_title', 'N/A')}")
            if "skills" in parsed:
                print(f"Skills: {parsed.get('skills', [])}")
        else:
            print(f"Parse returned error (expected if LLM key not configured): {parsed.get('error')}")
        
        print(f"Parse ID: {data['parse_id']}")
    
    def test_02_parse_text_too_short(self, seeker_auth):
        """POST /api/resume/parse/text rejects text that is too short"""
        response = requests.post(
            f"{BASE_URL}/api/resume/parse/text",
            headers={"Authorization": f"Bearer {seeker_auth['token']}"},
            json={"text": "Too short"}
        )
        assert response.status_code == 400
        assert "too short" in response.json().get("detail", "").lower()
        print("Short text correctly rejected")
    
    def test_03_get_parse_history(self, seeker_auth):
        """GET /api/resume/parses returns parse history"""
        response = requests.get(
            f"{BASE_URL}/api/resume/parses",
            headers={"Authorization": f"Bearer {seeker_auth['token']}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Should include our recent parse
        if TestData.parse_id:
            parse_ids = [p["id"] for p in data]
            assert TestData.parse_id in parse_ids
        
        print(f"Found {len(data)} parse records")
    
    def test_04_apply_to_profile(self, seeker_auth):
        """POST /api/resume/apply-to-profile/{parse_id} updates seeker profile from parsed data"""
        if not TestData.parse_id:
            pytest.skip("No parse_id available")
        
        response = requests.post(
            f"{BASE_URL}/api/resume/apply-to-profile/{TestData.parse_id}",
            headers={"Authorization": f"Bearer {seeker_auth['token']}"}
        )
        
        # May return 400 if parse had error, or 200 if successful
        if response.status_code == 200:
            data = response.json()
            assert "message" in data
            assert "fields_updated" in data
            print(f"Profile updated with fields: {data.get('fields_updated', [])}")
        elif response.status_code == 400:
            # Expected if parse had error
            print(f"Apply to profile returned 400 (expected if parse had error): {response.json()}")
        else:
            assert False, f"Unexpected status: {response.status_code} - {response.text}"
    
    def test_05_apply_to_profile_not_found(self, seeker_auth):
        """POST /api/resume/apply-to-profile/{parse_id} returns 404 for invalid parse_id"""
        response = requests.post(
            f"{BASE_URL}/api/resume/apply-to-profile/invalid-parse-id-12345",
            headers={"Authorization": f"Bearer {seeker_auth['token']}"}
        )
        assert response.status_code == 404
        print("Invalid parse_id correctly returns 404")


class TestResumeParserUpload:
    """Test resume file upload parsing"""
    
    def test_01_upload_txt_file(self, seeker_auth):
        """POST /api/resume/parse/upload accepts TXT file upload"""
        sample_resume = b"""
        JOHN DOE, RN
        Phone: (555) 123-4567
        Email: john.doe@email.com
        
        LICENSES
        - RN License #789012, California, Compact
        
        EXPERIENCE
        Staff Nurse - General Hospital
        2020 - Present
        """
        
        files = {
            "file": ("test_resume.txt", sample_resume, "text/plain")
        }
        response = requests.post(
            f"{BASE_URL}/api/resume/parse/upload",
            headers={"Authorization": f"Bearer {seeker_auth['token']}"},
            files=files
        )
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        
        assert "vault_document_id" in data
        assert "file_url" in data
        assert "parsed_profile" in data or "error" in data
        print(f"Uploaded and parsed TXT file, vault_document_id: {data.get('vault_document_id')}")
    
    def test_02_upload_invalid_file_type(self, seeker_auth):
        """POST /api/resume/parse/upload rejects invalid file types"""
        files = {
            "file": ("test.exe", b"invalid content", "application/octet-stream")
        }
        response = requests.post(
            f"{BASE_URL}/api/resume/parse/upload",
            headers={"Authorization": f"Bearer {seeker_auth['token']}"},
            files=files
        )
        assert response.status_code == 400
        assert "not allowed" in response.json().get("detail", "").lower()
        print("Invalid file type correctly rejected")


class TestReferencesEdgeCases:
    """Test edge cases and error handling for references"""
    
    def test_01_create_reference_missing_required_fields(self, seeker_auth):
        """POST /api/references fails without required fields"""
        # Missing relationship
        response = requests.post(
            f"{BASE_URL}/api/references",
            headers={"Authorization": f"Bearer {seeker_auth['token']}"},
            json={"full_name": "Test Person"}
        )
        assert response.status_code == 422  # Validation error
        print("Missing required field correctly rejected")
    
    def test_02_update_nonexistent_reference(self, seeker_auth):
        """PUT /api/references/{id} returns 404 for nonexistent reference"""
        response = requests.put(
            f"{BASE_URL}/api/references/nonexistent-ref-id",
            headers={"Authorization": f"Bearer {seeker_auth['token']}"},
            json={"title": "Updated Title"}
        )
        assert response.status_code == 404
        print("Update nonexistent reference correctly returns 404")
    
    def test_03_delete_nonexistent_reference(self, seeker_auth):
        """DELETE /api/references/{id} returns 404 for nonexistent reference"""
        response = requests.delete(
            f"{BASE_URL}/api/references/nonexistent-ref-id",
            headers={"Authorization": f"Bearer {seeker_auth['token']}"}
        )
        assert response.status_code == 404
        print("Delete nonexistent reference correctly returns 404")
    
    def test_04_request_verification_no_email(self, seeker_auth):
        """POST /api/references/{id}/request-verification fails if reference has no email"""
        # Create reference without email
        create_response = requests.post(
            f"{BASE_URL}/api/references",
            headers={"Authorization": f"Bearer {seeker_auth['token']}"},
            json={
                "full_name": "TEST_No Email Person",
                "relationship": "coworker"
            }
        )
        assert create_response.status_code == 200
        ref_id = create_response.json()["id"]
        
        # Try to request verification
        response = requests.post(
            f"{BASE_URL}/api/references/{ref_id}/request-verification",
            headers={"Authorization": f"Bearer {seeker_auth['token']}"}
        )
        assert response.status_code == 400
        assert "no email" in response.json().get("detail", "").lower()
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/references/{ref_id}",
            headers={"Authorization": f"Bearer {seeker_auth['token']}"}
        )
        print("Verification request without email correctly rejected")
    
    def test_05_verify_invalid_token(self):
        """GET /api/references/verify/{token} returns 404 for invalid token"""
        response = requests.get(
            f"{BASE_URL}/api/references/verify/invalid-token-12345"
        )
        assert response.status_code == 404
        print("Invalid verification token correctly returns 404")
    
    def test_06_submit_verification_invalid_token(self):
        """POST /api/references/verify/{token} returns 404 for invalid token"""
        response = requests.post(
            f"{BASE_URL}/api/references/verify/invalid-token-12345",
            json={"confirms_identity": True, "confirms_relationship": True}
        )
        assert response.status_code == 404
        print("Submit verification with invalid token correctly returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
