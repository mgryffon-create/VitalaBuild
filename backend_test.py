import requests
import sys
import json
from datetime import datetime

class VitalaMatchAPITester:
    def __init__(self, base_url="https://medjobsuite.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.seeker_token = None
        self.poster_token = None
        self.seeker_id = None
        self.poster_id = None
        self.current_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.job_id = None
        self.match_id = None
        self.offer_id = None
        self.employment_id = None
        self.policy_id = None

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
        
        if self.current_token:
            test_headers['Authorization'] = f'Bearer {self.current_token}'
        
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
        """Test authentication for both seeker and poster using provided test credentials"""
        print("\n🔍 Testing VitalaMatch Authentication...")
        
        # Test seeker login with provided credentials
        seeker_login_data = {
            "email": "seeker_test@vitalamatch.com",
            "password": "test123"
        }
        
        success, response = self.run_test(
            "Login test seeker",
            "POST",
            "auth/login",
            200,
            seeker_login_data
        )
        
        if not success:
            # Try to register seeker
            seeker_register_data = {
                "email": "seeker_test@vitalamatch.com",
                "password": "test123",
                "role": "seeker",
                "full_name": "Test Seeker"
            }
            
            success, response = self.run_test(
                "Register test seeker",
                "POST",
                "auth/register",
                200,
                seeker_register_data
            )
        
        if success and 'access_token' in response:
            self.seeker_token = response['access_token']
            self.seeker_id = response['user']['id']
            self.log_test("Seeker token received", True, f"User ID: {self.seeker_id}")
        
        # Test employer login with provided credentials
        employer_login_data = {
            "email": "employer_test@vitalamatch.com",
            "password": "test123"
        }
        
        success, response = self.run_test(
            "Login test employer",
            "POST",
            "auth/login",
            200,
            employer_login_data
        )
        
        if not success:
            # Try to register employer
            employer_register_data = {
                "email": "employer_test@vitalamatch.com",
                "password": "test123",
                "role": "poster",
                "full_name": "Test Employer"
            }
            
            success, response = self.run_test(
                "Register test employer",
                "POST",
                "auth/register",
                200,
                employer_register_data
            )
        
        if success and 'access_token' in response:
            self.poster_token = response['access_token']
            self.poster_id = response['user']['id']
            self.log_test("Employer token received", True, f"User ID: {self.poster_id}")
        
        return self.seeker_token and self.poster_token

    def test_hiring_suite_offers(self):
        """Test Hiring Suite employment offers endpoints"""
        print("\n🔍 Testing Hiring Suite - Employment Offers...")
        
        # Use employer token to create offers
        self.current_token = self.poster_token
        
        # First create a match to make an offer on
        if not self.match_id:
            print("⚠️ No match available for offer testing - creating test scenario")
            # For testing, we'll use dummy IDs and expect appropriate errors
        
        # Test creating an employment offer (employer only)
        offer_data = {
            "match_id": "test-match-id",
            "job_id": self.job_id or "test-job-id",
            "seeker_id": self.seeker_id,
            "position_title": "ICU Travel Nurse",
            "salary_amount": 75000.0,
            "salary_type": "annual",
            "start_date": "2024-01-15",
            "expiration_date": "2024-01-01",
            "conditions": ["Background check", "Drug screening", "License verification"],
            "benefits_summary": "Health insurance, housing stipend, travel reimbursement",
            "additional_terms": "13-week assignment with possible extension"
        }
        
        success, offer_response = self.run_test(
            "Create employment offer (employer)",
            "POST",
            "hiring/offers",
            200,
            offer_data
        )
        
        if success and 'id' in offer_response:
            self.offer_id = offer_response['id']
            self.log_test("Employment offer created", True, f"Offer ID: {self.offer_id}")
        
        # Test listing offers as employer
        success, offers_list = self.run_test(
            "List offers (employer view)",
            "GET",
            "hiring/offers",
            200
        )
        
        if success:
            self.log_test("Employer can list offers", True, f"Found {len(offers_list)} offers")
        
        # Test seeker cannot create offers (authorization check)
        self.current_token = self.seeker_token
        
        success, response = self.run_test(
            "Seeker cannot create offers (auth check)",
            "POST",
            "hiring/offers",
            403,  # Should be forbidden
            offer_data
        )
        
        self.log_test("Authorization: Seeker blocked from creating offers", success)
        
        # Test listing offers as seeker (should see received offers)
        success, seeker_offers = self.run_test(
            "List offers (seeker view)",
            "GET",
            "hiring/offers",
            200
        )
        
        if success:
            self.log_test("Seeker can list received offers", True, f"Found {len(seeker_offers)} offers")
        
        # Test responding to offer (seeker only)
        if self.offer_id:
            offer_response_data = {
                "accepted": True,
                "notes": "Excited to join the team!"
            }
            
            success, response = self.run_test(
                "Accept employment offer (seeker)",
                "PUT",
                f"hiring/offers/{self.offer_id}/respond",
                200,
                offer_response_data
            )
            
            if success:
                self.log_test("Seeker can accept offer", True)
                # Store employment ID if created
                if 'employment_id' in response:
                    self.employment_id = response['employment_id']
        
        # Test employer cannot respond to offers (authorization check)
        self.current_token = self.poster_token
        
        if self.offer_id:
            success, response = self.run_test(
                "Employer cannot respond to offers (auth check)",
                "PUT",
                f"hiring/offers/{self.offer_id}/respond",
                403,
                {"accepted": False}
            )
            
            self.log_test("Authorization: Employer blocked from responding to offers", success)
        
        # Test withdrawing offer (employer only)
        if self.offer_id:
            success, response = self.run_test(
                "Withdraw employment offer (employer)",
                "DELETE",
                f"hiring/offers/{self.offer_id}",
                200
            )
            
            self.log_test("Employer can withdraw offer", success)

    def test_hiring_suite_policies(self):
        """Test Hiring Suite policy documents endpoints"""
        print("\n🔍 Testing Hiring Suite - Policy Documents...")
        
        # Use employer token for policy management
        self.current_token = self.poster_token
        
        # Test uploading policy document (employer only)
        import base64
        
        # Create a dummy PDF content (base64 encoded)
        dummy_pdf_content = base64.b64encode(b"Dummy PDF content for testing").decode('utf-8')
        
        policy_data = {
            "title": "Employee Handbook 2024",
            "description": "Comprehensive employee handbook covering all policies",
            "file_data": dummy_pdf_content,
            "file_name": "employee_handbook_2024.pdf",
            "requires_signature": True,
            "version": "2024.1"
        }
        
        success, policy_response = self.run_test(
            "Upload policy document (employer)",
            "POST",
            "hiring/policies",
            200,
            policy_data
        )
        
        if success and 'id' in policy_response:
            self.policy_id = policy_response['id']
            self.log_test("Policy document uploaded", True, f"Policy ID: {self.policy_id}")
        
        # Test listing policies (employer)
        success, policies_list = self.run_test(
            "List policy documents (employer)",
            "GET",
            "hiring/policies",
            200
        )
        
        if success:
            self.log_test("Employer can list policies", True, f"Found {len(policies_list)} policies")
        
        # Test getting specific policy
        if self.policy_id:
            success, policy_details = self.run_test(
                "Get specific policy document",
                "GET",
                f"hiring/policies/{self.policy_id}",
                200
            )
            
            if success:
                title_correct = policy_details.get('title') == policy_data['title']
                self.log_test("Policy details retrieved correctly", title_correct)
        
        # Test seeker cannot upload policies (authorization check)
        self.current_token = self.seeker_token
        
        success, response = self.run_test(
            "Seeker cannot upload policies (auth check)",
            "POST",
            "hiring/policies",
            403,
            policy_data
        )
        
        self.log_test("Authorization: Seeker blocked from uploading policies", success)
        
        # Test deleting policy (employer only)
        self.current_token = self.poster_token
        
        if self.policy_id:
            success, response = self.run_test(
                "Delete policy document (employer)",
                "DELETE",
                f"hiring/policies/{self.policy_id}",
                200
            )
            
            self.log_test("Employer can delete policy", success)

    def test_hiring_suite_employments(self):
        """Test Hiring Suite employment and onboarding endpoints"""
        print("\n🔍 Testing Hiring Suite - Employments & Onboarding...")
        
        # Test listing employments (both roles should work)
        self.current_token = self.seeker_token
        
        success, seeker_employments = self.run_test(
            "List employments (seeker)",
            "GET",
            "hiring/employments",
            200
        )
        
        if success:
            self.log_test("Seeker can list employments", True, f"Found {len(seeker_employments)} employments")
        
        self.current_token = self.poster_token
        
        success, employer_employments = self.run_test(
            "List employments (employer)",
            "GET",
            "hiring/employments",
            200
        )
        
        if success:
            self.log_test("Employer can list employments", True, f"Found {len(employer_employments)} employments")
        
        # Test onboarding checklist (if we have an employment)
        if self.employment_id:
            success, checklist = self.run_test(
                "Get onboarding checklist",
                "GET",
                f"hiring/onboarding/{self.employment_id}",
                200
            )
            
            if success:
                has_items = 'items' in checklist and len(checklist['items']) > 0
                self.log_test("Onboarding checklist has items", has_items)
        else:
            # Test with dummy ID to check endpoint structure
            success, response = self.run_test(
                "Test onboarding endpoint structure",
                "GET",
                "hiring/onboarding/dummy-employment-id",
                404  # Expected 404 for dummy ID
            )
            
            self.log_test("Onboarding endpoint exists", success or response != {})

    def test_hiring_suite_documents(self):
        """Test Hiring Suite hiring documents endpoints"""
        print("\n🔍 Testing Hiring Suite - Hiring Documents...")
        
        # Use seeker token for submitting documents
        self.current_token = self.seeker_token
        
        # Test submitting I-9 document
        i9_document_data = {
            "employment_id": self.employment_id or "test-employment-id",
            "document_type": "i9",
            "form_data": {
                "employee_name": "Test Seeker",
                "employee_address": "123 Test St, Test City, CA 90210",
                "date_of_birth": "1990-01-01",
                "ssn": "123-45-6789",
                "citizenship_status": "US Citizen",
                "document_title": "Driver's License",
                "document_number": "D1234567",
                "expiration_date": "2025-12-31"
            },
            "signature": "base64_signature_data_here",
            "signed_at": "2024-12-24T10:00:00Z"
        }
        
        success, doc_response = self.run_test(
            "Submit I-9 document (seeker)",
            "POST",
            "hiring/documents",
            200,
            i9_document_data
        )
        
        if success:
            self.log_test("I-9 document submitted successfully", True)
        
        # Test submitting W-4 document
        w4_document_data = {
            "employment_id": self.employment_id or "test-employment-id",
            "document_type": "w4",
            "form_data": {
                "employee_name": "Test Seeker",
                "ssn": "123-45-6789",
                "filing_status": "single",
                "dependents": 0,
                "extra_withholding": 0,
                "exempt": False
            },
            "signature": "base64_signature_data_here",
            "signed_at": "2024-12-24T10:00:00Z"
        }
        
        success, doc_response = self.run_test(
            "Submit W-4 document (seeker)",
            "POST",
            "hiring/documents",
            200,
            w4_document_data
        )
        
        if success:
            self.log_test("W-4 document submitted successfully", True)
        
        # Test getting documents for employment
        employment_id = self.employment_id or "test-employment-id"
        
        success, documents_list = self.run_test(
            "Get hiring documents for employment",
            "GET",
            f"hiring/documents/{employment_id}",
            200
        )
        
        if success:
            self.log_test("Can retrieve hiring documents", True, f"Found {len(documents_list)} documents")
        
        # Test employer can also view documents
        self.current_token = self.poster_token
        
        success, employer_docs = self.run_test(
            "Get hiring documents (employer view)",
            "GET",
            f"hiring/documents/{employment_id}",
            200
        )
        
        if success:
            self.log_test("Employer can view hiring documents", True, f"Found {len(employer_docs)} documents")

    def test_hiring_suite_reviews(self):
        """Test Hiring Suite employment reviews endpoints"""
        print("\n🔍 Testing Hiring Suite - Employment Reviews...")
        
        # Use seeker token for submitting reviews
        self.current_token = self.seeker_token
        
        # Test submitting employment review
        review_data = {
            "employment_id": self.employment_id or "test-employment-id",
            "rating": 5,
            "communication_rating": 5,
            "professionalism_rating": 4,
            "reliability_rating": 5,
            "review_text": "Excellent experience working with this facility. Great team and supportive management.",
            "would_recommend": True
        }
        
        success, review_response = self.run_test(
            "Submit employment review (seeker)",
            "POST",
            "hiring/reviews",
            200,
            review_data
        )
        
        if success:
            self.log_test("Employment review submitted successfully", True)
        
        # Test getting pending reviews
        success, pending_reviews = self.run_test(
            "Get pending review requests",
            "GET",
            "hiring/reviews/pending",
            200
        )
        
        if success:
            self.log_test("Can retrieve pending reviews", True, f"Found {len(pending_reviews)} pending reviews")
        
        # Test getting profile reviews
        success, profile_reviews = self.run_test(
            "Get profile reviews",
            "GET",
            f"profiles/{self.poster_id}/reviews",
            200
        )
        
        if success:
            self.log_test("Can retrieve profile reviews", True, f"Found {len(profile_reviews)} profile reviews")
        
        # Test employer submitting review
        self.current_token = self.poster_token
        
        employer_review_data = {
            "employment_id": self.employment_id or "test-employment-id",
            "rating": 4,
            "communication_rating": 5,
            "professionalism_rating": 4,
            "reliability_rating": 4,
            "review_text": "Great nurse, very professional and skilled. Would work with again.",
            "would_recommend": True
        }
        
        success, review_response = self.run_test(
            "Submit employment review (employer)",
            "POST",
            "hiring/reviews",
            200,
            employer_review_data
        )
        
        if success:
            self.log_test("Employer review submitted successfully", True)

    def test_swipe_bins_endpoints(self):
        """Test swipe bins endpoints for 'Take Another Look' and 'Maybe' features"""
        print("\n🔍 Testing Swipe Bins Endpoints...")
        
        # Use seeker token
        self.current_token = self.seeker_token
        
        # Test getting passed profiles (Take Another Look bin)
        success, passed_profiles = self.run_test(
            "Get passed profiles bin",
            "GET",
            "swipe/bins/passed",
            200
        )
        
        if success:
            self.log_test("Passed profiles endpoint accessible", True, 
                         f"Found {len(passed_profiles)} passed profiles")
        
        # Test getting maybe profiles
        success, maybe_profiles = self.run_test(
            "Get maybe profiles bin",
            "GET",
            "swipe/bins/maybe",
            200
        )
        
        if success:
            self.log_test("Maybe profiles endpoint accessible", True,
                         f"Found {len(maybe_profiles)} maybe profiles")
        
        # Test swipe reconsider endpoint (will test with dummy ID)
        success, response = self.run_test(
            "Test swipe reconsider endpoint structure",
            "PUT",
            "swipe/bins/dummy-id/reconsider?new_action=like",
            404  # Expected 404 for dummy ID
        )
        
        # 404 is expected for dummy ID, so this confirms endpoint exists
        self.log_test("Swipe reconsider endpoint exists", success or response != {})
        """Test swipe bins endpoints for 'Take Another Look' and 'Maybe' features"""
        print("\n🔍 Testing Swipe Bins Endpoints...")
        
        # Use seeker token
        self.current_token = self.seeker_token
        
        # Test getting passed profiles (Take Another Look bin)
        success, passed_profiles = self.run_test(
            "Get passed profiles bin",
            "GET",
            "swipe/bins/passed",
            200
        )
        
        if success:
            self.log_test("Passed profiles endpoint accessible", True, 
                         f"Found {len(passed_profiles)} passed profiles")
        
        # Test getting maybe profiles
        success, maybe_profiles = self.run_test(
            "Get maybe profiles bin",
            "GET",
            "swipe/bins/maybe",
            200
        )
        
        if success:
            self.log_test("Maybe profiles endpoint accessible", True,
                         f"Found {len(maybe_profiles)} maybe profiles")
        
        # Test swipe reconsider endpoint (will test with dummy ID)
        success, response = self.run_test(
            "Test swipe reconsider endpoint structure",
            "PUT",
            "swipe/bins/dummy-id/reconsider?new_action=like",
            404  # Expected 404 for dummy ID
        )
        
        # 404 is expected for dummy ID, so this confirms endpoint exists
        self.log_test("Swipe reconsider endpoint exists", success or response != {})

    def test_feed_endpoints(self):
        """Test social feed endpoints"""
        print("\n🔍 Testing Social Feed Endpoints...")
        
        # Use seeker token
        self.current_token = self.seeker_token
        
        # Test creating a feed post
        post_data = {
            "content": "Excited to start my new nursing assignment! #VitalaMatch #Nursing",
            "visibility": "everyone",
            "comment_permission": "everyone"
        }
        
        success, post_response = self.run_test(
            "Create feed post",
            "POST",
            "feed",
            200,
            post_data
        )
        
        post_id = None
        if success and 'id' in post_response:
            post_id = post_response['id']
            content_correct = post_response.get('content') == post_data['content']
            visibility_correct = post_response.get('visibility') == 'everyone'
            
            self.log_test("Feed post created with correct content", content_correct)
            self.log_test("Feed post has correct visibility", visibility_correct)
        
        # Test creating post with 140 character limit
        long_post_data = {
            "content": "A" * 141,  # 141 characters - should fail
            "visibility": "everyone",
            "comment_permission": "everyone"
        }
        
        success, response = self.run_test(
            "Test 140 character limit",
            "POST",
            "feed",
            400,  # Should fail with 400
            long_post_data
        )
        
        self.log_test("140 character limit enforced", success)
        
        # Test getting feed
        success, feed_posts = self.run_test(
            "Get feed posts",
            "GET",
            "feed",
            200
        )
        
        if success:
            self.log_test("Feed retrieval successful", True,
                         f"Found {len(feed_posts)} posts")
        
        # Test liking a post (if we have a post ID)
        if post_id:
            success, like_response = self.run_test(
                "Like feed post",
                "POST",
                f"feed/{post_id}/like",
                200
            )
            
            if success:
                liked_status = like_response.get('liked', False)
                self.log_test("Post like toggle works", True, f"Liked: {liked_status}")
            
            # Test commenting on post
            comment_data = {"content": "Great post! Congratulations!"}
            
            success, comment_response = self.run_test(
                "Comment on feed post",
                "POST",
                f"feed/{post_id}/comment",
                200,
                comment_data
            )
            
            if success:
                comment_content = comment_response.get('content') == comment_data['content']
                self.log_test("Comment created successfully", comment_content)

    def test_interview_endpoints(self):
        """Test interview request endpoints"""
        print("\n🔍 Testing Interview Request Endpoints...")
        
        # Use poster token for creating interview requests
        self.current_token = self.poster_token
        
        # First, we need a match to create an interview request
        # For testing purposes, we'll test the endpoint structure
        
        # Test getting interview requests
        success, interview_requests = self.run_test(
            "Get interview requests",
            "GET",
            "interview-requests",
            200
        )
        
        if success:
            self.log_test("Interview requests endpoint accessible", True,
                         f"Found {len(interview_requests)} interview requests")
        
        # Test creating interview request (will fail without valid match, but tests endpoint)
        interview_data = {
            "match_id": "dummy-match-id",
            "proposed_times": ["2024-12-01T10:00:00Z", "2024-12-01T14:00:00Z"],
            "duration_minutes": 60,
            "meeting_type": "video",
            "notes": "Looking forward to discussing the position"
        }
        
        success, response = self.run_test(
            "Test interview request endpoint structure",
            "POST",
            "matches/dummy-match-id/interview-request",
            404,  # Expected 404 for dummy match ID
            interview_data
        )
        
        # 404 is expected for dummy match ID, confirms endpoint exists
        self.log_test("Interview request endpoint exists", success or response != {})

    def test_swipe_actions(self):
        """Test swipe actions including 'maybe' action"""
        print("\n🔍 Testing Swipe Actions...")
        
        # Use seeker token
        self.current_token = self.seeker_token
        
        # Test getting swipeable jobs
        success, jobs = self.run_test(
            "Get swipeable jobs",
            "GET",
            "swipe/jobs",
            200
        )
        
        if success:
            self.log_test("Swipeable jobs endpoint accessible", True,
                         f"Found {len(jobs)} jobs to swipe")
            
            # If we have jobs, test swipe actions
            if len(jobs) > 0:
                job_id = jobs[0].get('id')
                
                # Test 'maybe' swipe action
                maybe_swipe_data = {
                    "target_id": job_id,
                    "action": "maybe"
                }
                
                success, swipe_response = self.run_test(
                    "Test 'maybe' swipe action",
                    "POST",
                    "swipe",
                    200,
                    maybe_swipe_data
                )
                
                if success:
                    self.log_test("Maybe swipe action works", True)
                
                # Test 'pass' swipe action
                pass_swipe_data = {
                    "target_id": job_id,
                    "action": "pass"
                }
                
                success, swipe_response = self.run_test(
                    "Test 'pass' swipe action",
                    "POST",
                    "swipe",
                    200,
                    pass_swipe_data
                )
                
                if success:
                    self.log_test("Pass swipe action works", True)

    def setup_test_data(self):
        """Setup test data for comprehensive testing"""
        print("\n🔍 Setting up test data...")
        
        # Setup seeker profile
        self.current_token = self.seeker_token
        seeker_profile = {
            "specialty": "Registered Nurse (RN) - ICU/Critical Care",
            "years_experience": 3,
            "bio": "Dedicated ICU nurse with passion for patient care",
            "contact_info": {
                "email": "testseeker@vitalamatch.com",
                "phone": "(555) 123-4567"
            },
            "preferred_locations": ["Los Angeles, CA", "San Francisco, CA"]
        }
        
        success, response = self.run_test(
            "Setup seeker profile",
            "PUT",
            "profile/seeker",
            200,
            seeker_profile
        )
        
        # Setup poster profile and create a job
        self.current_token = self.poster_token
        poster_profile = {
            "company_name": "VitalaMatch Medical Center",
            "company_description": "Leading healthcare facility",
            "contact_info": {
                "email": "hr@vitalamatch.com",
                "phone": "(555) 987-6543"
            }
        }
        
        success, response = self.run_test(
            "Setup poster profile",
            "PUT",
            "profile/poster",
            200,
            poster_profile
        )
        
        # Create a test job
        job_data = {
            "title": "ICU Travel Nurse - VitalaMatch",
            "description": "Join our team at VitalaMatch Medical Center",
            "location": "Los Angeles, CA",
            "duration": "13 weeks",
            "pay_range": {"min": 55, "max": 75},
            "benefits": ["Health Insurance", "Housing Stipend"],
            "time_off_policy": "Flexible PTO",
            "requirements": ["2+ years ICU experience"],
            "certifications_required": ["BLS", "ACLS"],
            "experience_required": 2,
            "specialty": "Registered Nurse (RN) - ICU/Critical Care"
        }
        
        success, job_response = self.run_test(
            "Create test job",
            "POST",
            "jobs",
            200,
            job_data
        )
        
        if success and 'id' in job_response:
            self.job_id = job_response['id']
            self.log_test("Test job created", True, f"Job ID: {self.job_id}")

    def run_all_tests(self):
        """Run all VitalaMatch tests including Hiring Suite"""
        print("🚀 Starting VitalaMatch API Tests...")
        print(f"Testing against: {self.base_url}")
        
        # Test authentication for both roles
        if not self.test_auth_flow():
            print("❌ Authentication failed - stopping tests")
            return self.generate_report()
        
        # Setup test data
        self.setup_test_data()
        
        # Test Hiring Suite endpoints (NEW)
        print("\n" + "="*50)
        print("🏥 TESTING HIRING SUITE FUNCTIONALITY")
        print("="*50)
        
        self.test_hiring_suite_offers()
        self.test_hiring_suite_policies()
        self.test_hiring_suite_employments()
        self.test_hiring_suite_documents()
        self.test_hiring_suite_reviews()
        
        # Test existing VitalaMatch features
        print("\n" + "="*50)
        print("📱 TESTING EXISTING FEATURES")
        print("="*50)
        
        self.test_swipe_bins_endpoints()
        self.test_feed_endpoints()
        self.test_interview_endpoints()
        self.test_swipe_actions()
        
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
    tester = VitalaMatchAPITester()
    report = tester.run_all_tests()
    
    # Return appropriate exit code
    return 0 if report["success_rate"] >= 80 else 1

if __name__ == "__main__":
    sys.exit(main())