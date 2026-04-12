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
import {
  Briefcase, MapPin, DollarSign, Clock, Plus, X, Save, ArrowLeft,
  Award, Gift, FileText, Calendar, Cloud, CloudOff, Loader2, Check,
  ChevronUp, ChevronDown
} from "lucide-react";

const SECTIONS = [
  { id: "basic", label: "Basic Info", icon: Briefcase },
  { id: "schedule", label: "Schedule", icon: Clock },
  { id: "compensation", label: "Compensation", icon: DollarSign },
  { id: "requirements", label: "Requirements", icon: FileText },
  { id: "review", label: "Review", icon: Check },
];

const AutoSaveIndicator = ({ status }) => {
  const statusConfig = {
    saved: { icon: Cloud, text: "Saved", className: "text-green-500" },
    saving: { icon: Loader2, text: "Saving...", className: "text-blue-500" },
    unsaved: { icon: CloudOff, text: "Unsaved", className: "text-amber-500" },
    error: { icon: CloudOff, text: "Save failed", className: "text-red-500" },
  };
  const config = statusConfig[status] || statusConfig.saved;
  const Icon = config.icon;
  return (
    <div className={`flex items-center gap-1.5 text-xs ${config.className}`}>
      <Icon className={`w-3.5 h-3.5 ${status === "saving" ? "animate-spin" : ""}`} />
      <span className="hidden sm:inline">{config.text}</span>
    </div>
  );
};

