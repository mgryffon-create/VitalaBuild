import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { User, Mail, Phone, MapPin, Plus, X, Briefcase, Award, DollarSign, Heart, Save, CheckCircle, FileText, Stethoscope, Clock, Building, Calendar, Upload, Sparkles, Loader2, Cloud, CloudOff, Shield, Settings, UserCheck, BookOpen, ClipboardCheck, CreditCard, ShieldCheck, ChevronRight } from "lucide-react";

// Custom hook for debounced auto-save
const useAutoSave = (data, saveFunction, delay = 2000) => {
  const [autoSaveStatus, setAutoSaveStatus] = useState('saved'); // 'saved', 'saving', 'unsaved', 'error'
  const timeoutRef = useRef(null);
  const lastSavedRef = useRef(JSON.stringify(data));
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const currentData = JSON.stringify(data);
    
    // If data hasn't changed from last save, don't trigger
    if (currentData === lastSavedRef.current) {
      return;
    }

    setAutoSaveStatus('unsaved');

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for auto-save
    timeoutRef.current = setTimeout(async () => {
      setAutoSaveStatus('saving');
      try {
        await saveFunction();
        lastSavedRef.current = JSON.stringify(data);
        setAutoSaveStatus('saved');
      } catch (error) {
        setAutoSaveStatus('error');
      }
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, saveFunction, delay]);

  return autoSaveStatus;
};

