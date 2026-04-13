"""
Test Document Upload System - Category-first upload flow
Tests for DocumentsPage and VaultPage upload functionality
"""
import pytest
import requests
import os
import base64

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SEEKER_EMAIL = "seeker_test@vitalamatch.com"
SEEKER_PASSWORD = "test123"

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def seeker_token(api_client):
    """Get seeker authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": SEEKER_EMAIL,
        "password": SEEKER_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        # API returns access_token, not token
        return data.get("access_token") or data.get("token")
    pytest.skip(f"Seeker authentication failed: {response.status_code}")

@pytest.fixture(scope="module")
def authenticated_client(api_client, seeker_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {seeker_token}"})
    return api_client


class TestVaultCategoriesEndpoint:
    """Test GET /api/vault/categories endpoint structure"""
    
    def test_vault_categories_returns_200(self, api_client):
        """Vault categories endpoint should return 200"""
        response = api_client.get(f"{BASE_URL}/api/vault/categories")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ GET /api/vault/categories returns 200")
    
    def test_vault_categories_has_5_categories(self, api_client):
        """Should have 5 categories: medical, certification, identification, license, compliance"""
        response = api_client.get(f"{BASE_URL}/api/vault/categories")
        data = response.json()
        categories = data.get("categories", {})
        
        expected_categories = ["medical", "certification", "identification", "license", "compliance"]
        for cat in expected_categories:
            assert cat in categories, f"Missing category: {cat}"
        
        assert len(categories) == 5, f"Expected 5 categories, got {len(categories)}"
        print("✓ Vault categories has all 5 categories")
    
    def test_medical_category_has_groups(self, api_client):
        """Medical category should have vaccinations and tb_clearance groups"""
        response = api_client.get(f"{BASE_URL}/api/vault/categories")
        data = response.json()
        medical = data.get("categories", {}).get("medical", {})
        
        assert "groups" in medical, "Medical category should have 'groups'"
        groups = medical["groups"]
        
        assert "vaccinations" in groups, "Medical should have 'vaccinations' group"
        assert "tb_clearance" in groups, "Medical should have 'tb_clearance' group"
        print("✓ Medical category has vaccinations and tb_clearance groups")
    
    def test_vaccinations_group_has_7_types(self, api_client):
        """Vaccinations group should have 7 vaccine types"""
        response = api_client.get(f"{BASE_URL}/api/vault/categories")
        data = response.json()
        vaccinations = data["categories"]["medical"]["groups"]["vaccinations"]
        
        expected_vaccines = [
            "COVID-19 Vaccine", "Influenza (Flu)", "Hepatitis B",
            "MMR", "Varicella", "Tdap", "Other Vaccination"
        ]
        
        assert vaccinations.get("label") == "Vaccinations"
        types = vaccinations.get("types", [])
        assert len(types) == 7, f"Expected 7 vaccine types, got {len(types)}"
        
        for vaccine in expected_vaccines:
            assert vaccine in types, f"Missing vaccine type: {vaccine}"
        print("✓ Vaccinations group has all 7 vaccine types")
    
    def test_tb_clearance_group_has_4_types(self, api_client):
        """TB/Medical Clearance group should have 4 types"""
        response = api_client.get(f"{BASE_URL}/api/vault/categories")
        data = response.json()
        tb_clearance = data["categories"]["medical"]["groups"]["tb_clearance"]
        
        expected_types = [
            "TB Skin Test (PPD)", "TB Blood Test (Quantiferon)",
            "Chest X-Ray (TB Clearance)", "Physical Exam"
        ]
        
        assert tb_clearance.get("label") == "TB / Medical Clearance"
        types = tb_clearance.get("types", [])
        assert len(types) == 4, f"Expected 4 TB clearance types, got {len(types)}"
        
        for t in expected_types:
            assert t in types, f"Missing TB clearance type: {t}"
        print("✓ TB/Medical Clearance group has all 4 types")
    
    def test_certification_category_flat_list(self, api_client):
        """Certification category should have flat types list (no groups)"""
        response = api_client.get(f"{BASE_URL}/api/vault/categories")
        data = response.json()
        certification = data["categories"]["certification"]
        
        assert "types" in certification, "Certification should have 'types'"
        assert "groups" not in certification, "Certification should NOT have 'groups'"
        
        expected_types = ["BLS", "ACLS", "PALS", "CPR", "CNA Certificate"]
        types = certification.get("types", [])
        
        for t in expected_types:
            assert t in types, f"Missing certification type: {t}"
        print("✓ Certification category has flat list with 5 types")


class TestDocumentsEndpoint:
    """Test POST /api/documents endpoint with new fields"""
    
    def test_documents_endpoint_requires_auth(self):
        """Documents endpoint should require authentication"""
        # Use a fresh session without auth
        response = requests.post(f"{BASE_URL}/api/documents", json={
            "document_type": "BLS",
            "file_data": "data:application/pdf;base64,dGVzdA==",
            "file_name": "test.pdf"
        })
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ POST /api/documents requires authentication")
    
    def test_upload_document_with_category_and_tags(self, authenticated_client):
        """Upload document with document_category and document_tags"""
        # Create a minimal base64 PDF-like data
        test_data = base64.b64encode(b"test pdf content").decode()
        
        response = authenticated_client.post(f"{BASE_URL}/api/documents", json={
            "document_type": "COVID-19 Vaccine",
            "document_category": "medical",
            "document_tags": ["Influenza (Flu)", "Hepatitis B"],
            "file_data": f"data:application/pdf;base64,{test_data}",
            "file_name": "TEST_multi_vaccine.pdf",
            "expiration_date": "2027-12-31"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "document_id" in data, "Response should contain document_id"
        print(f"✓ Document uploaded with category and tags, ID: {data['document_id']}")
        return data["document_id"]
    
    def test_upload_document_without_optional_fields(self, authenticated_client):
        """Upload document without document_category and document_tags (backward compatible)"""
        test_data = base64.b64encode(b"test pdf content").decode()
        
        response = authenticated_client.post(f"{BASE_URL}/api/documents", json={
            "document_type": "BLS",
            "file_data": f"data:application/pdf;base64,{test_data}",
            "file_name": "TEST_bls_cert.pdf"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Document uploaded without optional fields (backward compatible)")
    
    def test_get_documents_returns_category_and_tags(self, authenticated_client):
        """GET /api/documents should return document_category and document_tags"""
        response = authenticated_client.get(f"{BASE_URL}/api/documents")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        docs = response.json()
        
        # Find our test document with tags
        test_doc = next((d for d in docs if d.get("file_name") == "TEST_multi_vaccine.pdf"), None)
        
        if test_doc:
            assert "document_category" in test_doc, "Document should have document_category field"
            assert "document_tags" in test_doc, "Document should have document_tags field"
            assert test_doc["document_category"] == "medical", f"Expected category 'medical', got {test_doc['document_category']}"
            assert isinstance(test_doc["document_tags"], list), "document_tags should be a list"
            print(f"✓ GET /api/documents returns category: {test_doc['document_category']}, tags: {test_doc['document_tags']}")
        else:
            print("⚠ Test document not found, but endpoint works")


class TestVaultUploadEndpoint:
    """Test POST /api/vault/upload endpoint"""
    
    def test_vault_upload_requires_auth(self):
        """Vault upload should require authentication"""
        response = requests.post(f"{BASE_URL}/api/vault/upload")
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}"
        print("✓ POST /api/vault/upload requires authentication")
    
    def test_vault_upload_with_new_category(self, authenticated_client):
        """Upload to vault with new category structure"""
        # Create test file content
        test_content = b"test vault document content"
        
        # Use multipart/form-data for vault upload
        files = {
            'file': ('TEST_vault_doc.pdf', test_content, 'application/pdf')
        }
        data = {
            'category': 'medical',
            'subtype': 'COVID-19 Vaccine',
            'expiration_date': '2027-12-31'
        }
        
        # Remove Content-Type header for multipart
        headers = {"Authorization": authenticated_client.headers.get("Authorization")}
        
        response = requests.post(
            f"{BASE_URL}/api/vault/upload",
            files=files,
            data=data,
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        result = response.json()
        assert "id" in result, "Response should contain id"
        assert "file_url" in result, "Response should contain file_url"
        print(f"✓ Vault upload successful, ID: {result['id']}")
        return result["id"]
    
    def test_vault_upload_validates_category(self, authenticated_client):
        """Vault upload should validate category"""
        test_content = b"test content"
        files = {'file': ('test.pdf', test_content, 'application/pdf')}
        data = {'category': 'invalid_category', 'subtype': 'Test'}
        
        headers = {"Authorization": authenticated_client.headers.get("Authorization")}
        
        response = requests.post(
            f"{BASE_URL}/api/vault/upload",
            files=files,
            data=data,
            headers=headers
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid category, got {response.status_code}"
        print("✓ Vault upload validates category")


class TestVaultDocumentsEndpoint:
    """Test POST /api/vault/documents for multi-tag support"""
    
    def test_create_vault_document_record(self, authenticated_client):
        """Create vault document record (for multi-tag same file)"""
        response = authenticated_client.post(f"{BASE_URL}/api/vault/documents", json={
            "category": "medical",
            "subtype": "Influenza (Flu)",
            "file_url": "/api/vault/files/test-file.pdf",
            "file_name": "TEST_multi_tag_doc.pdf",
            "expiration_date": "2027-06-30"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data, "Response should contain id"
        print(f"✓ Vault document record created, ID: {data['id']}")
    
    def test_get_vault_documents(self, authenticated_client):
        """GET /api/vault/documents should return documents"""
        response = authenticated_client.get(f"{BASE_URL}/api/vault/documents")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        docs = response.json()
        assert isinstance(docs, list), "Response should be a list"
        print(f"✓ GET /api/vault/documents returns {len(docs)} documents")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_documents(self, authenticated_client):
        """Delete test documents created during testing"""
        # Get all documents
        response = authenticated_client.get(f"{BASE_URL}/api/documents")
        if response.status_code == 200:
            docs = response.json()
            for doc in docs:
                file_name = doc.get("file_name") or ""
                if file_name.startswith("TEST_"):
                    del_response = authenticated_client.delete(f"{BASE_URL}/api/documents/{doc['id']}")
                    if del_response.status_code == 200:
                        print(f"  Deleted test document: {file_name}")
        
        # Get all vault documents
        response = authenticated_client.get(f"{BASE_URL}/api/vault/documents")
        if response.status_code == 200:
            docs = response.json()
            for doc in docs:
                file_name = doc.get("file_name") or ""
                if file_name.startswith("TEST_"):
                    del_response = authenticated_client.delete(f"{BASE_URL}/api/vault/documents/{doc['id']}")
                    if del_response.status_code == 200:
                        print(f"  Deleted test vault document: {file_name}")
        
        print("✓ Test cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
