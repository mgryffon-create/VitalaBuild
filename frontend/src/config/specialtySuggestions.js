/**
 * Specialty-based suggestions for Experience Highlights and Clinical Skills.
 * Keyed by partial specialty match (lowercase) so "ICU/Critical Care" matches "icu".
 */

// ── Clinical Skills by specialty keyword ───────────────────────
const SKILLS_BY_SPECIALTY = {
  "icu": ["Ventilator management", "Hemodynamic monitoring", "Critical drips/titration", "Arterial line management", "Central line care", "Sedation management", "Rapid response", "CRRT/dialysis", "Post-cardiac surgery care", "IABP management"],
  "critical care": ["Ventilator management", "Hemodynamic monitoring", "Critical drips/titration", "Arterial line management", "Central line care", "Sedation management", "Rapid response", "CRRT/dialysis"],
  "emergency": ["Triage assessment", "Trauma stabilization", "Rapid assessment", "IV access/IO insertion", "Splinting/immobilization", "Cardiac monitoring", "Code blue response", "Wound management", "Procedural sedation assist"],
  "operating room": ["Surgical instrument handling", "Sterile technique", "Patient positioning", "Circulating nurse duties", "Scrub nurse duties", "Specimen handling", "Surgical count procedures", "Anesthesia assist"],
  "pacu": ["Post-anesthesia assessment", "Airway management", "Pain management", "Sedation monitoring", "IV therapy", "Discharge readiness assessment", "Nausea/emesis management"],
  "labor": ["Fetal monitoring", "Labor support", "Postpartum assessment", "Newborn assessment", "Breastfeeding support", "High-risk pregnancy monitoring", "C-section assist", "Oxytocin administration"],
  "postpartum": ["Postpartum assessment", "Newborn care", "Breastfeeding support", "Patient education", "Circumcision assist", "Fundal assessment", "Lochia assessment"],
  "nicu": ["Neonatal resuscitation", "Incubator/warmer management", "Gavage feeding", "Neonatal assessment", "Phototherapy", "CPAP/ventilator (neonatal)", "IV therapy (neonatal)", "Parent education"],
  "pediatric": ["Pediatric assessment", "Growth/development monitoring", "Family-centered care", "Pediatric IV therapy", "Medication calculation (weight-based)", "Child life coordination", "Pain assessment (pediatric scales)"],
  "oncology": ["Chemotherapy administration", "Central line care", "Port access/deaccess", "Chemo precautions/safety", "Symptom management", "Blood product administration", "Tumor lysis monitoring", "End-of-life care"],
  "cardiac": ["Telemetry monitoring", "ECG/EKG interpretation", "Cardiac rhythm recognition", "Cardiac drip management", "Post-cath lab care", "Heart failure management", "Pacemaker/ICD monitoring", "Chest tube management"],
  "telemetry": ["Telemetry monitoring", "ECG/EKG interpretation", "Cardiac rhythm recognition", "Cardiac drip management", "Heart failure management", "Anticoagulation management"],
  "cath lab": ["Cardiac catheterization assist", "Hemodynamic monitoring", "Sheath management", "Post-procedure monitoring", "Stent/balloon procedures", "Sterile technique"],
  "med-surg": ["Patient assessment", "Medication administration", "Wound care", "IV therapy", "Post-operative care", "Discharge planning", "Fall prevention", "Pain management", "Blood glucose monitoring"],
  "step-down": ["Telemetry monitoring", "IV drip management", "Post-ICU step-down care", "Respiratory assessment", "Hemodynamic monitoring", "Pain management"],
  "dialysis": ["Hemodialysis initiation", "Peritoneal dialysis", "AV fistula/graft assessment", "Fluid management", "Dialysis machine operation", "Catheter care", "Patient education"],
  "home health": ["Wound care", "Medication management", "Patient education", "Fall risk assessment", "Vital signs monitoring", "Care plan development", "Family/caregiver training", "PICC line care"],
  "hospice": ["Symptom management", "Pain management", "End-of-life care", "Comfort measures", "Family support/grief counseling", "Advance directive coordination", "Medication management"],
  "psych": ["Crisis intervention", "De-escalation techniques", "Behavioral assessment", "Safety monitoring", "Group facilitation", "Medication administration (psych)", "Suicide risk assessment", "Therapeutic communication"],
  "mental health": ["Crisis intervention", "De-escalation techniques", "Behavioral assessment", "Safety monitoring", "Suicide risk assessment", "Therapeutic communication"],
  "rehabilitation": ["Functional assessment", "Mobility assistance", "Fall prevention", "ADL training", "Pain management", "Patient motivation", "Discharge planning", "Therapy coordination"],
  "long-term care": ["Geriatric assessment", "Fall prevention", "Wound care", "Medication management", "Dementia care", "ADL assistance", "Restorative nursing", "Skin integrity assessment"],
  "wound care": ["Wound assessment", "Debridement assist", "Negative pressure wound therapy", "Compression therapy", "Ostomy care", "Skin integrity assessment", "Dressing changes", "Wound measurement/documentation"],
  "infection control": ["Surveillance monitoring", "Outbreak investigation", "Isolation precautions", "Hand hygiene auditing", "Staff education", "Antibiotic stewardship", "Policy development"],
  "case manager": ["Utilization review", "Discharge planning", "Insurance coordination", "Care plan development", "Resource coordination", "Patient advocacy", "Documentation"],
  "clinic": ["Triage assessment", "Patient education", "Medication administration", "Vital signs", "EHR documentation", "Chronic disease management", "Preventive care"],
  "outpatient": ["Triage assessment", "Patient education", "Medication administration", "Vital signs", "EHR documentation", "Chronic disease management"],
  "school": ["Health screenings", "Medication administration", "First aid", "Health education", "IEP/504 coordination", "Communicable disease management", "Emergency response"],
  "general": ["Patient assessment", "Medication administration", "IV therapy", "Wound care", "Patient education", "Vital signs monitoring", "EHR documentation", "Care coordination", "Fall prevention", "Pain management"],
  "lpn": ["Medication administration", "Wound care", "Vital signs", "Patient assessment", "Blood glucose monitoring", "Catheter care", "Specimen collection", "Patient education"],
  "lvn": ["Medication administration", "Wound care", "Vital signs", "Patient assessment", "Blood glucose monitoring", "Catheter care", "Specimen collection"],
  "cna": ["Vital signs", "ADL assistance", "Ambulation assistance", "Bed making/positioning", "Intake/output measurement", "Specimen collection", "Patient hygiene", "Fall prevention"],
  "pct": ["Vital signs", "EKG/ECG", "Phlebotomy", "Blood glucose monitoring", "ADL assistance", "Specimen collection", "Patient transport"],
  "nurse practitioner": ["Advanced assessment", "Differential diagnosis", "Prescriptive authority", "Procedures (suturing, I&D)", "Patient education", "Chronic disease management", "Referral coordination"],
  "physical therap": ["Gait training", "Manual therapy", "Therapeutic exercise", "Balance training", "Modalities (ultrasound, e-stim)", "Functional assessment", "Discharge planning"],
  "occupational therap": ["ADL training", "Hand therapy", "Cognitive rehabilitation", "Adaptive equipment", "Splinting", "Home modification assessment", "Functional assessment"],
  "speech": ["Swallow assessment", "Dysphagia management", "Articulation therapy", "Language intervention", "Cognitive-communication therapy", "Modified barium swallow"],
  "respiratory": ["Ventilator management", "ABG interpretation", "Bronchial hygiene", "Oxygen therapy", "Nebulizer treatments", "PFT administration", "Airway management", "BiPAP/CPAP management"],
  "radiol": ["X-ray positioning", "CT scan operation", "MRI operation", "Contrast administration", "Radiation safety", "Image quality assessment", "Patient positioning"],
  "pharmacist": ["Medication review", "Drug interaction assessment", "Dose adjustment", "Clinical pharmacy rounds", "Patient counseling", "IV admixture", "Anticoagulation management"],
  "surgical tech": ["Sterile technique", "Instrument handling", "Surgical counts", "Specimen handling", "Operating room setup", "Patient positioning"],
  "phlebotom": ["Venipuncture", "Capillary collection", "Blood culture collection", "Order of draw", "Specimen processing", "Patient identification"],
  "medical assistant": ["Vital signs", "Phlebotomy", "EKG/ECG", "Injection administration", "Patient intake", "Medical records", "Scheduling", "Insurance verification"],
};

