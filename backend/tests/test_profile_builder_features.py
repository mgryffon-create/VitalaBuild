"""
Test ProfileBuilder P0 Features:
1. Structured address fields (street_address, city, state, zip)
2. Role Category dropdown (normalized_role_category)
3. PUT/GET /api/profile/seeker saves and returns these fields
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_SEEKER_EMAIL = "testseeker@test.com"
TEST_SEEKER_PASSWORD = "Test1234!"


class TestProfileBuilderFeatures:
    """Test ProfileBuilder P0 features for seeker profile"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_SEEKER_EMAIL,
            "password": TEST_SEEKER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        self.user_id = data["user"]["id"]
    
    def test_put_profile_with_structured_address(self):
        """Test PUT /api/profile/seeker saves structured address fields"""
        profile_data = {
            "contact_info": {
                "email": TEST_SEEKER_EMAIL,
                "phone": "555-123-4567",
                "street_address": "456 Oak Avenue",
                "city": "Dallas",
                "state": "TX",
                "zip": "75201"
            },
            "specialty": "Registered Nurse (RN) - ICU/Critical Care"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/profile/seeker",
            headers=self.headers,
            json=profile_data
        )
        
        assert response.status_code == 200, f"PUT failed: {response.text}"
        assert response.json()["message"] == "Profile updated successfully"
        print("SUCCESS: PUT /api/profile/seeker with structured address")
    
    def test_get_profile_returns_structured_address(self):
        """Test GET /api/profile/seeker returns structured address fields"""
        # First set the data
        profile_data = {
            "contact_info": {
                "email": TEST_SEEKER_EMAIL,
                "phone": "555-123-4567",
                "street_address": "789 Pine Street",
                "city": "Houston",
                "state": "TX",
                "zip": "77001"
            }
        }
        
        put_response = requests.put(
            f"{BASE_URL}/api/profile/seeker",
            headers=self.headers,
            json=profile_data
        )
        assert put_response.status_code == 200
        
        # Now GET and verify
        response = requests.get(
            f"{BASE_URL}/api/profile/seeker",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"GET failed: {response.text}"
        data = response.json()
        
        # Verify structured address fields
        contact_info = data.get("contact_info", {})
        assert contact_info.get("street_address") == "789 Pine Street", f"street_address mismatch: {contact_info}"
        assert contact_info.get("city") == "Houston", f"city mismatch: {contact_info}"
        assert contact_info.get("state") == "TX", f"state mismatch: {contact_info}"
        assert contact_info.get("zip") == "77001", f"zip mismatch: {contact_info}"
        print("SUCCESS: GET /api/profile/seeker returns structured address fields")
    
    def test_put_profile_with_normalized_role_category(self):
        """Test PUT /api/profile/seeker saves normalized_role_category"""
        profile_data = {
            "normalized_role_category": "RN",
            "specialty": "Registered Nurse (RN) - ICU/Critical Care"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/profile/seeker",
            headers=self.headers,
            json=profile_data
        )
        
        assert response.status_code == 200, f"PUT failed: {response.text}"
        print("SUCCESS: PUT /api/profile/seeker with normalized_role_category")
    
    def test_get_profile_returns_normalized_role_category(self):
        """Test GET /api/profile/seeker returns normalized_role_category"""
        # First set the data
        profile_data = {
            "normalized_role_category": "NP",
            "specialty": "Nurse Practitioner (NP) - Family"
        }
        
        put_response = requests.put(
            f"{BASE_URL}/api/profile/seeker",
            headers=self.headers,
            json=profile_data
        )
        assert put_response.status_code == 200
        
        # Now GET and verify
        response = requests.get(
            f"{BASE_URL}/api/profile/seeker",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"GET failed: {response.text}"
        data = response.json()
        
        assert data.get("normalized_role_category") == "NP", f"normalized_role_category mismatch: {data}"
        print("SUCCESS: GET /api/profile/seeker returns normalized_role_category")
    
    def test_all_canonical_roles_accepted(self):
        """Test that all canonical roles are accepted by the API"""
        canonical_roles = [
            "CNA", "LPN", "RN", "NP", "CRNA", "PA",
            "RT", "OT", "PT", "ST", "MEDICAL_ASSISTANT", "PHLEBOTOMIST", "RADIOLOGY_TECH"
        ]
        
        for role in canonical_roles:
            profile_data = {
                "normalized_role_category": role
            }
            
            response = requests.put(
                f"{BASE_URL}/api/profile/seeker",
                headers=self.headers,
                json=profile_data
            )
            
            assert response.status_code == 200, f"PUT failed for role {role}: {response.text}"
            
            # Verify it was saved
            get_response = requests.get(
                f"{BASE_URL}/api/profile/seeker",
                headers=self.headers
            )
            assert get_response.status_code == 200
            assert get_response.json().get("normalized_role_category") == role, f"Role {role} not saved correctly"
        
        print(f"SUCCESS: All {len(canonical_roles)} canonical roles accepted and saved")
    
    def test_combined_profile_update(self):
        """Test updating profile with all new fields together"""
        profile_data = {
            "contact_info": {
                "email": TEST_SEEKER_EMAIL,
                "phone": "555-999-8888",
                "street_address": "100 Healthcare Blvd",
                "city": "San Antonio",
                "state": "TX",
                "zip": "78201"
            },
            "normalized_role_category": "CRNA",
            "specialty": "Certified Registered Nurse Anesthetist (CRNA)",
            "years_experience": 10,
            "bio": "Experienced CRNA with 10 years in surgical settings"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/profile/seeker",
            headers=self.headers,
            json=profile_data
        )
        
        assert response.status_code == 200, f"PUT failed: {response.text}"
        
        # Verify all fields
        get_response = requests.get(
            f"{BASE_URL}/api/profile/seeker",
            headers=self.headers
        )
        
        assert get_response.status_code == 200
        data = get_response.json()
        
        # Verify contact_info
        contact = data.get("contact_info", {})
        assert contact.get("street_address") == "100 Healthcare Blvd"
        assert contact.get("city") == "San Antonio"
        assert contact.get("state") == "TX"
        assert contact.get("zip") == "78201"
        
        # Verify role category
        assert data.get("normalized_role_category") == "CRNA"
        
        # Verify other fields
        assert data.get("specialty") == "Certified Registered Nurse Anesthetist (CRNA)"
        assert data.get("years_experience") == 10
        
        print("SUCCESS: Combined profile update with all new fields")
    
    def test_get_canonical_roles_endpoint(self):
        """Test GET /api/roles/canonical returns all canonical roles"""
        response = requests.get(
            f"{BASE_URL}/api/roles/canonical",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"GET failed: {response.text}"
        data = response.json()
        
        assert "roles" in data, "Response missing 'roles' key"
        roles = data["roles"]
        
        expected_roles = [
            "CNA", "LPN", "RN", "NP", "CRNA", "PA",
            "RT", "OT", "PT", "ST", "MEDICAL_ASSISTANT", "PHLEBOTOMIST", "RADIOLOGY_TECH"
        ]
        
        for role in expected_roles:
            assert role in roles, f"Missing canonical role: {role}"
        
        print(f"SUCCESS: GET /api/roles/canonical returns {len(roles)} roles")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
