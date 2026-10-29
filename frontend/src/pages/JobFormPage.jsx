import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import SpecialtyAutocomplete from "@/components/SpecialtyAutocomplete";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import InlineAutocomplete from "@/components/InlineAutocomplete";
import { CERTIFICATIONS } from "@/config/fieldSuggestions";
import {
  Briefcase, MapPin, DollarSign, Clock, Plus, X, Save, ArrowLeft,
  Award, Gift, FileText, Calendar, Cloud, CloudOff, Loader2, Check,
  ChevronUp, ChevronDown, ExternalLink, Globe, AlertTriangle, Home, ShieldCheck
} from "lucide-react";

const SECTIONS = [
  { id: "basic", label: "Basic Info", icon: Briefcase },
  { id: "schedule", label: "Schedule", icon: Clock },
  { id: "compensation", label: "Pay", icon: DollarSign },
  { id: "requirements", label: "Requirements", icon: FileText },
  { id: "compliance", label: "Compliance", icon: ShieldCheck },
  { id: "workflow", label: "Application", icon: Globe },
  { id: "review", label: "Review", icon: Check },
];

const JOB_TYPES = ["Travel Contract", "Per Diem", "Staff/Permanent", "PRN", "Local Contract"];

import { CANONICAL_ROLES, ROLE_LABELS } from "@/config/canonicalRoles";
const DURATIONS = ["4 weeks", "8 weeks", "13 weeks", "26 weeks", "52 weeks", "Permanent", "Ongoing"];
const SHIFT_TYPES = ["Day Shift (7a-7p)", "Night Shift (7p-7a)", "Day Shift (8 hr)", "Evening Shift", "Rotating", "Flexible"];
const STIPEND_OPTIONS = ["Housing included", "Housing stipend", "M&IE stipend", "Travel reimbursement", "Not included"];
const COMMON_BENEFITS = [
  "Health Insurance", "Dental Insurance", "Vision Insurance", "401(k)",
  "Housing Stipend", "Travel Reimbursement", "Sign-On Bonus", "Completion Bonus",
  "Referral Bonus", "Continuing Education", "License Reimbursement", "Meal Allowance",
];

const AutoSaveIndicator = ({ status }) => {
  const cfg = { saved: { icon: Cloud, text: "Saved", cls: "text-green-500" }, saving: { icon: Loader2, text: "Saving...", cls: "text-blue-500" }, unsaved: { icon: CloudOff, text: "Unsaved", cls: "text-amber-500" }, error: { icon: CloudOff, text: "Save failed", cls: "text-red-500" } };
  const c = cfg[status] || cfg.saved;
  const Icon = c.icon;
  return <div className={`flex items-center gap-1.5 text-xs ${c.cls}`}><Icon className={`w-3.5 h-3.5 ${status === "saving" ? "animate-spin" : ""}`} /><span className="hidden sm:inline">{c.text}</span></div>;
};