const CollapsibleSection = ({ id, title, icon: Icon, children, isActive, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div id={`section-${id}`} data-testid={`section-${id}`} className="scroll-mt-32">
      <Card className={`transition-all duration-200 ${isActive ? "ring-2 ring-primary/40 shadow-md" : "shadow-sm"}`}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full"
          data-testid={`toggle-section-${id}`}
        >
          <CardHeader className="flex flex-row items-center justify-between py-4 px-4 sm:px-6 cursor-pointer select-none">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Icon className="w-5 h-5 text-primary shrink-0" />
              {title}
            </CardTitle>
            {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </CardHeader>
        </button>
        {open && <CardContent className="px-4 sm:px-6 pb-5 pt-0">{children}</CardContent>}
      </Card>
    </div>
  );
};

const ProgressTracker = ({ activeSection, completedSections, onSectionClick }) => (
  <div data-testid="progress-tracker" className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b py-2.5 px-2 -mx-4 sm:-mx-0 mb-4">
    <div className="flex items-center justify-between max-w-4xl mx-auto px-2">
      {SECTIONS.map((section, idx) => {
        const isActive = activeSection === section.id;
        const isCompleted = completedSections.has(section.id);
        const Icon = section.icon;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSectionClick(section.id)}
            data-testid={`progress-step-${section.id}`}
            className="flex flex-col items-center gap-1 group relative flex-1"
          >
            {/* Connector line */}
            {idx > 0 && (
              <div className={`absolute top-3.5 right-1/2 w-full h-0.5 -z-10 ${
                isCompleted || isActive ? "bg-primary/50" : "bg-muted-foreground/20"
              }`} />
            )}
            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all text-xs font-semibold
              ${isActive ? "bg-primary text-primary-foreground scale-110 shadow-lg shadow-primary/30" : ""}
              ${isCompleted && !isActive ? "bg-primary/20 text-primary" : ""}
              ${!isActive && !isCompleted ? "bg-muted text-muted-foreground" : ""}
            `}>
              {isCompleted && !isActive ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
            </div>
            <span className={`text-[10px] sm:text-xs leading-tight text-center transition-colors
              ${isActive ? "text-primary font-semibold" : "text-muted-foreground"}
            `}>
              {section.label}
            </span>
          </button>
        );
      })}
    </div>
  </div>
);

const ReviewField = ({ label, value, missing }) => (
  <div className="flex justify-between items-start py-1.5 border-b border-muted/50 last:border-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className={`text-sm font-medium text-right max-w-[60%] ${missing ? "text-amber-500 italic" : ""}`}>
      {value || "Not set"}
    </span>
  </div>
);

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
    title: "",
    description: "",
    location: "",
    duration: "",
    pay_range: { min: "", max: "" },
    benefits: [],
    time_off_policy: "",
    requirements: [],
    certifications_required: [],
    experience_required: 0,
    specialty: "",
    shift_type: "",
    start_date: "",
  });

  const [newBenefit, setNewBenefit] = useState("");
  const [newRequirement, setNewRequirement] = useState("");
  const [newCert, setNewCert] = useState("");
  const isEdit = !!jobId;

  // Compute completed sections
  const completedSections = new Set();
  if (job.title && job.specialty && job.location && job.description) completedSections.add("basic");
  if (job.duration || job.shift_type || job.start_date) completedSections.add("schedule");
  if (job.pay_range.min || job.pay_range.max || job.benefits.length > 0) completedSections.add("compensation");
  if (job.experience_required > 0 || job.requirements.length > 0 || job.certifications_required.length > 0) completedSections.add("requirements");

  const durations = ["13 weeks", "26 weeks", "52 weeks", "Permanent", "Per Diem", "PRN"];
  const shiftTypes = ["Day Shift (7a-7p)", "Night Shift (7p-7a)", "Day Shift (8 hr)", "Evening Shift", "Rotating", "Flexible"];
  const commonBenefits = [
    "Health Insurance", "Dental Insurance", "Vision Insurance", "401(k)",
    "Housing Stipend", "Travel Reimbursement", "Sign-On Bonus", "Completion Bonus",
    "Referral Bonus", "Continuing Education", "License Reimbursement", "Meal Allowance",
  ];

  // Intersection Observer to track active section on scroll
  useEffect(() => {
    const sectionIds = SECTIONS.map((s) => `section-${s.id}`);
    const handleIntersect = (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible.length > 0) {
        const id = visible[0].target.id.replace("section-", "");
        setActiveSection(id);
      }
    };
    observerRef.current = new IntersectionObserver(handleIntersect, {
      rootMargin: "-120px 0px -50% 0px",
      threshold: 0.1,
    });
    // Small delay to allow DOM mount
    const timer = setTimeout(() => {
      sectionIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el) observerRef.current.observe(el);
      });
    }, 100);
    return () => {
      clearTimeout(timer);
      observerRef.current?.disconnect();
    };
  }, [loading]);

  const scrollToSection = (sectionId) => {
    const el = document.getElementById(`section-${sectionId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const fetchSpecialties = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/specialties`);
      setSpecialties(response.data);
    } catch (error) {
      console.error("Failed to load specialties");
    }
  }, []);

  const fetchJob = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/jobs/${jobId}`);
      setJob(response.data);
      lastSavedRef.current = JSON.stringify(response.data);
    } catch (error) {
      toast.error("Failed to load job");
      navigate("/poster");
    } finally {
      setLoading(false);
      setTimeout(() => setInitialLoadComplete(true), 500);
    }
  }, [jobId, navigate]);

  useEffect(() => {
    fetchSpecialties();
    if (jobId) fetchJob();
  }, [jobId, fetchJob, fetchSpecialties]);

  // Auto-save (edit mode only)
  useEffect(() => {
    if (!isEdit || !initialLoadComplete) return;
    const currentData = JSON.stringify(job);
    if (currentData === lastSavedRef.current) return;
    setAutoSaveStatus("unsaved");
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = setTimeout(async () => {
      if (!job.title || !job.description || !job.location || !job.specialty) return;
      setAutoSaveStatus("saving");
      try {
        const payload = {
          ...job,
          pay_range: { min: parseInt(job.pay_range.min) || 0, max: parseInt(job.pay_range.max) || 0 },
          experience_required: parseInt(job.experience_required) || 0,
        };
        await axios.put(`${API}/jobs/${jobId}`, payload);
        lastSavedRef.current = JSON.stringify(job);
        setAutoSaveStatus("saved");
      } catch (error) {
        setAutoSaveStatus("error");
      }
    }, 1500);
    return () => { if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current); };
  }, [job, isEdit, jobId, initialLoadComplete]);

  const handleSave = async () => {
    if (!job.title || !job.description || !job.location || !job.specialty) {
      toast.error("Please fill in all required fields (Title, Specialty, Location, Description)");
      scrollToSection("basic");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...job,
        pay_range: { min: parseInt(job.pay_range.min) || 0, max: parseInt(job.pay_range.max) || 0 },
        experience_required: parseInt(job.experience_required) || 0,
      };
      if (isEdit) {
        await axios.put(`${API}/jobs/${jobId}`, payload);
        toast.success("Job updated successfully");
      } else {
        await axios.post(`${API}/jobs`, payload);
        toast.success("Job posted successfully");
      }
      navigate("/poster");
    } catch (error) {
      toast.error(`Failed to ${isEdit ? "update" : "create"} job`);
    } finally {
      setSaving(false);
    }
  };

  const addItem = (field, value, setter) => {
    if (value.trim()) {
      setJob((prev) => ({ ...prev, [field]: [...(prev[field] || []), value.trim()] }));
      setter("");
    }
  };

  const removeItem = (field, index) => {
    setJob((prev) => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const requiredFieldsMissing = !job.title || !job.description || !job.location || !job.specialty;

  return (
    <DashboardLayout>
      <div data-testid="job-form-page" className="max-w-4xl mx-auto pb-24 sm:pb-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/poster")} data-testid="back-btn" className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                {isEdit ? "Edit Job Posting" : "Post New Job"}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {isEdit ? "Update your job listing" : "Fill in the details below"}
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            {isEdit && initialLoadComplete && <AutoSaveIndicator status={autoSaveStatus} />}
            <Button data-testid="save-job-btn" onClick={handleSave} disabled={saving} size="sm">
              <Save className="w-4 h-4 mr-1.5" />
              {saving ? "Saving..." : isEdit ? "Update" : "Post Job"}
            </Button>
          </div>
        </div>

        {/* Progress Tracker */}
        <ProgressTracker
          activeSection={activeSection}
          completedSections={completedSections}
          onSectionClick={scrollToSection}
        />

        <div className="space-y-4">
          {/* === SECTION 1: Basic Info === */}
          <CollapsibleSection id="basic" title="Basic Information" icon={Briefcase} isActive={activeSection === "basic"}>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">Job Title *</Label>
                <Input
                  data-testid="job-title-input"
                  id="title"
                  value={job.title}
                  onChange={(e) => setJob((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., ICU Registered Nurse"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Specialty *</Label>
                  <Select value={job.specialty} onValueChange={(v) => setJob((prev) => ({ ...prev, specialty: v }))}>
                    <SelectTrigger data-testid="specialty-select">
                      <SelectValue placeholder="Select specialty" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="px-2 py-1.5 text-sm font-semibold text-primary">Nursing</div>
                      {specialties.nursing?.map((spec) => (
                        <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                      ))}
                      <div className="px-2 py-1.5 text-sm font-semibold text-secondary border-t mt-2 pt-2">Allied Health</div>
                      {specialties.allied_health?.map((spec) => (
                        <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="location">Location *</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      data-testid="location-input"
                      id="location"
                      value={job.location}
                      onChange={(e) => setJob((prev) => ({ ...prev, location: e.target.value }))}
                      className="pl-10"
                      placeholder="City, State"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Job Description *</Label>
                <Textarea
                  data-testid="description-input"
                  id="description"
                  value={job.description}
                  onChange={(e) => setJob((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the role, responsibilities, and ideal candidate..."
                  rows={4}
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* === SECTION 2: Schedule === */}
          <CollapsibleSection id="schedule" title="Duration & Schedule" icon={Clock} isActive={activeSection === "schedule"}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Assignment Duration</Label>
                <Select value={job.duration} onValueChange={(v) => setJob((prev) => ({ ...prev, duration: v }))}>
                  <SelectTrigger data-testid="duration-select">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    {durations.map((dur) => (
                      <SelectItem key={dur} value={dur}>{dur}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Shift Type</Label>
                <Select value={job.shift_type} onValueChange={(v) => setJob((prev) => ({ ...prev, shift_type: v }))}>
                  <SelectTrigger data-testid="shift-select">
                    <SelectValue placeholder="Select shift" />
                  </SelectTrigger>
                  <SelectContent>
                    {shiftTypes.map((shift) => (
                      <SelectItem key={shift} value={shift}>{shift}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  data-testid="start-date-input"
                  id="start_date"
                  type="date"
                  value={job.start_date}
                  onChange={(e) => setJob((prev) => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* === SECTION 3: Compensation === */}
          <CollapsibleSection id="compensation" title="Compensation & Benefits" icon={DollarSign} isActive={activeSection === "compensation"}>
            <div className="space-y-5">
              {/* Pay Range */}
              <div>
                <Label className="text-sm font-semibold mb-2 block">Hourly Rate</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Minimum</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        data-testid="min-pay-input"
                        type="number"
                        value={job.pay_range.min}
                        onChange={(e) => setJob((prev) => ({ ...prev, pay_range: { ...prev.pay_range, min: e.target.value } }))}
                        className="pl-10"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Maximum</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        data-testid="max-pay-input"
                        type="number"
                        value={job.pay_range.max}
                        onChange={(e) => setJob((prev) => ({ ...prev, pay_range: { ...prev.pay_range, max: e.target.value } }))}
                        className="pl-10"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Benefits */}
              <div>
                <Label className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <Gift className="w-4 h-4 text-primary" /> Benefits Offered
                </Label>
                <div className="flex gap-2 mb-2">
                  <Select value={newBenefit} onValueChange={setNewBenefit}>
                    <SelectTrigger data-testid="benefit-select" className="flex-1">
                      <SelectValue placeholder="Select a benefit" />
                    </SelectTrigger>
                    <SelectContent>
                      {commonBenefits.map((b) => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button data-testid="add-benefit-btn" type="button" variant="outline" size="icon" onClick={() => addItem("benefits", newBenefit, setNewBenefit)}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {job.benefits.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {job.benefits.map((benefit, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1 py-0.5 px-2 text-xs">
                        {benefit}
                        <button type="button" onClick={() => removeItem("benefits", index)} className="ml-0.5 hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Time Off */}
              <div>
                <Label className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-primary" /> Time Off Policy
                </Label>
                <Textarea
                  data-testid="time-off-input"
                  value={job.time_off_policy}
                  onChange={(e) => setJob((prev) => ({ ...prev, time_off_policy: e.target.value }))}
                  placeholder="Describe PTO policies..."
                  rows={2}
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* === SECTION 4: Requirements === */}
          <CollapsibleSection id="requirements" title="Requirements & Certifications" icon={FileText} isActive={activeSection === "requirements"}>
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label>Minimum Years of Experience</Label>
                <Input
                  data-testid="experience-input"
                  type="number"
                  min="0"
                  value={job.experience_required}
                  onChange={(e) => setJob((prev) => ({ ...prev, experience_required: e.target.value }))}
                  placeholder="0"
                  className="w-28"
                />
              </div>

              <div>
                <Label className="mb-2 block">Additional Requirements</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    data-testid="requirement-input"
                    value={newRequirement}
                    onChange={(e) => setNewRequirement(e.target.value)}
                    placeholder="e.g., Must be able to lift 50 lbs"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem("requirements", newRequirement, setNewRequirement))}
                  />
                  <Button data-testid="add-requirement-btn" type="button" variant="outline" size="icon" onClick={() => addItem("requirements", newRequirement, setNewRequirement)}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {job.requirements.length > 0 && (
                  <div className="space-y-1.5">
                    {job.requirements.map((req, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md text-sm">
                        <span className="flex-1">{req}</span>
                        <button type="button" onClick={() => removeItem("requirements", index)} className="text-muted-foreground hover:text-destructive shrink-0">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label className="mb-2 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-primary" /> Required Certifications
                </Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    data-testid="cert-input"
                    value={newCert}
                    onChange={(e) => setNewCert(e.target.value)}
                    placeholder="e.g., BLS, ACLS, PALS"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem("certifications_required", newCert, setNewCert))}
                  />
                  <Button data-testid="add-cert-btn" type="button" variant="outline" size="icon" onClick={() => addItem("certifications_required", newCert, setNewCert)}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {job.certifications_required.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {job.certifications_required.map((cert, index) => (
                      <Badge key={index} variant="outline" className="flex items-center gap-1 py-0.5 px-2 text-xs">
                        <Award className="w-3 h-3" />
                        {cert}
                        <button type="button" onClick={() => removeItem("certifications_required", index)} className="ml-0.5 hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CollapsibleSection>

          {/* === SECTION 5: Review & Submit === */}
          <CollapsibleSection id="review" title="Review & Submit" icon={Check} isActive={activeSection === "review"}>
            <div className="space-y-4">
              {requiredFieldsMissing && (
                <div data-testid="missing-fields-warning" className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm text-amber-600">
                  Please complete all required fields (marked with *) in the Basic Info section before submitting.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Position</h4>
                  <ReviewField label="Title" value={job.title} missing={!job.title} />
                  <ReviewField label="Specialty" value={job.specialty} missing={!job.specialty} />
                  <ReviewField label="Location" value={job.location} missing={!job.location} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Schedule</h4>
                  <ReviewField label="Duration" value={job.duration} />
                  <ReviewField label="Shift" value={job.shift_type} />
                  <ReviewField label="Start Date" value={job.start_date} />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Compensation</h4>
                <ReviewField
                  label="Pay Range"
                  value={job.pay_range.min || job.pay_range.max ? `$${job.pay_range.min || "0"} - $${job.pay_range.max || "0"}/hr` : null}
                />
                <ReviewField label="Benefits" value={job.benefits.length > 0 ? job.benefits.join(", ") : null} />
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Requirements</h4>
                <ReviewField label="Experience" value={job.experience_required > 0 ? `${job.experience_required}+ years` : null} />
                <ReviewField label="Certifications" value={job.certifications_required.length > 0 ? job.certifications_required.join(", ") : null} />
                <ReviewField label="Requirements" value={job.requirements.length > 0 ? `${job.requirements.length} listed` : null} />
              </div>

              {/* Desktop Submit */}
              <div className="flex justify-end gap-3 pt-3 border-t">
                <Button variant="outline" onClick={() => navigate("/poster")} data-testid="cancel-btn">
                  Cancel
                </Button>
                <Button
                  data-testid="save-job-bottom-btn"
                  onClick={handleSave}
                  disabled={saving || requiredFieldsMissing}
                  size="lg"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Saving..." : isEdit ? "Update Job" : "Post Job"}
                </Button>
              </div>
            </div>
          </CollapsibleSection>
        </div>

        {/* Mobile Sticky Bottom Bar */}
        <div data-testid="mobile-sticky-submit" className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-background/95 backdrop-blur-sm border-t px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            {isEdit && initialLoadComplete && <AutoSaveIndicator status={autoSaveStatus} />}
            {!isEdit && (
              <span className="text-xs text-muted-foreground">
                {completedSections.size}/{SECTIONS.length - 1} sections filled
              </span>
            )}
          </div>
          <Button
            data-testid="mobile-submit-btn"
            onClick={handleSave}
            disabled={saving || requiredFieldsMissing}
            className="shrink-0"
          >
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? "Saving..." : isEdit ? "Update" : "Post Job"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default JobFormPage;
