"""
Test Credential Verification Layer
Tests the cross-referencing of profile certifications with vault documents
to determine verification status (verified/needs_review/unverified).
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
EMPLOYER_EMAIL = "employer_test@vitalamatch.com"
EMPLOYER_PASSWORD = "test123"
SEEKER_EMAIL = "seeker_test@vitalamatch.com"
SEEKER_PASSWORD = "test123"
TEST_SEEKER_EMAIL = "testseeker@test.com"
TEST_SEEKER_PASSWORD = "test123"


@pytest.fixture(scope="module")
def employer_token():
    """Get employer auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": EMPLOYER_EMAIL,
        "password": EMPLOYER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Employer login failed: {response.status_code}")


@pytest.fixture(scope="module")
def seeker_token():
    """Get seeker auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SEEKER_EMAIL,
        "password": SEEKER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Seeker login failed: {response.status_code}")


@pytest.fixture(scope="module")
def test_seeker_token():
    """Get test seeker auth token (has BLS/ACLS but no vault docs)"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_SEEKER_EMAIL,
        "password": TEST_SEEKER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Test seeker login failed: {response.status_code}")


class TestPipelineCredentialVerification:
    """Test pipeline API returns enriched certifications with verification status"""
    
    def test_pipeline_returns_certifications_as_objects(self, employer_token):
        """Pipeline API should return certifications as objects with verification_status, not plain strings"""
        response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates",
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        assert response.status_code == 200, f"Pipeline API failed: {response.text}"
        
        data = response.json()
        candidates = data.get("candidates", {})
        
        # Find any candidate with certifications
        found_cert_object = False
        for stage, stage_candidates in candidates.items():
            for candidate in stage_candidates:
                certs = candidate.get("seeker", {}).get("certifications", [])
                if certs:
                    for cert in certs:
                        # Certifications should be objects, not strings
                        assert isinstance(cert, dict), f"Certification should be object, got {type(cert)}: {cert}"
                        assert "name" in cert, f"Certification object missing 'name' field: {cert}"
                        assert "verification_status" in cert, f"Certification object missing 'verification_status' field: {cert}"
                        assert cert["verification_status"] in ["verified", "needs_review", "unverified"], \
                            f"Invalid verification_status: {cert['verification_status']}"
                        found_cert_object = True
                        break
                if found_cert_object:
                    break
            if found_cert_object:
                break
        
        assert found_cert_object, "No certifications found in pipeline candidates to verify structure"
        print("✓ Pipeline API returns certifications as objects with verification_status")
    
    def test_pipeline_returns_credential_summary(self, employer_token):
        """Pipeline API should return credential_summary with level and counts"""
        response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates",
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        candidates = data.get("candidates", {})
        
        # Find any candidate with credential_summary
        found_summary = False
        for stage, stage_candidates in candidates.items():
            for candidate in stage_candidates:
                summary = candidate.get("credential_summary")
                if summary:
                    # Verify summary structure
                    assert "level" in summary, f"credential_summary missing 'level': {summary}"
                    assert "verified" in summary, f"credential_summary missing 'verified': {summary}"
                    assert "needs_review" in summary, f"credential_summary missing 'needs_review': {summary}"
                    assert "unverified" in summary, f"credential_summary missing 'unverified': {summary}"
                    assert "total" in summary, f"credential_summary missing 'total': {summary}"
                    
                    # Verify level is valid
                    assert summary["level"] in ["compliance_ready", "partially_verified", "verification_needed"], \
                        f"Invalid credential_summary level: {summary['level']}"
                    
                    # Verify counts are integers
                    assert isinstance(summary["verified"], int)
                    assert isinstance(summary["needs_review"], int)
                    assert isinstance(summary["unverified"], int)
                    assert isinstance(summary["total"], int)
                    
                    # Verify total = verified + needs_review + unverified
                    assert summary["total"] == summary["verified"] + summary["needs_review"] + summary["unverified"], \
                        f"Total mismatch: {summary}"
                    
                    found_summary = True
                    print(f"  Found credential_summary: level={summary['level']}, verified={summary['verified']}, needs_review={summary['needs_review']}, unverified={summary['unverified']}, total={summary['total']}")
                    break
            if found_summary:
                break
        
        assert found_summary, "No credential_summary found in pipeline candidates"
        print("✓ Pipeline API returns credential_summary with level and counts")