const CollapsibleSection = ({ id, title, icon: Icon, children, isActive, hasErrors, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div id={`section-${id}`} data-testid={`section-${id}`} className="scroll-mt-32">
      <Card className={`transition-all duration-200 ${isActive ? "ring-2 ring-primary/40 shadow-md" : ""} ${hasErrors ? "ring-2 ring-amber-400/50" : ""}`}>
        <button type="button" onClick={() => setOpen(!open)} className="w-full" data-testid={`toggle-section-${id}`}>
          <CardHeader className="flex flex-row items-center justify-between py-4 px-4 sm:px-6 cursor-pointer select-none">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Icon className="w-5 h-5 text-primary shrink-0" />
              {title}
              {hasErrors && <AlertTriangle className="w-4 h-4 text-amber-500" />}
            </CardTitle>
            {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </CardHeader>
        </button>
        {open && <CardContent className="px-4 sm:px-6 pb-5 pt-0">{children}</CardContent>}
      </Card>
    </div>
  );
};

const ProgressTracker = ({ activeSection, completedSections, errorSections, onSectionClick }) => (
  <div data-testid="progress-tracker" className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b py-2.5 px-2 -mx-4 sm:-mx-0 mb-4">
    <div className="flex items-center justify-between max-w-4xl mx-auto px-2">
      {SECTIONS.map((section, idx) => {
        const isActive = activeSection === section.id;
        const isCompleted = completedSections.has(section.id);
        const hasError = errorSections.has(section.id);
        const Icon = section.icon;
        return (
          <button key={section.id} type="button" onClick={() => onSectionClick(section.id)} data-testid={`progress-step-${section.id}`} className="flex flex-col items-center gap-1 group relative flex-1">
            {idx > 0 && <div className={`absolute top-3.5 right-1/2 w-full h-0.5 -z-10 ${isCompleted || isActive ? "bg-primary/50" : "bg-muted-foreground/20"}`} />}
            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all text-xs font-semibold
              ${isActive ? "bg-primary text-primary-foreground scale-110 shadow-lg shadow-primary/30" : ""}
              ${isCompleted && !isActive ? "bg-primary/20 text-primary" : ""}
              ${hasError && !isActive ? "bg-amber-100 text-amber-600 ring-2 ring-amber-300" : ""}
              ${!isActive && !isCompleted && !hasError ? "bg-muted text-muted-foreground" : ""}
            `}>
              {isCompleted && !isActive ? <Check className="w-3.5 h-3.5" /> : hasError && !isActive ? <AlertTriangle className="w-3 h-3" /> : <Icon className="w-3.5 h-3.5" />}
            </div>
            <span className={`text-[10px] sm:text-xs leading-tight text-center transition-colors ${isActive ? "text-primary font-semibold" : hasError ? "text-amber-600" : "text-muted-foreground"}`}>{section.label}</span>
          </button>
        );
      })}
    </div>
  </div>
);

const ReviewField = ({ label, value, required, missing }) => (
  <div className="flex justify-between items-start py-1.5 border-b border-muted/50 last:border-0">
    <span className="text-sm text-muted-foreground">{label}{required && <span className="text-amber-500 ml-0.5">*</span>}</span>
    <span className={`text-sm font-medium text-right max-w-[60%] ${missing ? "text-amber-500 italic" : ""}`}>
      {value || (missing ? "Required" : "Not set")}
    </span>
  </div>
);

// Smart title generation
function generateTitle(job) {
  const parts = [];
  if (job.specialty) {
    const match = job.specialty.match(/\(([^)]+)\)\s*-\s*(.+)/);
    if (match) parts.push(`${match[2].trim()} ${match[1].trim()}`);
    else { const s = job.specialty.match(/\(([^)]+)\)/); parts.push(s ? s[1] : job.specialty); }
  }
  if (job.shift_type) {
    const shift = job.shift_type.split("(")[0].trim();
    parts.push(`– ${shift}`);
  }
  return parts.join(" ") || "";
}

const JobFormPage = () => {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(!!jobId);
  const [saving, setSaving] = useState(false);
  const [specialties, setSpecialties] = useState({ nursing: [], allied_health: [], all: [] });
  const [autoSaveStatus, setAutoSaveStatus] = useState("saved");
  const [initialLoadComplete, setInitialLoadComplete] = useState(!jobId);
  const [activeSection, setActiveSection] = useState("basic");
  const autoSaveTimeoutRef = useRef(null);
  const lastSavedRef = useRef(null);
  const observerRef = useRef(null);

  const [job, setJob] = useState({
    title: "", description: "", location: "", duration: "", job_type: "",
    pay_range: { min: "", max: "" }, stipend: "",
    base_rate: "", guaranteed_hours: "36", weekly_stipend: "", overtime_rate: "",
    benefits: [], time_off_policy: "", requirements: [], certifications_required: [],
    experience_required: "", specialty: "", shift_type: "", start_date: "", weekly_hours: "",
    primary_role_category: "", accepted_role_categories: [],
    application_workflow_type: "in_platform_only", external_application_url: "",
    external_application_stage: "", profile_sufficient_for_initial_review: true, required_additional_fields: "",
    compliance_requirements: [],
  });

  const [newBenefit, setNewBenefit] = useState("");
  const [newRequirement, setNewRequirement] = useState("");
  const [newCert, setNewCert] = useState("");
  const [newComplianceReq, setNewComplianceReq] = useState("");
  const [payWarningAcknowledged, setPayWarningAcknowledged] = useState(false);
  const isEdit = !!jobId;

  // ── Pay calculation ───────────────────────────────────
  const baseRate = parseFloat(job.base_rate) || 0;
  const guaranteedHrs = parseFloat(job.guaranteed_hours) || 0;
  const weeklyStipend = parseFloat(job.weekly_stipend) || 0;
  const overtimeRate = parseFloat(job.overtime_rate) || 0;
  const calculatedWeeklyPay = Math.round(baseRate * guaranteedHrs + weeklyStipend);
  const hasStructuredPay = baseRate > 0 && guaranteedHrs > 0;

  // Pay range validation by role
  const getPayRange = (specialty) => {
    if (!specialty) return { min: 800, max: 5500 };
    const lower = specialty.toLowerCase();
    if (lower.includes("cna") || lower.includes("pct") || lower.includes("aide")) return { min: 600, max: 2500 };
    if (lower.includes("lpn") || lower.includes("lvn")) return { min: 800, max: 3000 };
    if (lower.includes("rn") || lower.includes("nurse")) return { min: 1200, max: 5500 };
    if (lower.includes("np") || lower.includes("practitioner") || lower.includes("crna")) return { min: 2000, max: 7000 };
    return { min: 800, max: 5500 };
  };
  const expectedRange = getPayRange(job.specialty);
  const payOutOfRange = hasStructuredPay && (calculatedWeeklyPay < expectedRange.min || calculatedWeeklyPay > expectedRange.max);

  // ── Description validation ────────────────────────────
  const PLACEHOLDER_PATTERNS = /^(tbd|n\/a|see details|to be determined|coming soon|details|lorem|test)/i;
  const descriptionValid = !!job.description && job.description.length >= 150 && !PLACEHOLDER_PATTERNS.test(job.description.trim());

  // ── Validation ────────────────────────────────────────
  const isTravelContract = ["Travel Contract", "Local Contract"].includes(job.job_type);
  const isWeakTitle = (t) => !t || /test|posting|job\s*\d|^\d+$/i.test(t) || t.length < 5;

  const requiredFields = {
    title: !isWeakTitle(job.title),
    specialty: !!job.specialty,
    role_category: !!job.primary_role_category,
    location: !!job.location,
    description: descriptionValid,
    shift_type: !!job.shift_type,
    pay: hasStructuredPay,
    job_type: !!job.job_type,
    experience: job.experience_required !== "" && job.experience_required !== undefined,
    start_date: !!job.start_date,
    pay_confirmed: !payOutOfRange || payWarningAcknowledged,
    ...(isTravelContract ? {
      duration: !!job.duration,
      stipend: !!job.stipend,
    } : {}),
  };

  const missingFields = Object.entries(requiredFields).filter(([, ok]) => !ok).map(([k]) => k);
  const canPublish = missingFields.length === 0;
  const generatedTitle = generateTitle(job);

  // Section-level errors
  const sectionErrors = new Set();
  if (!requiredFields.title || !requiredFields.specialty || !requiredFields.role_category || !requiredFields.location || !requiredFields.description) sectionErrors.add("basic");
  if (!requiredFields.shift_type || !requiredFields.start_date || (isTravelContract && !requiredFields.duration)) sectionErrors.add("schedule");
  if (!requiredFields.pay || !requiredFields.pay_confirmed || (isTravelContract && !requiredFields.stipend)) sectionErrors.add("compensation");

  // Section-level completeness
  const completedSections = new Set();
  if (requiredFields.title && requiredFields.specialty && requiredFields.location && requiredFields.description) completedSections.add("basic");
  if (requiredFields.shift_type && requiredFields.start_date && (!isTravelContract || requiredFields.duration)) completedSections.add("schedule");
  if (requiredFields.pay && requiredFields.pay_confirmed && (!isTravelContract || requiredFields.stipend)) completedSections.add("compensation");
  if (requiredFields.experience) completedSections.add("requirements");
  if (job.application_workflow_type) completedSections.add("workflow");
  if (canPublish) completedSections.add("review");

  useEffect(() => {
    const ids = SECTIONS.map((s) => `section-${s.id}`);
    const handleIntersect = (entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible.length > 0) setActiveSection(visible[0].target.id.replace("section-", ""));
    };
    observerRef.current = new IntersectionObserver(handleIntersect, { rootMargin: "-120px 0px -50% 0px", threshold: 0.1 });
    const timer = setTimeout(() => { ids.forEach((id) => { const el = document.getElementById(id); if (el) observerRef.current.observe(el); }); }, 100);
    return () => { clearTimeout(timer); observerRef.current?.disconnect(); };
  }, [loading]);

  const scrollToSection = (sectionId) => { const el = document.getElementById(`section-${sectionId}`); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); };

  const fetchSpecialties = useCallback(async () => { try { const r = await axios.get(`${API}/specialties`); setSpecialties(r.data); } catch {} }, []);
  const fetchJob = useCallback(async () => {
    try { const r = await axios.get(`${API}/jobs/${jobId}`); setJob(r.data); lastSavedRef.current = JSON.stringify(r.data); }
    catch { toast.error("Failed to load job"); navigate("/poster"); }
    finally { setLoading(false); setTimeout(() => setInitialLoadComplete(true), 500); }
  }, [jobId, navigate]);

  useEffect(() => { fetchSpecialties(); if (jobId) fetchJob(); }, [jobId, fetchJob, fetchSpecialties]);

  // Auto-save (edit mode only)
  useEffect(() => {
    if (!isEdit || !initialLoadComplete) return;
    const cur = JSON.stringify(job);
    if (cur === lastSavedRef.current) return;
    setAutoSaveStatus("unsaved");
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = setTimeout(async () => {
      if (!job.title || !job.description || !job.location || !job.specialty) return;
      setAutoSaveStatus("saving");
      try {
        const payload = { ...job, pay_range: { min: baseRate, max: baseRate }, weekly_pay: calculatedWeeklyPay, base_rate: baseRate, guaranteed_hours: guaranteedHrs, weekly_stipend: weeklyStipend, overtime_rate: overtimeRate, experience_required: parseInt(job.experience_required) || 0 };
        await axios.put(`${API}/jobs/${jobId}`, payload);
        lastSavedRef.current = JSON.stringify(job);
        setAutoSaveStatus("saved");
      } catch { setAutoSaveStatus("error"); }
    }, 1500);
    return () => { if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current); };
  }, [job, isEdit, jobId, initialLoadComplete]);

  const handleSave = async () => {
    if (!canPublish) {
      const firstError = [...sectionErrors][0];
      if (firstError) scrollToSection(firstError);
      toast.error(`Missing required fields: ${missingFields.map(f => f.replace(/_/g, " ")).join(", ")}`);
      return;
    }
    setSaving(true);
    try {
      const title = isWeakTitle(job.title) && generatedTitle ? generatedTitle : job.title;
      const payload = { ...job, title, pay_range: { min: baseRate, max: baseRate }, weekly_pay: calculatedWeeklyPay, base_rate: baseRate, guaranteed_hours: guaranteedHrs, weekly_stipend: weeklyStipend, overtime_rate: overtimeRate, experience_required: parseInt(job.experience_required) || 0 };
      if (isEdit) { await axios.put(`${API}/jobs/${jobId}`, payload); toast.success("Job updated"); }
      else { await axios.post(`${API}/jobs`, payload); toast.success("Job posted"); }
      navigate("/poster");
    } catch { toast.error(`Failed to ${isEdit ? "update" : "create"} job`); }
    finally { setSaving(false); }
  };

  const addItem = (field, value, setter) => { if (value.trim()) { setJob((prev) => ({ ...prev, [field]: [...(prev[field] || []), value.trim()] })); setter(""); } };
  const removeItem = (field, index) => { setJob((prev) => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) })); };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div data-testid="job-form-page" className="max-w-4xl mx-auto pb-24 sm:pb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/poster")} data-testid="back-btn" className="shrink-0"><ArrowLeft className="w-5 h-5" /></Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">{isEdit ? "Edit Job Posting" : "Post New Job"}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">{canPublish ? "Ready to publish" : `${missingFields.length} required field${missingFields.length > 1 ? "s" : ""} remaining`}</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            {isEdit && initialLoadComplete && <AutoSaveIndicator status={autoSaveStatus} />}
            <Button data-testid="save-job-btn" onClick={handleSave} disabled={saving || !canPublish} size="sm">
              <Save className="w-4 h-4 mr-1.5" />
              {saving ? "Saving..." : isEdit ? "Update" : "Publish Job"}
            </Button>
          </div>
        </div>

        <ProgressTracker activeSection={activeSection} completedSections={completedSections} errorSections={sectionErrors} onSectionClick={scrollToSection} />

        <div className="space-y-4">
          {/* === BASIC INFO === */}
          <CollapsibleSection id="basic" title="Basic Information" icon={Briefcase} isActive={activeSection === "basic"} hasErrors={sectionErrors.has("basic") && activeSection !== "basic"}>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Job Title *</Label>
                <Input data-testid="job-title-input" value={job.title} onChange={(e) => setJob((p) => ({ ...p, title: e.target.value }))} placeholder="e.g., ICU Registered Nurse" autoComplete="organization-title" />
                {isWeakTitle(job.title) && generatedTitle && (
                  <p className="text-xs text-muted-foreground">Seeker-facing title: <strong className="text-foreground">{generatedTitle}</strong></p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Specialty *</Label>
                  <SpecialtyAutocomplete
                    value={job.specialty}
                    allSpecialties={[...(specialties.nursing || []), ...(specialties.allied_health || [])]}
                    onChange={(v) => setJob((p) => ({ ...p, specialty: v }))}
                    testId="job-specialty"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Location *</Label>
                  <LocationAutocomplete
                    locations={job.location ? [job.location] : []}
                    onAdd={(city) => setJob((p) => ({ ...p, location: city }))}
                    onRemove={() => setJob((p) => ({ ...p, location: "" }))}
                    testId="job-location"
                    placeholder="Search city (e.g., Los Angeles, CA)"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Role Category *</Label>
                  <Select value={job.primary_role_category} onValueChange={(v) => setJob((p) => ({ ...p, primary_role_category: v, accepted_role_categories: p.accepted_role_categories.length === 0 || (p.accepted_role_categories.length === 1 && p.accepted_role_categories[0] === p.primary_role_category) ? [v] : p.accepted_role_categories }))}>
                    <SelectTrigger data-testid="job-role-select"><SelectValue placeholder="Select role category" /></SelectTrigger>
                    <SelectContent>{CANONICAL_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r] || r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Also Accept (optional)</Label>
                  <Select value="" onValueChange={(v) => { if (v && !job.accepted_role_categories.includes(v)) setJob((p) => ({ ...p, accepted_role_categories: [...p.accepted_role_categories, v] })); }}>
                    <SelectTrigger data-testid="job-accepted-roles-select"><SelectValue placeholder="Add alternate role" /></SelectTrigger>
                    <SelectContent>{CANONICAL_ROLES.filter((r) => r !== job.primary_role_category && !job.accepted_role_categories.includes(r)).map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r] || r}</SelectItem>)}</SelectContent>
                  </Select>
                  {job.accepted_role_categories.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">{job.accepted_role_categories.map((r) => (
                      <Badge key={r} variant="secondary" className="text-xs">{ROLE_LABELS[r] || r} {r !== job.primary_role_category && <button type="button" onClick={() => setJob((p) => ({ ...p, accepted_role_categories: p.accepted_role_categories.filter((x) => x !== r) }))} className="ml-1 text-destructive"><X className="w-3 h-3" /></button>}</Badge>
                    ))}</div>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Job Type *</Label>
                <Select value={job.job_type} onValueChange={(v) => setJob((p) => ({ ...p, job_type: v }))}>
                  <SelectTrigger data-testid="job-type-select"><SelectValue placeholder="Select job type" /></SelectTrigger>
                  <SelectContent>{JOB_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Job Description *</Label>
                <Textarea data-testid="description-input" value={job.description} onChange={(e) => setJob((p) => ({ ...p, description: e.target.value }))} placeholder="Describe the role, responsibilities, and ideal candidate..." rows={4} />
                {job.description && job.description.length < 150 && <p className="text-xs text-amber-500">{150 - job.description.length} more characters needed (minimum 150)</p>}
                {job.description && PLACEHOLDER_PATTERNS.test(job.description.trim()) && <p className="text-xs text-amber-500">Please write a real description — placeholder text is not allowed</p>}
              </div>
            </div>
          </CollapsibleSection>

          {/* === SCHEDULE === */}
          <CollapsibleSection id="schedule" title="Schedule & Timing" icon={Clock} isActive={activeSection === "schedule"} hasErrors={sectionErrors.has("schedule") && activeSection !== "schedule"}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Shift Type *</Label>
                <Select value={job.shift_type} onValueChange={(v) => setJob((p) => ({ ...p, shift_type: v }))}>
                  <SelectTrigger data-testid="shift-select"><SelectValue placeholder="Select shift" /></SelectTrigger>
                  <SelectContent>{SHIFT_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Start Date *</Label>
                <Input data-testid="start-date-input" type="date" value={job.start_date} onChange={(e) => setJob((p) => ({ ...p, start_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Duration {isTravelContract && "*"}</Label>
                <Select value={job.duration} onValueChange={(v) => setJob((p) => ({ ...p, duration: v }))}>
                  <SelectTrigger data-testid="duration-select"><SelectValue placeholder="Select duration" /></SelectTrigger>
                  <SelectContent>{DURATIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </CollapsibleSection>

          {/* === COMPENSATION === */}
          <CollapsibleSection id="compensation" title="Compensation & Benefits" icon={DollarSign} isActive={activeSection === "compensation"} hasErrors={sectionErrors.has("compensation") && activeSection !== "compensation"}>
            <div className="space-y-5">
              {/* Structured Pay */}
              <div>
                <Label className="text-sm font-semibold mb-3 block">Pay Structure *</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Base Rate ($/hr) *</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input data-testid="base-rate-input" type="number" min="0" step="0.5" value={job.base_rate} onChange={(e) => setJob((p) => ({ ...p, base_rate: e.target.value }))} className="pl-10" placeholder="52" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Hours/Week *</Label>
                    <Input data-testid="guaranteed-hours-input" type="number" min="0" value={job.guaranteed_hours} onChange={(e) => setJob((p) => ({ ...p, guaranteed_hours: e.target.value }))} placeholder="36" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Weekly Stipend ($)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input data-testid="weekly-stipend-input" type="number" min="0" value={job.weekly_stipend} onChange={(e) => setJob((p) => ({ ...p, weekly_stipend: e.target.value }))} className="pl-10" placeholder="900" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">OT Rate ($/hr)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input data-testid="overtime-rate-input" type="number" min="0" step="0.5" value={job.overtime_rate} onChange={(e) => setJob((p) => ({ ...p, overtime_rate: e.target.value }))} className="pl-10" placeholder="78" />
                    </div>
                  </div>
                </div>

                {/* Auto-calculated weekly pay */}
                {hasStructuredPay && (
                  <div data-testid="weekly-pay-preview" className="mt-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Calculated Weekly Pay</span>
                      <span className="text-xl font-bold text-green-600">${calculatedWeeklyPay.toLocaleString()}/week</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      ${baseRate}/hr x {guaranteedHrs}hrs{weeklyStipend > 0 ? ` + $${weeklyStipend} stipend` : ""}
                      {overtimeRate > 0 ? ` | OT: $${overtimeRate}/hr` : ""}
                    </p>
                  </div>
                )}

                {!hasStructuredPay && <p className="text-xs text-amber-500 mt-2">Base rate and hours are required — seekers skip jobs without clear pay</p>}

                {/* Pay range warning */}
                {payOutOfRange && (
                  <div data-testid="pay-range-warning" className="mt-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-300">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-amber-700">This pay appears outside the typical range for this role</p>
                        <p className="text-xs text-amber-600 mt-0.5">Expected: ${expectedRange.min.toLocaleString()}–${expectedRange.max.toLocaleString()}/week. Please verify before posting.</p>
                        <label className="flex items-center gap-2 mt-2 cursor-pointer">
                          <input type="checkbox" checked={payWarningAcknowledged} onChange={(e) => setPayWarningAcknowledged(e.target.checked)} className="rounded" data-testid="pay-confirm-checkbox" />
                          <span className="text-xs text-amber-700">I confirm this pay is correct</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Stipend type (required for travel) */}
              {isTravelContract && (
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Home className="w-4 h-4 text-primary" /> Stipend Type *</Label>
                  <Select value={job.stipend} onValueChange={(v) => setJob((p) => ({ ...p, stipend: v }))}>
                    <SelectTrigger data-testid="stipend-select"><SelectValue placeholder="Select stipend type" /></SelectTrigger>
                    <SelectContent>{STIPEND_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}

              {/* Benefits */}
              <div>
                <Label className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Gift className="w-4 h-4 text-primary" /> Benefits Offered</Label>
                <div className="flex gap-2 mb-2">
                  <Select value={newBenefit} onValueChange={setNewBenefit}>
                    <SelectTrigger data-testid="benefit-select" className="flex-1"><SelectValue placeholder="Select a benefit" /></SelectTrigger>
                    <SelectContent>{COMMON_BENEFITS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button data-testid="add-benefit-btn" type="button" variant="outline" size="icon" onClick={() => addItem("benefits", newBenefit, setNewBenefit)}><Plus className="w-4 h-4" /></Button>
                </div>
                {job.benefits.length > 0 && <div className="flex flex-wrap gap-1.5">{job.benefits.map((b, i) => <Badge key={i} variant="secondary" className="flex items-center gap-1 py-0.5 px-2 text-xs">{b}<button type="button" onClick={() => removeItem("benefits", i)} className="ml-0.5 hover:text-destructive"><X className="w-3 h-3" /></button></Badge>)}</div>}
              </div>

              <div>
                <Label className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Calendar className="w-4 h-4 text-primary" /> Time Off Policy</Label>
                <Textarea data-testid="time-off-input" value={job.time_off_policy} onChange={(e) => setJob((p) => ({ ...p, time_off_policy: e.target.value }))} placeholder="Describe PTO policies..." rows={2} />
              </div>
            </div>
          </CollapsibleSection>

          {/* === REQUIREMENTS === */}
          <CollapsibleSection id="requirements" title="Requirements & Certifications" icon={FileText} isActive={activeSection === "requirements"}>
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label>Minimum Years of Experience *</Label>
                <Input data-testid="experience-input" type="number" min="0" value={job.experience_required} onChange={(e) => setJob((p) => ({ ...p, experience_required: e.target.value }))} placeholder="0" className="w-28" />
                <p className="text-xs text-muted-foreground">Enter 0 for no minimum</p>
              </div>
              <div>
                <Label className="mb-2 block">Additional Requirements</Label>
                <div className="flex gap-2 mb-2">
                  <Input data-testid="requirement-input" value={newRequirement} onChange={(e) => setNewRequirement(e.target.value)} placeholder="e.g., Must be able to lift 50 lbs" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem("requirements", newRequirement, setNewRequirement))} />
                  <Button data-testid="add-requirement-btn" type="button" variant="outline" size="icon" onClick={() => addItem("requirements", newRequirement, setNewRequirement)}><Plus className="w-4 h-4" /></Button>
                </div>
                {job.requirements.length > 0 && <div className="space-y-1.5">{job.requirements.map((r, i) => <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md text-sm"><span className="flex-1">{r}</span><button type="button" onClick={() => removeItem("requirements", i)} className="text-muted-foreground hover:text-destructive shrink-0"><X className="w-4 h-4" /></button></div>)}</div>}
              </div>
              <div>
                <Label className="mb-2 flex items-center gap-1.5"><Award className="w-4 h-4 text-primary" /> Required Certifications</Label>
                <div className="flex gap-2 mb-2">
                  <InlineAutocomplete value={newCert} onChange={setNewCert} suggestions={CERTIFICATIONS} placeholder="Search certifications (BLS, ACLS...)" testId="cert-autocomplete" />
                  <Button data-testid="add-cert-btn" type="button" variant="outline" size="icon" onClick={() => addItem("certifications_required", newCert, setNewCert)}><Plus className="w-4 h-4" /></Button>
                </div>
                {job.certifications_required.length > 0 && <div className="flex flex-wrap gap-1.5">{job.certifications_required.map((c, i) => <Badge key={i} variant="outline" className="flex items-center gap-1 py-0.5 px-2 text-xs"><Award className="w-3 h-3" />{c}<button type="button" onClick={() => removeItem("certifications_required", i)} className="ml-0.5 hover:text-destructive"><X className="w-3 h-3" /></button></Badge>)}</div>}
              </div>
            </div>
          </CollapsibleSection>

          {/* === JOB-SPECIFIC COMPLIANCE === */}
          <CollapsibleSection id="compliance" title="Facility-Specific Requirements" icon={ShieldCheck} isActive={activeSection === "compliance"}>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Add requirements specific to this role beyond your baseline compliance (e.g., facility orientation, policy acknowledgements, specialized training).</p>
              <div className="flex gap-2">
                <Input
                  data-testid="compliance-req-input"
                  value={newComplianceReq}
                  onChange={(e) => setNewComplianceReq(e.target.value)}
                  placeholder="e.g., EPIC EMR training, Fall prevention module"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem("compliance_requirements", newComplianceReq, setNewComplianceReq))}
                />
                <Button data-testid="add-compliance-btn" type="button" variant="outline" size="icon" onClick={() => addItem("compliance_requirements", newComplianceReq, setNewComplianceReq)}><Plus className="w-4 h-4" /></Button>
              </div>
              {job.compliance_requirements.length > 0 && (
                <div className="space-y-1.5">
                  {job.compliance_requirements.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md text-sm">
                      <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1">{r}</span>
                      <button type="button" onClick={() => removeItem("compliance_requirements", i)} className="text-muted-foreground hover:text-destructive shrink-0"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* === APPLICATION WORKFLOW === */}
          <CollapsibleSection id="workflow" title="Application Workflow" icon={Globe} isActive={activeSection === "workflow"}>
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">How should candidates apply?</Label>
                <Select value={job.application_workflow_type} onValueChange={(v) => setJob((p) => ({ ...p, application_workflow_type: v, external_application_stage: v === "in_platform_only" ? "" : v === "external_required_immediately" ? "before_match" : "after_match" }))}>
                  <SelectTrigger data-testid="workflow-type-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_platform_only">In-platform only</SelectItem>
                    <SelectItem value="external_required_immediately">External application required immediately</SelectItem>
                    <SelectItem value="external_required_after_match">External application after match</SelectItem>
                    <SelectItem value="external_optional">External application optional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {job.application_workflow_type !== "in_platform_only" && (
                <>
                  <div className="space-y-1.5">
                    <Label>External Application URL *</Label>
                    <div className="relative"><ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input data-testid="external-url-input" value={job.external_application_url} onChange={(e) => setJob((p) => ({ ...p, external_application_url: e.target.value }))} className="pl-10" placeholder="https://careers.yourcompany.com/apply" type="url" /></div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>When is external application required?</Label>
                    <Select value={job.external_application_stage} onValueChange={(v) => setJob((p) => ({ ...p, external_application_stage: v }))}>
                      <SelectTrigger data-testid="workflow-stage-select"><SelectValue placeholder="Select stage" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="before_match">Before match</SelectItem>
                        <SelectItem value="after_match">After mutual match</SelectItem>
                        <SelectItem value="after_offer">After offer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          </CollapsibleSection>

          {/* === REVIEW === */}
          <CollapsibleSection id="review" title="Review & Publish" icon={Check} isActive={activeSection === "review"}>
            <div className="space-y-4">
              {!canPublish && (
                <div data-testid="missing-fields-warning" className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <p className="text-sm font-medium text-amber-600 flex items-center gap-1.5 mb-2"><AlertTriangle className="w-4 h-4" /> {missingFields.length} required field{missingFields.length > 1 ? "s" : ""} missing</p>
                  <div className="flex flex-wrap gap-1.5">
                    {missingFields.map((f) => <Badge key={f} variant="outline" className="text-xs text-amber-600 border-amber-300">{f.replace(/_/g, " ")}</Badge>)}
                  </div>
                </div>
              )}
              {canPublish && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                  <p className="text-sm font-medium text-green-600 flex items-center gap-1.5"><Check className="w-4 h-4" /> Ready to publish — all required fields are complete</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Position</h4>
                  <ReviewField label="Title" value={isWeakTitle(job.title) && generatedTitle ? `${job.title} → ${generatedTitle}` : job.title} required missing={!requiredFields.title} />
                  <ReviewField label="Specialty" value={job.specialty} required missing={!requiredFields.specialty} />
                  <ReviewField label="Location" value={job.location} required missing={!requiredFields.location} />
                  <ReviewField label="Job Type" value={job.job_type} required missing={!requiredFields.job_type} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Schedule</h4>
                  <ReviewField label="Shift" value={job.shift_type} required missing={!requiredFields.shift_type} />
                  <ReviewField label="Start Date" value={job.start_date} required missing={!requiredFields.start_date} />
                  <ReviewField label="Duration" value={job.duration} required={isTravelContract} missing={isTravelContract && !requiredFields.duration} />
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Compensation</h4>
                <ReviewField label="Pay" value={hasStructuredPay ? `$${calculatedWeeklyPay.toLocaleString()}/week ($${baseRate}/hr x ${guaranteedHrs}hrs${weeklyStipend > 0 ? ` + $${weeklyStipend}` : ""})` : null} required missing={!requiredFields.pay} />
                {payOutOfRange && <ReviewField label="Pay Confirmed" value={payWarningAcknowledged ? "Yes" : null} required missing={!payWarningAcknowledged} />}
                {isTravelContract && <ReviewField label="Stipend Type" value={job.stipend} required missing={!requiredFields.stipend} />}
                <ReviewField label="Benefits" value={job.benefits.length > 0 ? job.benefits.join(", ") : null} />
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Requirements</h4>
                <ReviewField label="Experience" value={job.experience_required !== "" ? `${job.experience_required}+ years` : null} required missing={!requiredFields.experience} />
                <ReviewField label="Certifications" value={job.certifications_required.length > 0 ? job.certifications_required.join(", ") : null} />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <Button variant="outline" onClick={() => navigate("/poster")} data-testid="cancel-btn">Cancel</Button>
                <Button data-testid="save-job-bottom-btn" onClick={handleSave} disabled={saving || !canPublish} size="lg">
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Publishing..." : isEdit ? "Update Job" : "Publish Job"}
                </Button>
              </div>
            </div>
          </CollapsibleSection>
        </div>

        {/* Mobile Bottom Bar */}
        <div data-testid="mobile-sticky-submit" className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-background/95 backdrop-blur-sm border-t px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            {isEdit && initialLoadComplete && <AutoSaveIndicator status={autoSaveStatus} />}
            {!isEdit && <span className="text-xs text-muted-foreground">{canPublish ? "Ready to publish" : `${missingFields.length} fields remaining`}</span>}
          </div>
          <Button data-testid="mobile-submit-btn" onClick={handleSave} disabled={saving || !canPublish} className="shrink-0">
            <Save className="w-4 h-4 mr-1.5" />{saving ? "..." : isEdit ? "Update" : "Publish"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default JobFormPage;
