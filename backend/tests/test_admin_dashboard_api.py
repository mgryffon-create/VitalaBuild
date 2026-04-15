"""
Admin Dashboard API Tests
Tests for the internal admin dashboard with access control, stats, user management,
document review, jobs monitoring, onboarding monitoring, and system health.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "admin@vitalamatch.com"
ADMIN_PASSWORD = "admin123"


class TestAdminAuth:
    """Test admin authentication and access control"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        """Get headers with admin auth"""
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_admin_login_success(self):
        """Test admin can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        assert data["user"]["email"] == ADMIN_EMAIL
        print(f"✓ Admin login successful, role: {data['user']['role']}")


class TestAdminDashboardStats:
    """Test GET /api/admin/dashboard/stats endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.status_code}")
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_dashboard_stats_returns_all_fields(self, admin_headers):
        """Test dashboard stats returns all required stat fields"""
        response = requests.get(f"{BASE_URL}/api/admin/dashboard/stats", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify all required fields are present
        required_fields = [
            "total_users", "seekers", "employers", "active_jobs",
            "total_matches", "offers_sent", "offers_accepted",
            "onboarding_active", "docs_needs_review"
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
            assert isinstance(data[field], int), f"Field {field} should be int, got {type(data[field])}"
        
        print(f"✓ Dashboard stats: {data}")
    
    def test_non_admin_gets_403(self):
        """Test non-admin user gets 403 on admin endpoints"""
        # First register a test seeker
        test_email = f"test_nonadmin_{os.urandom(4).hex()}@test.com"
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "test123",
            "role": "seeker",
            "full_name": "Test Non-Admin"
        })
        
        if reg_response.status_code == 200:
            token = reg_response.json().get("access_token")
            headers = {"Authorization": f"Bearer {token}"}
            
            # Try to access admin endpoint
            response = requests.get(f"{BASE_URL}/api/admin/dashboard/stats", headers=headers)
            assert response.status_code == 403, f"Expected 403, got {response.status_code}"
            print(f"✓ Non-admin correctly gets 403 on admin endpoint")
        else:
            # User might already exist, try login
            login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": test_email,
                "password": "test123"
            })
            if login_response.status_code == 200:
                token = login_response.json().get("access_token")
                headers = {"Authorization": f"Bearer {token}"}
                response = requests.get(f"{BASE_URL}/api/admin/dashboard/stats", headers=headers)
                assert response.status_code == 403
                print(f"✓ Non-admin correctly gets 403 on admin endpoint")
            else:
                pytest.skip("Could not create or login test user")


class TestAdminUsersManagement:
    """Test admin user management endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed")
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_list_users_returns_users(self, admin_headers):
        """Test GET /api/admin/users returns users with required fields"""
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        users = response.json()
        assert isinstance(users, list)
        
        if len(users) > 0:
            user = users[0]
            # Check required fields
            assert "id" in user
            assert "email" in user
            assert "role" in user
            assert "full_name" in user
            
            # Check role-specific fields
            if user.get("role") == "seeker":
                assert "matches" in user
                assert "vault_docs" in user
            elif user.get("role") == "poster":
                assert "matches" in user
                assert "jobs_posted" in user
        
        print(f"✓ Listed {len(users)} users")
    
    def test_filter_users_by_role_seeker(self, admin_headers):
        """Test filtering users by role=seeker"""
        response = requests.get(f"{BASE_URL}/api/admin/users?role=seeker", headers=admin_headers)
        assert response.status_code == 200
        users = response.json()
        
        for user in users:
            assert user.get("role") == "seeker", f"Expected seeker, got {user.get('role')}"
        
        print(f"✓ Filtered to {len(users)} seekers")
    
    def test_filter_users_by_role_poster(self, admin_headers):
        """Test filtering users by role=poster"""
        response = requests.get(f"{BASE_URL}/api/admin/users?role=poster", headers=admin_headers)
        assert response.status_code == 200
        users = response.json()
        
        for user in users:
            assert user.get("role") == "poster", f"Expected poster, got {user.get('role')}"
        
        print(f"✓ Filtered to {len(users)} employers")
    
    def test_search_users_by_name(self, admin_headers):
        """Test searching users by name"""
        # First get all users to find a name to search
        all_users = requests.get(f"{BASE_URL}/api/admin/users", headers=admin_headers).json()
        
        if len(all_users) > 0:
            # Search for a partial name
            search_term = all_users[0].get("full_name", "")[:3]
            if search_term:
                response = requests.get(f"{BASE_URL}/api/admin/users?search={search_term}", headers=admin_headers)
                assert response.status_code == 200
                results = response.json()
                print(f"✓ Search for '{search_term}' returned {len(results)} users")
        else:
            print("✓ No users to search (empty database)")
    
    def test_deactivate_reactivate_user(self, admin_headers):
        """Test PUT /api/admin/users/{id}/status to deactivate/reactivate"""
        # Get a non-admin user to test with
        users = requests.get(f"{BASE_URL}/api/admin/users", headers=admin_headers).json()
        test_user = None
        for u in users:
            if u.get("role") != "admin":
                test_user = u
                break
        
        if not test_user:
            pytest.skip("No non-admin user to test deactivation")
        
        user_id = test_user["id"]
        original_status = test_user.get("is_active", True)
        
        # Deactivate
        response = requests.put(
            f"{BASE_URL}/api/admin/users/{user_id}/status",
            headers=admin_headers,
            json={"is_active": False}
        )
        assert response.status_code == 200, f"Deactivate failed: {response.text}"
        
        # Verify deactivation
        users_after = requests.get(f"{BASE_URL}/api/admin/users", headers=admin_headers).json()
        deactivated_user = next((u for u in users_after if u["id"] == user_id), None)
        assert deactivated_user is not None
        assert deactivated_user.get("is_active") == False
        
        # Reactivate
        response = requests.put(
            f"{BASE_URL}/api/admin/users/{user_id}/status",
            headers=admin_headers,
            json={"is_active": True}
        )
        assert response.status_code == 200
        
        print(f"✓ Successfully deactivated and reactivated user {user_id}")


