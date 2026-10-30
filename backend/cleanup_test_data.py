"""Legacy test-data cleanup is intentionally disabled after the database migration.

Start the separate Supabase project empty. Do not run blanket cleanup against
Supabase; test fixtures must remove only the rows they create.
"""
if __name__ == "__main__":
    raise SystemExit("Legacy cleanup is disabled; use isolated test fixtures.")