// ── Experience Highlights by specialty keyword ─────────────────
const HIGHLIGHTS_BY_SPECIALTY = {
  "icu": ["ICU and critical care experience", "Ventilator and sedation management", "Post-surgical ICU recovery", "Rapid response and code team", "High-acuity patient monitoring"],
  "critical care": ["Critical care and high-acuity experience", "Ventilator and hemodynamic management", "Rapid response and code team"],
  "emergency": ["Emergency and trauma experience", "Triage and rapid assessment", "High-volume ER environment", "Trauma stabilization", "Pediatric and adult emergency care"],
  "operating room": ["Perioperative nursing experience", "Circulating and scrub nurse roles", "Multi-specialty OR experience", "Robotic surgery assist"],
  "pacu": ["Post-anesthesia recovery care", "Airway and pain management", "Discharge readiness assessment"],
  "labor": ["Labor and delivery experience", "High-risk pregnancy monitoring", "Fetal monitoring expertise", "C-section and vaginal delivery support"],
  "postpartum": ["Postpartum and newborn care", "Breastfeeding education and support", "Mother-baby couplet care"],
  "nicu": ["NICU and neonatal intensive care", "Premature infant care", "Neonatal resuscitation trained", "Parent education and support"],
  "pediatric": ["Pediatric nursing experience", "Family-centered care approach", "Pediatric medication safety", "Growth and development monitoring"],
  "oncology": ["Oncology and chemotherapy experience", "Chemo-certified administration", "Central line and port management", "Symptom and pain management"],
  "cardiac": ["Cardiac and telemetry experience", "ECG/rhythm interpretation", "Heart failure management", "Post-cardiac procedure care"],
  "telemetry": ["Telemetry monitoring experience", "Cardiac rhythm recognition", "Acute cardiac care"],
  "med-surg": ["Medical-surgical nursing experience", "Multi-system patient management", "Post-operative care", "Wound care and dressing changes"],
  "dialysis": ["Hemodialysis and peritoneal dialysis", "AV fistula/graft management", "Chronic kidney disease care"],
  "home health": ["Home health and community nursing", "Independent clinical judgment", "Wound care in home setting", "Patient and family education"],
  "hospice": ["Hospice and palliative care experience", "End-of-life comfort care", "Family grief support", "Pain and symptom management"],
  "psych": ["Psychiatric nursing experience", "Crisis intervention and de-escalation", "Behavioral health assessment", "Therapeutic communication"],
  "mental health": ["Mental health nursing experience", "Crisis intervention", "Behavioral assessment"],
  "rehabilitation": ["Rehabilitation nursing experience", "Functional recovery support", "Multidisciplinary team coordination"],
  "long-term care": ["Long-term care and geriatric nursing", "Dementia and fall-risk care", "Restorative nursing programs", "Skin integrity management"],
  "wound care": ["Wound care specialist experience", "Complex wound management", "Ostomy and skin integrity care", "Negative pressure wound therapy"],
  "infection control": ["Infection prevention and control", "Outbreak investigation experience", "Staff education and training"],
  "general": ["Registered nursing experience", "Multi-unit float experience", "Patient assessment and care planning", "Medication administration and safety", "Team collaboration and communication"],
  "lpn": ["LPN clinical experience", "Medication administration", "Wound care and dressing changes", "Patient assessment within scope"],
  "lvn": ["LVN clinical experience", "Medication administration", "Patient care coordination"],
  "cna": ["Certified nursing assistant experience", "Direct patient care", "Vital signs and ADL assistance", "Patient comfort and safety"],
  "pct": ["Patient care technician experience", "Phlebotomy and EKG skills", "Direct patient care support"],
  "nurse practitioner": ["Advanced practice nursing experience", "Diagnostic and prescriptive authority", "Chronic disease management", "Independent clinical practice"],
  "physical therap": ["Physical therapy experience", "Gait and mobility rehabilitation", "Post-surgical recovery programs"],
  "occupational therap": ["Occupational therapy experience", "ADL rehabilitation", "Adaptive equipment training"],
  "respiratory": ["Respiratory therapy experience", "Ventilator and airway management", "ABG interpretation"],
};