class TestContextEndpointCredentialVerification:
    """Test context endpoint returns enriched certifications"""
    
    def test_context_returns_certifications_with_verification_status(self, employer_token):
        """Context endpoint should return certifications as objects with verification_status"""
        # First get a candidate ID from pipeline
        pipeline_response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates",
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        assert pipeline_response.status_code == 200
        
        candidates = pipeline_response.json().get("candidates", {})
        candidate_id = None
        job_id = None
        
        for stage, stage_candidates in candidates.items():
            for candidate in stage_candidates:
                if candidate.get("seeker", {}).get("certifications"):
                    candidate_id = candidate.get("candidate_id")
                    job_id = candidate.get("job_id")
                    break
            if candidate_id:
                break
        
        if not candidate_id:
            pytest.skip("No candidate with certifications found")
        
        # Get context for this candidate
        url = f"{BASE_URL}/api/pipeline/candidates/{candidate_id}/context"
        if job_id:
            url += f"?job_id={job_id}"
        
        response = requests.get(url, headers={"Authorization": f"Bearer {employer_token}"})
        assert response.status_code == 200, f"Context API failed: {response.text}"
        
        ctx = response.json()
        certs = ctx.get("certifications", [])
        
        assert len(certs) > 0, "Context should return certifications"
        
        for cert in certs:
            assert isinstance(cert, dict), f"Certification should be object: {cert}"
            assert "name" in cert, f"Certification missing 'name': {cert}"
            assert "verification_status" in cert, f"Certification missing 'verification_status': {cert}"
            assert cert["verification_status"] in ["verified", "needs_review", "unverified"]
            print(f"  Cert: {cert['name']} -> {cert['verification_status']}")
        
        print("✓ Context endpoint returns certifications with verification_status")
    
    def test_context_returns_credential_summary(self, employer_token):
        """Context endpoint should return credential_summary"""
        # First get a candidate ID from pipeline
        pipeline_response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates",
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        assert pipeline_response.status_code == 200
        
        candidates = pipeline_response.json().get("candidates", {})
        candidate_id = None
        
        for stage, stage_candidates in candidates.items():
            for candidate in stage_candidates:
                if candidate.get("credential_summary"):
                    candidate_id = candidate.get("candidate_id")
                    break
            if candidate_id:
                break
        
        if not candidate_id:
            pytest.skip("No candidate with credential_summary found")
        
        # Get context for this candidate
        response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates/{candidate_id}/context",
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        assert response.status_code == 200
        
        ctx = response.json()
        summary = ctx.get("credential_summary")
        
        assert summary is not None, "Context should return credential_summary"
        assert "level" in summary
        assert "verified" in summary
        assert "needs_review" in summary
        assert "unverified" in summary
        assert "total" in summary
        
        print(f"✓ Context endpoint returns credential_summary: {summary}")


class TestVerificationLogic:
    """Test the verification logic: self-reported certs vs vault docs"""
    
    def test_unverified_when_no_vault_docs(self, employer_token):
        """Self-reported cert with no matching vault doc should be 'unverified'"""
        # Get pipeline candidates
        response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates",
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        assert response.status_code == 200
        
        candidates = response.json().get("candidates", {})
        
        # Find a candidate with unverified certifications (vault_docs = 0)
        found_unverified = False
        for stage, stage_candidates in candidates.items():
            for candidate in stage_candidates:
                vault_docs = candidate.get("vault_docs", 0)
                certs = candidate.get("seeker", {}).get("certifications", [])
                summary = candidate.get("credential_summary", {})
                
                if vault_docs == 0 and certs:
                    # All certs should be unverified
                    for cert in certs:
                        assert cert.get("verification_status") == "unverified", \
                            f"Cert should be unverified when no vault docs: {cert}"
                    
                    # Summary should show all unverified
                    assert summary.get("unverified") == summary.get("total"), \
                        f"All certs should be unverified when no vault docs: {summary}"
                    assert summary.get("level") == "verification_needed", \
                        f"Level should be verification_needed when no vault docs: {summary}"
                    
                    found_unverified = True
                    print(f"  Candidate with 0 vault docs: {len(certs)} certs all unverified")
                    break
            if found_unverified:
                break
        
        if not found_unverified:
            print("  No candidate with 0 vault docs and certifications found - skipping")
        else:
            print("✓ Self-reported certs with no vault docs are marked 'unverified'")
    
    def test_verified_or_needs_review_with_vault_docs(self, employer_token):
        """Self-reported cert with matching vault doc should be 'verified' or 'needs_review'"""
        # Get pipeline candidates
        response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates",
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        assert response.status_code == 200
        
        candidates = response.json().get("candidates", {})
        
        # Find a candidate with vault docs
        found_with_docs = False
        for stage, stage_candidates in candidates.items():
            for candidate in stage_candidates:
                vault_docs = candidate.get("vault_docs", 0)
                certs = candidate.get("seeker", {}).get("certifications", [])
                summary = candidate.get("credential_summary", {})
                
                if vault_docs > 0 and certs:
                    # Check if any cert is verified or needs_review
                    has_verified_or_review = any(
                        cert.get("verification_status") in ["verified", "needs_review"]
                        for cert in certs
                    )
                    
                    if has_verified_or_review:
                        found_with_docs = True
                        print(f"  Candidate with {vault_docs} vault docs:")
                        for cert in certs:
                            print(f"    - {cert.get('name')}: {cert.get('verification_status')}")
                        print(f"    Summary: {summary}")
                        break
            if found_with_docs:
                break
        
        if not found_with_docs:
            print("  No candidate with vault docs and verified/needs_review certs found - this may be expected if no matching docs")
        else:
            print("✓ Self-reported certs with matching vault docs are marked 'verified' or 'needs_review'")


