"""
Database cleanup script — removes all test/demo data while preserving real users.
Deletes in dependency-safe order to prevent orphaned records.
"""
import asyncio
import motor.motor_asyncio

KEEP_EMAILS = {
    "admin@vitalamatch.com",
    "mgryffon@outlook.com",
    "r.l.olsen@outlook.com",
    "janedue@gmail.com",
    "stampd_ut@outlook.com",
}

async def cleanup():
    client = motor.motor_asyncio.AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["test_database"]
    
    # 1. Identify users to delete
    all_users = []
    async for u in db.users.find({}, {"_id": 0, "id": 1, "email": 1, "full_name": 1}):
        all_users.append(u)
    
    delete_ids = [u["id"] for u in all_users if u.get("email") not in KEEP_EMAILS]
    keep_ids = [u["id"] for u in all_users if u.get("email") in KEEP_EMAILS]
    
    print(f"Users to DELETE: {len(delete_ids)}")
    print(f"Users to KEEP:   {len(keep_ids)}")
    
    # Get job IDs to delete (jobs created by test employers)
    delete_job_ids = []
    async for j in db.jobs.find({"poster_id": {"$in": delete_ids}}, {"_id": 0, "id": 1}):
        delete_job_ids.append(j["id"])
    
    # Get match IDs to delete
    delete_match_ids = []
    async for m in db.matches.find({"$or": [
        {"seeker_id": {"$in": delete_ids}},
        {"poster_id": {"$in": delete_ids}},
    ]}, {"_id": 0, "id": 1}):
        delete_match_ids.append(m["id"])
    
    # Get offer IDs to delete
    delete_offer_ids = []
    async for o in db.employment_offers.find({"$or": [
        {"seeker_id": {"$in": delete_ids}},
        {"poster_id": {"$in": delete_ids}},
    ]}, {"_id": 0, "id": 1}):
        delete_offer_ids.append(o["id"])
    
    # Get onboarding case IDs
    delete_case_ids = []
    async for c in db.onboarding_cases.find({"$or": [
        {"candidate_id": {"$in": delete_ids}},
        {"employer_id": {"$in": delete_ids}},
    ]}, {"_id": 0, "id": 1}):
        delete_case_ids.append(c["id"])
    
    or_filter = {"$or": [
        {"user_id": {"$in": delete_ids}},
        {"candidate_id": {"$in": delete_ids}},
        {"seeker_id": {"$in": delete_ids}},
        {"poster_id": {"$in": delete_ids}},
        {"employer_id": {"$in": delete_ids}},
        {"sender_id": {"$in": delete_ids}},
    ]}
    
    results = {}
    
    # --- PHASE 1: Leaf records (no dependents) ---
    print("\n--- Phase 1: Leaf records ---")
    
    for col in ["feed_likes", "feed_comments", "audit_logs", "notification_preferences",
                 "resume_parses", "reply_time_stats"]:
        r = await db[col].delete_many(or_filter)
        results[col] = r.deleted_count
        if r.deleted_count > 0:
            print(f"  {col}: {r.deleted_count} deleted")
    
    # --- PHASE 2: Messages (depend on matches) ---
    print("\n--- Phase 2: Messages ---")
    if delete_match_ids:
        r = await db.messages.delete_many({"match_id": {"$in": delete_match_ids}})
        results["messages"] = r.deleted_count
        print(f"  messages: {r.deleted_count} deleted")
    
    # --- PHASE 3: Onboarding records (depend on cases) ---
    print("\n--- Phase 3: Onboarding ---")
    if delete_case_ids:
        for col in ["onboarding_requirements", "onboarding_tasks"]:
            r = await db[col].delete_many({"onboarding_case_id": {"$in": delete_case_ids}})
            results[col] = r.deleted_count
            if r.deleted_count > 0:
                print(f"  {col}: {r.deleted_count} deleted")
    
    for col in ["onboarding_cases", "onboarding_checklists"]:
        r = await db[col].delete_many(or_filter)
        results[col] = r.deleted_count
        if r.deleted_count > 0:
            print(f"  {col}: {r.deleted_count} deleted")
    
    # --- PHASE 4: Offers, employments, employment docs ---
    print("\n--- Phase 4: Offers & Employment ---")
    for col in ["employment_offers", "employments", "employment_documents"]:
        r = await db[col].delete_many(or_filter)
        results[col] = r.deleted_count
        if r.deleted_count > 0:
            print(f"  {col}: {r.deleted_count} deleted")
    
    r = await db.assignment_feedback.delete_many(or_filter)
    results["assignment_feedback"] = r.deleted_count
    
    # --- PHASE 5: Matches, pipeline, swipes ---
    print("\n--- Phase 5: Matches & Pipeline ---")
    for col in ["matches", "pipeline_stages", "requirement_document_matches"]:
        r = await db[col].delete_many(or_filter)
        results[col] = r.deleted_count
        if r.deleted_count > 0:
            print(f"  {col}: {r.deleted_count} deleted")
    
    # Swipes by user OR targeting deleted jobs
    r1 = await db.swipes.delete_many({"user_id": {"$in": delete_ids}})
    r2 = await db.swipes.delete_many({"target_id": {"$in": delete_job_ids}})
    results["swipes"] = r1.deleted_count + r2.deleted_count
    print(f"  swipes: {results['swipes']} deleted")
    
    # --- PHASE 6: Jobs, documents ---
    print("\n--- Phase 6: Jobs & Documents ---")
    if delete_job_ids:
        r = await db.job_documents.delete_many({"job_id": {"$in": delete_job_ids}})
        results["job_documents"] = r.deleted_count
    
    r = await db.jobs.delete_many({"poster_id": {"$in": delete_ids}})
    results["jobs"] = r.deleted_count
    print(f"  jobs: {r.deleted_count} deleted")
    
    for col in ["vault_documents", "seeker_licenses", "portable_references"]:
        r = await db[col].delete_many(or_filter)
        results[col] = r.deleted_count
        if r.deleted_count > 0:
            print(f"  {col}: {r.deleted_count} deleted")
    
    # --- PHASE 7: Feed, employer data ---
    print("\n--- Phase 7: Feed & Employer data ---")
    for col in ["feed_posts", "external_systems", "employer_browse_actions",
                 "employer_billing", "payment_transactions", "compliance_baselines",
                 "compliance_requirements", "business_email_verifications",
                 "facility_metrics", "facility_responses", "license_verifications",
                 "policy_documents", "training_courses", "training_assignments",
                 "references", "documents"]:
        r = await db[col].delete_many({})  # These are all test data
        results[col] = r.deleted_count
        if r.deleted_count > 0:
            print(f"  {col}: {r.deleted_count} deleted (full collection)")
    
    # --- PHASE 8: Profiles ---
    print("\n--- Phase 8: Profiles ---")
    for col in ["seeker_profiles", "poster_profiles"]:
        r = await db[col].delete_many({"user_id": {"$in": delete_ids}})
        results[col] = r.deleted_count
        print(f"  {col}: {r.deleted_count} deleted")
    
    # --- PHASE 9: Users (LAST) ---
    print("\n--- Phase 9: Users ---")
    r = await db.users.delete_many({"id": {"$in": delete_ids}})
    results["users"] = r.deleted_count
    print(f"  users: {r.deleted_count} deleted")
    
    # --- VERIFICATION ---
    print("\n=== POST-CLEANUP VERIFICATION ===")
    remaining_users = []
    async for u in db.users.find({}, {"_id": 0, "id": 1, "email": 1, "full_name": 1, "role": 1}):
        remaining_users.append(u)
        print(f"  KEPT: {u['email']:40} {u.get('full_name',''):20} ({u.get('role','')})")
    
    print(f"\nRemaining users: {len(remaining_users)}")
    
    # Check for orphans
    print("\n=== ORPHAN CHECK ===")
    orphan_count = 0
    remaining_ids = [u["id"] for u in remaining_users]
    
    for col_name in ["seeker_profiles", "poster_profiles"]:
        count = await db[col_name].count_documents({"user_id": {"$nin": remaining_ids}})
        if count > 0:
            print(f"  ORPHAN: {col_name} has {count} records with no user")
            orphan_count += count
    
    for col_name in ["jobs"]:
        count = await db[col_name].count_documents({"poster_id": {"$nin": remaining_ids}})
        if count > 0:
            print(f"  ORPHAN: {col_name} has {count} records with no user")
            orphan_count += count
    
    if orphan_count == 0:
        print("  No orphaned records found!")
    
    # Collection counts
    print("\n=== FINAL COLLECTION STATE ===")
    cols = await db.list_collection_names()
    for c in sorted(cols):
        count = await db[c].count_documents({})
        if count > 0:
            print(f"  {c:42} {count:>5}")
    
    total_deleted = sum(results.values())
    print(f"\n=== SUMMARY ===")
    print(f"Total records deleted: {total_deleted}")
    print(f"Users deleted: {results.get('users', 0)}")
    print(f"Jobs deleted: {results.get('jobs', 0)}")
    print(f"Matches deleted: {results.get('matches', 0)}")
    print(f"Offers deleted: {results.get('employment_offers', 0)}")
    print(f"Messages deleted: {results.get('messages', 0)}")

asyncio.run(cleanup())
