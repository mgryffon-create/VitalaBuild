import requests
import sys
import json
from datetime import datetime

class MedJobMatchAPITester:
    def __init__(self, base_url="https://nursetinder.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
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

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                details += f", Expected: {expected_status}"
                try:
                    error_data = response.json()
                    details += f", Response: {error_data}"
                except:
                    details += f", Response: {response.text[:200]}"
            
            self.log_test(name, success, details)
            
            if success:
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                return False, {}

        except Exception as e:
            self.log_test(name, False, f"Error: {str(e)}")
            return False, {}

    def test_specialties_endpoint(self):
        """Test specialties endpoint returns nursing and allied health categories"""
        print("\n🔍 Testing Specialties Endpoint...")
        
        success, response = self.run_test(
            "Get specialties endpoint",
            "GET",
            "specialties",
            200
        )
        
        if success:
            # Check if response has nursing and allied_health categories
            has_nursing = 'nursing' in response and len(response['nursing']) > 0
            has_allied = 'allied_health' in response and len(response['allied_health']) > 0
            has_all = 'all' in response and len(response['all']) > 0
            
            self.log_test("Specialties has nursing category", has_nursing, 
                         f"Found {len(response.get('nursing', []))} nursing specialties")
            self.log_test("Specialties has allied health category", has_allied,
                         f"Found {len(response.get('allied_health', []))} allied health specialties")
            self.log_test("Specialties has combined 'all' list", has_all,
                         f"Found {len(response.get('all', []))} total specialties")
            
            # Check for specific nursing specialties
            nursing_specs = response.get('nursing', [])
            has_rn_icu = any('ICU' in spec for spec in nursing_specs)
            has_rn_er = any('Emergency' in spec for spec in nursing_specs)
            
            self.log_test("Has ICU nursing specialty", has_rn_icu)
            self.log_test("Has Emergency nursing specialty", has_rn_er)
            
            # Check for specific allied health specialties
            allied_specs = response.get('allied_health', [])
            has_pt = any('Physical Therapist' in spec for spec in allied_specs)
            has_rt = any('Respiratory Therapist' in spec for spec in allied_specs)
            
            self.log_test("Has Physical Therapist specialty", has_pt)
            self.log_test("Has Respiratory Therapist specialty", has_rt)
            
            return response
        
        return {}

    def test_auth_flow(self):
        """Test authentication with test credentials"""
        print("\n🔍 Testing Authentication...")
        
        # Test login with provided credentials
        login_data = {
            "email": "testseeker@test.com",
            "password": "test123"
        }
        
        success, response = self.run_test(
            "Login with test credentials",
            "POST",
            "auth/login",
            200,
            login_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            self.log_test("Token received", True, f"User ID: {self.user_id}")
            return True
        else:
            # Try to register if login fails
            register_data = {
                "email": "testseeker@test.com",
                "password": "test123",
                "role": "seeker",
                "full_name": "Test Seeker"
            }
            
            success, response = self.run_test(
                "Register test user",
                "POST",
                "auth/register",
                200,
                register_data
            )
            
            if success and 'access_token' in response:
                self.token = response['access_token']
                self.user_id = response['user']['id']
                self.log_test("Registration successful", True, f"User ID: {self.user_id}")
                return True
        
        return False

    def test_profile_endpoints(self):
        """Test profile endpoints for seeker"""
        print("\n🔍 Testing Profile Endpoints...")
        
        # Get current profile
        success, profile = self.run_test(
            "Get seeker profile",
            "GET",
            "profile/seeker",
            200
        )
        
        # Test profile update with work history and medical records
        profile_data = {
            "contact_info": {
                "email": "testseeker@test.com",
                "phone": "(555) 123-4567",
                "address": "Test City, Test State"
            },
            "specialty": "Registered Nurse (RN) - ICU/Critical Care",
            "years_experience": 5,
            "bio": "Experienced ICU nurse with 5 years of critical care experience",
            "work_history": [
                {
                    "facility_name": "Memorial Hospital",
                    "position": "ICU Registered Nurse",
                    "department": "Intensive Care Unit",
                    "start_date": "2020-01",
                    "end_date": "2023-12",
                    "is_current": False,
                    "responsibilities": "Provided critical care to ICU patients"
                },
                {
                    "facility_name": "City General Hospital",
                    "position": "Staff Nurse",
                    "department": "Emergency Department",
                    "start_date": "2024-01",
                    "end_date": "",
                    "is_current": True,
                    "responsibilities": "Emergency care and triage"
                }
            ],
            "medical_records": [
                {
                    "record_type": "TB Test (PPD/Quantiferon)",
                    "date_completed": "2024-01-15",
                    "expiration_date": "2025-01-15",
                    "result": "Negative"
                },
                {
                    "record_type": "COVID-19 Vaccination",
                    "date_completed": "2023-12-01",
                    "expiration_date": "",
                    "result": "Complete"
                },
                {
                    "record_type": "Annual Physical",
                    "date_completed": "2024-06-01",
                    "expiration_date": "2025-06-01",
                    "result": "Cleared for duty"
                }
            ],
            "certifications": [
                {"name": "BLS", "expiration": "2025-03-15"},
                {"name": "ACLS", "expiration": "2025-06-20"}
            ],
            "licenses": [
                {
                    "name": "RN",
                    "state": "CA",
                    "license_number": "RN123456",
                    "expiration": "2025-12-31"
                }
            ],
            "expected_pay": {"min": 45, "max": 65},
            "desired_benefits": ["Health Insurance", "401(k)", "Paid Time Off"],
            "preferred_locations": ["Los Angeles, CA", "San Francisco, CA"]
        }
        
        success, response = self.run_test(
            "Update seeker profile with work history and medical records",
            "PUT",
            "profile/seeker",
            200,
            profile_data
        )
        
        if success:
            # Verify the profile was updated
            success, updated_profile = self.run_test(
                "Verify profile update",
                "GET",
                "profile/seeker",
                200
            )
            
            if success:
                has_work_history = len(updated_profile.get('work_history', [])) >= 2
                has_medical_records = len(updated_profile.get('medical_records', [])) >= 3
                has_specialty = updated_profile.get('specialty') == "Registered Nurse (RN) - ICU/Critical Care"
                
                self.log_test("Profile has work history", has_work_history,
                             f"Found {len(updated_profile.get('work_history', []))} work entries")
                self.log_test("Profile has medical records", has_medical_records,
                             f"Found {len(updated_profile.get('medical_records', []))} medical records")
                self.log_test("Profile has correct specialty", has_specialty)

    def test_job_creation_with_specialties(self):
        """Test job creation with categorized specialties"""
        print("\n🔍 Testing Job Creation...")
        
        # First create a poster account
        poster_register_data = {
            "email": "testposter@test.com",
            "password": "test123",
            "role": "poster",
            "full_name": "Test Hospital"
        }
        
        success, response = self.run_test(
            "Register poster account",
            "POST",
            "auth/register",
            200,
            poster_register_data
        )
        
        if success:
            poster_token = response['access_token']
            poster_id = response['user']['id']
            
            # Update poster profile
            poster_profile = {
                "company_name": "Memorial Medical Center",
                "company_description": "Leading healthcare facility",
                "contact_info": {
                    "email": "hr@memorial.com",
                    "phone": "(555) 987-6543",
                    "address": "123 Hospital Way, Medical City, CA"
                }
            }
            
            # Temporarily switch to poster token
            original_token = self.token
            self.token = poster_token
            
            success, response = self.run_test(
                "Update poster profile",
                "PUT",
                "profile/poster",
                200,
                poster_profile
            )
            
            # Create job with nursing specialty
            job_data = {
                "title": "ICU Travel Nurse",
                "description": "Seeking experienced ICU nurse for 13-week travel assignment",
                "location": "Los Angeles, CA",
                "duration": "13 weeks",
                "pay_range": {"min": 50, "max": 70},
                "benefits": ["Health Insurance", "Housing Stipend", "Travel Reimbursement"],
                "time_off_policy": "Flexible PTO policy",
                "requirements": ["Must have 2+ years ICU experience", "BLS and ACLS required"],
                "certifications_required": ["BLS", "ACLS"],
                "experience_required": 2,
                "specialty": "Registered Nurse (RN) - ICU/Critical Care",
                "shift_type": "Day Shift (7a-7p)",
                "start_date": "2024-09-01"
            }
            
            success, job_response = self.run_test(
                "Create job with nursing specialty",
                "POST",
                "jobs",
                200,
                job_data
            )
            
            if success:
                job_id = job_response.get('id')
                has_specialty = job_response.get('specialty') == "Registered Nurse (RN) - ICU/Critical Care"
                has_company = job_response.get('company_name') == "Memorial Medical Center"
                
                self.log_test("Job created with correct specialty", has_specialty)
                self.log_test("Job has company information", has_company)
                
                # Test job retrieval
                success, retrieved_job = self.run_test(
                    "Retrieve created job",
                    "GET",
                    f"jobs/{job_id}",
                    200
                )
                
                if success:
                    self.log_test("Job retrieval successful", True, f"Job ID: {job_id}")
            
            # Restore original token
            self.token = original_token

    def test_document_expiration_check(self):
        """Test admin endpoint for document expiration check"""
        print("\n🔍 Testing Document Expiration Check...")
        
        success, response = self.run_test(
            "Trigger document expiration check",
            "POST",
            "admin/check-expirations",
            200
        )
        
        if success:
            has_message = 'message' in response
            self.log_test("Expiration check returns message", has_message,
                         response.get('message', ''))

    def test_notification_preferences(self):
        """Test notification preferences endpoints"""
        print("\n🔍 Testing Notification Preferences...")
        
        # Get current preferences
        success, prefs = self.run_test(
            "Get notification preferences",
            "GET",
            "notifications/preferences",
            200
        )
        
        # Update preferences
        new_prefs = {
            "email_enabled": True,
            "sms_enabled": False,
            "phone_number": "+15551234567",
            "frequency": "immediate",
            "match_notifications": True,
            "message_notifications": True,
            "document_reminders": True
        }
        
        success, response = self.run_test(
            "Update notification preferences",
            "PUT",
            "notifications/preferences",
            200,
            new_prefs
        )

    def test_stats_endpoint(self):
        """Test stats/dashboard endpoint"""
        print("\n🔍 Testing Stats Endpoint...")
        
        success, stats = self.run_test(
            "Get dashboard stats",
            "GET",
            "stats",
            200
        )
        
        if success:
            has_matches = 'matches' in stats
            has_refs = 'pending_references' in stats or 'completed_references' in stats
            
            self.log_test("Stats has matches count", has_matches)
            self.log_test("Stats has references info", has_refs)

    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting MedJobMatch API Tests...")
        print(f"Testing against: {self.base_url}")
        
        # Test specialties endpoint (no auth required)
        specialties = self.test_specialties_endpoint()
        
        # Test authentication
        if not self.test_auth_flow():
            print("❌ Authentication failed - stopping tests")
            return self.generate_report()
        
        # Test profile endpoints
        self.test_profile_endpoints()
        
        # Test job creation
        self.test_job_creation_with_specialties()
        
        # Test admin endpoints
        self.test_document_expiration_check()
        
        # Test notification preferences
        self.test_notification_preferences()
        
        # Test stats
        self.test_stats_endpoint()
        
        return self.generate_report()

    def generate_report(self):
        """Generate test report"""
        print(f"\n📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed < self.tests_run:
            print("\n❌ Failed Tests:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['details']}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        
        return {
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "success_rate": success_rate,
            "test_results": self.test_results
        }

def main():
    tester = MedJobMatchAPITester()
    report = tester.run_all_tests()
    
    # Return appropriate exit code
    return 0 if report["success_rate"] >= 80 else 1

if __name__ == "__main__":
    sys.exit(main())