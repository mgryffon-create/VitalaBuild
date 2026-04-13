import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Search, Heart, X, ChevronRight, MapPin, Clock,
  Star, Briefcase, ArrowRight, BadgeCheck, CircleCheck, Eye
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

// Match quality label from score
const matchLabel = (score) => {
  if (score >= 70) return { text: "Strong Match", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
  if (score >= 45) return { text: "Good Match", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
  return { text: "Potential Match", className: "bg-muted text-muted-foreground" };
};

// Known clinical certifications worth showing
const CLINICAL_CERTS = new Set(["bls", "acls", "pals", "nrp", "tncc", "ccrn", "cen", "cnl", "np", "rn", "lpn", "cna"]);

// Build 2-3 specific highlights — no generic filler
const getHighlights = (pro) => {
  const bullets = [];

  // 1. Specialty-derived experience highlight
  if (pro.specialty) {
    const sub = pro.specialty.replace(/.*\)\s*-?\s*/, "").replace(/Registered Nurse|Licensed Practical Nurse|Certified Nursing Assistant/gi, "").trim();
    if (sub && sub.length > 2) bullets.push(`${sub} experience`);
  }

  // 2. Individual clinical certifications as separate items
  const certs = (pro.certifications || [])
    .map(c => typeof c === "string" ? c : c?.name || c?.title || "")
    .filter(c => c && CLINICAL_CERTS.has(c.toLowerCase()) && !["rn", "lpn", "cna"].includes(c.toLowerCase()));
  for (const cert of certs.slice(0, 2)) {
    if (bullets.length < 3) bullets.push(`${cert.toUpperCase()} certified`);
  }

  // 3. Bio snippet — only meaningful, specific content
  if (pro.bio && bullets.length < 3) {
    const sentences = pro.bio.split(/[.\n]/).map(s => s.trim()).filter(s => s.length > 10 && s.length < 80);
    const useful = sentences.find(s => {
      const low = s.toLowerCase();
      return !low.match(/^(rn|lpn|cna|nurse|healthcare)\s+(with|having)\s+\d/) &&
        !low.startsWith("seeking") && !low.startsWith("looking for") &&
        !low.match(/^\d+\s*years?\s*(of\s+)?experience/);
    });
    if (useful) bullets.push(useful);
  }

  // 4. Skills as fallback
  if (bullets.length < 2 && pro.skills?.length > 0) {
    const realSkills = pro.skills.slice(0, 2)
      .map(s => typeof s === "string" ? s : s?.skill || s?.name || "")
      .filter(s => s.length > 1 && s.length < 40);
    if (realSkills.length) bullets.push(realSkills.join(", "));
  }

  return bullets.slice(0, 3);
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

  const fetchPros = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/employer/browse-pros`);
      setPros(res.data.pros || []);
      setJobs(res.data.jobs || []);
    } catch {
      toast.error("Failed to load pros");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPros(); }, [fetchPros]);

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
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Top Pros for Your Jobs</h1>
          <p className="text-xs text-muted-foreground">{remaining > 0 ? `${remaining} pros ranked by role, location & availability` : "No more pros to browse"}</p>
        </div>

        {!current ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Search className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <h2 className="text-base font-semibold text-foreground mb-1">All caught up</h2>
              <p className="text-sm text-muted-foreground mb-4">No more pros to browse right now. Check back later or review your applicants.</p>
              <Button onClick={() => navigate("/poster/pipeline")} data-testid="go-to-applicants">
                View Applicants <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
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
                  {/* Match quality label */}
                  {current.match_score > 0 && (
                    <span data-testid="match-label" className={`text-[9px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${matchLabel(current.match_score).className}`}>
                      {matchLabel(current.match_score).text}
                    </span>
                  )}
                </div>

                {/* Availability — prominent */}
                <div className="px-4 pb-2 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Available Now
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

                {/* Context: job-specific fit line */}
                {current.best_job_context && (
                  <div className="mx-4 mb-3 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40">
                    <p data-testid="why-this-pro" className="text-[10px] text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                      <Star className="w-3 h-3 shrink-0" /> {current.best_job_context}
                    </p>
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
                  onClick={() => navigate(`/poster/candidates/list`)}
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
      </div>
    </DashboardLayout>
  );
};

export default BrowseProsPage;
