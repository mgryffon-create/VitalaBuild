// Feature flags — controls visibility of advanced features
// Backend systems continue running silently; these only control UI rendering
const FEATURE_FLAGS = {
  enable_trust_signals: false,
  enable_worker_feedback: false,
  enable_facility_scores: false,
  enable_worker_preferences: false,
  enable_facility_profile_fields: false,
};

export default FEATURE_FLAGS;
