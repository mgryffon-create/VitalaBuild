"""Regression tests: unknown roles never become unrestricted discovery results."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from eligibility import check_role_eligibility, get_accepted_roles_for_job

RN = {"normalized_role_category": "RN"}
CNA = {"normalized_role_category": "CNA"}
RT = {"normalized_role_category": "RT"}
JOBS = [
    {"primary_role_category": "RN", "accepted_role_categories": ["RN"], "specialty": "Registered Nurse (RN) - ICU"},
    {"primary_role_category": "CNA", "accepted_role_categories": ["CNA"], "specialty": "Certified Nursing Assistant (CNA)"},
    {"primary_role_category": "RT", "accepted_role_categories": ["RT"], "specialty": "Respiratory Therapist (RT)"},
]


def test_unknown_seeker_role_never_unlocks_all_jobs():
    assert all(not check_role_eligibility({}, job)["eligible"] for job in JOBS)


def test_unknown_job_role_not_exposed_to_any_seeker():
    for seeker in [RN, CNA, RT]:
        assert not check_role_eligibility(seeker, {})["eligible"]


def test_each_role_gets_only_its_own_job():
    for seeker, expected in [(RN, "RN"), (CNA, "CNA"), (RT, "RT")]:
        matches = [get_accepted_roles_for_job(job)[0] for job in JOBS if check_role_eligibility(seeker, job)["eligible"]]
        assert matches == [expected]


def test_explicit_employer_multirole_acceptance_is_respected():
    job = {"primary_role_category": "RN", "accepted_role_categories": ["RN", "LPN"]}
    assert check_role_eligibility(RN, job)["eligible"]
    assert check_role_eligibility({"normalized_role_category": "LPN"}, job)["eligible"]
    assert not check_role_eligibility(CNA, job)["eligible"]
    assert not check_role_eligibility(RT, job)["eligible"]


def test_legacy_job_role_can_be_inferred_from_specialty():
    assert check_role_eligibility(RN, {"specialty": "Registered Nurse (RN) - ICU"})["eligible"]
    assert not check_role_eligibility(CNA, {"specialty": "Registered Nurse (RN) - ICU"})["eligible"]
