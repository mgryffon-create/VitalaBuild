"""
Migration: Normalize role categories on existing jobs and seeker profiles.
Run once to populate primary_role_category, accepted_role_categories, normalized_role_category.
Conservative: ambiguous titles get None (flagged for manual review).
"""
import asyncio
import os
from postgres_store import db
from eligibility import normalize_role_from_specialty, normalize_role

async def migrate():

    # ── Normalize Jobs ──
    jobs = await db.jobs.find({}, {"_id": 0, "id": 1, "title": 1, "specialty": 1, "primary_role_category": 1}).to_list(1000)
    job_updated = 0
    job_flagged = 0
    for job in jobs:
        if job.get("primary_role_category"):
            continue  # Already set
        # Try specialty first (more structured), then title
        role = normalize_role_from_specialty(job.get("specialty", ""))
        if not role:
            role = normalize_role(job.get("title", ""))
        if role:
            await db.jobs.update_one(
                {"id": job["id"]},
                {"$set": {
                    "primary_role_category": role,
                    "accepted_role_categories": [role],
                }}
            )
            job_updated += 1
            print(f"  Job '{job.get('title', '?')[:50]}' → {role}")
        else:
            job_flagged += 1
            print(f"  FLAGGED Job '{job.get('title', '?')[:50]}' (specialty: {job.get('specialty', '?')[:30]}) — cannot determine role")

    # ── Normalize Seeker Profiles ──
    profiles = await db.seeker_profiles.find({}, {"_id": 0, "user_id": 1, "specialty": 1, "normalized_role_category": 1}).to_list(1000)
    seeker_updated = 0
    seeker_flagged = 0
    for profile in profiles:
        if profile.get("normalized_role_category"):
            continue  # Already set
        role = normalize_role_from_specialty(profile.get("specialty", ""))
        if role:
            await db.seeker_profiles.update_one(
                {"user_id": profile["user_id"]},
                {"$set": {"normalized_role_category": role}}
            )
            seeker_updated += 1
            print(f"  Seeker {profile['user_id'][:12]}... → {role} (from: {profile.get('specialty', '?')[:30]})")
        else:
            seeker_flagged += 1
            print(f"  FLAGGED Seeker {profile['user_id'][:12]}... (specialty: {profile.get('specialty', '?')[:30]}) — cannot determine role")

    # ── Flag Invalid Existing Matches ──
    matches = await db.matches.find({"status": {"$ne": "invalid"}}, {"_id": 0, "id": 1, "seeker_id": 1, "job_id": 1}).to_list(5000)
    invalid_count = 0
    for match in matches:
        job = await db.jobs.find_one({"id": match["job_id"]}, {"_id": 0, "primary_role_category": 1, "accepted_role_categories": 1, "specialty": 1})
        profile = await db.seeker_profiles.find_one({"user_id": match["seeker_id"]}, {"_id": 0, "normalized_role_category": 1, "specialty": 1})
        if not job or not profile:
            continue
        seeker_role = (profile.get("normalized_role_category") or "").upper()
        job_roles = [r.upper() for r in (job.get("accepted_role_categories") or [])]
        if seeker_role and job_roles and seeker_role not in job_roles:
            await db.matches.update_one(
                {"id": match["id"]},
                {"$set": {"status": "invalid", "invalid_reason": f"role_mismatch: {seeker_role} not in {job_roles}"}}
            )
            invalid_count += 1
            print(f"  INVALID Match {match['id'][:12]}... (seeker={seeker_role}, job={job_roles})")

    print(f"\n=== Migration Complete ===")
    print(f"Jobs: {job_updated} updated, {job_flagged} flagged for review")
    print(f"Seekers: {seeker_updated} updated, {seeker_flagged} flagged for review")
    print(f"Matches: {invalid_count} flagged as invalid")


if __name__ == "__main__":
    asyncio.run(migrate())
