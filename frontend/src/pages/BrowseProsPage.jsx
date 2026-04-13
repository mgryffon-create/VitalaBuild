import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Search, Heart, X, ChevronRight, MapPin, Clock,
  Star, Briefcase, ArrowRight, BadgeCheck, CircleCheck, Eye,
  SlidersHorizontal, RotateCcw, Shield, FileText, Award, ArrowLeft
} from "lucide-react";

// Format name as "First L."
const formatName = (name) => {
  if (!name) return "Pro";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
};

// Format role line: "RN • Wound Care • 3 yrs"
const formatRole = (specialty, years) => {
  const parts = [];
  if (specialty) {
    // Extract abbreviation and sub-specialty
    const abbr = specialty.match(/\(([A-Z]+)\)/)?.[1];
    const sub = specialty.replace(/.*\)\s*-?\s*/, "").trim();
    if (abbr && sub) {
      parts.push(abbr);
      parts.push(sub);
    } else {
      parts.push(
        specialty
          .replace("Registered Nurse", "RN")
          .replace("Licensed Practical Nurse", "LPN")
          .replace("Certified Nursing Assistant", "CNA")
          .replace(/\(.*?\)\s*-?\s*/, "")
          .trim()
      );
    }
  }
  if (years) parts.push(`${years} yrs`);
  return parts.join(" \u2022 ") || "Healthcare Pro";
};

