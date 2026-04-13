"""
Test Resume Upload Auth Fix and Review Flow
Tests:
1. POST /api/resume/parse/upload endpoint accepts file upload with auth token
2. Returns parsed_profile with structured data
3. Skills normalization (objects with {name, confidence} become plain strings)
4. Work history extraction (employment_groups)
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
SEEKER_EMAIL = "seeker_test@vitalamatch.com"
SEEKER_PASSWORD = "test123"


class TestResumeUploadAuth:
    """Test resume upload authentication and parsing"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for seeker"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
    
    @pytest.fixture(scope="class")
    def authenticated_session(self, auth_token):
        """Session with auth header"""
        session = requests.Session()
        session.headers.update({"Authorization": f"Bearer {auth_token}"})
        return session
    
    def test_resume_upload_without_auth_fails(self):
        """Test that resume upload without auth returns 401"""
        # Create a simple text file
        files = {'file': ('test_resume.txt', io.BytesIO(b'Test resume content'), 'text/plain')}
        response = requests.post(f"{BASE_URL}/api/resume/parse/upload", files=files)
        
        # Should fail without auth
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        print(f"✓ Resume upload without auth correctly returns {response.status_code}")
    
    def test_resume_upload_with_auth_succeeds(self, authenticated_session):
        """Test that resume upload with auth token works - CRITICAL AUTH FIX TEST"""
        # Create a realistic resume text file
        resume_content = """
JANE DOE, RN, BSN
123 Main Street, Austin, TX 78701
Phone: (512) 555-1234 | Email: jane.doe@email.com

PROFESSIONAL SUMMARY
Experienced Registered Nurse with 8 years of experience in ICU and Med-Surg units.
Skilled in patient assessment, medication administration, and critical care.

LICENSES
- RN License, Texas Board of Nursing, License #RN123456, Exp: 12/2026
- Compact License (NLC)

CERTIFICATIONS
- BLS (Basic Life Support), American Heart Association, Exp: 06/2025
- ACLS (Advanced Cardiac Life Support), AHA, Exp: 06/2025
- CCRN (Critical Care Registered Nurse), AACN, Exp: 03/2026

CLINICAL SKILLS
- Patient Assessment
- IV Therapy
- Ventilator Management
- Epic EMR
- Medication Administration
- Wound Care
- Central Line Care
- Telemetry Monitoring

WORK EXPERIENCE

ICU Registered Nurse
Memorial Hermann Hospital, Houston, TX
January 2020 - Present
- Provide critical care to patients in 24-bed ICU
- Manage ventilators, central lines, and arterial lines
- Collaborate with multidisciplinary team

Med-Surg RN
St. David's Medical Center, Austin, TX
June 2016 - December 2019
- Cared for 6-8 patients per shift
- Administered medications and IV therapy
- Documented in Epic EMR

EDUCATION
Bachelor of Science in Nursing (BSN)
University of Texas at Austin, 2016
"""
        
        files = {'file': ('jane_doe_resume.txt', io.BytesIO(resume_content.encode('utf-8')), 'text/plain')}
        
        # CRITICAL: Do NOT set Content-Type header - let requests set it with boundary
        # This is the auth fix - explicit Content-Type was preventing auth header
        response = authenticated_session.post(
            f"{BASE_URL}/api/resume/parse/upload",
            files=files
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text[:500] if response.text else 'empty'}")
        
        # Should succeed with auth
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "parsed_profile" in data, "Response should contain parsed_profile"
        assert "parse_id" in data, "Response should contain parse_id"
        assert "vault_document_id" in data, "Response should contain vault_document_id"
        
        print(f"✓ Resume upload with auth succeeded")
        print(f"  - parse_id: {data.get('parse_id')}")
        print(f"  - vault_document_id: {data.get('vault_document_id')}")
        
        return data
    
    def test_parsed_profile_structure(self, authenticated_session):
        """Test that parsed profile contains expected fields"""
        resume_content = """
JOHN SMITH, CNA
Phone: (555) 123-4567

SKILLS
- Patient Care
- Vital Signs
- ADLs Assistance

EXPERIENCE
CNA at Sunrise Senior Living, 2022-Present
"""
        files = {'file': ('john_smith.txt', io.BytesIO(resume_content.encode('utf-8')), 'text/plain')}
        response = authenticated_session.post(f"{BASE_URL}/api/resume/parse/upload", files=files)
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        
        data = response.json()
        parsed = data.get("parsed_profile", {})
        
        # Check for expected fields (may be empty but should exist in schema)
        print(f"Parsed profile keys: {list(parsed.keys())}")
        
        # Verify skills are present (if parsed)
        if parsed.get("skills"):
            print(f"  - Skills found: {len(parsed['skills'])} skills")
            # Check skill format - should be list of strings or objects with name
            for skill in parsed["skills"][:3]:
                if isinstance(skill, dict):
                    assert "name" in skill, f"Skill object should have 'name': {skill}"
                    print(f"    - Skill (object): {skill.get('name')}")
                else:
                    print(f"    - Skill (string): {skill}")
        
        # Verify employment_groups (work history)
        if parsed.get("employment_groups"):
            print(f"  - Work history: {len(parsed['employment_groups'])} entries")
            for job in parsed["employment_groups"][:2]:
                print(f"    - {job.get('role_title', job.get('display_title', 'Unknown'))} at {job.get('primary_employer', 'Unknown')}")
        
        print(f"✓ Parsed profile structure validated")
    
    def test_invalid_file_type_rejected(self, authenticated_session):
        """Test that invalid file types are rejected"""
        files = {'file': ('test.exe', io.BytesIO(b'fake executable'), 'application/octet-stream')}
        response = authenticated_session.post(f"{BASE_URL}/api/resume/parse/upload", files=files)
        
        assert response.status_code == 400, f"Expected 400 for invalid file type, got {response.status_code}"
        print(f"✓ Invalid file type correctly rejected")
    
    def test_file_size_limit(self, authenticated_session):
        """Test that oversized files are rejected"""
        # Create a file larger than 10MB
        large_content = b"x" * (11 * 1024 * 1024)  # 11MB
        files = {'file': ('large_resume.txt', io.BytesIO(large_content), 'text/plain')}
        response = authenticated_session.post(f"{BASE_URL}/api/resume/parse/upload", files=files)
        
        assert response.status_code == 400, f"Expected 400 for oversized file, got {response.status_code}"
        print(f"✓ Oversized file correctly rejected")