// Auto-save status indicator component
const AutoSaveIndicator = ({ status }) => {
  const statusConfig = {
    saved: { icon: Cloud, text: 'Saved', className: 'text-green-500' },
    saving: { icon: Loader2, text: 'Saving...', className: 'text-blue-500 animate-spin' },
    unsaved: { icon: CloudOff, text: 'Unsaved changes', className: 'text-amber-500' },
    error: { icon: CloudOff, text: 'Save failed', className: 'text-red-500' }
  };

  const config = statusConfig[status] || statusConfig.saved;
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 text-sm ${config.className}`}>
      <Icon className="w-4 h-4" />
      <span>{config.text}</span>
    </div>
  );
};

const ProfileBuilder = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({});
  const [specialties, setSpecialties] = useState({ nursing: [], allied_health: [], all: [] });
  const [parsingResume, setParsingResume] = useState(false);
  const resumeInputRef = useRef(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const isSeeker = user?.role === "seeker";

  const fetchProfile = useCallback(async () => {
    try {
      const endpoint = isSeeker ? "/profile/seeker" : "/profile/poster";
      const response = await axios.get(`${API}${endpoint}`);
      setProfile(response.data || {});
    } catch (error) {
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
      // Delay setting initial load to prevent auto-save on first load
      setTimeout(() => setInitialLoadComplete(true), 500);
    }
  }, [isSeeker]);

  const fetchSpecialties = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/specialties`);
      setSpecialties(response.data);
    } catch (error) {
      console.error("Failed to load specialties");
    }
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchSpecialties();
  }, [fetchProfile, fetchSpecialties]);

  // Auto-save function (silent, no toast)
  const autoSave = useCallback(async () => {
    if (!initialLoadComplete) return;
    
    const endpoint = isSeeker ? "/profile/seeker" : "/profile/poster";
    await axios.put(`${API}${endpoint}`, profile);
    
    // Update user's profile_complete status
    const meRes = await axios.get(`${API}/auth/me`);
    updateUser(meRes.data);
  }, [profile, isSeeker, updateUser, initialLoadComplete]);

  // Use auto-save hook
  const autoSaveStatus = useAutoSave(
    initialLoadComplete ? profile : null, 
    autoSave, 
    1500
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const endpoint = isSeeker ? "/profile/seeker" : "/profile/poster";
      await axios.put(`${API}${endpoint}`, profile);
      
      // Update user's profile_complete status
      const meRes = await axios.get(`${API}/auth/me`);
      updateUser(meRes.data);
      
      toast.success("Profile saved successfully");
    } catch (error) {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleResumeUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a PDF, DOC, DOCX, or TXT file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setParsingResume(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API}/profile/parse-resume`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const parsedData = response.data;
      
      // Merge parsed data with existing profile
      setProfile(prev => ({
        ...prev,
        ...parsedData,
        contact_info: { ...prev.contact_info, ...parsedData.contact_info },
        work_history: [...(prev.work_history || []), ...(parsedData.work_history || [])],
        certifications: [...(prev.certifications || []), ...(parsedData.certifications || [])],
        skills: [...new Set([...(prev.skills || []), ...(parsedData.skills || [])])]
      }));

      toast.success("Resume parsed successfully! Please review and save your profile.");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to parse resume. Please fill in your details manually.");
    } finally {
      setParsingResume(false);
      if (resumeInputRef.current) {
        resumeInputRef.current.value = '';
      }
    }
  };

  const updateField = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const addToArray = (field, value) => {
    const current = profile[field] || [];
    setProfile(prev => ({ ...prev, [field]: [...current, value] }));
  };

  const removeFromArray = (field, index) => {
    const current = profile[field] || [];
    setProfile(prev => ({ ...prev, [field]: current.filter((_, i) => i !== index) }));
  };

  const updateArrayItem = (field, index, value) => {
    const current = profile[field] || [];
    const updated = [...current];
    updated[index] = value;
    setProfile(prev => ({ ...prev, [field]: updated }));
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div data-testid="profile-builder" className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {isSeeker ? "Your Profile" : "Company Profile"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isSeeker
                ? "Build your universal application"
                : "Tell job seekers about your facility"}
            </p>
          </div>
          {/* Auto-save indicator */}
          {initialLoadComplete && (
            <AutoSaveIndicator status={autoSaveStatus} />
          )}
        </div>

        {/* Resume Upload Section (Seeker Only) */}
        {isSeeker && (
          <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="font-semibold text-lg">Quick Start with Resume Upload</h3>
                  <p className="text-sm text-muted-foreground">
                    Upload your resume and we&apos;ll automatically fill in your profile details
                  </p>
                </div>
                <div>
                  <input
                    ref={resumeInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={handleResumeUpload}
                    className="hidden"
                    id="resume-upload"
                  />
                  <Button
                    data-testid="upload-resume-btn"
                    onClick={() => resumeInputRef.current?.click()}
                    disabled={parsingResume}
                    variant="outline"
                    className="border-primary text-primary hover:bg-primary hover:text-white"
                  >
                    {parsingResume ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Parsing...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Resume
                      </>
                    )}
                  </Button>
                </div>
              </div>
              {parsingResume && (
                <Alert className="mt-4 bg-primary/10 border-primary/20">
                  <Sparkles className="h-4 w-4" />
                  <AlertDescription>
                    Analyzing your resume with AI... This may take a moment.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {isSeeker ? (
          <>
            {/* Quick links — pages accessible from Profile */}
            <div data-testid="profile-quick-links" className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { label: "Document Vault", icon: Shield, path: "/seeker/vault", desc: "Upload & manage docs" },
                { label: "Licenses", icon: FileText, path: "/seeker/licenses", desc: "Professional licenses" },
                { label: "References", icon: UserCheck, path: "/references", desc: "Portable references" },
                { label: "Training", icon: BookOpen, path: "/seeker/training", desc: "CEU & compliance" },
                { label: "Onboarding", icon: ClipboardCheck, path: "/seeker/onboarding", desc: "Offer requirements" },
                { label: "Settings", icon: Settings, path: "/settings", desc: "Notifications & prefs" },
              ].map((link) => (
                <button
                  key={link.path}
                  data-testid={`quick-link-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                  onClick={() => navigate(link.path)}
                  className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left group"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <link.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{link.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{link.desc}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors shrink-0" />
                </button>
              ))}
            </div>
            <SeekerProfileForm 
              profile={profile} 
              updateField={updateField} 
              addToArray={addToArray} 
              removeFromArray={removeFromArray}
              updateArrayItem={updateArrayItem}
              specialties={specialties}
            />
          </>
        ) : (
          <>
            {/* Quick links — pages accessible from Profile */}
            <div data-testid="profile-quick-links" className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { label: "Billing & Plans", icon: CreditCard, path: "/poster/billing", desc: "Subscription & invoices" },
                { label: "Compliance", icon: ShieldCheck, path: "/poster/compliance", desc: "Onboarding & training" },
                { label: "Offers & Hires", icon: Briefcase, path: "/poster/offers-sent", desc: "Sent offers tracker" },
                { label: "Settings", icon: Settings, path: "/settings", desc: "Notifications & prefs" },
              ].map((link) => (
                <button
                  key={link.path}
                  data-testid={`quick-link-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                  onClick={() => navigate(link.path)}
                  className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left group"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <link.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{link.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{link.desc}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors shrink-0" />
                </button>
              ))}
            </div>
            <PosterProfileForm profile={profile} updateField={updateField} specialties={specialties} />
          </>
        )}

        {/* Save Button at Bottom */}
        <div className="sticky bottom-4 flex justify-end">
          <Button
            data-testid="save-profile-btn"
            onClick={handleSave}
            disabled={saving}
            size="lg"
            className="bg-primary hover:bg-primary/90 shadow-lg"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save Profile"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

// Seeker Profile Form
const SeekerProfileForm = ({ profile, updateField, addToArray, removeFromArray, updateArrayItem, specialties }) => {
  const [newCert, setNewCert] = useState({ name: "", expiration: "" });
  const [newLicense, setNewLicense] = useState({ name: "", state: "", expiration: "", license_number: "" });
  const [newBenefit, setNewBenefit] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newWorkHistory, setNewWorkHistory] = useState({
    facility_name: "",
    position: "",
    department: "",
    start_date: "",
    end_date: "",
    is_current: false,
    responsibilities: ""
  });
  const [newMedicalRecord, setNewMedicalRecord] = useState({
    record_type: "",
    date_completed: "",
    expiration_date: "",
    result: ""
  });
  const [newHighlight, setNewHighlight] = useState("");
  const [newSkill, setNewSkill] = useState("");

  const benefitOptions = [
    "Health Insurance",
    "Dental Insurance",
    "Vision Insurance",
    "401(k)",
    "Paid Time Off",
    "Flexible Schedule",
    "Sign-On Bonus",
    "Relocation Assistance",
    "Continuing Education",
    "Tuition Reimbursement",
    "Housing Stipend",
    "Travel Reimbursement"
  ];

  const medicalRecordTypes = [
    "TB Test (PPD/Quantiferon)",
    "COVID-19 Vaccination",
    "COVID-19 Booster",
    "MMR Vaccination",
    "MMR Titers",
    "Hepatitis B Vaccination",
    "Hepatitis B Titers",
    "Varicella Vaccination",
    "Varicella Titers",
    "Tdap Vaccination",
    "Influenza Vaccination",
    "Annual Physical",
    "Drug Screen",
    "Background Check",
    "Fit Test (N95)",
    "Other"
  ];

  return (
    <Tabs defaultValue="basic" className="space-y-6">
      <TabsList className="grid grid-cols-5 w-full">
        <TabsTrigger value="basic" data-testid="tab-basic">Basic Info</TabsTrigger>
        <TabsTrigger value="work" data-testid="tab-work">Work History</TabsTrigger>
        <TabsTrigger value="credentials" data-testid="tab-credentials">Credentials</TabsTrigger>
        <TabsTrigger value="medical" data-testid="tab-medical">Medical Records</TabsTrigger>
        <TabsTrigger value="preferences" data-testid="tab-preferences">Preferences</TabsTrigger>
      </TabsList>

      {/* Basic Info Tab */}
      <TabsContent value="basic" className="space-y-6">
        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Contact Information
            </CardTitle>
            <CardDescription>How employers can reach you</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    data-testid="contact-email-input"
                    id="email"
                    value={profile.contact_info?.email || ""}
                    onChange={(e) => updateField("contact_info", { ...profile.contact_info, email: e.target.value })}
                    className="pl-10"
                    placeholder="you@example.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    data-testid="contact-phone-input"
                    id="phone"
                    value={profile.contact_info?.phone || ""}
                    onChange={(e) => updateField("contact_info", { ...profile.contact_info, phone: e.target.value })}
                    className="pl-10"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  data-testid="contact-address-input"
                  id="address"
                  value={profile.contact_info?.address || ""}
                  onChange={(e) => updateField("contact_info", { ...profile.contact_info, address: e.target.value })}
                  className="pl-10"
                  placeholder="City, State"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Professional Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-primary" />
              Professional Information
            </CardTitle>
            <CardDescription>Your specialty and experience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="specialty">Specialty</Label>
                <Select
                  value={profile.specialty || ""}
                  onValueChange={(value) => updateField("specialty", value)}
                >
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
              <div className="space-y-2">
                <Label htmlFor="experience">Years of Experience</Label>
                <Input
                  data-testid="experience-input"
                  id="experience"
                  type="number"
                  min="0"
                  value={profile.years_experience || ""}
                  onChange={(e) => updateField("years_experience", parseInt(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                data-testid="bio-input"
                id="bio"
                value={profile.bio || ""}
                onChange={(e) => updateField("bio", e.target.value)}
                placeholder="Tell employers about yourself, your experience, and what you're looking for..."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Availability & Shift */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Availability & Shift
            </CardTitle>
            <CardDescription>When can you start and what shifts do you prefer?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Availability</Label>
                <Select value={profile.availability || ""} onValueChange={(v) => updateField("availability", v)}>
                  <SelectTrigger data-testid="availability-select"><SelectValue placeholder="Select availability" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Available Now">Available Now</SelectItem>
                    <SelectItem value="Available in 2 weeks">Available in 2 weeks</SelectItem>
                    <SelectItem value="Available in 1 month">Available in 1 month</SelectItem>
                    <SelectItem value="Not Available">Not Available</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Shift Preference</Label>
                <Select value={profile.preferred_shift || ""} onValueChange={(v) => updateField("preferred_shift", v)}>
                  <SelectTrigger data-testid="shift-select"><SelectValue placeholder="Select shift" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Day Shift">Day Shift</SelectItem>
                    <SelectItem value="Night Shift">Night Shift</SelectItem>
                    <SelectItem value="Rotating">Rotating</SelectItem>
                    <SelectItem value="Flexible">Flexible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Experience Highlights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Experience Highlights
            </CardTitle>
            <CardDescription>Add 3-5 concise highlights employers will see (e.g., "ICU + Trauma experience")</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(profile.experience_highlights || []).length > 0 && (
              <div className="space-y-1.5">
                {profile.experience_highlights.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                    <span className="text-primary text-sm">&bull;</span>
                    <span className="text-sm flex-1">{h}</span>
                    <button type="button" onClick={() => removeFromArray("experience_highlights", i)} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
            {(profile.experience_highlights || []).length < 5 && (
              <div className="flex gap-2">
                <Input data-testid="new-highlight-input" placeholder="e.g., Wound care + post-op patients" value={newHighlight} onChange={(e) => setNewHighlight(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newHighlight.trim()) { e.preventDefault(); addToArray("experience_highlights", newHighlight.trim()); setNewHighlight(""); }}} />
                <Button type="button" variant="outline" onClick={() => { if (newHighlight.trim()) { addToArray("experience_highlights", newHighlight.trim()); setNewHighlight(""); }}}><Plus className="w-4 h-4" /></Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Skills */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-primary" />
              Clinical Skills
            </CardTitle>
            <CardDescription>Specific skills relevant to your practice</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {(profile.skills || []).map((s, i) => (
                <Badge key={i} variant="outline" className="flex items-center gap-1">
                  {typeof s === "string" ? s : s?.name || ""}
                  <button type="button" onClick={() => removeFromArray("skills", i)} className="ml-0.5 hover:text-destructive"><X className="w-3 h-3" /></button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input data-testid="new-skill-input" placeholder="e.g., IV Therapy, Wound Assessment" value={newSkill} onChange={(e) => setNewSkill(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newSkill.trim()) { e.preventDefault(); addToArray("skills", newSkill.trim()); setNewSkill(""); }}} />
              <Button type="button" variant="outline" onClick={() => { if (newSkill.trim()) { addToArray("skills", newSkill.trim()); setNewSkill(""); }}}><Plus className="w-4 h-4" /></Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Work History Tab */}
      <TabsContent value="work" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              Work History
            </CardTitle>
            <CardDescription>Your previous employment experience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing Work History */}
            {(profile.work_history || []).length > 0 && (
              <div className="space-y-3 mb-6">
                {profile.work_history.map((job, index) => (
                  <div key={index} className="p-4 border border-border rounded-xl bg-muted/30">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-foreground">{job.position}</h4>
                          {job.is_current && (
                            <Badge className="bg-secondary/10 text-secondary text-xs">Current</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <Building className="w-3 h-3" /> {job.facility_name}
                          {job.department && <span> • {job.department}</span>}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {job.start_date} - {job.is_current ? "Present" : job.end_date}
                        </p>
                        {job.responsibilities && (
                          <p className="text-sm text-muted-foreground mt-2">{job.responsibilities}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFromArray("work_history", index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Work History */}
            <div className="p-4 border border-dashed border-border rounded-xl space-y-4">
              <p className="text-sm font-medium text-foreground">Add Work Experience</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Facility/Hospital Name</Label>
                  <Input
                    data-testid="work-facility-input"
                    value={newWorkHistory.facility_name}
                    onChange={(e) => setNewWorkHistory({ ...newWorkHistory, facility_name: e.target.value })}
                    placeholder="Memorial Hospital"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Position/Title</Label>
                  <Input
                    data-testid="work-position-input"
                    value={newWorkHistory.position}
                    onChange={(e) => setNewWorkHistory({ ...newWorkHistory, position: e.target.value })}
                    placeholder="ICU Registered Nurse"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Department/Unit</Label>
                  <Input
                    data-testid="work-department-input"
                    value={newWorkHistory.department}
                    onChange={(e) => setNewWorkHistory({ ...newWorkHistory, department: e.target.value })}
                    placeholder="Intensive Care Unit"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newWorkHistory.is_current}
                      onChange={(e) => setNewWorkHistory({ ...newWorkHistory, is_current: e.target.checked })}
                      className="rounded border-border"
                    />
                    <span className="text-sm">Currently working here</span>
                  </label>
                </div>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    data-testid="work-start-input"
                    type="month"
                    value={newWorkHistory.start_date}
                    onChange={(e) => setNewWorkHistory({ ...newWorkHistory, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    data-testid="work-end-input"
                    type="month"
                    value={newWorkHistory.end_date}
                    onChange={(e) => setNewWorkHistory({ ...newWorkHistory, end_date: e.target.value })}
                    disabled={newWorkHistory.is_current}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Key Responsibilities</Label>
                <Textarea
                  data-testid="work-responsibilities-input"
                  value={newWorkHistory.responsibilities}
                  onChange={(e) => setNewWorkHistory({ ...newWorkHistory, responsibilities: e.target.value })}
                  placeholder="Describe your key responsibilities and achievements..."
                  rows={3}
                />
              </div>
              <Button
                data-testid="add-work-btn"
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (newWorkHistory.facility_name && newWorkHistory.position) {
                    addToArray("work_history", newWorkHistory);
                    setNewWorkHistory({
                      facility_name: "",
                      position: "",
                      department: "",
                      start_date: "",
                      end_date: "",
                      is_current: false,
                      responsibilities: ""
                    });
                  } else {
                    toast.error("Please enter facility name and position");
                  }
                }}
              >
                <Plus className="w-4 h-4 mr-2" /> Add Work Experience
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Credentials Tab */}
      <TabsContent value="credentials" className="space-y-6">
        {/* Certifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Certifications
            </CardTitle>
            <CardDescription>Your professional certifications (BLS, ACLS, etc.)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 mb-4">
              {(profile.certifications || []).map((cert, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1 py-1.5 px-3">
                  <Award className="w-3 h-3" />
                  {cert.name}
                  {cert.expiration && <span className="text-xs opacity-70 ml-1">exp: {cert.expiration}</span>}
                  <button
                    type="button"
                    onClick={() => removeFromArray("certifications", index)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                data-testid="new-cert-name-input"
                placeholder="Certification name (e.g., BLS, ACLS)"
                value={newCert.name}
                onChange={(e) => setNewCert({ ...newCert, name: e.target.value })}
              />
              <Input
                data-testid="new-cert-exp-input"
                type="date"
                value={newCert.expiration}
                onChange={(e) => setNewCert({ ...newCert, expiration: e.target.value })}
                className="w-40"
              />
              <Button
                data-testid="add-cert-btn"
                type="button"
                variant="outline"
                onClick={() => {
                  if (newCert.name) {
                    addToArray("certifications", newCert);
                    setNewCert({ name: "", expiration: "" });
                  }
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Licenses */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              Professional Licenses
            </CardTitle>
            <CardDescription>Your state nursing/professional licenses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing Licenses */}
            {(profile.licenses || []).length > 0 && (
              <div className="space-y-2 mb-4">
                {profile.licenses.map((lic, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{lic.name} - {lic.state}</p>
                      <p className="text-xs text-muted-foreground">
                        {lic.license_number && `#${lic.license_number} • `}
                        Exp: {lic.expiration || "N/A"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFromArray("licenses", index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="grid sm:grid-cols-4 gap-2">
              <Input
                data-testid="new-license-name-input"
                placeholder="License type (e.g., RN)"
                value={newLicense.name}
                onChange={(e) => setNewLicense({ ...newLicense, name: e.target.value })}
              />
              <Input
                data-testid="new-license-state-input"
                placeholder="State"
                value={newLicense.state}
                onChange={(e) => setNewLicense({ ...newLicense, state: e.target.value })}
              />
              <Input
                data-testid="new-license-number-input"
                placeholder="License #"
                value={newLicense.license_number}
                onChange={(e) => setNewLicense({ ...newLicense, license_number: e.target.value })}
              />
              <Input
                data-testid="new-license-exp-input"
                type="date"
                value={newLicense.expiration}
                onChange={(e) => setNewLicense({ ...newLicense, expiration: e.target.value })}
              />
            </div>
            <Button
              data-testid="add-license-btn"
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                if (newLicense.name && newLicense.state) {
                  addToArray("licenses", newLicense);
                  setNewLicense({ name: "", state: "", expiration: "", license_number: "" });
                }
              }}
            >
              <Plus className="w-4 h-4 mr-2" /> Add License
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Medical Records Tab */}
      <TabsContent value="medical" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Medical Records & Immunizations
            </CardTitle>
            <CardDescription>Track your health clearances and immunization records</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Info Banner */}
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Note:</strong> This section helps you track your medical compliance requirements. 
                Upload actual documents in the Documents section for verification.
              </p>
            </div>

            {/* Existing Medical Records */}
            {(profile.medical_records || []).length > 0 && (
              <div className="space-y-2 mb-4">
                {profile.medical_records.map((record, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{record.record_type}</p>
                      <p className="text-xs text-muted-foreground">
                        Completed: {record.date_completed}
                        {record.expiration_date && ` • Expires: ${record.expiration_date}`}
                        {record.result && ` • Result: ${record.result}`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFromArray("medical_records", index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Medical Record */}
            <div className="p-4 border border-dashed border-border rounded-xl space-y-4">
              <p className="text-sm font-medium text-foreground">Add Medical Record</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Record Type</Label>
                  <Select
                    value={newMedicalRecord.record_type}
                    onValueChange={(value) => setNewMedicalRecord({ ...newMedicalRecord, record_type: value })}
                  >
                    <SelectTrigger data-testid="medical-type-select">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {medicalRecordTypes.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date Completed</Label>
                  <Input
                    data-testid="medical-date-input"
                    type="date"
                    value={newMedicalRecord.date_completed}
                    onChange={(e) => setNewMedicalRecord({ ...newMedicalRecord, date_completed: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expiration Date (if applicable)</Label>
                  <Input
                    data-testid="medical-exp-input"
                    type="date"
                    value={newMedicalRecord.expiration_date}
                    onChange={(e) => setNewMedicalRecord({ ...newMedicalRecord, expiration_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Result (if applicable)</Label>
                  <Input
                    data-testid="medical-result-input"
                    value={newMedicalRecord.result}
                    onChange={(e) => setNewMedicalRecord({ ...newMedicalRecord, result: e.target.value })}
                    placeholder="e.g., Negative, Immune, Complete"
                  />
                </div>
              </div>
              <Button
                data-testid="add-medical-btn"
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (newMedicalRecord.record_type && newMedicalRecord.date_completed) {
                    addToArray("medical_records", newMedicalRecord);
                    setNewMedicalRecord({
                      record_type: "",
                      date_completed: "",
                      expiration_date: "",
                      result: ""
                    });
                  } else {
                    toast.error("Please select record type and completion date");
                  }
                }}
              >
                <Plus className="w-4 h-4 mr-2" /> Add Medical Record
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Preferences Tab */}
      <TabsContent value="preferences" className="space-y-6">
        {/* Pay & Benefits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Pay Expectations
            </CardTitle>
            <CardDescription>Your compensation preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Minimum Hourly Rate</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    data-testid="min-pay-input"
                    type="number"
                    value={profile.expected_pay?.min || ""}
                    onChange={(e) => updateField("expected_pay", { ...profile.expected_pay, min: parseInt(e.target.value) || 0 })}
                    className="pl-10"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Desired Hourly Rate</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    data-testid="max-pay-input"
                    type="number"
                    value={profile.expected_pay?.max || ""}
                    onChange={(e) => updateField("expected_pay", { ...profile.expected_pay, max: parseInt(e.target.value) || 0 })}
                    className="pl-10"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Desired Benefits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary" />
              Desired Benefits
            </CardTitle>
            <CardDescription>Benefits you&apos;re looking for</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {benefitOptions.map((benefit) => (
                <button
                  key={benefit}
                  type="button"
                  onClick={() => {
                    const current = profile.desired_benefits || [];
                    if (current.includes(benefit)) {
                      updateField("desired_benefits", current.filter(b => b !== benefit));
                    } else {
                      updateField("desired_benefits", [...current, benefit]);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                    (profile.desired_benefits || []).includes(benefit)
                      ? "bg-secondary text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                  }`}
                >
                  {benefit}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Preferred Locations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Preferred Locations
            </CardTitle>
            <CardDescription>Where you&apos;d like to work</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                data-testid="new-location-input"
                placeholder="City, State"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
              />
              <Button
                data-testid="add-location-btn"
                type="button"
                variant="outline"
                onClick={() => {
                  if (newLocation) {
                    addToArray("preferred_locations", newLocation);
                    setNewLocation("");
                  }
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(profile.preferred_locations || []).map((loc, index) => (
                <Badge key={index} variant="outline" className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {loc}
                  <button
                    type="button"
                    onClick={() => removeFromArray("preferred_locations", index)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Work Environment Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Work Environment Preferences
            </CardTitle>
            <CardDescription>Help us match you with facilities that fit your style</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Schedule Stability</Label>
                <Select value={profile.schedule_stability_importance || ""} onValueChange={(v) => updateField("schedule_stability_importance", v)}>
                  <SelectTrigger data-testid="schedule-stability-select"><SelectValue placeholder="How important?" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low — Flexible</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High — Very important</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Overtime Preference</Label>
                <Select value={profile.overtime_preference || ""} onValueChange={(v) => updateField("overtime_preference", v)}>
                  <SelectTrigger data-testid="overtime-pref-select"><SelectValue placeholder="Your preference" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Avoid overtime">Avoid overtime</SelectItem>
                    <SelectItem value="Open to overtime">Open to overtime</SelectItem>
                    <SelectItem value="Prefer overtime">Prefer overtime</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Overtime Pressure Tolerance</Label>
                <Select value={profile.overtime_pressure_tolerance || ""} onValueChange={(v) => updateField("overtime_pressure_tolerance", v)}>
                  <SelectTrigger data-testid="ot-pressure-select"><SelectValue placeholder="Tolerance level" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Not acceptable">Not acceptable</SelectItem>
                    <SelectItem value="Acceptable occasionally">Acceptable occasionally</SelectItem>
                    <SelectItem value="Comfortable with frequent overtime">Comfortable with frequent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Shift Cancellation Tolerance</Label>
                <Select value={profile.shift_cancellation_tolerance || ""} onValueChange={(v) => updateField("shift_cancellation_tolerance", v)}>
                  <SelectTrigger data-testid="cancel-tolerance-select"><SelectValue placeholder="Tolerance level" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Not acceptable">Not acceptable</SelectItem>
                    <SelectItem value="Acceptable occasionally">Acceptable occasionally</SelectItem>
                    <SelectItem value="Flexible">Flexible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Staffing Environment</Label>
                <Select value={profile.staffing_tolerance || ""} onValueChange={(v) => updateField("staffing_tolerance", v)}>
                  <SelectTrigger data-testid="staffing-tolerance-select"><SelectValue placeholder="Your comfort level" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Only well-staffed environments">Well-staffed only</SelectItem>
                    <SelectItem value="Moderate flexibility">Moderate flexibility</SelectItem>
                    <SelectItem value="Comfortable in high-acuity / short-staffed environments">Comfortable in high-acuity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Floating Tolerance</Label>
                <Select value={profile.floating_tolerance || ""} onValueChange={(v) => updateField("floating_tolerance", v)}>
                  <SelectTrigger data-testid="floating-select"><SelectValue placeholder="Your preference" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Do not float">Do not float</SelectItem>
                    <SelectItem value="Occasional floating acceptable">Occasional floating OK</SelectItem>
                    <SelectItem value="Flexible">Flexible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Pay Transparency Importance</Label>
              <Select value={profile.pay_transparency_importance || ""} onValueChange={(v) => updateField("pay_transparency_importance", v)}>
                <SelectTrigger data-testid="pay-transparency-select"><SelectValue placeholder="How important?" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Critical">Critical — Must be transparent</SelectItem>
                  <SelectItem value="Important">Important</SelectItem>
                  <SelectItem value="Flexible">Flexible</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Work Type & Travel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              Work Type & Travel
            </CardTitle>
            <CardDescription>What type of work are you looking for?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Job Type Preference</Label>
                <Select value={profile.job_type_preference || ""} onValueChange={(v) => updateField("job_type_preference", v)}>
                  <SelectTrigger data-testid="job-type-select"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Travel Contract">Travel Contract</SelectItem>
                    <SelectItem value="Per Diem">Per Diem</SelectItem>
                    <SelectItem value="Staff/Permanent">Staff/Permanent</SelectItem>
                    <SelectItem value="Any">Any</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Travel Readiness</Label>
                <Select value={profile.travel_readiness || ""} onValueChange={(v) => updateField("travel_readiness", v)}>
                  <SelectTrigger data-testid="travel-select"><SelectValue placeholder="Select readiness" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Open to travel">Open to travel</SelectItem>
                    <SelectItem value="Local only">Local only</SelectItem>
                    <SelectItem value="Will relocate">Will relocate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};

// Poster Profile Form
const PosterProfileForm = ({ profile, updateField, specialties }) => {
  return (
    <div className="space-y-6">
      {/* Company Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5 text-primary" />
            Company Information
          </CardTitle>
          <CardDescription>Tell job seekers about your facility</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company_name">Company/Facility Name</Label>
            <Input
              data-testid="company-name-input"
              id="company_name"
              value={profile.company_name || ""}
              onChange={(e) => updateField("company_name", e.target.value)}
              placeholder="e.g., Memorial Hospital"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company_description">About Your Facility</Label>
            <Textarea
              data-testid="company-description-input"
              id="company_description"
              value={profile.company_description || ""}
              onChange={(e) => updateField("company_description", e.target.value)}
              placeholder="Describe your facility, culture, and what makes it a great place to work..."
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company_logo">Logo URL</Label>
            <Input
              data-testid="company-logo-input"
              id="company_logo"
              value={profile.company_logo || ""}
              onChange={(e) => updateField("company_logo", e.target.value)}
              placeholder="https://..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Contact Information
          </CardTitle>
          <CardDescription>How candidates can reach you</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_email">Contact Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  data-testid="poster-email-input"
                  id="contact_email"
                  type="email"
                  value={profile.contact_info?.email || ""}
                  onChange={(e) => updateField("contact_info", { ...profile.contact_info, email: e.target.value })}
                  className="pl-10"
                  placeholder="hr@company.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_phone">Contact Phone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  data-testid="poster-phone-input"
                  id="contact_phone"
                  value={profile.contact_info?.phone || ""}
                  onChange={(e) => updateField("contact_info", { ...profile.contact_info, phone: e.target.value })}
                  className="pl-10"
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_address">Address</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                data-testid="poster-address-input"
                id="contact_address"
                value={profile.contact_info?.address || ""}
                onChange={(e) => updateField("contact_info", { ...profile.contact_info, address: e.target.value })}
                className="pl-10"
                placeholder="123 Main St, City, State 12345"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Facility Work Environment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Facility Work Environment
          </CardTitle>
          <CardDescription>Help pros understand your work environment for better matching</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Staffing Expectation</Label>
              <Select value={profile.staffing_expectation || ""} onValueChange={(v) => updateField("staffing_expectation", v)}>
                <SelectTrigger data-testid="staffing-expect-select"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Well-staffed">Well-staffed</SelectItem>
                  <SelectItem value="Moderate">Moderate</SelectItem>
                  <SelectItem value="High-acuity">High-acuity</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Floating Expectation</Label>
              <Select value={profile.floating_expectation || ""} onValueChange={(v) => updateField("floating_expectation", v)}>
                <SelectTrigger data-testid="floating-expect-select"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="None">None</SelectItem>
                  <SelectItem value="Occasional">Occasional</SelectItem>
                  <SelectItem value="Frequent">Frequent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Schedule Structure</Label>
              <Select value={profile.schedule_structure || ""} onValueChange={(v) => updateField("schedule_structure", v)}>
                <SelectTrigger data-testid="schedule-struct-select"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fixed">Fixed</SelectItem>
                  <SelectItem value="Rotating">Rotating</SelectItem>
                  <SelectItem value="Variable">Variable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Overtime Policy</Label>
              <Select value={profile.overtime_policy || ""} onValueChange={(v) => updateField("overtime_policy", v)}>
                <SelectTrigger data-testid="ot-policy-select"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Rare/optional">Rare / Optional</SelectItem>
                  <SelectItem value="Available">Available</SelectItem>
                  <SelectItem value="Expected">Expected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cancellation Policy</Label>
              <Select value={profile.cancellation_policy || ""} onValueChange={(v) => updateField("cancellation_policy", v)}>
                <SelectTrigger data-testid="cancel-policy-select"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Rare">Rare</SelectItem>
                  <SelectItem value="Occasional">Occasional</SelectItem>
                  <SelectItem value="Frequent">Frequent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Contract Accuracy Confidence</Label>
              <Select value={profile.contract_accuracy_confidence || ""} onValueChange={(v) => updateField("contract_accuracy_confidence", v)}>
                <SelectTrigger data-testid="contract-accuracy-select"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Moderate">Moderate</SelectItem>
                  <SelectItem value="Variable">Variable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileBuilder;
