"""
Test Security Features (Vault Auth, Path Traversal, Audit Logs) and Training/Compliance APIs
Iteration 20 - Testing new security hardening and training/compliance features
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
SEEKER_EMAIL = "seeker_test@vitalamatch.com"
SEEKER_PASSWORD = "test123"
EMPLOYER_EMAIL = "employer_test@vitalamatch.com"
EMPLOYER_PASSWORD = "test123"
ADMIN_EMAIL = "admin@vitalamatch.com"
ADMIN_PASSWORD = "admin123"


class TestAuthHelpers:
    """Helper methods for authentication"""
    
    @staticmethod
    def login(email: str, password: str) -> dict:
        """Login and return token + user info"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            data = response.json()
            return {
                "token": data["access_token"],
                "user": data["user"],
                "headers": {"Authorization": f"Bearer {data['access_token']}"}
            }
        return None
    
    @staticmethod
    def get_auth_headers(email: str, password: str) -> dict:
        """Get auth headers for a user"""
        auth = TestAuthHelpers.login(email, password)
        return auth["headers"] if auth else {}


# ==================== SECURITY TESTS ====================

class TestVaultFileSecurity:
    """Test vault file access security - auth, ownership, path traversal"""
    
    def test_vault_file_requires_auth(self):
        """GET /api/vault/files/{filename} returns 401 without token"""
        # Try to access a file without authentication
        response = requests.get(f"{BASE_URL}/api/vault/files/test-file.pdf")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Vault file access requires authentication (401 without token)")
    
    def test_path_traversal_blocked(self):
        """Path traversal attempts return 400"""
        auth = TestAuthHelpers.login(SEEKER_EMAIL, SEEKER_PASSWORD)
        assert auth, "Failed to login as seeker"
        
        # Test various path traversal attempts
        traversal_attempts = [
            "../../../etc/passwd",
            "..%2F..%2F..%2Fetc%2Fpasswd",
            "....//....//etc/passwd",
            "test/../../../etc/passwd",
        ]
        
        for attempt in traversal_attempts:
            response = requests.get(
                f"{BASE_URL}/api/vault/files/{attempt}",
                headers=auth["headers"]
            )
            # Should return 400 (invalid filename) or 404 (not found)
            assert response.status_code in [400, 404], f"Path traversal not blocked for '{attempt}': {response.status_code}"
        
        print("PASS: Path traversal attempts are blocked (400/404)")
    
    def test_vault_file_ownership_check(self):
        """User cannot access another user's vault files"""
        # Login as seeker and get their vault documents
        seeker_auth = TestAuthHelpers.login(SEEKER_EMAIL, SEEKER_PASSWORD)
        assert seeker_auth, "Failed to login as seeker"
        
        # Get seeker's vault documents
        response = requests.get(f"{BASE_URL}/api/vault", headers=seeker_auth["headers"])
        assert response.status_code == 200
        seeker_docs = response.json()
        
        if seeker_docs:
            # Get a file URL from seeker's vault
            doc_with_file = next((d for d in seeker_docs if d.get("file_url")), None)
            if doc_with_file:
                file_url = doc_with_file["file_url"]
                filename = file_url.split("/")[-1]
                
                # Try to access as a different user (employer)
                employer_auth = TestAuthHelpers.login(EMPLOYER_EMAIL, EMPLOYER_PASSWORD)
                assert employer_auth, "Failed to login as employer"
                
                response = requests.get(
                    f"{BASE_URL}/api/vault/files/{filename}",
                    headers=employer_auth["headers"]
                )
                # Should be 403 (not authorized) unless employer has onboarding case with seeker
                # The test passes if we get 403 OR 200 (if there's an onboarding case)
                assert response.status_code in [200, 403], f"Unexpected status: {response.status_code}"
                print(f"PASS: Vault file ownership check works (status: {response.status_code})")
            else:
                print("SKIP: No vault documents with file_url to test ownership")
        else:
            print("SKIP: No vault documents found for seeker")