// Match tier badge config
const TIER_BADGE = {
  strong:   { text: "Strong Match",   className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  possible: { text: "Possible Match", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  none:     { text: "Explore",        className: "bg-muted text-muted-foreground" },
};

// Known clinical certifications worth showing
const CLINICAL_CERTS = new Set(["bls", "acls", "pals", "nrp", "tncc", "ccrn", "cen", "cnl", "np", "rn", "lpn", "cna"]);

// Build 2-3 specific highlights — prefer structured, fallback to derived
const getHighlights = (pro) => {
  // Prefer structured experience_highlights if available
  if (pro.experience_highlights?.length > 0) {
    return pro.experience_highlights.slice(0, 3);
  }

  const bullets = [];

  // 1. Specialty-derived experience highlight
  if (pro.specialty) {
    const sub = pro.specialty.replace(/.*\)\s*-?\s*/, "").replace(/Registered Nurse|Licensed Practical Nurse|Certified Nursing Assistant/gi, "").trim();
    if (sub && sub.length > 2) bullets.push(`${sub} experience`);
  }

  // 2. Individual clinical certifications
  const certs = (pro.certifications || [])
    .map(c => typeof c === "string" ? c : c?.name || c?.title || "")
    .filter(c => c && CLINICAL_CERTS.has(c.toLowerCase()) && !["rn", "lpn", "cna"].includes(c.toLowerCase()));
  for (const cert of certs.slice(0, 2)) {
    if (bullets.length < 3) bullets.push(`${cert.toUpperCase()} certified`);
  }

  // 3. Skills as fallback
  if (bullets.length < 2 && pro.skills?.length > 0) {
    const realSkills = pro.skills.slice(0, 2)
      .map(s => typeof s === "string" ? s : s?.skill || s?.name || "")
      .filter(s => s.length > 1 && s.length < 40);
    if (realSkills.length) bullets.push(realSkills.join(", "));
  }

  return bullets.slice(0, 3);
};

const CLINICAL_CERTS_SET = new Set(["bls", "acls", "pals", "nrp", "tncc", "ccrn", "cen", "cnl"]);

const ProProfileView = ({ pro, jobs, onClose, onInterested, onPass, acting }) => {
  if (!pro) return null;
  const tier = TIER_BADGE[pro.match_tier] || TIER_BADGE.none;
  const certs = (pro.certifications || []).map(c => typeof c === "string" ? { name: c } : c).filter(c => c?.name);
  const profileLicenses = (pro.licenses || []).filter(l => l?.name);
  const clinicalCerts = certs.filter(c => CLINICAL_CERTS_SET.has(c.name?.toLowerCase()));
  const otherCerts = certs.filter(c => !CLINICAL_CERTS_SET.has(c.name?.toLowerCase()) && !profileLicenses.some(l => l.name === c.name));

  return (
    <div data-testid="pro-profile-view" className="fixed inset-0 z-[100] bg-background flex flex-col">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-card shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} data-testid="profile-back-btn">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <p className="text-sm font-semibold text-foreground flex-1">Pro Profile</p>
        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${tier.className}`}>{tier.text}</span>
      </div>

      {/* Scrollable content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5 pb-28">
          {/* Identity */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0">
              {pro.full_name?.charAt(0) || "?"}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{formatName(pro.full_name)}</h2>
              <p className="text-sm text-muted-foreground">{formatRole(pro.specialty, pro.years_experience)}</p>
              <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                !pro.availability || pro.availability === "Available Now"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800"
                  : pro.availability === "Not Available"
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800"
              }`}>
                {(!pro.availability || pro.availability === "Available Now") && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
                {pro.availability || "Available Now"}
              </span>
            </div>
          </div>

          {/* Professional Summary */}
          {pro.bio && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Professional Summary</h3>
              <p className="text-sm text-foreground/80 leading-relaxed">{pro.bio}</p>
            </section>
          )}

          {/* Experience Highlights — prefer structured data */}
          {(() => {
            const highlights = pro.experience_highlights?.length > 0
              ? [...pro.experience_highlights]
              : getHighlights(pro);
            return highlights.length > 0 ? (
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Experience Highlights</h3>
                <ul className="space-y-1">
                  {highlights.slice(0, 5).map((b, i) => (
                    <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                      <span className="text-primary mt-0.5 shrink-0">&bull;</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null;
          })()}

          {/* Licenses & Certifications */}
          {(profileLicenses.length > 0 || certs.length > 0) && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Licenses & Certifications</h3>
              <div className="space-y-2">
                {profileLicenses.length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Licenses</p>
                    <div className="flex flex-wrap gap-1.5">
                      {profileLicenses.map((l, i) => (
                        <span key={i} className="text-[11px] px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-medium">
                          {l.name}{l.state ? ` (${l.state})` : ""}
                          {l.expiration && <span className="text-[9px] text-muted-foreground ml-1">exp {l.expiration}</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {clinicalCerts.length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Clinical Certifications</p>
                    <div className="flex flex-wrap gap-1.5">
                      {clinicalCerts.map((c, i) => (
                        <span key={i} className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 font-medium">
                          {c.name?.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Verification & Compliance */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Verification & Compliance</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${pro.verified_references > 0 ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" : "bg-muted/50 border-transparent"}`}>
                <BadgeCheck className={`w-4 h-4 ${pro.verified_references > 0 ? "text-green-600" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-[11px] font-medium text-foreground">{pro.verified_references > 0 ? "Verified Pro" : "Not Yet Verified"}</p>
                  <p className="text-[9px] text-muted-foreground">{pro.verified_references} verified ref{pro.verified_references !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${pro.vault_documents >= 3 ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800" : "bg-muted/50 border-transparent"}`}>
                <CircleCheck className={`w-4 h-4 ${pro.vault_documents >= 3 ? "text-blue-600" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-[11px] font-medium text-foreground">{pro.vault_documents >= 3 ? "Compliance Ready" : "Docs In Progress"}</p>
                  <p className="text-[9px] text-muted-foreground">{pro.vault_documents} document{pro.vault_documents !== 1 ? "s" : ""} uploaded</p>
                </div>
              </div>
            </div>
          </section>

          {/* Work Preferences */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Work Preferences</h3>
            <div className="grid grid-cols-2 gap-2">
              {pro.preferred_locations?.length > 0 && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div><p className="text-[10px] text-muted-foreground">Location</p><p className="text-[11px] font-medium text-foreground">{pro.preferred_locations.join(", ")}</p></div>
                </div>
              )}
              {pro.preferred_shift && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div><p className="text-[10px] text-muted-foreground">Shift</p><p className="text-[11px] font-medium text-foreground">{pro.preferred_shift}</p></div>
                </div>
              )}
              {pro.years_experience && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
                  <Award className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div><p className="text-[10px] text-muted-foreground">Experience</p><p className="text-[11px] font-medium text-foreground">{pro.years_experience} years</p></div>
                </div>
              )}
              {pro.travel_readiness && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div><p className="text-[10px] text-muted-foreground">Travel</p><p className="text-[11px] font-medium text-foreground">{pro.travel_readiness}</p></div>
                </div>
              )}
              {pro.job_type_preference && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
                  <Briefcase className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div><p className="text-[10px] text-muted-foreground">Job Type</p><p className="text-[11px] font-medium text-foreground">{pro.job_type_preference}</p></div>
                </div>
              )}
              {pro.skills?.length > 0 && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 col-span-2">
                  <Briefcase className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div><p className="text-[10px] text-muted-foreground">Skills</p><p className="text-[11px] font-medium text-foreground">{pro.skills.slice(0, 5).map(s => typeof s === "string" ? s : s?.name || "").join(", ")}</p></div>
                </div>
              )}
            </div>
            {!pro.preferred_locations?.length && !pro.preferred_shift && !pro.travel_readiness && !pro.job_type_preference && (
              <p className="text-[11px] text-muted-foreground mt-1">No preferences specified yet</p>
            )}
          </section>

          {/* Context line */}
          {pro.context_reasons?.length > 0 && (
            <div className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40">
              {pro.context_reasons.map((r, i) => (
                <p key={i} className="text-[11px] text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                  <Star className="w-3 h-3 shrink-0" /> {r}
                </p>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Sticky actions */}
      <div className="border-t bg-card p-3 pb-24 sm:pb-3 flex items-center gap-3 shrink-0">
        <Button data-testid="profile-pass-btn" variant="outline" className="flex-1 h-11 border-destructive/50 text-destructive hover:bg-destructive hover:text-white" onClick={() => { onPass(pro.id); onClose(); }} disabled={acting}>
          <X className="w-4 h-4 mr-1.5" /> Pass
        </Button>
        <Button data-testid="profile-interested-btn" className="flex-[2] h-11 bg-green-500 hover:bg-green-600 text-white" onClick={() => { onInterested(pro.id); onClose(); }} disabled={acting}>
          <Heart className="w-4 h-4 mr-1.5" /> Interested
        </Button>
      </div>
    </div>
  );
};

const BrowseProsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pros, setPros] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [pendingSeekerId, setPendingSeekerId] = useState(null);
  const [acting, setActing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ specialty: "", location: "", minExp: "", maxExp: "", shift: "", certification: "" });
  const [activeFilterCount, setActiveFilterCount] = useState(0);
  const [profilePro, setProfilePro] = useState(null);

  const fetchPros = useCallback(async (includeAll = false, filterParams = null) => {
    try {
      const params = new URLSearchParams();
      if (includeAll) params.set("include_all", "true");
      const f = filterParams || filters;
      if (f.specialty) params.set("specialty", f.specialty);
      if (f.location) params.set("location", f.location);
      if (f.minExp) params.set("min_experience", f.minExp);
      if (f.maxExp) params.set("max_experience", f.maxExp);
      if (f.shift) params.set("shift", f.shift);
      if (f.certification) params.set("certification", f.certification);
      const qs = params.toString();
      const res = await axios.get(`${API}/employer/browse-pros${qs ? `?${qs}` : ""}`);
      setPros(res.data.pros || []);
      setJobs(res.data.jobs || []);
      setCurrentIndex(0);
    } catch {
      toast.error("Failed to load pros");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchPros(); }, [fetchPros]);

  const applyFilters = () => {
    const count = [filters.specialty, filters.location, filters.minExp, filters.maxExp, filters.shift, filters.certification].filter(Boolean).length;
    setActiveFilterCount(count);
    setLoading(true);
    fetchPros(expanded, filters);
    setFilterOpen(false);
  };

  const clearFilters = () => {
    const empty = { specialty: "", location: "", minExp: "", maxExp: "", shift: "", certification: "" };
    setFilters(empty);
    setActiveFilterCount(0);
    setLoading(true);
    fetchPros(expanded, empty);
    setFilterOpen(false);
  };

  const handleInterested = (seekerId) => {
    if (jobs.length === 0) {
      toast.error("Post a job first to express interest in pros");
      return;
    }
    if (jobs.length === 1) {
      submitInterest(seekerId, jobs[0].id);
    } else {
      setPendingSeekerId(seekerId);
      setShowJobPicker(true);
    }
  };

  const submitInterest = async (seekerId, jobId) => {
    setActing(true);
    try {
      await axios.post(`${API}/employer/express-interest`, { seeker_id: seekerId, job_id: jobId });
      toast.success("Added to Applicants", {
        description: `${pros[currentIndex]?.full_name || "Pro"} is now in your hiring flow`,
      });
      setCurrentIndex((i) => i + 1);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail === "This pro is already an applicant for this job") {
        toast.info("Already an applicant for this job");
        setCurrentIndex((i) => i + 1);
      } else {
        toast.error(detail || "Failed to express interest");
      }
    } finally {
      setActing(false);
      setShowJobPicker(false);
      setPendingSeekerId(null);
    }
  };

  const handlePass = async (seekerId) => {
    setActing(true);
    try {
      await axios.post(`${API}/employer/browse-pass`, { seeker_id: seekerId });
      setCurrentIndex((i) => i + 1);
    } catch {
      // Still advance even on error
      setCurrentIndex((i) => i + 1);
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div></DashboardLayout>;
  }

  const current = pros[currentIndex];
  const remaining = pros.length - currentIndex;

  return (
    <DashboardLayout>
      <div data-testid="browse-pros-page" className="max-w-lg mx-auto space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Top Pros for Your Jobs</h1>
            <p className="text-xs text-muted-foreground">{remaining > 0 ? `${remaining} pros ranked by role, location & availability` : "No more pros to browse"}</p>
          </div>
          <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0 h-8 gap-1.5" data-testid="filter-btn">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge className="h-4 w-4 p-0 flex items-center justify-center text-[8px] bg-primary text-primary-foreground rounded-full">{activeFilterCount}</Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh]">
              <SheetHeader>
                <SheetTitle className="text-base">Filter Pros</SheetTitle>
              </SheetHeader>
              <ScrollArea className="py-4 space-y-4 max-h-[60vh]">
                <div className="space-y-4 pr-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Specialty</Label>
                    <Input data-testid="filter-specialty" placeholder="e.g. ICU, Wound Care" value={filters.specialty} onChange={(e) => setFilters(f => ({ ...f, specialty: e.target.value }))} className="h-9 text-sm mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Location</Label>
                    <Input data-testid="filter-location" placeholder="e.g. Houston, TX" value={filters.location} onChange={(e) => setFilters(f => ({ ...f, location: e.target.value }))} className="h-9 text-sm mt-1" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Min Experience (yrs)</Label>
                      <Input data-testid="filter-min-exp" type="number" min="0" placeholder="0" value={filters.minExp} onChange={(e) => setFilters(f => ({ ...f, minExp: e.target.value }))} className="h-9 text-sm mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Max Experience (yrs)</Label>
                      <Input data-testid="filter-max-exp" type="number" min="0" placeholder="30" value={filters.maxExp} onChange={(e) => setFilters(f => ({ ...f, maxExp: e.target.value }))} className="h-9 text-sm mt-1" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Shift Preference</Label>
                    <Input data-testid="filter-shift" placeholder="e.g. Night, Day" value={filters.shift} onChange={(e) => setFilters(f => ({ ...f, shift: e.target.value }))} className="h-9 text-sm mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Certification</Label>
                    <Input data-testid="filter-cert" placeholder="e.g. BLS, ACLS" value={filters.certification} onChange={(e) => setFilters(f => ({ ...f, certification: e.target.value }))} className="h-9 text-sm mt-1" />
                  </div>
                </div>
              </ScrollArea>
              <div className="flex gap-2 pt-2 border-t">
                <Button variant="ghost" size="sm" className="flex-1" onClick={clearFilters} data-testid="clear-filters-btn">
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> Clear
                </Button>
                <Button size="sm" className="flex-1" onClick={applyFilters} data-testid="apply-filters-btn">
                  Apply Filters
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {!current ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Search className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <h2 className="text-base font-semibold text-foreground mb-1">{expanded ? "All caught up" : "No more top matches"}</h2>
              <p className="text-sm text-muted-foreground mb-4">
                {expanded
                  ? "No more pros to browse right now. Check back later or review your applicants."
                  : "You've seen all Strong and Possible matches. Expand to browse more pros."}
              </p>
              <div className="flex flex-col gap-2 items-center">
                {!expanded && (
                  <Button onClick={() => { setExpanded(true); setLoading(true); fetchPros(true); }} data-testid="expand-search-btn">
                    <Search className="w-4 h-4 mr-1" /> Expand search to more Pros
                  </Button>
                )}
                <Button variant="outline" onClick={() => navigate("/poster/pipeline")} data-testid="go-to-applicants">
                  View Applicants <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Pro Card */}
            <Card data-testid={`pro-card-${current.id}`} className="overflow-hidden">
              <CardContent className="p-0">
                {/* Header: avatar + name + role */}
                <div className="p-4 pb-2 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                    {current.full_name?.charAt(0) || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-semibold text-foreground leading-tight">{formatName(current.full_name)}</h2>
                    <p className="text-[13px] text-muted-foreground leading-tight">{formatRole(current.specialty, current.years_experience)}</p>
                  </div>
                  {/* Tier badge */}
                  {current.match_tier && TIER_BADGE[current.match_tier] && (
                    <span data-testid="match-label" className={`text-[9px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${TIER_BADGE[current.match_tier].className}`}>
                      {TIER_BADGE[current.match_tier].text}
                    </span>
                  )}
                </div>

                {/* Availability — prominent, from structured data */}
                <div className="px-4 pb-2 flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                    !current.availability || current.availability === "Available Now"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800"
                      : current.availability === "Not Available"
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                  }`}>
                    {(!current.availability || current.availability === "Available Now") && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
                    {current.availability || "Available Now"}
                  </span>
                  {current.preferred_locations?.length > 0 && (
                    <span className="text-[11px] text-muted-foreground flex items-center gap-0.5"><MapPin className="w-3 h-3" /> {current.preferred_locations[0]}</span>
                  )}
                  {current.preferred_shift && (
                    <span className="text-[11px] text-muted-foreground flex items-center gap-0.5"><Clock className="w-3 h-3" /> {current.preferred_shift}</span>
                  )}
                </div>

                {/* Trust badges — only show positive signals */}
                {(current.verified_references > 0 || current.vault_documents >= 3) && (
                  <div className="px-4 pb-2 flex items-center gap-2">
                    {current.verified_references > 0 && (
                      <span data-testid="badge-verified" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <BadgeCheck className="w-3 h-3" /> Verified Pro
                      </span>
                    )}
                    {current.vault_documents >= 3 && (
                      <span data-testid="badge-compliance" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        <CircleCheck className="w-3 h-3" /> Compliance Ready
                      </span>
                    )}
                  </div>
                )}

                {/* Highlights — 2-3 short bullets */}
                {getHighlights(current).length > 0 && (
                  <div className="px-4 pb-2">
                    <ul className="space-y-0.5">
                      {getHighlights(current).map((b, i) => (
                        <li key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
                          <span className="text-primary mt-0.5 shrink-0">&bull;</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Context: specific reason WHY this pro is relevant */}
                {current.context_reasons?.length > 0 && (
                  <div className="mx-4 mb-3 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 space-y-0.5">
                    {current.context_reasons.slice(0, 2).map((r, i) => (
                      <p key={i} data-testid="why-this-pro" className="text-[10px] text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                        <Star className="w-3 h-3 shrink-0" /> {r}
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions — fixed on mobile */}
            <div data-testid="browse-actions" className="fixed bottom-20 left-0 right-0 z-50 sm:static sm:bottom-auto sm:z-auto">
              <div className="flex justify-center items-center gap-4 px-6 py-3 sm:py-0 bg-background/90 backdrop-blur-md sm:bg-transparent sm:backdrop-blur-none">
                <Button
                  data-testid="browse-pass-btn"
                  size="lg"
                  variant="outline"
                  className="w-14 h-14 rounded-full border-2 border-destructive/50 text-destructive hover:bg-destructive hover:text-white active:scale-90 transition-all"
                  onClick={() => handlePass(current.id)}
                  disabled={acting}
                >
                  <X className="w-6 h-6" />
                </Button>
                <Button
                  data-testid="browse-profile-btn"
                  size="lg"
                  variant="outline"
                  className="w-10 h-10 rounded-full border-2 border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary active:scale-90 transition-all"
                  onClick={() => setProfilePro(current)}
                  disabled={acting}
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button
                  data-testid="browse-interested-btn"
                  size="lg"
                  className="w-[4.5rem] h-[4.5rem] rounded-full bg-green-500 hover:bg-green-600 text-white active:scale-90 transition-all shadow-xl shadow-green-500/30"
                  onClick={() => handleInterested(current.id)}
                  disabled={acting}
                >
                  <Heart className="w-7 h-7" />
                </Button>
              </div>
              <div className="flex justify-center items-center gap-4 px-6">
                <span className="text-[10px] text-muted-foreground w-14 text-center">Pass</span>
                <span className="text-[10px] text-muted-foreground w-10 text-center">Profile</span>
                <span className="text-[10px] text-muted-foreground w-[4.5rem] text-center font-semibold text-green-600">Interested</span>
              </div>
            </div>
          </>
        )}

        {/* Job Picker Dialog (multiple jobs) */}
        <Dialog open={showJobPicker} onOpenChange={setShowJobPicker}>
          <DialogContent className="sm:max-w-md" data-testid="job-picker-dialog">
            <DialogHeader>
              <DialogTitle className="text-base">Which job is this for?</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              {jobs.map((j) => (
                <button
                  key={j.id}
                  data-testid={`pick-job-${j.id}`}
                  onClick={() => submitInterest(pendingSeekerId, j.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/50 transition-colors text-left"
                  disabled={acting}
                >
                  <Briefcase className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm font-medium text-foreground flex-1 truncate">{j.title}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setShowJobPicker(false); setPendingSeekerId(null); }}>Cancel</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Full Profile View */}
        {profilePro && (
          <ProProfileView
            pro={profilePro}
            jobs={jobs}
            onClose={() => setProfilePro(null)}
            onInterested={handleInterested}
            onPass={handlePass}
            acting={acting}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default BrowseProsPage;
