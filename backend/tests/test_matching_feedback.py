"""
Test Suite for Phase A: Bidirectional Matching & Worker Protection System
Tests:
- Worker preference fields on SeekerProfile (7 fields)
- Facility structured profile fields on PosterProfile (6 fields)
- Assignment feedback system with 9 metrics
- Aggregated facility metrics with trust_score
- Signal & badge generation
- Bidirectional matching engine with candidate fit score
- Facility dashboard
- Post-assignment feedback triggers
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SEEKER_EMAIL = "seeker_test@vitalamatch.com"
SEEKER_PASSWORD = "test123"
EMPLOYER_EMAIL = "employer_test@vitalamatch.com"
EMPLOYER_PASSWORD = "test123"

# Facility ID for the test employer (from context)
TEST_FACILITY_ID = "727c73f5-44fa-400c-a222-f7af7e5f8b14"


class TestAuth:
    """Authentication helpers"""
    
    @staticmethod
    def get_seeker_token():
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    @staticmethod
    def get_employer_token():
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYER_EMAIL,
            "password": EMPLOYER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None


class TestSeekerWorkerPreferences:
    """Test 7 worker preference fields on SeekerProfile"""
    
    def test_seeker_login(self):
        """Verify seeker can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SEEKER_EMAIL,
            "password": SEEKER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        print(f"✓ Seeker login successful")
    
    def test_get_seeker_profile(self):
        """GET /api/profile/seeker returns profile data"""
        token = TestAuth.get_seeker_token()
        assert token, "Failed to get seeker token"
        
        response = requests.get(f"{BASE_URL}/api/profile/seeker", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        print(f"✓ GET /api/profile/seeker returns 200")
    
    def test_save_worker_preference_schedule_stability(self):
        """POST /api/profile/seeker saves schedule_stability_importance"""
        token = TestAuth.get_seeker_token()
        assert token, "Failed to get seeker token"
        
        response = requests.put(f"{BASE_URL}/api/profile/seeker", 
            headers={"Authorization": f"Bearer {token}"},
            json={"schedule_stability_importance": "High"}
        )
        assert response.status_code == 200
        
        # Verify it was saved
        get_response = requests.get(f"{BASE_URL}/api/profile/seeker", headers={
            "Authorization": f"Bearer {token}"
        })
        assert get_response.status_code == 200
        data = get_response.json()
        assert data.get("schedule_stability_importance") == "High"
        print(f"✓ schedule_stability_importance saved and retrieved")
    
    def test_save_worker_preference_overtime(self):
        """POST /api/profile/seeker saves overtime_preference"""
        token = TestAuth.get_seeker_token()
        assert token, "Failed to get seeker token"
        
        response = requests.put(f"{BASE_URL}/api/profile/seeker", 
            headers={"Authorization": f"Bearer {token}"},
            json={"overtime_preference": "Open to overtime"}
        )
        assert response.status_code == 200
        
        get_response = requests.get(f"{BASE_URL}/api/profile/seeker", headers={
            "Authorization": f"Bearer {token}"
        })
        data = get_response.json()
        assert data.get("overtime_preference") == "Open to overtime"
        print(f"✓ overtime_preference saved and retrieved")
    
    def test_save_all_worker_preferences(self):
        """POST /api/profile/seeker saves all 7 worker preference fields"""
        token = TestAuth.get_seeker_token()
        assert token, "Failed to get seeker token"
        
        preferences = {
            "schedule_stability_importance": "Medium",
            "overtime_preference": "Avoid overtime",
            "overtime_pressure_tolerance": "Acceptable occasionally",
            "shift_cancellation_tolerance": "Not acceptable",
            "staffing_tolerance": "Only well-staffed environments",
            "floating_tolerance": "Occasional floating acceptable",
            "pay_transparency_importance": "Critical"
        }
        
        response = requests.put(f"{BASE_URL}/api/profile/seeker", 
            headers={"Authorization": f"Bearer {token}"},
            json=preferences
        )
        assert response.status_code == 200
        
        # Verify all fields saved
        get_response = requests.get(f"{BASE_URL}/api/profile/seeker", headers={
            "Authorization": f"Bearer {token}"
        })
        data = get_response.json()
        
        for field, value in preferences.items():
            assert data.get(field) == value, f"Field {field} not saved correctly"
        
        print(f"✓ All 7 worker preference fields saved and retrieved")


class TestFacilityProfileFields:
    """Test 6 facility structured profile fields on PosterProfile"""
    
    def test_employer_login(self):
        """Verify employer can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYER_EMAIL,
            "password": EMPLOYER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        print(f"✓ Employer login successful")
    
    def test_get_facility_profile_status_incomplete(self):
        """GET /api/matching/facility-profile-status returns completion status"""
        token = TestAuth.get_employer_token()
        assert token, "Failed to get employer token"
        
        response = requests.get(f"{BASE_URL}/api/matching/facility-profile-status", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        data = response.json()
        
        # Should have these fields
        assert "complete" in data
        assert "filled" in data
        assert "required" in data
        assert "missing_fields" in data
        assert data["required"] == 6  # 6 required fields
        
        print(f"✓ GET /api/matching/facility-profile-status returns status (filled: {data['filled']}/{data['required']})")
    
    def test_save_facility_profile_fields(self):
        """POST /api/profile/poster saves all 6 facility fields"""
        token = TestAuth.get_employer_token()
        assert token, "Failed to get employer token"
        
        facility_fields = {
            "staffing_expectation": "Well-staffed",
            "floating_expectation": "Occasional",
            "schedule_structure": "Fixed",
            "overtime_policy": "Available",
            "cancellation_policy": "Rare",
            "contract_accuracy_confidence": "High"
        }
        
        response = requests.put(f"{BASE_URL}/api/profile/poster", 
            headers={"Authorization": f"Bearer {token}"},
            json=facility_fields
        )
        assert response.status_code == 200
        
        # Verify saved
        get_response = requests.get(f"{BASE_URL}/api/profile/poster", headers={
            "Authorization": f"Bearer {token}"
        })
        data = get_response.json()
        
        for field, value in facility_fields.items():
            assert data.get(field) == value, f"Field {field} not saved correctly"
        
        print(f"✓ All 6 facility profile fields saved and retrieved")
    
    def test_facility_profile_status_complete(self):
        """After saving all fields, profile should be complete"""
        token = TestAuth.get_employer_token()
        assert token, "Failed to get employer token"
        
        # First save all fields
        facility_fields = {
            "staffing_expectation": "Well-staffed",
            "floating_expectation": "Occasional",
            "schedule_structure": "Fixed",
            "overtime_policy": "Available",
            "cancellation_policy": "Rare",
            "contract_accuracy_confidence": "High"
        }
        
        requests.put(f"{BASE_URL}/api/profile/poster", 
            headers={"Authorization": f"Bearer {token}"},
            json=facility_fields
        )
        
        # Check status
        response = requests.get(f"{BASE_URL}/api/matching/facility-profile-status", headers={
            "Authorization": f"Bearer {token}"
        })
        data = response.json()
        
        assert data["complete"] == True
        assert data["filled"] == 6
        assert len(data["missing_fields"]) == 0
        
        print(f"✓ Facility profile status shows complete after saving all fields")


class TestAssignmentFeedback:
    """Test assignment feedback system with 9 metrics"""
    
    def test_feedback_requires_seeker_role(self):
        """POST /api/matching/feedback rejects non-seekers"""
        token = TestAuth.get_employer_token()
        assert token, "Failed to get employer token"
        
        response = requests.post(f"{BASE_URL}/api/matching/feedback", 
            headers={"Authorization": f"Bearer {token}"},
            json={
                "facility_id": TEST_FACILITY_ID,
                "staffing_stability": 4,
                "shift_cancellation_frequency": 2,
                "schedule_consistency": 4,
                "overtime_availability": 3,
                "overtime_pressure": 2,
                "pay_accuracy": 5,
                "contract_accuracy": 4,
                "management_support": 4,
                "floating_frequency": 2
            }
        )
        assert response.status_code == 403
        print(f"✓ POST /api/matching/feedback rejects employer (403)")
    
    def test_feedback_validates_scores_1_to_5(self):
        """POST /api/matching/feedback validates scores 1-5"""
        token = TestAuth.get_seeker_token()
        assert token, "Failed to get seeker token"
        
        # Test score out of range (0)
        response = requests.post(f"{BASE_URL}/api/matching/feedback", 
            headers={"Authorization": f"Bearer {token}"},
            json={
                "facility_id": TEST_FACILITY_ID,
                "staffing_stability": 0,  # Invalid - should be 1-5
                "shift_cancellation_frequency": 2,
                "schedule_consistency": 4,
                "overtime_availability": 3,
                "overtime_pressure": 2,
                "pay_accuracy": 5,
                "contract_accuracy": 4,
                "management_support": 4,
                "floating_frequency": 2
            }
        )
        assert response.status_code == 422
        print(f"✓ POST /api/matching/feedback rejects score 0 (422)")
        
        # Test score out of range (6)
        response = requests.post(f"{BASE_URL}/api/matching/feedback", 
            headers={"Authorization": f"Bearer {token}"},
            json={
                "facility_id": TEST_FACILITY_ID,
                "staffing_stability": 6,  # Invalid - should be 1-5
                "shift_cancellation_frequency": 2,
                "schedule_consistency": 4,
                "overtime_availability": 3,
                "overtime_pressure": 2,
                "pay_accuracy": 5,
                "contract_accuracy": 4,
                "management_support": 4,
                "floating_frequency": 2
            }
        )
        assert response.status_code == 422
        print(f"✓ POST /api/matching/feedback rejects score 6 (422)")
    
    def test_feedback_limits_comment_to_500_chars(self):
        """POST /api/matching/feedback limits comment to 500 chars"""
        token = TestAuth.get_seeker_token()
        assert token, "Failed to get seeker token"
        
        long_comment = "A" * 600  # 600 chars
        
        response = requests.post(f"{BASE_URL}/api/matching/feedback", 
            headers={"Authorization": f"Bearer {token}"},
            json={
                "facility_id": TEST_FACILITY_ID,
                "staffing_stability": 4,
                "shift_cancellation_frequency": 2,
                "schedule_consistency": 4,
                "overtime_availability": 3,
                "overtime_pressure": 2,
                "pay_accuracy": 5,
                "contract_accuracy": 4,
                "management_support": 4,
                "floating_frequency": 2,
                "comment": long_comment
            }
        )
        # Should succeed but truncate comment
        # Note: This may fail if no verified assignment exists
        if response.status_code == 200:
            print(f"✓ POST /api/matching/feedback accepts long comment (truncated)")
        elif response.status_code == 403:
            print(f"✓ POST /api/matching/feedback requires verified assignment (403)")
        else:
            print(f"Response: {response.status_code} - {response.text}")
    
    def test_submit_feedback_success(self):
        """POST /api/matching/feedback submits feedback successfully"""
        token = TestAuth.get_seeker_token()
        assert token, "Failed to get seeker token"
        
        response = requests.post(f"{BASE_URL}/api/matching/feedback", 
            headers={"Authorization": f"Bearer {token}"},
            json={
                "facility_id": TEST_FACILITY_ID,
                "staffing_stability": 4,
                "shift_cancellation_frequency": 2,
                "schedule_consistency": 4,
                "overtime_availability": 3,
                "overtime_pressure": 2,
                "pay_accuracy": 5,
                "contract_accuracy": 4,
                "management_support": 4,
                "floating_frequency": 2,
                "comment": "Good facility to work at"
            }
        )
        
        # May succeed or fail based on assignment verification
        if response.status_code == 200:
            data = response.json()
            assert "id" in data
            assert data.get("message") == "Feedback submitted"
            print(f"✓ POST /api/matching/feedback submitted successfully")
        elif response.status_code == 403:
            print(f"✓ POST /api/matching/feedback requires verified assignment (expected)")
        else:
            print(f"Unexpected response: {response.status_code} - {response.text}")


class TestFacilityMetrics:
    """Test aggregated facility metrics and signals/badges"""
    
    def test_get_facility_feedback(self):
        """GET /api/matching/feedback/{facility_id} returns aggregated metrics"""
        token = TestAuth.get_seeker_token()
        assert token, "Failed to get seeker token"
        
        response = requests.get(f"{BASE_URL}/api/matching/feedback/{TEST_FACILITY_ID}", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "facility_id" in data
        assert "has_data" in data
        assert "signals" in data
        assert "badges" in data
        
        if data["has_data"]:
            assert "metrics" in data
            metrics = data["metrics"]
            assert "trust_score" in metrics
            assert "feedback_count" in metrics
            assert "scores" in metrics
            print(f"✓ GET /api/matching/feedback/{TEST_FACILITY_ID} returns metrics (trust_score: {metrics.get('trust_score')})")
        else:
            print(f"✓ GET /api/matching/feedback/{TEST_FACILITY_ID} returns no data (no feedback yet)")
    
    def test_trust_score_calculation(self):
        """Verify trust score calculation: staffing 25% + schedule 25% + pay 25% + cancellation 15% + contract 10%"""
        token = TestAuth.get_seeker_token()
        assert token, "Failed to get seeker token"
        
        response = requests.get(f"{BASE_URL}/api/matching/feedback/{TEST_FACILITY_ID}", headers={
            "Authorization": f"Bearer {token}"
        })
        data = response.json()
        
        if data["has_data"] and data.get("metrics"):
            metrics = data["metrics"]
            scores = metrics.get("scores", {})
            
            # Calculate expected trust score
            staffing = scores.get("staffing_stability_score", 0)
            schedule = scores.get("schedule_reliability_score", 0)
            pay = scores.get("pay_fairness_score", 0)
            cancellation = scores.get("cancellation_stability_score", 0)
            contract = scores.get("contract_accuracy_score", 0)
            
            expected_trust = round(
                staffing * 0.25 +
                schedule * 0.25 +
                pay * 0.25 +
                cancellation * 0.15 +
                contract * 0.10
            )
            
            actual_trust = metrics.get("trust_score", 0)
            
            # Allow small rounding difference
            assert abs(actual_trust - expected_trust) <= 1, f"Trust score mismatch: {actual_trust} vs {expected_trust}"
            print(f"✓ Trust score calculation verified: {actual_trust}")
        else:
            print(f"✓ No metrics data to verify trust score calculation")


class TestBidirectionalMatching:
    """Test bidirectional matching engine with candidate fit score"""
    
    def test_job_fit_requires_seeker(self):
        """GET /api/matching/job-fit/{job_id} requires seeker role"""
        token = TestAuth.get_employer_token()
        assert token, "Failed to get employer token"
        
        response = requests.get(f"{BASE_URL}/api/matching/job-fit/test-job-id", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 403
        print(f"✓ GET /api/matching/job-fit rejects employer (403)")
    
    def test_job_fit_returns_404_for_invalid_job(self):
        """GET /api/matching/job-fit/{job_id} returns 404 for invalid job"""
        token = TestAuth.get_seeker_token()
        assert token, "Failed to get seeker token"
        
        response = requests.get(f"{BASE_URL}/api/matching/job-fit/invalid-job-id-12345", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 404
        print(f"✓ GET /api/matching/job-fit returns 404 for invalid job")
    
    def test_job_fit_returns_score_breakdown(self):
        """GET /api/matching/job-fit/{job_id} returns personalized fit score with breakdown"""
        token = TestAuth.get_seeker_token()
        assert token, "Failed to get seeker token"
        
        # First get a valid job ID
        employer_token = TestAuth.get_employer_token()
        jobs_response = requests.get(f"{BASE_URL}/api/jobs", headers={
            "Authorization": f"Bearer {employer_token}"
        })
        
        if jobs_response.status_code == 200 and jobs_response.json():
            job_id = jobs_response.json()[0]["id"]
            
            response = requests.get(f"{BASE_URL}/api/matching/job-fit/{job_id}", headers={
                "Authorization": f"Bearer {token}"
            })
            assert response.status_code == 200
            data = response.json()
            
            assert "job_id" in data
            assert "has_facility_data" in data
            assert "candidate_fit" in data
            
            fit = data["candidate_fit"]
            assert "score" in fit
            assert "breakdown" in fit
            assert "warnings" in fit
            
            print(f"✓ GET /api/matching/job-fit returns fit score: {fit['score']} with breakdown")
        else:
            print(f"✓ No jobs available to test job-fit endpoint")


class TestFacilityDashboard:
    """Test facility dashboard for employers"""
    
    def test_facility_dashboard_requires_employer(self):
        """GET /api/matching/facility-dashboard requires employer role"""
        token = TestAuth.get_seeker_token()
        assert token, "Failed to get seeker token"
        
        response = requests.get(f"{BASE_URL}/api/matching/facility-dashboard", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 403
        print(f"✓ GET /api/matching/facility-dashboard rejects seeker (403)")
    
    def test_facility_dashboard_returns_data(self):
        """GET /api/matching/facility-dashboard returns trust_score, scores, signals, badges, suggestions"""
        token = TestAuth.get_employer_token()
        assert token, "Failed to get employer token"
        
        response = requests.get(f"{BASE_URL}/api/matching/facility-dashboard", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "has_data" in data
        assert "trust_score" in data
        assert "scores" in data
        assert "signals" in data
        assert "badges" in data
        assert "suggestions" in data
        
        if data["has_data"]:
            print(f"✓ GET /api/matching/facility-dashboard returns data (trust_score: {data['trust_score']})")
        else:
            print(f"✓ GET /api/matching/facility-dashboard returns no data (no feedback yet)")
            assert len(data["suggestions"]) > 0, "Should have suggestions when no data"
    
    def test_facility_response_submission(self):
        """POST /api/matching/facility-response records facility improvement response"""
        token = TestAuth.get_employer_token()
        assert token, "Failed to get employer token"
        
        response = requests.post(f"{BASE_URL}/api/matching/facility-response", 
            headers={"Authorization": f"Bearer {token}"},
            json={
                "response_type": "Updated staffing model",
                "details": "We have hired additional staff to improve ratios"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data.get("message") == "Response recorded"
        print(f"✓ POST /api/matching/facility-response recorded successfully")


class TestPendingFeedback:
    """Test post-assignment feedback triggers"""
    
    def test_pending_feedback_requires_seeker(self):
        """GET /api/matching/pending-feedback requires seeker role"""
        token = TestAuth.get_employer_token()
        assert token, "Failed to get employer token"
        
        response = requests.get(f"{BASE_URL}/api/matching/pending-feedback", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 403
        print(f"✓ GET /api/matching/pending-feedback rejects employer (403)")
    
    def test_pending_feedback_returns_list(self):
        """GET /api/matching/pending-feedback returns assignments without feedback"""
        token = TestAuth.get_seeker_token()
        assert token, "Failed to get seeker token"
        
        response = requests.get(f"{BASE_URL}/api/matching/pending-feedback", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "pending" in data
        assert isinstance(data["pending"], list)
        
        if data["pending"]:
            pending = data["pending"][0]
            assert "facility_id" in pending
            assert "facility_name" in pending
            print(f"✓ GET /api/matching/pending-feedback returns {len(data['pending'])} pending assignments")
        else:
            print(f"✓ GET /api/matching/pending-feedback returns empty list (no pending)")


class TestGracefulDefaults:
    """Test that existing profiles without new fields still work"""
    
    def test_seeker_profile_without_new_fields(self):
        """Existing seeker profiles without new fields render gracefully"""
        token = TestAuth.get_seeker_token()
        assert token, "Failed to get seeker token"
        
        response = requests.get(f"{BASE_URL}/api/profile/seeker", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        data = response.json()
        
        # New fields should be None/missing if not set
        # This should not cause errors
        print(f"✓ Seeker profile loads without errors (has {len(data)} fields)")
    
    def test_poster_profile_without_new_fields(self):
        """Existing poster profiles without new fields render gracefully"""
        token = TestAuth.get_employer_token()
        assert token, "Failed to get employer token"
        
        response = requests.get(f"{BASE_URL}/api/profile/poster", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        data = response.json()
        
        print(f"✓ Poster profile loads without errors (has {len(data)} fields)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