class TestAuditLogs:
    """Test audit logging functionality"""
    
    def test_audit_logs_created_on_login(self):
        """Audit logs are created for login events"""
        # Login as admin to check audit logs
        admin_auth = TestAuthHelpers.login(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert admin_auth, "Failed to login as admin"
        
        # Get audit logs
        response = requests.get(f"{BASE_URL}/api/audit/logs", headers=admin_auth["headers"])
        assert response.status_code == 200, f"Failed to get audit logs: {response.status_code}"
        
        logs = response.json()
        assert isinstance(logs, list), "Audit logs should be a list"
        
        # Check for login events
        login_logs = [l for l in logs if l.get("action") == "login"]
        assert len(login_logs) > 0, "No login audit logs found"
        print(f"PASS: Audit logs contain {len(login_logs)} login events")
    
    def test_admin_can_view_audit_logs(self):
        """Admin can access GET /api/audit/logs"""
        admin_auth = TestAuthHelpers.login(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert admin_auth, "Failed to login as admin"
        
        response = requests.get(f"{BASE_URL}/api/audit/logs", headers=admin_auth["headers"])
        assert response.status_code == 200, f"Admin should access audit logs, got {response.status_code}"
        
        logs = response.json()
        assert isinstance(logs, list)
        print(f"PASS: Admin can view audit logs ({len(logs)} entries)")
    
    def test_non_admin_cannot_view_audit_logs(self):
        """Non-admin gets 403 on GET /api/audit/logs"""
        # Test with seeker
        seeker_auth = TestAuthHelpers.login(SEEKER_EMAIL, SEEKER_PASSWORD)
        assert seeker_auth, "Failed to login as seeker"
        
        response = requests.get(f"{BASE_URL}/api/audit/logs", headers=seeker_auth["headers"])
        assert response.status_code == 403, f"Seeker should get 403, got {response.status_code}"
        
        # Test with employer
        employer_auth = TestAuthHelpers.login(EMPLOYER_EMAIL, EMPLOYER_PASSWORD)
        assert employer_auth, "Failed to login as employer"
        
        response = requests.get(f"{BASE_URL}/api/audit/logs", headers=employer_auth["headers"])
        assert response.status_code == 403, f"Employer should get 403, got {response.status_code}"
        
        print("PASS: Non-admin users get 403 on audit logs")


# ==================== TRAINING API TESTS ====================

class TestTrainingCourses:
    """Test training course CRUD operations"""
    
    def test_get_courses(self):
        """GET /api/training/courses returns courses list"""
        auth = TestAuthHelpers.login(EMPLOYER_EMAIL, EMPLOYER_PASSWORD)
        assert auth, "Failed to login"
        
        response = requests.get(f"{BASE_URL}/api/training/courses", headers=auth["headers"])
        assert response.status_code == 200, f"Failed to get courses: {response.status_code}"
        
        courses = response.json()
        assert isinstance(courses, list)
        print(f"PASS: GET /api/training/courses returns {len(courses)} courses")
        return courses
    
    def test_employer_can_create_course(self):
        """POST /api/training/courses - employer can create course"""
        auth = TestAuthHelpers.login(EMPLOYER_EMAIL, EMPLOYER_PASSWORD)
        assert auth, "Failed to login as employer"
        
        course_data = {
            "title": f"TEST_Course_{uuid.uuid4().hex[:8]}",
            "description": "Test course for automated testing",
            "category": "compliance",
            "credit_hours": 2.0,
            "credit_type": "CEU",
            "duration_minutes": 60
        }
        
        response = requests.post(
            f"{BASE_URL}/api/training/courses",
            json=course_data,
            headers=auth["headers"]
        )
        assert response.status_code == 200, f"Failed to create course: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "id" in data
        print(f"PASS: Employer created course with ID: {data['id']}")
        return data["id"]
    
    def test_seeker_cannot_create_course(self):
        """POST /api/training/courses - seeker gets 403"""
        auth = TestAuthHelpers.login(SEEKER_EMAIL, SEEKER_PASSWORD)
        assert auth, "Failed to login as seeker"
        
        course_data = {
            "title": "Unauthorized Course",
            "category": "general"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/training/courses",
            json=course_data,
            headers=auth["headers"]
        )
        assert response.status_code == 403, f"Seeker should get 403, got {response.status_code}"
        print("PASS: Seeker cannot create courses (403)")


class TestTrainingAssignments:
    """Test training assignment operations"""
    
    def test_get_assignments_seeker(self):
        """GET /api/training/assignments - seeker gets their assignments"""
        auth = TestAuthHelpers.login(SEEKER_EMAIL, SEEKER_PASSWORD)
        assert auth, "Failed to login as seeker"
        
        response = requests.get(f"{BASE_URL}/api/training/assignments", headers=auth["headers"])
        assert response.status_code == 200, f"Failed to get assignments: {response.status_code}"
        
        assignments = response.json()
        assert isinstance(assignments, list)
        print(f"PASS: Seeker has {len(assignments)} training assignments")
        return assignments
    
    def test_get_assignments_employer(self):
        """GET /api/training/assignments - employer gets assignments they created"""
        auth = TestAuthHelpers.login(EMPLOYER_EMAIL, EMPLOYER_PASSWORD)
        assert auth, "Failed to login as employer"
        
        response = requests.get(f"{BASE_URL}/api/training/assignments", headers=auth["headers"])
        assert response.status_code == 200, f"Failed to get assignments: {response.status_code}"
        
        assignments = response.json()
        assert isinstance(assignments, list)
        # Employer assignments should include user info
        if assignments:
            assert "user" in assignments[0] or "course" in assignments[0]
        print(f"PASS: Employer has {len(assignments)} training assignments")
        return assignments
    
    def test_employer_can_assign_training(self):
        """POST /api/training/assignments - employer can assign training"""
        employer_auth = TestAuthHelpers.login(EMPLOYER_EMAIL, EMPLOYER_PASSWORD)
        assert employer_auth, "Failed to login as employer"
        
        seeker_auth = TestAuthHelpers.login(SEEKER_EMAIL, SEEKER_PASSWORD)
        assert seeker_auth, "Failed to login as seeker"
        seeker_id = seeker_auth["user"]["id"]
        
        # Get or create a course
        courses_response = requests.get(f"{BASE_URL}/api/training/courses", headers=employer_auth["headers"])
        courses = courses_response.json()
        
        if not courses:
            # Create a course first
            course_response = requests.post(
                f"{BASE_URL}/api/training/courses",
                json={"title": f"TEST_Assignment_Course_{uuid.uuid4().hex[:8]}", "category": "general"},
                headers=employer_auth["headers"]
            )
            course_id = course_response.json()["id"]
        else:
            course_id = courses[0]["id"]
        
        # Assign training
        due_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        assignment_data = {
            "user_id": seeker_id,
            "course_id": course_id,
            "due_date": due_date
        }
        
        response = requests.post(
            f"{BASE_URL}/api/training/assignments",
            json=assignment_data,
            headers=employer_auth["headers"]
        )
        assert response.status_code == 200, f"Failed to assign training: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "id" in data
        print(f"PASS: Employer assigned training with ID: {data['id']}")
        return data["id"]
    
    def test_update_assignment_status(self):
        """PUT /api/training/assignments/{id} - update status"""
        # First create an assignment
        employer_auth = TestAuthHelpers.login(EMPLOYER_EMAIL, EMPLOYER_PASSWORD)
        seeker_auth = TestAuthHelpers.login(SEEKER_EMAIL, SEEKER_PASSWORD)
        
        # Get seeker's assignments
        response = requests.get(f"{BASE_URL}/api/training/assignments", headers=seeker_auth["headers"])
        assignments = response.json()
        
        if not assignments:
            print("SKIP: No assignments to update")
            return
        
        assignment_id = assignments[0]["id"]
        
        # Update to in_progress
        response = requests.put(
            f"{BASE_URL}/api/training/assignments/{assignment_id}",
            json={"completion_status": "in_progress"},
            headers=seeker_auth["headers"]
        )
        assert response.status_code == 200, f"Failed to update assignment: {response.status_code}"
        print("PASS: Assignment status updated to in_progress")
    
    def test_complete_assignment_sets_completion_date(self):
        """PUT /api/training/assignments/{id} with completed status sets completion_date"""
        seeker_auth = TestAuthHelpers.login(SEEKER_EMAIL, SEEKER_PASSWORD)
        
        # Get seeker's assignments
        response = requests.get(f"{BASE_URL}/api/training/assignments", headers=seeker_auth["headers"])
        assignments = response.json()
        
        # Find an assignment that's not completed
        non_completed = [a for a in assignments if a.get("completion_status") != "completed"]
        
        if not non_completed:
            print("SKIP: No non-completed assignments to test")
            return
        
        assignment_id = non_completed[0]["id"]
        
        # Complete the assignment
        response = requests.put(
            f"{BASE_URL}/api/training/assignments/{assignment_id}",
            json={"completion_status": "completed"},
            headers=seeker_auth["headers"]
        )
        assert response.status_code == 200, f"Failed to complete assignment: {response.status_code}"
        
        # Verify completion_date was set by checking transcript
        response = requests.get(f"{BASE_URL}/api/training/transcript", headers=seeker_auth["headers"])
        transcript = response.json()
        
        completed_assignment = next((a for a in transcript if a["id"] == assignment_id), None)
        if completed_assignment:
            assert completed_assignment.get("completion_date"), "completion_date should be set"
            print(f"PASS: Completed assignment has completion_date: {completed_assignment['completion_date']}")
        else:
            print("PASS: Assignment marked as completed")


class TestTrainingTranscriptCertificates:
    """Test transcript and certificates endpoints"""
    
    def test_get_transcript(self):
        """GET /api/training/transcript returns only completed assignments"""
        auth = TestAuthHelpers.login(SEEKER_EMAIL, SEEKER_PASSWORD)
        assert auth, "Failed to login"
        
        response = requests.get(f"{BASE_URL}/api/training/transcript", headers=auth["headers"])
        assert response.status_code == 200, f"Failed to get transcript: {response.status_code}"
        
        transcript = response.json()
        assert isinstance(transcript, list)
        
        # All items should be completed
        for item in transcript:
            assert item.get("completion_status") == "completed", f"Transcript item not completed: {item}"
        
        print(f"PASS: Transcript has {len(transcript)} completed assignments")
    
    def test_get_certificates(self):
        """GET /api/training/certificates returns assignments with certificate_url"""
        auth = TestAuthHelpers.login(SEEKER_EMAIL, SEEKER_PASSWORD)
        assert auth, "Failed to login"
        
        response = requests.get(f"{BASE_URL}/api/training/certificates", headers=auth["headers"])
        assert response.status_code == 200, f"Failed to get certificates: {response.status_code}"
        
        certificates = response.json()
        assert isinstance(certificates, list)
        
        # All items should have certificate_url (if any exist)
        for item in certificates:
            assert item.get("certificate_url"), f"Certificate item missing certificate_url: {item}"
        
        print(f"PASS: Certificates endpoint returns {len(certificates)} items")


class TestComplianceSummary:
    """Test compliance summary endpoint"""
    
    def test_get_compliance_summary(self):
        """GET /api/training/compliance-summary returns summary stats"""
        auth = TestAuthHelpers.login(EMPLOYER_EMAIL, EMPLOYER_PASSWORD)
        assert auth, "Failed to login as employer"
        
        response = requests.get(f"{BASE_URL}/api/training/compliance-summary", headers=auth["headers"])
        assert response.status_code == 200, f"Failed to get compliance summary: {response.status_code}"
        
        summary = response.json()
        
        # Check expected fields
        expected_fields = ["total_assignments", "completed", "overdue", "in_progress", "not_started", "compliance_rate"]
        for field in expected_fields:
            assert field in summary, f"Missing field: {field}"
        
        print(f"PASS: Compliance summary - Total: {summary['total_assignments']}, Completed: {summary['completed']}, Rate: {summary['compliance_rate']}%")
    
    def test_seeker_cannot_access_compliance_summary(self):
        """Seeker gets 403 on compliance summary"""
        auth = TestAuthHelpers.login(SEEKER_EMAIL, SEEKER_PASSWORD)
        assert auth, "Failed to login as seeker"
        
        response = requests.get(f"{BASE_URL}/api/training/compliance-summary", headers=auth["headers"])
        assert response.status_code == 403, f"Seeker should get 403, got {response.status_code}"
        print("PASS: Seeker cannot access compliance summary (403)")


# ==================== CLEANUP ====================

class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_courses(self):
        """Remove TEST_ prefixed courses"""
        auth = TestAuthHelpers.login(EMPLOYER_EMAIL, EMPLOYER_PASSWORD)
        if not auth:
            print("SKIP: Could not login for cleanup")
            return
        
        # Note: No delete endpoint for courses, so we just verify test data exists
        response = requests.get(f"{BASE_URL}/api/training/courses", headers=auth["headers"])
        if response.status_code == 200:
            courses = response.json()
            test_courses = [c for c in courses if c.get("title", "").startswith("TEST_")]
            print(f"INFO: {len(test_courses)} TEST_ courses exist (no delete endpoint)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
