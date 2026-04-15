# VitalaMatch Test Credentials

## Post-Cleanup (April 15, 2026)
All test/demo data has been removed. Only real users remain.

### Preserved Accounts
| Role | Email | Password | Notes |
|---|---|---|---|
| Admin | admin@vitalamatch.com | admin123 | System administrator |
| Seeker | mgryffon@outlook.com | (user-set) | Rachelle Olsen - real seeker |
| Seeker | r.l.olsen@outlook.com | (user-set) | Mary Lou - real seeker |
| Poster | janedue@gmail.com | (user-set) | Jane Due - real employer |
| Poster | stampd_ut@outlook.com | (user-set) | mary john - real employer |

### Database State
- 5 users, 0 test data
- Backup at: `/app/backups/mongodb_snapshot_20260415_002446`
- Restore: `mongorestore --uri="mongodb://localhost:27017" --db=test_database --drop /app/backups/mongodb_snapshot_20260415_002446/test_database/`