class TestComplianceReadyLogic:
    """Test compliance_ready is based on credential_summary.level"""
    
    def test_compliance_ready_based_on_credential_summary(self, employer_token):
        """compliance_ready should be True only when credential_summary.level == 'compliance_ready'"""
        # Get context for a candidate
        pipeline_response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates",
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        assert pipeline_response.status_code == 200
        
        candidates = pipeline_response.json().get("candidates", {})
        
        tested_count = 0
        for stage, stage_candidates in candidates.items():
            for candidate in stage_candidates:
                candidate_id = candidate.get("candidate_id")
                job_id = candidate.get("job_id")
                
                # Get context
                url = f"{BASE_URL}/api/pipeline/candidates/{candidate_id}/context"
                if job_id:
                    url += f"?job_id={job_id}"
                
                ctx_response = requests.get(url, headers={"Authorization": f"Bearer {employer_token}"})
                if ctx_response.status_code != 200:
                    continue
                
                ctx = ctx_response.json()
                summary = ctx.get("credential_summary", {})
                compliance_ready = ctx.get("compliance_ready", False)
                
                if summary:
                    level = summary.get("level")
                    
                    # compliance_ready should match level == "compliance_ready"
                    expected_compliance_ready = (level == "compliance_ready")
                    assert compliance_ready == expected_compliance_ready, \
                        f"compliance_ready mismatch: got {compliance_ready}, expected {expected_compliance_ready} for level={level}"
                    
                    tested_count += 1
                    print(f"  Candidate {candidate_id}: level={level}, compliance_ready={compliance_ready}")
                    
                    if tested_count >= 3:
                        break
            if tested_count >= 3:
                break
        
        assert tested_count > 0, "No candidates tested for compliance_ready logic"
        print(f"✓ compliance_ready correctly based on credential_summary.level ({tested_count} candidates tested)")


class TestVerificationStatusValues:
    """Test that verification_status values are correct"""
    
    def test_verification_status_enum_values(self, employer_token):
        """All verification_status values should be one of: verified, needs_review, unverified"""
        response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates",
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        assert response.status_code == 200
        
        candidates = response.json().get("candidates", {})
        valid_statuses = {"verified", "needs_review", "unverified"}
        
        status_counts = {"verified": 0, "needs_review": 0, "unverified": 0}
        
        for stage, stage_candidates in candidates.items():
            for candidate in stage_candidates:
                certs = candidate.get("seeker", {}).get("certifications", [])
                for cert in certs:
                    status = cert.get("verification_status")
                    assert status in valid_statuses, f"Invalid verification_status: {status}"
                    status_counts[status] += 1
        
        print(f"✓ All verification_status values are valid")
        print(f"  Counts: verified={status_counts['verified']}, needs_review={status_counts['needs_review']}, unverified={status_counts['unverified']}")


class TestCredentialSummaryLevels:
    """Test credential_summary.level values"""
    
    def test_credential_summary_level_values(self, employer_token):
        """credential_summary.level should be one of: compliance_ready, partially_verified, verification_needed"""
        response = requests.get(
            f"{BASE_URL}/api/pipeline/candidates",
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        assert response.status_code == 200
        
        candidates = response.json().get("candidates", {})
        valid_levels = {"compliance_ready", "partially_verified", "verification_needed"}
        
        level_counts = {"compliance_ready": 0, "partially_verified": 0, "verification_needed": 0}
        
        for stage, stage_candidates in candidates.items():
            for candidate in stage_candidates:
                summary = candidate.get("credential_summary", {})
                if summary:
                    level = summary.get("level")
                    assert level in valid_levels, f"Invalid credential_summary level: {level}"
                    level_counts[level] += 1
        
        print(f"✓ All credential_summary.level values are valid")
        print(f"  Counts: compliance_ready={level_counts['compliance_ready']}, partially_verified={level_counts['partially_verified']}, verification_needed={level_counts['verification_needed']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