class TestAdminDocumentsReview:
    """Test admin document review endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed")
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_get_review_queue(self, admin_headers):
        """Test GET /api/admin/documents/review returns review queue"""
        response = requests.get(f"{BASE_URL}/api/admin/documents/review", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        docs = response.json()
        assert isinstance(docs, list)
        
        if len(docs) > 0:
            doc = docs[0]
            # Check expected fields
            assert "id" in doc
            assert "user_name" in doc
            assert "user_email" in doc
            assert "verification_status" in doc
        
        print(f"✓ Review queue has {len(docs)} documents")
    
    def test_verify_document(self, admin_headers):
        """Test PUT /api/admin/documents/{id}/verify updates verification status"""
        # Get documents needing review
        docs = requests.get(f"{BASE_URL}/api/admin/documents/review", headers=admin_headers).json()
        
        if len(docs) == 0:
            print("✓ No documents to verify (empty queue)")
            return
        
        doc_id = docs[0]["id"]
        
        # Verify the document
        response = requests.put(
            f"{BASE_URL}/api/admin/documents/{doc_id}/verify",
            headers=admin_headers,
            json={"status": "verified", "notes": "Test verification"}
        )
        assert response.status_code == 200, f"Verify failed: {response.text}"
        
        print(f"✓ Successfully verified document {doc_id}")


class TestAdminJobsMonitoring:
    """Test admin jobs monitoring endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed")
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_list_jobs_with_stats(self, admin_headers):
        """Test GET /api/admin/jobs returns jobs with applicants, matches, hires counts"""
        response = requests.get(f"{BASE_URL}/api/admin/jobs", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        jobs = response.json()
        assert isinstance(jobs, list)
        
        if len(jobs) > 0:
            job = jobs[0]
            # Check required fields
            assert "id" in job
            assert "title" in job
            assert "employer_name" in job
            assert "applicants" in job
            assert "matches" in job
            assert "hires" in job
        
        print(f"✓ Listed {len(jobs)} jobs with stats")
    
    def test_toggle_job_status(self, admin_headers):
        """Test PUT /api/admin/jobs/{id}/status closes/activates job"""
        jobs = requests.get(f"{BASE_URL}/api/admin/jobs", headers=admin_headers).json()
        
        if len(jobs) == 0:
            print("✓ No jobs to toggle (empty)")
            return
        
        job_id = jobs[0]["id"]
        original_status = jobs[0].get("status", "active")
        
        # Close the job
        response = requests.put(
            f"{BASE_URL}/api/admin/jobs/{job_id}/status",
            headers=admin_headers,
            json={"status": "closed"}
        )
        assert response.status_code == 200, f"Close failed: {response.text}"
        
        # Reactivate
        response = requests.put(
            f"{BASE_URL}/api/admin/jobs/{job_id}/status",
            headers=admin_headers,
            json={"status": "active"}
        )
        assert response.status_code == 200
        
        print(f"✓ Successfully toggled job {job_id} status")


class TestAdminOnboardingMonitoring:
    """Test admin onboarding monitoring endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed")
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_list_onboarding_cases(self, admin_headers):
        """Test GET /api/admin/onboarding returns onboarding cases with progress"""
        response = requests.get(f"{BASE_URL}/api/admin/onboarding", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        cases = response.json()
        assert isinstance(cases, list)
        
        if len(cases) > 0:
            case = cases[0]
            # Check required fields
            assert "id" in case
            assert "candidate_name" in case
            assert "progress" in case
            assert "total_items" in case
            assert "completed_items" in case
        
        print(f"✓ Listed {len(cases)} onboarding cases")


class TestAdminSystemHealth:
    """Test admin system health endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed")
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_system_health_returns_all_fields(self, admin_headers):
        """Test GET /api/admin/system/health returns api, database, collections, recent_errors"""
        response = requests.get(f"{BASE_URL}/api/admin/system/health", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        health = response.json()
        
        # Check required fields
        assert "api" in health
        assert "database" in health
        assert "collections" in health
        assert "recent_errors" in health
        
        # Verify values
        assert health["api"] == "ok"
        assert health["database"] == "connected"
        assert isinstance(health["collections"], int)
        assert isinstance(health["recent_errors"], int)
        
        print(f"✓ System health: API={health['api']}, DB={health['database']}, Collections={health['collections']}, Errors={health['recent_errors']}")


class TestAdminAuditLogs:
    """Test admin audit logs endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed")
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_get_audit_logs(self, admin_headers):
        """Test GET /api/audit/logs returns audit trail"""
        response = requests.get(f"{BASE_URL}/api/audit/logs", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        logs = response.json()
        assert isinstance(logs, list)
        
        if len(logs) > 0:
            log = logs[0]
            # Check expected fields
            assert "action" in log or "timestamp" in log
        
        print(f"✓ Retrieved {len(logs)} audit logs")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
