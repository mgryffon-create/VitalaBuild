-- Backend-only schema: never expose app_private in the Supabase Data API.
-- Nested legacy fields stay in JSONB to preserve the existing API contracts.
-- Each domain has its own table, primary key and query indexes.
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create table app_private."assignment_feedback" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."assignment_feedback" enable row level security;
revoke all on app_private."assignment_feedback" from public, anon, authenticated;
create index "assignment_feedback_data_idx" on app_private."assignment_feedback" using gin (data jsonb_path_ops);
create table app_private."audit_logs" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."audit_logs" enable row level security;
revoke all on app_private."audit_logs" from public, anon, authenticated;
create index "audit_logs_data_idx" on app_private."audit_logs" using gin (data jsonb_path_ops);
create table app_private."business_email_verifications" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."business_email_verifications" enable row level security;
revoke all on app_private."business_email_verifications" from public, anon, authenticated;
create index "business_email_verifications_data_idx" on app_private."business_email_verifications" using gin (data jsonb_path_ops);
create index "business_email_verifications_user_id_idx" on app_private."business_email_verifications" ((data #> '{user_id}'));
create table app_private."compliance_baselines" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."compliance_baselines" enable row level security;
revoke all on app_private."compliance_baselines" from public, anon, authenticated;
create index "compliance_baselines_data_idx" on app_private."compliance_baselines" using gin (data jsonb_path_ops);
create index "compliance_baselines_employer_id_idx" on app_private."compliance_baselines" ((data #> '{employer_id}'));
create table app_private."compliance_requirements" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."compliance_requirements" enable row level security;
revoke all on app_private."compliance_requirements" from public, anon, authenticated;
create index "compliance_requirements_data_idx" on app_private."compliance_requirements" using gin (data jsonb_path_ops);
create index "compliance_requirements_employer_id_idx" on app_private."compliance_requirements" ((data #> '{employer_id}'));
create table app_private."documents" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."documents" enable row level security;
revoke all on app_private."documents" from public, anon, authenticated;
create index "documents_data_idx" on app_private."documents" using gin (data jsonb_path_ops);
create index "documents_id_idx" on app_private."documents" ((data #> '{id}'));
create index "documents_user_id_idx" on app_private."documents" ((data #> '{user_id}'));
create table app_private."employer_billing" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."employer_billing" enable row level security;
revoke all on app_private."employer_billing" from public, anon, authenticated;
create index "employer_billing_data_idx" on app_private."employer_billing" using gin (data jsonb_path_ops);
create index "employer_billing_employer_id_idx" on app_private."employer_billing" ((data #> '{employer_id}'));
create table app_private."employer_browse_actions" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."employer_browse_actions" enable row level security;
revoke all on app_private."employer_browse_actions" from public, anon, authenticated;
create index "employer_browse_actions_data_idx" on app_private."employer_browse_actions" using gin (data jsonb_path_ops);
create index "employer_browse_actions_id_idx" on app_private."employer_browse_actions" ((data #> '{id}'));
create index "employer_browse_actions_employer_id_idx" on app_private."employer_browse_actions" ((data #> '{employer_id}'));
create index "employer_browse_actions_seeker_id_idx" on app_private."employer_browse_actions" ((data #> '{seeker_id}'));
create table app_private."employer_integrations" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."employer_integrations" enable row level security;
revoke all on app_private."employer_integrations" from public, anon, authenticated;
create index "employer_integrations_data_idx" on app_private."employer_integrations" using gin (data jsonb_path_ops);
create index "employer_integrations_user_id_idx" on app_private."employer_integrations" ((data #> '{user_id}'));
create table app_private."employment_documents" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."employment_documents" enable row level security;
revoke all on app_private."employment_documents" from public, anon, authenticated;
create index "employment_documents_data_idx" on app_private."employment_documents" using gin (data jsonb_path_ops);
create table app_private."employment_offers" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."employment_offers" enable row level security;
revoke all on app_private."employment_offers" from public, anon, authenticated;
create index "employment_offers_data_idx" on app_private."employment_offers" using gin (data jsonb_path_ops);
create index "employment_offers_id_idx" on app_private."employment_offers" ((data #> '{id}'));
create index "employment_offers_seeker_id_idx" on app_private."employment_offers" ((data #> '{seeker_id}'));
create index "employment_offers_job_id_idx" on app_private."employment_offers" ((data #> '{job_id}'));
create index "employment_offers_status_idx" on app_private."employment_offers" ((data #> '{status}'));
create table app_private."employment_reviews" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."employment_reviews" enable row level security;
revoke all on app_private."employment_reviews" from public, anon, authenticated;
create index "employment_reviews_data_idx" on app_private."employment_reviews" using gin (data jsonb_path_ops);
create table app_private."employments" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."employments" enable row level security;
revoke all on app_private."employments" from public, anon, authenticated;
create index "employments_data_idx" on app_private."employments" using gin (data jsonb_path_ops);
create index "employments_id_idx" on app_private."employments" ((data #> '{id}'));
create index "employments_seeker_id_idx" on app_private."employments" ((data #> '{seeker_id}'));
create index "employments_poster_id_idx" on app_private."employments" ((data #> '{poster_id}'));
create index "employments_status_idx" on app_private."employments" ((data #> '{status}'));
create table app_private."external_systems" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."external_systems" enable row level security;
revoke all on app_private."external_systems" from public, anon, authenticated;
create index "external_systems_data_idx" on app_private."external_systems" using gin (data jsonb_path_ops);
create index "external_systems_employer_id_idx" on app_private."external_systems" ((data #> '{employer_id}'));
create table app_private."facility_metrics" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."facility_metrics" enable row level security;
revoke all on app_private."facility_metrics" from public, anon, authenticated;
create index "facility_metrics_data_idx" on app_private."facility_metrics" using gin (data jsonb_path_ops);
create table app_private."facility_responses" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."facility_responses" enable row level security;
revoke all on app_private."facility_responses" from public, anon, authenticated;
create index "facility_responses_data_idx" on app_private."facility_responses" using gin (data jsonb_path_ops);
create table app_private."feed_comments" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."feed_comments" enable row level security;
revoke all on app_private."feed_comments" from public, anon, authenticated;
create index "feed_comments_data_idx" on app_private."feed_comments" using gin (data jsonb_path_ops);
create table app_private."feed_likes" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."feed_likes" enable row level security;
revoke all on app_private."feed_likes" from public, anon, authenticated;
create index "feed_likes_data_idx" on app_private."feed_likes" using gin (data jsonb_path_ops);
create index "feed_likes_id_idx" on app_private."feed_likes" ((data #> '{id}'));
create index "feed_likes_user_id_idx" on app_private."feed_likes" ((data #> '{user_id}'));
create index "feed_likes_created_at_idx" on app_private."feed_likes" ((data #> '{created_at}'));
create table app_private."feed_posts" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."feed_posts" enable row level security;
revoke all on app_private."feed_posts" from public, anon, authenticated;
create index "feed_posts_data_idx" on app_private."feed_posts" using gin (data jsonb_path_ops);
create index "feed_posts_id_idx" on app_private."feed_posts" ((data #> '{id}'));
create table app_private."hiring_documents" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."hiring_documents" enable row level security;
revoke all on app_private."hiring_documents" from public, anon, authenticated;
create index "hiring_documents_data_idx" on app_private."hiring_documents" using gin (data jsonb_path_ops);
create index "hiring_documents_id_idx" on app_private."hiring_documents" ((data #> '{id}'));
create table app_private."interview_requests" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."interview_requests" enable row level security;
revoke all on app_private."interview_requests" from public, anon, authenticated;
create index "interview_requests_data_idx" on app_private."interview_requests" using gin (data jsonb_path_ops);
create index "interview_requests_id_idx" on app_private."interview_requests" ((data #> '{id}'));
create index "interview_requests_seeker_id_idx" on app_private."interview_requests" ((data #> '{seeker_id}'));
create index "interview_requests_poster_id_idx" on app_private."interview_requests" ((data #> '{poster_id}'));
create table app_private."job_documents" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."job_documents" enable row level security;
revoke all on app_private."job_documents" from public, anon, authenticated;
create index "job_documents_data_idx" on app_private."job_documents" using gin (data jsonb_path_ops);
create index "job_documents_job_id_idx" on app_private."job_documents" ((data #> '{job_id}'));
create table app_private."jobs" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."jobs" enable row level security;
revoke all on app_private."jobs" from public, anon, authenticated;
create index "jobs_data_idx" on app_private."jobs" using gin (data jsonb_path_ops);
create index "jobs_id_idx" on app_private."jobs" ((data #> '{id}'));
create index "jobs_poster_id_idx" on app_private."jobs" ((data #> '{poster_id}'));
create index "jobs_status_idx" on app_private."jobs" ((data #> '{status}'));
create table app_private."license_verifications" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."license_verifications" enable row level security;
revoke all on app_private."license_verifications" from public, anon, authenticated;
create index "license_verifications_data_idx" on app_private."license_verifications" using gin (data jsonb_path_ops);
create index "license_verifications_id_idx" on app_private."license_verifications" ((data #> '{id}'));
create index "license_verifications_user_id_idx" on app_private."license_verifications" ((data #> '{user_id}'));
create index "license_verifications_status_idx" on app_private."license_verifications" ((data #> '{status}'));
create table app_private."matches" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."matches" enable row level security;
revoke all on app_private."matches" from public, anon, authenticated;
create index "matches_data_idx" on app_private."matches" using gin (data jsonb_path_ops);
create index "matches_id_idx" on app_private."matches" ((data #> '{id}'));
create index "matches_seeker_id_idx" on app_private."matches" ((data #> '{seeker_id}'));
create index "matches_poster_id_idx" on app_private."matches" ((data #> '{poster_id}'));
create index "matches_job_id_idx" on app_private."matches" ((data #> '{job_id}'));
create table app_private."messages" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."messages" enable row level security;
revoke all on app_private."messages" from public, anon, authenticated;
create index "messages_data_idx" on app_private."messages" using gin (data jsonb_path_ops);
create index "messages_match_id_idx" on app_private."messages" ((data #> '{match_id}'));
create table app_private."notification_logs" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."notification_logs" enable row level security;
revoke all on app_private."notification_logs" from public, anon, authenticated;
create index "notification_logs_data_idx" on app_private."notification_logs" using gin (data jsonb_path_ops);
create index "notification_logs_id_idx" on app_private."notification_logs" ((data #> '{id}'));
create index "notification_logs_user_id_idx" on app_private."notification_logs" ((data #> '{user_id}'));
create table app_private."notification_preferences" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."notification_preferences" enable row level security;
revoke all on app_private."notification_preferences" from public, anon, authenticated;
create index "notification_preferences_data_idx" on app_private."notification_preferences" using gin (data jsonb_path_ops);
create index "notification_preferences_user_id_idx" on app_private."notification_preferences" ((data #> '{user_id}'));
create table app_private."offers" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."offers" enable row level security;
revoke all on app_private."offers" from public, anon, authenticated;
create index "offers_data_idx" on app_private."offers" using gin (data jsonb_path_ops);
create index "offers_employer_id_idx" on app_private."offers" ((data #> '{employer_id}'));
create index "offers_seeker_id_idx" on app_private."offers" ((data #> '{seeker_id}'));
create index "offers_status_idx" on app_private."offers" ((data #> '{status}'));
create table app_private."onboarding_cases" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."onboarding_cases" enable row level security;
revoke all on app_private."onboarding_cases" from public, anon, authenticated;
create index "onboarding_cases_data_idx" on app_private."onboarding_cases" using gin (data jsonb_path_ops);
create index "onboarding_cases_id_idx" on app_private."onboarding_cases" ((data #> '{id}'));
create index "onboarding_cases_candidate_id_idx" on app_private."onboarding_cases" ((data #> '{candidate_id}'));
create index "onboarding_cases_employer_id_idx" on app_private."onboarding_cases" ((data #> '{employer_id}'));
create index "onboarding_cases_status_idx" on app_private."onboarding_cases" ((data #> '{status}'));
create table app_private."onboarding_checklists" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."onboarding_checklists" enable row level security;
revoke all on app_private."onboarding_checklists" from public, anon, authenticated;
create index "onboarding_checklists_data_idx" on app_private."onboarding_checklists" using gin (data jsonb_path_ops);
create table app_private."onboarding_requirements" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."onboarding_requirements" enable row level security;
revoke all on app_private."onboarding_requirements" from public, anon, authenticated;
create index "onboarding_requirements_data_idx" on app_private."onboarding_requirements" using gin (data jsonb_path_ops);
create index "onboarding_requirements_id_idx" on app_private."onboarding_requirements" ((data #> '{id}'));
create index "onboarding_requirements_onboarding_case_id_idx" on app_private."onboarding_requirements" ((data #> '{onboarding_case_id}'));
create table app_private."onboarding_tasks" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."onboarding_tasks" enable row level security;
revoke all on app_private."onboarding_tasks" from public, anon, authenticated;
create index "onboarding_tasks_data_idx" on app_private."onboarding_tasks" using gin (data jsonb_path_ops);
create index "onboarding_tasks_onboarding_case_id_idx" on app_private."onboarding_tasks" ((data #> '{onboarding_case_id}'));
create table app_private."payment_transactions" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."payment_transactions" enable row level security;
revoke all on app_private."payment_transactions" from public, anon, authenticated;
create index "payment_transactions_data_idx" on app_private."payment_transactions" using gin (data jsonb_path_ops);
create index "payment_transactions_id_idx" on app_private."payment_transactions" ((data #> '{id}'));
create index "payment_transactions_user_id_idx" on app_private."payment_transactions" ((data #> '{user_id}'));
create index "payment_transactions_session_id_idx" on app_private."payment_transactions" ((data #> '{session_id}'));
create table app_private."pipeline_stages" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."pipeline_stages" enable row level security;
revoke all on app_private."pipeline_stages" from public, anon, authenticated;
create index "pipeline_stages_data_idx" on app_private."pipeline_stages" using gin (data jsonb_path_ops);
create index "pipeline_stages_candidate_id_idx" on app_private."pipeline_stages" ((data #> '{candidate_id}'));
create index "pipeline_stages_employer_id_idx" on app_private."pipeline_stages" ((data #> '{employer_id}'));
create index "pipeline_stages_job_id_idx" on app_private."pipeline_stages" ((data #> '{job_id}'));
create table app_private."policy_documents" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."policy_documents" enable row level security;
revoke all on app_private."policy_documents" from public, anon, authenticated;
create index "policy_documents_data_idx" on app_private."policy_documents" using gin (data jsonb_path_ops);
create index "policy_documents_id_idx" on app_private."policy_documents" ((data #> '{id}'));
create index "policy_documents_poster_id_idx" on app_private."policy_documents" ((data #> '{poster_id}'));
create table app_private."policy_signatures" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."policy_signatures" enable row level security;
revoke all on app_private."policy_signatures" from public, anon, authenticated;
create index "policy_signatures_data_idx" on app_private."policy_signatures" using gin (data jsonb_path_ops);
create table app_private."portable_references" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."portable_references" enable row level security;
revoke all on app_private."portable_references" from public, anon, authenticated;
create index "portable_references_data_idx" on app_private."portable_references" using gin (data jsonb_path_ops);
create index "portable_references_id_idx" on app_private."portable_references" ((data #> '{id}'));
create index "portable_references_candidate_id_idx" on app_private."portable_references" ((data #> '{candidate_id}'));
create table app_private."poster_profiles" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."poster_profiles" enable row level security;
revoke all on app_private."poster_profiles" from public, anon, authenticated;
create index "poster_profiles_data_idx" on app_private."poster_profiles" using gin (data jsonb_path_ops);
create index "poster_profiles_user_id_idx" on app_private."poster_profiles" ((data #> '{user_id}'));
create table app_private."push_subscriptions" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."push_subscriptions" enable row level security;
revoke all on app_private."push_subscriptions" from public, anon, authenticated;
create index "push_subscriptions_data_idx" on app_private."push_subscriptions" using gin (data jsonb_path_ops);
create index "push_subscriptions_user_id_idx" on app_private."push_subscriptions" ((data #> '{user_id}'));
create table app_private."references" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."references" enable row level security;
revoke all on app_private."references" from public, anon, authenticated;
create index "references_data_idx" on app_private."references" using gin (data jsonb_path_ops);
create index "references_status_idx" on app_private."references" ((data #> '{status}'));
create table app_private."reply_time_stats" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."reply_time_stats" enable row level security;
revoke all on app_private."reply_time_stats" from public, anon, authenticated;
create index "reply_time_stats_data_idx" on app_private."reply_time_stats" using gin (data jsonb_path_ops);
create index "reply_time_stats_user_id_idx" on app_private."reply_time_stats" ((data #> '{user_id}'));
create table app_private."requirement_document_matches" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."requirement_document_matches" enable row level security;
revoke all on app_private."requirement_document_matches" from public, anon, authenticated;
create index "requirement_document_matches_data_idx" on app_private."requirement_document_matches" using gin (data jsonb_path_ops);
create table app_private."resume_parses" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."resume_parses" enable row level security;
revoke all on app_private."resume_parses" from public, anon, authenticated;
create index "resume_parses_data_idx" on app_private."resume_parses" using gin (data jsonb_path_ops);
create index "resume_parses_id_idx" on app_private."resume_parses" ((data #> '{id}'));
create index "resume_parses_candidate_id_idx" on app_private."resume_parses" ((data #> '{candidate_id}'));
create table app_private."seeker_licenses" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."seeker_licenses" enable row level security;
revoke all on app_private."seeker_licenses" from public, anon, authenticated;
create index "seeker_licenses_data_idx" on app_private."seeker_licenses" using gin (data jsonb_path_ops);
create index "seeker_licenses_id_idx" on app_private."seeker_licenses" ((data #> '{id}'));
create index "seeker_licenses_user_id_idx" on app_private."seeker_licenses" ((data #> '{user_id}'));
create table app_private."seeker_profiles" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."seeker_profiles" enable row level security;
revoke all on app_private."seeker_profiles" from public, anon, authenticated;
create index "seeker_profiles_data_idx" on app_private."seeker_profiles" using gin (data jsonb_path_ops);
create index "seeker_profiles_user_id_idx" on app_private."seeker_profiles" ((data #> '{user_id}'));
create table app_private."swipes" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."swipes" enable row level security;
revoke all on app_private."swipes" from public, anon, authenticated;
create index "swipes_data_idx" on app_private."swipes" using gin (data jsonb_path_ops);
create index "swipes_user_id_idx" on app_private."swipes" ((data #> '{user_id}'));
create index "swipes_job_id_idx" on app_private."swipes" ((data #> '{job_id}'));
create table app_private."training_assignments" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."training_assignments" enable row level security;
revoke all on app_private."training_assignments" from public, anon, authenticated;
create index "training_assignments_data_idx" on app_private."training_assignments" using gin (data jsonb_path_ops);
create index "training_assignments_id_idx" on app_private."training_assignments" ((data #> '{id}'));
create index "training_assignments_user_id_idx" on app_private."training_assignments" ((data #> '{user_id}'));
create index "training_assignments_employer_id_idx" on app_private."training_assignments" ((data #> '{employer_id}'));
create index "training_assignments_status_idx" on app_private."training_assignments" ((data #> '{status}'));
create table app_private."training_courses" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."training_courses" enable row level security;
revoke all on app_private."training_courses" from public, anon, authenticated;
create index "training_courses_data_idx" on app_private."training_courses" using gin (data jsonb_path_ops);
create index "training_courses_id_idx" on app_private."training_courses" ((data #> '{id}'));
create table app_private."users" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."users" enable row level security;
revoke all on app_private."users" from public, anon, authenticated;
create index "users_data_idx" on app_private."users" using gin (data jsonb_path_ops);
create index "users_id_idx" on app_private."users" ((data #> '{id}'));
create index "users_email_idx" on app_private."users" ((data #> '{email}'));
create table app_private."vault_documents" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."vault_documents" enable row level security;
revoke all on app_private."vault_documents" from public, anon, authenticated;
create index "vault_documents_data_idx" on app_private."vault_documents" using gin (data jsonb_path_ops);
create index "vault_documents_id_idx" on app_private."vault_documents" ((data #> '{id}'));
create index "vault_documents_candidate_id_idx" on app_private."vault_documents" ((data #> '{candidate_id}'));
create table app_private."webhook_events" (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  check (not (data ? 'id') or data->>'id' = id)
);
alter table app_private."webhook_events" enable row level security;
revoke all on app_private."webhook_events" from public, anon, authenticated;
create index "webhook_events_data_idx" on app_private."webhook_events" using gin (data jsonb_path_ops);
create unique index "users_email_unique" on app_private."users" ((data->>'email')) where data->>'email' is not null;
create unique index "seeker_profiles_user_id_unique" on app_private."seeker_profiles" ((data->>'user_id')) where data->>'user_id' is not null;
create unique index "poster_profiles_user_id_unique" on app_private."poster_profiles" ((data->>'user_id')) where data->>'user_id' is not null;
create unique index "notification_preferences_user_id_unique" on app_private."notification_preferences" ((data->>'user_id')) where data->>'user_id' is not null;
create unique index "employer_billing_employer_id_unique" on app_private."employer_billing" ((data->>'employer_id')) where data->>'employer_id' is not null;
create unique index "pipeline_stages_match_id_unique" on app_private."pipeline_stages" ((data->>'match_id')) where data->>'match_id' is not null;
create unique index "business_email_verifications_user_id_unique" on app_private."business_email_verifications" ((data->>'user_id')) where data->>'user_id' is not null;
create unique index "payment_transactions_session_id_unique" on app_private."payment_transactions" ((data->>'session_id')) where data->>'session_id' is not null;
create unique index "webhook_events_event_id_unique" on app_private."webhook_events" ((data->>'event_id')) where data->>'event_id' is not null;

-- Auth owns credentials. This trigger creates only a safe initial app profile.
-- User metadata can request seeker/poster at signup; it can never grant admin.
-- Later authorization reads app_private.users, not editable auth metadata.
create function app_private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  initial_role text;
  now_text text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"+00:00"');
begin
  if tg_op <> 'INSERT' or tg_table_schema <> 'auth' or tg_table_name <> 'users' then
    raise exception 'Auth trigger only';
  end if;
  if auth.uid() is not null and auth.uid() <> new.id then
    raise exception 'Identity mismatch';
  end if;
  initial_role := case when new.raw_user_meta_data->>'requested_role' = 'poster' then 'poster' else 'seeker' end;
  insert into app_private.users(id, data) values(new.id::text, jsonb_build_object(
    'id', new.id::text, 'email', lower(new.email), 'full_name', coalesce(new.raw_user_meta_data->>'full_name', ''),
    'role', initial_role, 'profile_complete', false, 'created_at', now_text
  ));
  if initial_role = 'seeker' then
    insert into app_private.seeker_profiles(id, data) values(new.id::text, jsonb_build_object('user_id',new.id::text,'created_at',now_text));
  else
    insert into app_private.poster_profiles(id, data) values(new.id::text, jsonb_build_object('user_id',new.id::text,'created_at',now_text));
  end if;
  insert into app_private.notification_preferences(id, data) values(new.id::text, jsonb_build_object(
    'user_id',new.id::text,'email_enabled',true,'sms_enabled',false,'frequency','immediate',
    'match_notifications',true,'message_notifications',true,'document_reminders',true
  ));
  return new;
end;
$$;
revoke all on function app_private.handle_new_auth_user() from public, anon, authenticated;
create trigger vitalamatch_auth_user_created after insert on auth.users
for each row execute function app_private.handle_new_auth_user();

-- Private by default; downloads flow through the authorized API route.
insert into storage.buckets(id, name, public, file_size_limit)
values ('documents','documents',false,10485760)
on conflict(id) do update set public=false, file_size_limit=excluded.file_size_limit;
