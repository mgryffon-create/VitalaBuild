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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import FEATURE_FLAGS from "@/config/featureFlags";
import DashboardLayout from "@/components/DashboardLayout";
import { User, Mail, Phone, MapPin, Plus, X, Briefcase, Award, DollarSign, Heart, Save, CheckCircle, Circle, FileText, Stethoscope, Clock, Building, Calendar, Upload, Sparkles, Loader2, Cloud, CloudOff, Shield, Settings, UserCheck, BookOpen, ClipboardCheck, CreditCard, ShieldCheck, ChevronRight, Trash2, ArrowRight, PartyPopper } from "lucide-react";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import SuggestionInput from "@/components/SuggestionInput";
import SpecialtyAutocomplete from "@/components/SpecialtyAutocomplete";
import InlineAutocomplete from "@/components/InlineAutocomplete";
import { getSkillSuggestions, getHighlightSuggestions } from "@/config/specialtySuggestions";
import { CERTIFICATIONS, LICENSE_TYPES, US_STATES, POSITION_TITLES, DEPARTMENTS } from "@/config/fieldSuggestions";
import { CANONICAL_ROLES, ROLE_LABELS } from "@/config/canonicalRoles";

const TAB_ORDER = ["basic", "work", "credentials", "medical", "preferences"];

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
  const [resumeReview, setResumeReview] = useState(null); // parsed data for review
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

      // Use the resume parser endpoint — NO explicit Content-Type (let axios set boundary)
      const response = await axios.post(`${API}/resume/parse/upload`, formData);
      const parsed = response.data?.parsed_profile;
      const parseId = response.data?.parse_id;

      if (!parsed || parsed.error) {
        toast.error(parsed?.error || "Failed to parse resume. Try a different format.");
        return;
      }

      // Show review dialog instead of silently merging
      setResumeReview({ parsed, parseId });
      toast.success("Resume analyzed! Review the extracted data below.");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to parse resume. Please fill in your details manually.");
    } finally {
      setParsingResume(false);
      if (resumeInputRef.current) {
        resumeInputRef.current.value = '';
      }
    }
  };

  const applyResumeData = () => {
    if (!resumeReview?.parsed) return;
    const p = resumeReview.parsed;

    setProfile(prev => {
      const updated = { ...prev };

      // Basic fields — only set if parsed and not already filled
      if (p.full_name && !prev.full_name) updated.full_name = p.full_name;
      if (p.professional_summary && !prev.bio) updated.bio = p.professional_summary;
      if (p.specialties?.length && !prev.specialty) updated.specialty = p.specialties[0];
      if (p.phone && !prev.contact_info?.phone) {
        updated.contact_info = { ...prev.contact_info, phone: p.phone };
      }
      if (p.email && !prev.contact_info?.email) {
        updated.contact_info = { ...prev.contact_info, ...updated.contact_info, email: p.email };
      }

      // Skills — normalize from objects/strings, merge without duplicates
      if (p.skills?.length) {
        const normalizeSkill = (s) => typeof s === 'string' ? s : s?.name || '';
        const existingSkills = (prev.skills || []).map(s => normalizeSkill(s).toLowerCase());
        const parsedSkills = p.skills.map(normalizeSkill).filter(Boolean);
        const newSkills = parsedSkills.filter(s => !existingSkills.includes(s.toLowerCase()));
        updated.skills = [...(prev.skills || []), ...newSkills];
      }

      // Certifications — merge
      if (p.certifications?.length) {
        const existingCerts = (prev.certifications || []).map(c => (typeof c === 'string' ? c : c?.name || '').toLowerCase());
        const newCerts = p.certifications
          .map(c => c.name || c)
          .filter(c => !existingCerts.includes((typeof c === 'string' ? c : '').toLowerCase()));
        updated.certifications = [...(prev.certifications || []), ...newCerts];
      }

      // Work history — append
      if (p.employment_groups?.length) {
        const workEntries = p.employment_groups.map(g => ({
          facility_name: g.primary_employer || g.display_title || "",
          position: g.role_title || g.display_title || "",
          department: g.specialties?.join(", ") || "",
          start_date: g.start_date || "",
          end_date: g.end_date || "",
          is_current: g.currently_working || false,
          responsibilities: g.responsibilities?.join(". ") || g.description_summary || "",
        }));
        updated.work_history = [...(prev.work_history || []), ...workEntries];
        updated.work_history_mode = p.work_history_mode || "condensed";
      }

      // Education
      if (p.education?.length && !(prev.education?.length)) {
        updated.education = p.education;
      }

      // Experience highlights from parsed summary
      if (p.specialties?.length && !(prev.experience_highlights?.length)) {
        updated.experience_highlights = p.specialties.slice(0, 3).map(s => `${s} experience`);
      }

      return updated;
    });

    setResumeReview(null);
    toast.success("Resume data applied to your profile. Review and save.");
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
                        Reading...
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
                    Getting your profile ready... This may take a moment.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Resume Review Dialog */}
        <Dialog open={!!resumeReview} onOpenChange={(open) => { if (!open) setResumeReview(null); }}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>We found this from your resume</DialogTitle>
              <DialogDescription>
                Review what we found. You can always edit after adding.
              </DialogDescription>
            </DialogHeader>
            {resumeReview?.parsed && (() => {
              const p = resumeReview.parsed;
              const hasData = p.full_name || p.specialties?.length || p.employment_groups?.length || p.skills?.length || p.certifications?.length;
              return (
                <div data-testid="resume-review-content" className="space-y-3 py-2">
                  {!hasData ? (
                    <p className="text-sm text-muted-foreground text-center py-4">We couldn&apos;t find structured data. Try a different file format.</p>
                  ) : (
                    <>
                      {/* Name + Specialty — compact row */}
                      {(p.full_name || p.specialties?.length > 0) && (
                        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30 text-sm">
                          {p.full_name && <span className="font-medium text-foreground">{p.full_name}</span>}
                          {p.specialties?.length > 0 && (
                            <span className="text-muted-foreground">{p.specialties.map(s => typeof s === 'string' ? s : s?.name || '').filter(Boolean).join(", ")}</span>
                          )}
                        </div>
                      )}

                      {/* Work History — emphasized */}
                      {p.employment_groups?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                            {p.employment_groups.length} position{p.employment_groups.length > 1 ? "s" : ""} found
                          </p>
                          <div className="space-y-1.5">
                            {p.employment_groups.map((g, i) => (
                              <div key={i} className="px-3 py-2.5 rounded-lg border bg-card text-sm">
                                <p className="font-medium text-foreground">{g.role_title || g.display_title || "Position"}</p>
                                <p className="text-xs text-muted-foreground">{g.primary_employer || ""}{g.start_date ? ` | ${g.start_date}` : ""}{g.end_date ? ` — ${g.end_date}` : g.currently_working ? " — Present" : ""}</p>
                                {g.specialties?.length > 0 && <p className="text-[10px] text-muted-foreground mt-0.5">{g.specialties.join(", ")}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Skills */}
                      {p.skills?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                            {p.skills.length} skill{p.skills.length > 1 ? "s" : ""}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {p.skills.slice(0, 12).map((s, idx) => {
                              const label = typeof s === 'string' ? s : s?.name || '';
                              return <Badge key={`${label}-${idx}`} variant="outline" className="text-[10px]">{label}</Badge>;
                            })}
                            {p.skills.length > 12 && <Badge variant="outline" className="text-[10px]">+{p.skills.length - 12} more</Badge>}
                          </div>
                        </div>
                      )}

                      {/* Certifications + Licenses — compact */}
                      {(p.certifications?.length > 0 || p.licenses?.length > 0) && (
                        <div className="flex flex-wrap gap-3 text-sm">
                          {p.certifications?.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                              <span className="text-foreground">{p.certifications.map(c => c.name || c).join(", ")}</span>
                            </div>
                          )}
                          {p.licenses?.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                              <span className="text-foreground">{p.licenses.map(l => `${l.license_type || ""} ${l.state || ""}`.trim()).join(", ")}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Bio — de-emphasized */}
                      {p.professional_summary && (
                        <p className="text-xs text-muted-foreground italic px-1">{p.professional_summary.slice(0, 150)}{p.professional_summary.length > 150 ? "..." : ""}</p>
                      )}
                    </>
                  )}
                </div>
              );
            })()}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setResumeReview(null)} data-testid="resume-review-cancel">
                Discard
              </Button>
              <Button onClick={applyResumeData} data-testid="resume-review-apply">
                <CheckCircle className="w-4 h-4 mr-1.5" /> Add to Profile
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
              onSave={handleSave}
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
const SeekerProfileForm = ({ profile, updateField, addToArray, removeFromArray, updateArrayItem, specialties, onSave }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("basic");
  const [sectionSaving, setSectionSaving] = useState(false);
  const [justAdvanced, setJustAdvanced] = useState(false);
  const tabListRef = useRef(null);
  const [newCert, setNewCert] = useState({ name: "", expiration: "" });
  const [newLicense, setNewLicense] = useState({ name: "", state: "", expiration: "", license_number: "" });
  const [newBenefit, setNewBenefit] = useState("");
  const [newWorkHistory, setNewWorkHistory] = useState({
    facility_name: "",
    position: "",
    department: "",
    start_date: "",
    end_date: "",
    is_current: false,
    responsibilities: ""
  });
  const [editingWorkIndex, setEditingWorkIndex] = useState(null);

  // Scroll active tab into view when it changes
  useEffect(() => {
    if (tabListRef.current) {
      const activeEl = tabListRef.current.querySelector('[data-state="active"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTab]);

  // Parse legacy address into structured fields on first load
  useEffect(() => {
    if (profile.contact_info?.address && !profile.contact_info?.city && !profile.contact_info?.street_address) {
      const addr = profile.contact_info.address;
      const parts = addr.split(',').map(s => s.trim());
      let parsed = {};
      if (parts.length >= 3) {
        const last = parts[parts.length - 1].trim().split(/\s+/);
        parsed = { street_address: parts[0], city: parts[1], state: last[0] || '', zip: last[1] || '' };
      } else if (parts.length === 2) {
        const last = parts[1].trim().split(/\s+/);
        parsed = { city: parts[0], state: last[0] || '', zip: last[1] || '' };
      } else {
        parsed = { street_address: addr };
      }
      updateField("contact_info", { ...profile.contact_info, ...parsed });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const composeAddress = (ci) => {
    const parts = [
      ci?.street_address,
      ci?.city,
      ci?.state && ci?.zip ? `${ci.state} ${ci.zip}` : (ci?.state || ci?.zip)
    ].filter(Boolean);
    return parts.join(', ');
  };

  // Validate current section
  const validateSection = (tab) => {
    switch (tab) {
      case 'basic':
        if (!profile.contact_info?.email && !profile.contact_info?.phone) {
          toast.error("Please enter at least an email or phone number");
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const isLastTab = activeTab === TAB_ORDER[TAB_ORDER.length - 1];
  const currentTabIdx = TAB_ORDER.indexOf(activeTab);

  // Save & advance to next tab
  const handleSaveAndContinue = async () => {
    if (!validateSection(activeTab)) return;

    // Compose address for backward compat before save
    if (profile.contact_info) {
      const composed = composeAddress(profile.contact_info);
      if (composed && composed !== profile.contact_info.address) {
        updateField("contact_info", { ...profile.contact_info, address: composed });
      }
    }

    setSectionSaving(true);
    try {
      await onSave();
      setJustAdvanced(true);

      if (!isLastTab) {
        // Brief success flash, then advance
        setTimeout(() => {
          setActiveTab(TAB_ORDER[currentTabIdx + 1]);
          setJustAdvanced(false);
          // Scroll to top of content
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 600);
      } else {
        // Last tab — show completion
        setTimeout(() => setJustAdvanced(false), 2000);
      }
    } catch {
      toast.error("Save failed. Please try again.");
    } finally {
      setSectionSaving(false);
    }
  };

  // Continue button rendered at bottom of each tab section
  const ContinueButton = () => (
    <div data-testid="section-continue" className="pt-4">
      {justAdvanced && isLastTab ? (
        <div data-testid="profile-complete-indicator" className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-green-50 border border-green-200 text-green-700">
          <PartyPopper className="w-5 h-5" />
          <span className="font-medium">Profile complete! You can still edit any section.</span>
        </div>
      ) : (
        <Button
          data-testid={isLastTab ? "complete-profile-btn" : "save-continue-btn"}
          onClick={handleSaveAndContinue}
          disabled={sectionSaving}
          className="w-full"
          size="lg"
        >
          {sectionSaving ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
          ) : justAdvanced ? (
            <><CheckCircle className="w-4 h-4 mr-2" /> Saved!</>
          ) : isLastTab ? (
            <><CheckCircle className="w-4 h-4 mr-2" /> Complete Profile</>
          ) : (
            <><ArrowRight className="w-4 h-4 mr-2" /> Save &amp; Continue</>
          )}
        </Button>
      )}
    </div>
  );

  const startEditWork = (index) => {
    const job = (profile.work_history || [])[index];
    if (!job) return;
    // Normalize field names — handles both standard and resume-parsed formats
    setNewWorkHistory({
      facility_name: job.facility_name || job.primary_employer || "",
      position: job.position || job.role_title || job.display_title || "",
      department: job.department || (job.specialties ? (Array.isArray(job.specialties) ? job.specialties.join(", ") : job.specialties) : ""),
      start_date: job.start_date || "",
      end_date: job.end_date || "",
      is_current: job.is_current || job.currently_working || false,
      responsibilities: job.responsibilities || (job.description_summary || ""),
    });
    setEditingWorkIndex(index);
  };

  const cancelEditWork = () => {
    setEditingWorkIndex(null);
    setNewWorkHistory({ facility_name: "", position: "", department: "", start_date: "", end_date: "", is_current: false, responsibilities: "" });
  };

  const saveWorkEntry = () => {
    if (!newWorkHistory.facility_name || !newWorkHistory.position) {
      return;
    }
    if (editingWorkIndex !== null) {
      updateArrayItem("work_history", editingWorkIndex, newWorkHistory);
      setEditingWorkIndex(null);
    } else {
      addToArray("work_history", newWorkHistory);
    }
    setNewWorkHistory({ facility_name: "", position: "", department: "", start_date: "", end_date: "", is_current: false, responsibilities: "" });
  };

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

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      {/* Sticky, scrollable tab bar */}
      <div className="sticky top-0 z-20 bg-background pt-1 pb-2 -mx-1 px-1">
        <TabsList
          ref={tabListRef}
          className="no-scrollbar flex w-full overflow-x-auto h-auto p-1 gap-1"
        >
          {TAB_ORDER.map((tab, idx) => {
            const labels = { basic: "Basic Info", work: "Work History", credentials: "Credentials", medical: "Medical", preferences: "Preferences" };
            const isDone = idx < currentTabIdx;
            return (
              <TabsTrigger
                key={tab}
                value={tab}
                data-testid={`tab-${tab}`}
                className="flex-shrink-0 text-xs sm:text-sm px-3 sm:px-4 py-2 gap-1.5"
              >
                {isDone && <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />}
                {labels[tab]}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

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
            {/* Structured Address Fields */}
            <div className="space-y-3">
              <Label className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                Address
              </Label>
              <div className="space-y-3">
                <Input
                  data-testid="contact-street-input"
                  value={profile.contact_info?.street_address || ""}
                  onChange={(e) => updateField("contact_info", { ...profile.contact_info, street_address: e.target.value })}
                  placeholder="Street Address"
                  autoComplete="street-address"
                />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="col-span-2 sm:col-span-2">
                    <Input
                      data-testid="contact-city-input"
                      value={profile.contact_info?.city || ""}
                      onChange={(e) => updateField("contact_info", { ...profile.contact_info, city: e.target.value })}
                      placeholder="City"
                      autoComplete="address-level2"
                    />
                  </div>
                  <div>
                    <InlineAutocomplete
                      value={profile.contact_info?.state || ""}
                      onChange={(v) => updateField("contact_info", { ...profile.contact_info, state: v })}
                      suggestions={US_STATES}
                      placeholder="State"
                      testId="contact-state"
                    />
                  </div>
                  <div>
                    <Input
                      data-testid="contact-zip-input"
                      value={profile.contact_info?.zip || ""}
                      onChange={(e) => updateField("contact_info", { ...profile.contact_info, zip: e.target.value })}
                      placeholder="ZIP"
                      autoComplete="postal-code"
                      maxLength={10}
                    />
                  </div>
                </div>
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
                <SpecialtyAutocomplete
                  value={profile.specialty || ""}
                  allSpecialties={[...(specialties.nursing || []), ...(specialties.allied_health || [])]}
                  onChange={(value) => updateField("specialty", value)}
                  testId="specialty-autocomplete"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-category">Role Category</Label>
                <Select
                  value={profile.normalized_role_category || ""}
                  onValueChange={(v) => updateField("normalized_role_category", v)}
                >
                  <SelectTrigger data-testid="role-category-select">
                    <SelectValue placeholder="Select your role category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CANONICAL_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABELS[r] || r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Used to match you with eligible jobs</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
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
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  data-testid="full-name-input"
                  id="full_name"
                  value={profile.full_name || ""}
                  onChange={(e) => updateField("full_name", e.target.value)}
                  placeholder="Your full name"
                  autoComplete="name"
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
            <CardDescription>Add 3-5 concise highlights employers will see</CardDescription>
          </CardHeader>
          <CardContent>
            <SuggestionInput
              items={profile.experience_highlights || []}
              suggestions={getHighlightSuggestions(profile.specialty)}
              onAdd={(val) => addToArray("experience_highlights", val)}
              onRemove={(idx) => removeFromArray("experience_highlights", idx)}
              placeholder="Search highlights or type your own..."
              maxItems={5}
              testId="highlights"
              chipVariant="secondary"
            />
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
          <CardContent>
            <SuggestionInput
              items={profile.skills || []}
              suggestions={getSkillSuggestions(profile.specialty)}
              onAdd={(val) => addToArray("skills", val)}
              onRemove={(idx) => removeFromArray("skills", idx)}
              placeholder="Search skills or type your own..."
              maxItems={15}
              testId="skills"
            />
          </CardContent>
        </Card>
        <ContinueButton />
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
                  <div key={index} data-testid={`work-entry-${index}`} className={`p-4 border rounded-xl transition-colors ${editingWorkIndex === index ? "border-primary bg-primary/5" : "border-border bg-muted/30"}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-foreground">{job.position || job.role_title || job.display_title || "Untitled Position"}</h4>
                          {(job.is_current || job.currently_working) && (
                            <Badge className="bg-secondary/10 text-secondary text-xs">Current</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <Building className="w-3 h-3" /> {job.facility_name || job.primary_employer || "Unknown Facility"}
                          {(job.department || (job.specialties && (Array.isArray(job.specialties) ? job.specialties.join(", ") : job.specialties))) && <span> &bull; {job.department || (Array.isArray(job.specialties) ? job.specialties.join(", ") : job.specialties)}</span>}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {job.start_date || "N/A"} - {(job.is_current || job.currently_working) ? "Present" : job.end_date || "N/A"}
                        </p>
                        {job.responsibilities && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{job.responsibilities}</p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`edit-work-${index}`}
                          onClick={() => editingWorkIndex === index ? cancelEditWork() : startEditWork(index)}
                          className="h-8 px-2 text-muted-foreground hover:text-primary"
                        >
                          {editingWorkIndex === index ? <X className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`delete-work-${index}`}
                          onClick={() => { removeFromArray("work_history", index); if (editingWorkIndex === index) cancelEditWork(); }}
                          className="h-8 px-2 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add / Edit Work History */}
            <div className="p-4 border border-dashed border-border rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">
                  {editingWorkIndex !== null ? `Editing: ${(profile.work_history || [])[editingWorkIndex]?.position || "Entry"}` : "Add Work Experience"}
                </p>
                {editingWorkIndex !== null && (
                  <Button variant="ghost" size="sm" onClick={cancelEditWork} className="text-muted-foreground h-7 text-xs" data-testid="cancel-edit-work">
                    Cancel
                  </Button>
                )}
              </div>
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
                  <InlineAutocomplete
                    value={newWorkHistory.position}
                    onChange={(v) => setNewWorkHistory({ ...newWorkHistory, position: v })}
                    suggestions={POSITION_TITLES}
                    placeholder="ICU Registered Nurse"
                    testId="work-position"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Department/Unit</Label>
                  <InlineAutocomplete
                    value={newWorkHistory.department}
                    onChange={(v) => setNewWorkHistory({ ...newWorkHistory, department: v })}
                    suggestions={DEPARTMENTS}
                    placeholder="Intensive Care Unit"
                    testId="work-department"
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
                <Label>What did you do?</Label>
                <Textarea
                  data-testid="work-responsibilities-input"
                  value={newWorkHistory.responsibilities}
                  onChange={(e) => setNewWorkHistory({ ...newWorkHistory, responsibilities: e.target.value })}
                  placeholder="Describe your key responsibilities and achievements..."
                  rows={3}
                />
              </div>
              <Button
                data-testid={editingWorkIndex !== null ? "save-work-btn" : "add-work-btn"}
                type="button"
                variant={editingWorkIndex !== null ? "default" : "outline"}
                className="w-full"
                onClick={() => {
                  if (newWorkHistory.facility_name && newWorkHistory.position) {
                    saveWorkEntry();
                  } else {
                    toast.error("Please enter facility name and position");
                  }
                }}
              >
                {editingWorkIndex !== null ? (
                  <><Save className="w-4 h-4 mr-2" /> Save Changes</>
                ) : (
                  <><Plus className="w-4 h-4 mr-2" /> Add Work Experience</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
        <ContinueButton />
      </TabsContent>

      {/* Credentials Tab — Status + Vault routing */}
      <TabsContent value="credentials" className="space-y-6">
        {/* Certifications Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Certifications
            </CardTitle>
            <CardDescription>Your professional certifications (BLS, ACLS, etc.)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(profile.certifications || []).length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {(profile.certifications || []).map((cert, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1 py-1.5 px-3">
                    <Award className="w-3 h-3" />
                    {cert.name}
                    {cert.expiration && <span className="text-xs opacity-70 ml-1">exp: {cert.expiration}</span>}
                    <button type="button" onClick={() => removeFromArray("certifications", index)} className="ml-1 hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <InlineAutocomplete
                value={newCert.name}
                onChange={(v) => setNewCert({ ...newCert, name: v })}
                suggestions={CERTIFICATIONS}
                placeholder="Search certification (BLS, ACLS...)"
                testId="new-cert-name"
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
            <div data-testid="cert-vault-cta" className="p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Upload certification documents for employer verification</p>
              <Button size="sm" variant="outline" onClick={() => navigate("/seeker/vault?category=certification&from=profile")} data-testid="cert-go-to-vault">
                <Shield className="w-3.5 h-3.5 mr-1.5" /> Upload in Vault
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Licenses Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              Professional Licenses
            </CardTitle>
            <CardDescription>Your state nursing/professional licenses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(profile.licenses || []).length > 0 && (
              <div className="space-y-2 mb-2">
                {profile.licenses.map((lic, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{lic.name} - {lic.state}</p>
                      <p className="text-xs text-muted-foreground">
                        {lic.license_number && `#${lic.license_number} • `}
                        Exp: {lic.expiration || "N/A"}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeFromArray("licenses", index)} className="text-destructive hover:text-destructive">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="grid sm:grid-cols-4 gap-2">
              <InlineAutocomplete
                value={newLicense.name}
                onChange={(v) => setNewLicense({ ...newLicense, name: v })}
                suggestions={LICENSE_TYPES}
                placeholder="License type (RN, LPN...)"
                testId="new-license-name"
              />
              <InlineAutocomplete
                value={newLicense.state}
                onChange={(v) => setNewLicense({ ...newLicense, state: v })}
                suggestions={US_STATES}
                placeholder="State (CA, NY...)"
                testId="new-license-state"
              />
              <Input data-testid="new-license-number-input" placeholder="License #" value={newLicense.license_number} onChange={(e) => setNewLicense({ ...newLicense, license_number: e.target.value })} />
              <Input data-testid="new-license-exp-input" type="date" value={newLicense.expiration} onChange={(e) => setNewLicense({ ...newLicense, expiration: e.target.value })} />
            </div>
            <Button data-testid="add-license-btn" type="button" variant="outline" className="w-full" onClick={() => { if (newLicense.name && newLicense.state) { addToArray("licenses", newLicense); setNewLicense({ name: "", state: "", expiration: "", license_number: "" }); } }}>
              <Plus className="w-4 h-4 mr-2" /> Add License
            </Button>
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Upload license documents for employer verification</p>
              <Button size="sm" variant="outline" onClick={() => navigate("/seeker/vault?category=license&from=profile")} data-testid="license-go-to-vault">
                <Shield className="w-3.5 h-3.5 mr-1.5" /> Upload in Vault
              </Button>
            </div>
          </CardContent>
        </Card>
        <ContinueButton />
      </TabsContent>

      {/* Medical Records Tab — Status + Vault routing */}
      <TabsContent value="medical" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Medical Records & Immunizations
            </CardTitle>
            <CardDescription>Your health clearances and immunization status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
              <p className="text-sm text-foreground font-medium">All medical documents are managed in your Document Vault</p>
              <p className="text-xs text-muted-foreground">Upload vaccinations, TB tests, and medical clearances in one secure place. Employers will see your compliance status automatically.</p>
              <Button onClick={() => navigate("/seeker/vault?category=medical&from=profile")} data-testid="medical-go-to-vault" className="w-full sm:w-auto">
                <Shield className="w-4 h-4 mr-1.5" /> Go to Document Vault
              </Button>
            </div>

            {/* Quick status of required medical documents */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Required Documents</p>
              {[
                { label: "TB Test (PPD / Quantiferon / Chest X-Ray)", type: "TB Skin Test (PPD)", category: "medical" },
                { label: "Physical Exam", type: "Physical Exam", category: "medical" },
                { label: "COVID-19 Vaccine", type: "COVID-19 Vaccine", category: "medical" },
                { label: "Influenza (Flu)", type: "Influenza (Flu)", category: "medical" },
                { label: "Hepatitis B", type: "Hepatitis B", category: "medical" },
                { label: "MMR", type: "MMR", category: "medical" },
              ].map((item) => (
                <button
                  key={item.label}
                  data-testid={`medical-status-${item.type.replace(/[^a-zA-Z0-9]/g, "-")}`}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/seeker/vault?category=${item.category}&type=${encodeURIComponent(item.type)}&from=profile`)}
                >
                  <Circle className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                  <span className="text-sm text-muted-foreground flex-1">{item.label}</span>
                  <span className="text-[10px] text-primary">Upload</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
        <ContinueButton />
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
            <LocationAutocomplete
              locations={profile.preferred_locations || []}
              onAdd={(city) => addToArray("preferred_locations", city)}
              onRemove={(index) => removeFromArray("preferred_locations", index)}
              testId="preferred-locations"
            />
          </CardContent>
        </Card>

        {/* Work Environment Preferences — feature-gated */}
        {FEATURE_FLAGS.enable_worker_preferences && (
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
        )}

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
        <ContinueButton />
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

      {/* Facility Work Environment — feature-gated */}
      {FEATURE_FLAGS.enable_facility_profile_fields && (
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
      )}
    </div>
  );
};

export default ProfileBuilder;