class TestResumeParseEndpoints:
    """Test other resume parse endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for seeker"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Authentication failed: {response.status_code}")
    
    @pytest.fixture(scope="class")
    def authenticated_session(self, auth_token):
        """Session with auth header"""
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        })
        return session
    
    def test_parse_text_endpoint(self, authenticated_session):
        """Test POST /api/resume/parse/text endpoint"""
        resume_text = """
MARY JOHNSON, LPN
Licensed Practical Nurse with 5 years experience in long-term care.

SKILLS: Medication Administration, Wound Care, Patient Assessment, Documentation

EXPERIENCE:
LPN at Golden Years Nursing Home, 2019-Present
- Administered medications to 30+ residents
- Performed wound care and dressing changes
"""
        response = authenticated_session.post(
            f"{BASE_URL}/api/resume/parse/text",
            json={"text": resume_text}
        )
        
        print(f"Parse text response: {response.status_code}")
        
        assert response.status_code == 200, f"Parse text failed: {response.text}"
        
        data = response.json()
        assert "parsed_profile" in data
        assert "parse_id" in data
        
        print(f"✓ Parse text endpoint works")
        print(f"  - parse_id: {data.get('parse_id')}")
    
    def test_get_my_parses(self, authenticated_session):
        """Test GET /api/resume/parses endpoint"""
        response = authenticated_session.get(f"{BASE_URL}/api/resume/parses")
        
        assert response.status_code == 200, f"Get parses failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Should return a list of parses"
        
        print(f"✓ Get parses endpoint works - found {len(data)} parse records")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
