// Canonical Role Taxonomy — shared between Job Form and Seeker Profile
// Must stay in sync with backend eligibility.py ROLE_TAXONOMY keys

export const CANONICAL_ROLES = [
  "CNA", "LPN", "RN", "NP", "CRNA", "PA",
  "RT", "OT", "PT", "ST", "MEDICAL_ASSISTANT", "PHLEBOTOMIST", "RADIOLOGY_TECH",
];

export const ROLE_LABELS = {
  CNA: "CNA / Nurse Aide / PCT",
  LPN: "LPN / LVN",
  RN: "RN / Registered Nurse",
  NP: "NP / Nurse Practitioner",
  CRNA: "CRNA / Nurse Anesthetist",
  PA: "PA / Physician Assistant",
  RT: "Respiratory Therapist",
  OT: "Occupational Therapist",
  PT: "Physical Therapist",
  ST: "Speech-Language Pathologist",
  MEDICAL_ASSISTANT: "Medical Assistant",
  PHLEBOTOMIST: "Phlebotomist",
  RADIOLOGY_TECH: "Radiology Technologist",
};
