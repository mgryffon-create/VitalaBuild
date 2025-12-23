#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta
import uuid
import base64

class MedJobMatchAPITester:
    def __init__(self, base_url="https://medjobmatch.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.seeker_token = None
        self.poster_token = None
        self.seeker_user = None
        self.poster_user = None
        self.job_id = None
        self.match_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def make_request(self, method, endpoint, data=None, token=None, expected_status=None):
        """Make HTTP request with error handling"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                return False, f"Unsupported method: {method}"

            if expected_status and response.status_code != expected_status:
                return False, f"Expected {expected_status}, got {response.status_code}: {response.text}"
            
            return True, response.json() if response.content else {}

        except requests.exceptions.RequestException as e:
            return False, f"Request failed: {str(e)}"
        except json.JSONDecodeError:
            return False, f"Invalid JSON response: {response.text}"

    def test_api_health(self):
        """Test API root endpoint"""
        success, result = self.make_request('GET', '', expected_status=200)
        self.log_test("API Health Check", success, result if not success else "")
        return success

    def test_user_registration(self):
        """Test user registration for both seeker and poster"""
        timestamp = datetime.now().strftime("%H%M%S")
        
        # Test seeker registration
        seeker_data = {
            "email": f"seeker_{timestamp}@test.com",
            "password": "TestPass123!",
            "role": "seeker",
            "full_name": "Test Seeker"
        }
        
        success, result = self.make_request('POST', 'auth/register', seeker_data, expected_status=200)
        if success:
            self.seeker_token = result.get('access_token')
            self.seeker_user = result.get('user')
        self.log_test("Seeker Registration", success, result if not success else "")
        
        # Test poster registration
        poster_data = {
            "email": f"poster_{timestamp}@test.com",
            "password": "TestPass123!",
            "role": "poster",
            "full_name": "Test Hospital"
        }
        
        success, result = self.make_request('POST', 'auth/register', poster_data, expected_status=200)
        if success:
            self.poster_token = result.get('access_token')
            self.poster_user = result.get('user')
        self.log_test("Poster Registration", success, result if not success else "")
        
        return self.seeker_token and self.poster_token

    def test_user_login(self):
        """Test user login"""
        if not self.seeker_user:
            self.log_test("Seeker Login", False, "No seeker user to test login")
            return False
            
        login_data = {
            "email": self.seeker_user['email'],
            "password": "TestPass123!"
        }
        
        success, result = self.make_request('POST', 'auth/login', login_data, expected_status=200)
        self.log_test("User Login", success, result if not success else "")
        return success

    def test_get_user_profile(self):
        """Test getting current user profile"""
        success, result = self.make_request('GET', 'auth/me', token=self.seeker_token, expected_status=200)
        self.log_test("Get User Profile", success, result if not success else "")
        return success

    def test_seeker_profile_creation(self):
        """Test seeker profile creation and update"""
        profile_data = {
            "contact_info": {
                "email": "seeker@test.com",
                "phone": "(555) 123-4567",
                "address": "123 Main St, Test City, TS 12345"
            },
            "specialty": "Registered Nurse (RN)",
            "years_experience": 5,
            "bio": "Experienced RN with ICU background",
            "certifications": [
                {"name": "BLS", "expiration": "2025-12-31"},
                {"name": "ACLS", "expiration": "2025-06-30"}
            ],
            "licenses": [
                {"name": "RN License", "state": "CA", "expiration": "2025-12-31"}
            ],
            "expected_pay": {"min": 35, "max": 50},
            "desired_benefits": ["Health Insurance", "401(k)", "Paid Time Off"],
            "preferred_locations": ["Los Angeles, CA", "San Francisco, CA"]
        }
        
        success, result = self.make_request('PUT', 'profile/seeker', profile_data, token=self.seeker_token, expected_status=200)
        self.log_test("Seeker Profile Update", success, result if not success else "")
        
        # Test getting the profile
        success, result = self.make_request('GET', 'profile/seeker', token=self.seeker_token, expected_status=200)
        self.log_test("Get Seeker Profile", success, result if not success else "")
        
        return success

    def test_poster_profile_creation(self):
        """Test poster profile creation and update"""
        profile_data = {
            "company_name": "Test Medical Center",
            "company_description": "Leading healthcare facility providing excellent patient care",
            "contact_info": {
                "email": "hr@testmedical.com",
                "phone": "(555) 987-6543",
                "address": "456 Hospital Ave, Test City, TS 12345"
            }
        }
        
        success, result = self.make_request('PUT', 'profile/poster', profile_data, token=self.poster_token, expected_status=200)
        self.log_test("Poster Profile Update", success, result if not success else "")
        
        # Test getting the profile
        success, result = self.make_request('GET', 'profile/poster', token=self.poster_token, expected_status=200)
        self.log_test("Get Poster Profile", success, result if not success else "")
        
        return success

    def test_job_creation(self):
        """Test job posting creation"""
        job_data = {
            "title": "ICU Registered Nurse",
            "description": "Seeking experienced RN for our ICU department. Must have critical care experience.",
            "location": "Los Angeles, CA",
            "duration": "13 weeks",
            "pay_range": {"min": 40, "max": 55},
            "benefits": ["Health Insurance", "Housing Stipend", "Travel Reimbursement"],
            "time_off_policy": "Flexible PTO policy with paid holidays",
            "requirements": ["2+ years ICU experience", "BLS/ACLS certification"],
            "certifications_required": ["BLS", "ACLS"],
            "experience_required": 2,
            "specialty": "Registered Nurse (RN)",
            "shift_type": "Day Shift (7a-7p)",
            "start_date": "2024-02-01"
        }
        
        success, result = self.make_request('POST', 'jobs', job_data, token=self.poster_token, expected_status=200)
        if success:
            self.job_id = result.get('id')
        self.log_test("Job Creation", success, result if not success else "")
        
        return success

    def test_job_management(self):
        """Test job listing, updating, and retrieval"""
        if not self.job_id:
            self.log_test("Job Management", False, "No job ID available")
            return False
            
        # Test getting jobs list
        success, result = self.make_request('GET', 'jobs', token=self.poster_token, expected_status=200)
        self.log_test("Get Jobs List", success, result if not success else "")
        
        # Test getting specific job
        success, result = self.make_request('GET', f'jobs/{self.job_id}', token=self.poster_token, expected_status=200)
        self.log_test("Get Specific Job", success, result if not success else "")
        
        return success

    def test_swipe_functionality(self):
        """Test swipe functionality for both seeker and poster"""
        # Test seeker getting swipeable jobs
        success, result = self.make_request('GET', 'swipe/jobs', token=self.seeker_token, expected_status=200)
        self.log_test("Get Swipeable Jobs", success, result if not success else "")
        
        if success and result and len(result) > 0:
            # Test seeker swiping right on a job
            swipe_data = {"target_id": result[0]['id'], "action": "like"}
            success, swipe_result = self.make_request('POST', 'swipe', swipe_data, token=self.seeker_token, expected_status=200)
            self.log_test("Seeker Swipe Right", success, swipe_result if not success else "")
            
            # Test poster getting swipeable seekers for the job
            success, result = self.make_request('GET', f'swipe/seekers?job_id={self.job_id}', token=self.poster_token, expected_status=200)
            self.log_test("Get Swipeable Seekers", success, result if not success else "")
            
            if success and result and len(result) > 0:
                # Test poster swiping right on seeker (should create match)
                swipe_data = {"target_id": result[0]['id'], "action": "like"}
                success, swipe_result = self.make_request('POST', f'swipe?job_id={self.job_id}', swipe_data, token=self.poster_token, expected_status=200)
                if success and swipe_result.get('matched'):
                    self.match_id = swipe_result.get('match_id')
                self.log_test("Poster Swipe Right (Match)", success, swipe_result if not success else "")
        
        return success

    def test_matches_and_messaging(self):
        """Test matches retrieval and messaging"""
        # Test getting matches for seeker
        success, result = self.make_request('GET', 'matches', token=self.seeker_token, expected_status=200)
        self.log_test("Get Seeker Matches", success, result if not success else "")
        
        # Test getting matches for poster
        success, result = self.make_request('GET', 'matches', token=self.poster_token, expected_status=200)
        self.log_test("Get Poster Matches", success, result if not success else "")
        
        if self.match_id:
            # Test sending message
            message_data = {"content": "Hello! I'm interested in this position."}
            success, result = self.make_request('POST', f'matches/{self.match_id}/messages', message_data, token=self.seeker_token, expected_status=200)
            self.log_test("Send Message", success, result if not success else "")
            
            # Test getting messages
            success, result = self.make_request('GET', f'matches/{self.match_id}/messages', token=self.poster_token, expected_status=200)
            self.log_test("Get Messages", success, result if not success else "")
        
        return success

    def test_reference_system(self):
        """Test reference request and submission system"""
        # Test requesting a reference
        ref_data = {
            "referee_email": "reference@test.com",
            "referee_name": "Dr. Test Reference",
            "relationship": "Former Supervisor",
            "message": "Please provide a reference for this candidate"
        }
        
        success, result = self.make_request('POST', 'references/request', ref_data, token=self.seeker_token, expected_status=200)
        ref_token = None
        if success:
            ref_token = result.get('submission_link', '').split('/')[-1]
        self.log_test("Request Reference", success, result if not success else "")
        
        # Test getting pending references
        success, result = self.make_request('GET', 'references/pending', token=self.seeker_token, expected_status=200)
        self.log_test("Get Pending References", success, result if not success else "")
        
        if ref_token:
            # Test getting reference request details (public endpoint)
            success, result = self.make_request('GET', f'references/submit/{ref_token}', expected_status=200)
            self.log_test("Get Reference Request Details", success, result if not success else "")
            
            # Test submitting reference (public endpoint)
            submission_data = {
                "token": ref_token,
                "rating": 5,
                "strengths": ["Excellent clinical skills", "Great team player"],
                "areas_for_improvement": "Could improve time management",
                "recommendation": "Highly recommend for any nursing position",
                "comments": "Outstanding nurse with great patient care skills",
                "would_work_again": True
            }
            
            success, result = self.make_request('POST', f'references/submit/{ref_token}', submission_data, expected_status=200)
            self.log_test("Submit Reference", success, result if not success else "")
        
        return success

    def test_document_management(self):
        """Test document upload and management"""
        # Create a simple test document (base64 encoded)
        test_content = "This is a test document content"
        encoded_content = base64.b64encode(test_content.encode()).decode()
        
        doc_data = {
            "document_type": "BLS Certification",
            "expiration_date": "2025-12-31",
            "file_data": encoded_content,
            "file_name": "bls_cert.pdf"
        }
        
        success, result = self.make_request('POST', 'documents', doc_data, token=self.seeker_token, expected_status=200)
        doc_id = result.get('document_id') if success else None
        self.log_test("Upload Document", success, result if not success else "")
        
        # Test getting documents list
        success, result = self.make_request('GET', 'documents', token=self.seeker_token, expected_status=200)
        self.log_test("Get Documents List", success, result if not success else "")
        
        # Test getting expiring documents
        success, result = self.make_request('GET', 'documents/expiring', token=self.seeker_token, expected_status=200)
        self.log_test("Get Expiring Documents", success, result if not success else "")
        
        if doc_id:
            # Test getting specific document
            success, result = self.make_request('GET', f'documents/{doc_id}', token=self.seeker_token, expected_status=200)
            self.log_test("Get Specific Document", success, result if not success else "")
        
        return success

    def test_notification_preferences(self):
        """Test notification preferences management"""
        # Test getting notification preferences
        success, result = self.make_request('GET', 'notifications/preferences', token=self.seeker_token, expected_status=200)
        self.log_test("Get Notification Preferences", success, result if not success else "")
        
        # Test updating notification preferences
        prefs_data = {
            "email_enabled": True,
            "sms_enabled": False,
            "phone_number": "(555) 123-4567",
            "frequency": "daily",
            "match_notifications": True,
            "message_notifications": True,
            "document_reminders": True
        }
        
        success, result = self.make_request('PUT', 'notifications/preferences', prefs_data, token=self.seeker_token, expected_status=200)
        self.log_test("Update Notification Preferences", success, result if not success else "")
        
        return success

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        # Test seeker stats
        success, result = self.make_request('GET', 'stats', token=self.seeker_token, expected_status=200)
        self.log_test("Get Seeker Stats", success, result if not success else "")
        
        # Test poster stats
        success, result = self.make_request('GET', 'stats', token=self.poster_token, expected_status=200)
        self.log_test("Get Poster Stats", success, result if not success else "")
        
        return success

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting MedJobMatch API Tests")
        print("=" * 50)
        
        # Core functionality tests
        if not self.test_api_health():
            print("❌ API is not accessible, stopping tests")
            return False
            
        if not self.test_user_registration():
            print("❌ User registration failed, stopping tests")
            return False
            
        # Authentication tests
        self.test_user_login()
        self.test_get_user_profile()
        
        # Profile tests
        self.test_seeker_profile_creation()
        self.test_poster_profile_creation()
        
        # Job management tests
        self.test_job_creation()
        self.test_job_management()
        
        # Core matching functionality
        self.test_swipe_functionality()
        self.test_matches_and_messaging()
        
        # Additional features
        self.test_reference_system()
        self.test_document_management()
        self.test_notification_preferences()
        self.test_dashboard_stats()
        
        # Print summary
        print("\n" + "=" * 50)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return False

def main():
    tester = MedJobMatchAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    results = {
        "timestamp": datetime.now().isoformat(),
        "total_tests": tester.tests_run,
        "passed_tests": tester.tests_passed,
        "success_rate": (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0,
        "test_details": tester.test_results
    }
    
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())