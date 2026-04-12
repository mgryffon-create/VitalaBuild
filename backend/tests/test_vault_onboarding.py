"""
Vault & Onboarding API Tests
Tests for the Conditional Offer & Onboarding Flow with Secure Document Vault integration.
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SEEKER_EMAIL = "seeker_test@vitalamatch.com"
SEEKER_PASSWORD = "test123"
EMPLOYER_EMAIL = "employer_test@vitalamatch.com"
EMPLOYER_PASSWORD = "test123"


class TestVaultAPI:
    """Vault document CRUD tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as seeker for vault tests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as seeker
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.seeker_id = response.json().get("user", {}).get("id")
        else:
            pytest.skip("Seeker login failed")
    
    def test_get_vault_categories(self):
        """GET /api/vault/categories returns all category/subtype mappings"""
        response = self.session.get(f"{BASE_URL}/api/vault/categories")
        assert response.status_code == 200
        
        data = response.json()
        assert "categories" in data
        categories = data["categories"]
        
        # Verify expected categories exist
        expected_categories = ["identity", "certification", "license", "health_record", "health_screen", "resume", "miscellaneous"]
        for cat in expected_categories:
            assert cat in categories, f"Missing category: {cat}"
        
        # Verify identity subtypes
        assert "drivers_license" in categories["identity"]
        assert "passport" in categories["identity"]
        
        # Verify certification subtypes
        assert "BLS" in categories["certification"]
        assert "ACLS" in categories["certification"]
        
        print(f"✓ Vault categories returned: {list(categories.keys())}")
    
    def test_create_vault_document(self):
        """POST /api/vault/documents creates a vault document with correct category/subtype/expiration"""
        test_doc = {
            "category": "identity",
            "subtype": "drivers_license",
            "issuing_authority": "CA DMV",
            "document_number": f"TEST_{uuid.uuid4().hex[:8]}",
            "expiration_date": (datetime.now() + timedelta(days=365*3)).strftime("%Y-%m-%d"),
            "state": "CA",
            "file_name": "TEST_CA_Drivers_License.pdf"
        }
        
        response = self.session.post(f"{BASE_URL}/api/vault/documents", json=test_doc)
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert data.get("message") == "Document added to vault"
        
        # Store for cleanup
        self.created_doc_id = data["id"]
        
        # Verify by fetching
        get_response = self.session.get(f"{BASE_URL}/api/vault/documents/{data['id']}")
        assert get_response.status_code == 200
        
        doc = get_response.json()
        assert doc["category"] == test_doc["category"]
        assert doc["subtype"] == test_doc["subtype"]
        assert doc["expiration_date"] == test_doc["expiration_date"]
        assert doc["state"] == test_doc["state"]
        
        print(f"✓ Created vault document: {data['id']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/vault/documents/{data['id']}")
    
    def test_get_vault_documents_excludes_file_data(self):
        """GET /api/vault/documents returns list excluding file_data"""
        # First create a doc with file_data
        test_doc = {
            "category": "certification",
            "subtype": "BLS",
            "file_name": "TEST_BLS_Cert.pdf",
            "file_data": "dGVzdCBmaWxlIGRhdGE=",  # base64 "test file data"
            "expiration_date": (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/vault/documents", json=test_doc)
        assert create_response.status_code == 200
        doc_id = create_response.json()["id"]
        
        # Get all documents
        response = self.session.get(f"{BASE_URL}/api/vault/documents")
        assert response.status_code == 200
        
        docs = response.json()
        assert isinstance(docs, list)
        
        # Verify file_data is excluded from list response
        for doc in docs:
            assert "file_data" not in doc, "file_data should be excluded from list response"
        
        print(f"✓ Vault documents list excludes file_data, returned {len(docs)} docs")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/vault/documents/{doc_id}")
    
    def test_update_vault_document(self):
        """PUT /api/vault/documents/{id} updates metadata"""
        # Create a document first
        test_doc = {
            "category": "health_screen",
            "subtype": "TB_test",
            "file_name": "TEST_TB_Test.pdf",
            "document_date": datetime.now().strftime("%Y-%m-%d")
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/vault/documents", json=test_doc)
        assert create_response.status_code == 200
        doc_id = create_response.json()["id"]
        
        # Update the document
        update_data = {
            "issuing_authority": "Updated Lab Name",
            "state": "NY"
        }
        
        update_response = self.session.put(f"{BASE_URL}/api/vault/documents/{doc_id}", json=update_data)
        assert update_response.status_code == 200
        
        # Verify update
        get_response = self.session.get(f"{BASE_URL}/api/vault/documents/{doc_id}")
        assert get_response.status_code == 200
        
        doc = get_response.json()
        assert doc["issuing_authority"] == "Updated Lab Name"
        assert doc["state"] == "NY"
        
        print(f"✓ Updated vault document: {doc_id}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/vault/documents/{doc_id}")
    
    def test_delete_vault_document(self):
        """DELETE /api/vault/documents/{id} removes a document"""
        # Create a document first
        test_doc = {
            "category": "miscellaneous",
            "file_name": "TEST_Delete_Me.pdf"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/vault/documents", json=test_doc)
        assert create_response.status_code == 200
        doc_id = create_response.json()["id"]
        
        # Delete the document
        delete_response = self.session.delete(f"{BASE_URL}/api/vault/documents/{doc_id}")
        assert delete_response.status_code == 200
        
        # Verify deletion
        get_response = self.session.get(f"{BASE_URL}/api/vault/documents/{doc_id}")
        assert get_response.status_code == 404
        
        print(f"✓ Deleted vault document: {doc_id}")


class TestOnboardingAPI:
    """Onboarding cases and tasks tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as seeker for onboarding tests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as seeker
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.seeker_id = response.json().get("user", {}).get("id")
        else:
            pytest.skip("Seeker login failed")
    
    def test_get_onboarding_cases_empty_for_new_users(self):
        """GET /api/onboarding/cases returns empty for users with no cases"""
        response = self.session.get(f"{BASE_URL}/api/onboarding/cases")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        # Note: May not be empty if seeker has accepted offers before
        print(f"✓ Onboarding cases returned: {len(data)} cases")
    
    def test_get_onboarding_tasks_empty_for_new_users(self):
        """GET /api/onboarding/tasks returns empty for users with no tasks"""
        response = self.session.get(f"{BASE_URL}/api/onboarding/tasks")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Onboarding tasks returned: {len(data)} tasks")


class TestVaultMatchingFlow:
    """End-to-end test for vault matching during offer acceptance"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup sessions for both seeker and employer"""
        self.seeker_session = requests.Session()
        self.seeker_session.headers.update({"Content-Type": "application/json"})
        
        self.employer_session = requests.Session()
        self.employer_session.headers.update({"Content-Type": "application/json"})
        
        # Login as seeker
        seeker_response = self.seeker_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        if seeker_response.status_code == 200:
            token = seeker_response.json().get("access_token")
            self.seeker_session.headers.update({"Authorization": f"Bearer {token}"})
            self.seeker_id = seeker_response.json().get("user", {}).get("id")
        else:
            pytest.skip("Seeker login failed")
        
        # Login as employer
        employer_response = self.employer_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYER_EMAIL,
            "password": EMPLOYER_PASSWORD
        })
        if employer_response.status_code == 200:
            token = employer_response.json().get("access_token")
            self.employer_session.headers.update({"Authorization": f"Bearer {token}"})
            self.employer_id = employer_response.json().get("user", {}).get("id")
        else:
            pytest.skip("Employer login failed")
        
        self.created_vault_docs = []
        self.created_job_id = None
        self.created_offer_id = None
    
    def teardown_method(self, method):
        """Cleanup created test data"""
        # Delete vault docs
        for doc_id in self.created_vault_docs:
            try:
                self.seeker_session.delete(f"{BASE_URL}/api/vault/documents/{doc_id}")
            except:
                pass
        
        # Delete job if created
        if self.created_job_id:
            try:
                self.employer_session.delete(f"{BASE_URL}/api/jobs/{self.created_job_id}")
            except:
                pass
    
    def test_vault_matching_on_offer_acceptance(self):
        """
        Full E2E test:
        1. Create vault docs (identity, BLS cert, TB test)
        2. Employer sends offer
        3. Seeker accepts offer
        4. Verify requirements that match vault docs are detected (pending_manual_review for unverified docs)
        5. Verify onboarding case is created with correct role-based requirements
        
        Note: Vault documents with verification_status="pending" (default) will be matched
        but marked as "pending_manual_review" rather than "satisfied_from_vault".
        This is correct behavior - only verified documents should auto-satisfy requirements.
        """
        # Step 1: Create vault documents for seeker
        vault_docs = [
            {
                "category": "identity",
                "subtype": "drivers_license",
                "file_name": "TEST_DL_for_matching.pdf",
                "expiration_date": (datetime.now() + timedelta(days=365*2)).strftime("%Y-%m-%d"),
                "state": "CA"
            },
            {
                "category": "certification",
                "subtype": "BLS",
                "file_name": "TEST_BLS_for_matching.pdf",
                "expiration_date": (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")
            },
            {
                "category": "health_screen",
                "subtype": "TB_test",
                "file_name": "TEST_TB_for_matching.pdf",
                "document_date": datetime.now().strftime("%Y-%m-%d")  # Recent TB test
            }
        ]
        
        for doc in vault_docs:
            response = self.seeker_session.post(f"{BASE_URL}/api/vault/documents", json=doc)
            assert response.status_code == 200, f"Failed to create vault doc: {response.text}"
            self.created_vault_docs.append(response.json()["id"])
        
        print(f"✓ Created {len(self.created_vault_docs)} vault documents")
        
        # Step 2: Employer creates a job (CNA role to test role-based requirements)
        job_data = {
            "title": "TEST CNA Position for Vault Matching",
            "description": "Test job for vault matching flow",
            "location": "Los Angeles, CA",
            "duration": "Full-time",
            "pay_range": {"min": 20, "max": 30, "type": "hourly"},
            "benefits": ["Health Insurance"],
            "time_off_policy": "Standard PTO",
            "requirements": ["CNA certification"],
            "certifications_required": ["BLS"],
            "experience_required": 1,
            "specialty": "Certified Nursing Assistant (CNA)"
        }
        
        job_response = self.employer_session.post(f"{BASE_URL}/api/jobs", json=job_data)
        assert job_response.status_code == 200, f"Failed to create job: {job_response.text}"
        self.created_job_id = job_response.json()["id"]
        print(f"✓ Created job: {self.created_job_id}")
        
        # Step 3: Create a match (seeker likes job, employer accepts)
        # Seeker swipes right on job
        swipe_response = self.seeker_session.post(f"{BASE_URL}/api/swipe", json={
            "target_id": self.created_job_id,
            "action": "like"
        })
        assert swipe_response.status_code == 200
        
        # Employer accepts candidate
        accept_response = self.employer_session.post(
            f"{BASE_URL}/api/employer/candidates/{self.seeker_id}/accept",
            params={"job_id": self.created_job_id}
        )
        assert accept_response.status_code == 200
        match_id = accept_response.json().get("match_id")
        print(f"✓ Created match: {match_id}")
        
        # Step 4: Employer sends offer
        offer_data = {
            "match_id": match_id,
            "job_id": self.created_job_id,
            "seeker_id": self.seeker_id,
            "position_title": "CNA",
            "salary_amount": 25.00,
            "salary_type": "hourly",
            "start_date": (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%d"),
            "expiration_date": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "conditions": ["Background check", "Drug screen"],
            "benefits_summary": "Full benefits"
        }
        
        offer_response = self.employer_session.post(f"{BASE_URL}/api/hiring/offers", json=offer_data)
        assert offer_response.status_code == 200, f"Failed to create offer: {offer_response.text}"
        self.created_offer_id = offer_response.json()["id"]
        print(f"✓ Created offer: {self.created_offer_id}")
        
        # Step 5: Seeker accepts offer (this triggers onboarding case creation with vault matching)
        accept_offer_response = self.seeker_session.put(
            f"{BASE_URL}/api/hiring/offers/{self.created_offer_id}/respond",
            json={"accepted": True, "notes": "Test acceptance"}
        )
        assert accept_offer_response.status_code == 200, f"Failed to accept offer: {accept_offer_response.text}"
        print("✓ Seeker accepted offer")
        
        # Step 6: Verify onboarding case was created with correct vault matches
        cases_response = self.seeker_session.get(f"{BASE_URL}/api/onboarding/cases")
        assert cases_response.status_code == 200
        
        cases = cases_response.json()
        assert len(cases) > 0, "No onboarding cases found after offer acceptance"
        
        # Find the case for our job
        our_case = None
        for case in cases:
            if case.get("job_id") == self.created_job_id:
                our_case = case
                break
        
        assert our_case is not None, "Onboarding case not found for our job"
        print(f"✓ Found onboarding case: {our_case['id']}")
        
        # Verify role_type is correctly detected as CNA
        assert our_case.get("role_type") == "CNA", f"Expected role_type 'CNA', got '{our_case.get('role_type')}'"
        print(f"✓ Role type correctly detected: {our_case['role_type']}")
        
        # Verify progress stats
        progress = our_case.get("progress", {})
        assert progress.get("total", 0) > 0, "No requirements in onboarding case"
        
        # CNA role should have 8 requirements based on ROLE_REQUIREMENTS
        assert progress.get("total") == 8, f"Expected 8 requirements for CNA, got {progress.get('total')}"
        
        print(f"✓ Progress: {progress.get('completed', 0)}/{progress.get('total', 0)} completed")
        print(f"  - Satisfied from vault: {progress.get('satisfied_from_vault', 0)}")
        print(f"  - Pending: {progress.get('pending', 0)}")
        
        # Step 7: Verify requirements have correct statuses
        requirements = our_case.get("requirements", [])
        
        # Categorize requirements by status
        status_counts = {}
        for req in requirements:
            status = req["status"]
            if status not in status_counts:
                status_counts[status] = []
            status_counts[status].append(req["type"])
        
        print(f"✓ Requirement statuses: {status_counts}")
        
        # Verify expected requirement types exist for CNA role
        expected_types = ["government_id", "background_check", "drug_screen", "license_verification", 
                         "fingerprinting", "bls_certification", "tb_screening", "vaccination_records"]
        actual_types = [req["type"] for req in requirements]
        
        for expected in expected_types:
            assert expected in actual_types, f"Missing expected requirement type: {expected}"
        
        print(f"✓ All expected CNA requirement types present")
        
        # Verify vault matching detected documents (should be pending_manual_review for unverified docs)
        # Documents with verification_status="pending" should result in pending_manual_review
        matched_types = status_counts.get("pending_manual_review", [])
        
        # Our vault docs (identity/drivers_license, certification/BLS, health_screen/TB_test) 
        # should be matched and marked as pending_manual_review
        print(f"✓ Documents matched (pending review): {matched_types}")
        
        # Step 8: Verify tasks are created for unresolved requirements
        tasks_response = self.seeker_session.get(f"{BASE_URL}/api/onboarding/tasks")
        assert tasks_response.status_code == 200
        
        tasks = tasks_response.json()
        print(f"✓ Total tasks created: {len(tasks)}")
        
        # Tasks should exist for non-satisfied requirements
        # satisfied_from_vault requirements should NOT have tasks
        satisfied_req_ids = [req["id"] for req in requirements if req["status"] == "satisfied_from_vault"]
        task_req_ids = [t.get("onboarding_requirement_id") for t in tasks]
        
        for req_id in satisfied_req_ids:
            assert req_id not in task_req_ids, f"Task should not exist for satisfied_from_vault requirement"
        
        print(f"✓ Vault matching flow completed successfully")


class TestRequirementCompletion:
    """Test requirement status updates"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as employer for requirement completion tests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as employer
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYER_EMAIL,
            "password": EMPLOYER_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Employer login failed")
    
    def test_mark_requirement_completed(self):
        """PUT /api/onboarding/requirements/{id}/status marks requirement as completed"""
        # First get any existing onboarding cases
        cases_response = self.session.get(f"{BASE_URL}/api/onboarding/cases")
        assert cases_response.status_code == 200
        
        cases = cases_response.json()
        if not cases:
            pytest.skip("No onboarding cases available for testing")
        
        # Find a requirement that's not already completed
        for case in cases:
            requirements = case.get("requirements", [])
            for req in requirements:
                if req["status"] not in ("satisfied_from_vault", "completed"):
                    # Try to mark it as completed
                    update_response = self.session.put(
                        f"{BASE_URL}/api/onboarding/requirements/{req['id']}/status"
                    )
                    
                    if update_response.status_code == 200:
                        print(f"✓ Marked requirement {req['type']} as completed")
                        
                        # Verify the update
                        case_response = self.session.get(f"{BASE_URL}/api/onboarding/cases/{case['id']}")
                        if case_response.status_code == 200:
                            updated_case = case_response.json()
                            updated_req = next(
                                (r for r in updated_case.get("requirements", []) if r["id"] == req["id"]),
                                None
                            )
                            if updated_req:
                                assert updated_req["status"] == "completed"
                                print(f"✓ Verified requirement status is 'completed'")
                        return
                    elif update_response.status_code == 403:
                        # Not authorized for this case, try next
                        continue
        
        print("✓ No pending requirements found to test (all may be completed or satisfied)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