// ── Universal skills and highlights (shown when no specialty match) ─
const UNIVERSAL_SKILLS = [
  "Patient assessment", "Medication administration", "IV therapy", "Wound care",
  "Patient education", "Vital signs monitoring", "EHR documentation",
  "Care coordination", "Fall prevention", "Pain management",
  "Infection control", "Blood glucose monitoring", "Specimen collection",
  "CPR/BLS", "Communication", "Time management",
];

const UNIVERSAL_HIGHLIGHTS = [
  "Strong clinical assessment skills", "Team collaboration and communication",
  "Patient safety and advocacy", "Adaptable to fast-paced environments",
  "Compassionate patient-centered care", "Accurate documentation and charting",
  "Experience with diverse patient populations", "Mentorship and precepting",
];

/**
 * Get suggested skills based on specialty string.
 * Matches keywords from the specialty name against our map.
 */
export function getSkillSuggestions(specialty) {
  if (!specialty) return UNIVERSAL_SKILLS;
  const lower = specialty.toLowerCase();
  for (const [keyword, skills] of Object.entries(SKILLS_BY_SPECIALTY)) {
    if (lower.includes(keyword)) return skills;
  }
  return UNIVERSAL_SKILLS;
}

/**
 * Get suggested highlights based on specialty string.
 */
export function getHighlightSuggestions(specialty) {
  if (!specialty) return UNIVERSAL_HIGHLIGHTS;
  const lower = specialty.toLowerCase();
  for (const [keyword, highlights] of Object.entries(HIGHLIGHTS_BY_SPECIALTY)) {
    if (lower.includes(keyword)) return highlights;
  }
  return UNIVERSAL_HIGHLIGHTS;
}
