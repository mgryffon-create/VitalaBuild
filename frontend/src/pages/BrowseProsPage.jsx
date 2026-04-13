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
  Search, Heart, X, ChevronRight, ChevronUp, MapPin, Clock, ShieldCheck,
  FileText, Star, Briefcase, User, ArrowRight, BadgeCheck, CircleCheck, Eye
} from "lucide-react";

// Format name as "First L."
const formatName = (name) => {
  if (!name) return "Pro";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
};

// Shorten specialty label
const shortSpecialty = (s) => {
  if (!s) return null;
  return s.replace(/\(.*?\)\s*-?\s*/, "").replace("Registered Nurse", "RN").replace("Licensed Practical Nurse", "LPN").replace("Certified Nursing Assistant", "CNA").trim();
};

// Generate "Why this Pro?" based on job match
const whyThisPro = (pro, jobs) => {
  if (!jobs?.length) return null;
  const jobSpecialties = jobs.map(j => (j.title || "").toLowerCase());
  const proSpec = (pro.specialty || "").toLowerCase();
  for (const js of jobSpecialties) {
    if (proSpec && js.includes("icu") && proSpec.includes("icu")) return "Matches your ICU role";
    if (proSpec && js.includes("travel") && proSpec.includes("travel")) return "Travel experience matches";
    if (proSpec && js.includes("er") && (proSpec.includes("er") || proSpec.includes("emergency"))) return "ER experience matches";
  }
  if (pro.preferred_shift) {
    const shift = pro.preferred_shift.toLowerCase();
    if (shift.includes("night")) return "Available for night shift";
    if (shift.includes("day")) return "Available for day shift";
  }
  if (pro.preferred_locations?.length && jobs.some(j => (j.title || "").toLowerCase().includes(pro.preferred_locations[0]?.toLowerCase()?.split(",")[0])))
    return `Near your location`;
  if (pro.verified_references > 0) return "Has verified references";
  if (pro.years_experience >= 5) return `${pro.years_experience}+ years of experience`;
  if (pro.profile_complete) return "Complete profile";
  return null;
};

// Build highlight bullets from available data
const buildHighlights = (pro) => {
  const bullets = [];
  if (pro.skills?.length > 0) {
    const top = pro.skills.slice(0, 2).map(s => typeof s === "string" ? s : s?.skill || s?.name || "").filter(Boolean);
    if (top.length) bullets.push(top.join(" + ") + " experience");
  }
  const certs = (pro.certifications || []).slice(0, 4).map(c => typeof c === "string" ? c : c?.name || c?.title || "").filter(Boolean);
  if (certs.length) bullets.push(certs.join(", ") + " certified");
  if (pro.bio) {
    const short = pro.bio.split(/[.\n]/).find(s => s.trim().length > 10 && s.trim().length < 80);
    if (short && bullets.length < 3) bullets.push(short.trim());
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
                {/* Top: Identity row */}
                <div className="p-4 pb-3 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-base font-bold text-primary shrink-0">
                    {current.full_name?.charAt(0) || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-semibold text-foreground leading-tight">{formatName(current.full_name)}</h2>
                    <p className="text-sm text-muted-foreground leading-tight">
                      {shortSpecialty(current.specialty) || "Healthcare Pro"}
                      {current.years_experience ? ` \u2022 ${current.years_experience} yrs` : ""}
                    </p>
                  </div>
                </div>

                {/* Meta row: location, shift, availability */}
                <div className="px-4 pb-3 flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
                  {current.preferred_locations?.length > 0 && (
                    <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" /> {current.preferred_locations[0]}</span>
                  )}
                  {current.preferred_shift && (
                    <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {current.preferred_shift}</span>
                  )}
                  <Badge variant="outline" className="text-[9px] h-5 bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">Available</Badge>
                </div>

                {/* Badges row */}
                <div className="px-4 pb-3 flex items-center gap-2">
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

                {/* Highlight bullets */}
                {buildHighlights(current).length > 0 && (
                  <div className="px-4 pb-3">
                    <ul className="space-y-1">
                      {buildHighlights(current).map((b, i) => (
                        <li key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
                          <span className="text-primary mt-0.5 shrink-0">&bull;</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* "Why this Pro?" — server-ranked reasons */}
                {current.match_reasons?.length > 0 && (
                  <div className="mx-4 mb-3 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 space-y-0.5">
                    {current.match_reasons.map((r, i) => (
                      <p key={i} data-testid="why-this-pro" className="text-[10px] text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                        <Star className="w-3 h-3 shrink-0" /> {r}
                      </p>
                    ))}
                  </div>
                )}
                {!current.match_reasons?.length && whyThisPro(current, jobs) && (
                  <div className="mx-4 mb-3 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40">
                    <p data-testid="why-this-pro" className="text-[10px] text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                      <Star className="w-3 h-3 shrink-0" /> {whyThisPro(current, jobs)}
                    </p>
                  </div>
                )}

                {/* Match score bar */}
                {current.match_score > 0 && (
                  <div className="mx-4 mb-3 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${current.match_score >= 70 ? "bg-green-500" : current.match_score >= 40 ? "bg-amber-500" : "bg-muted-foreground/30"}`}
                        style={{ width: `${current.match_score}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground shrink-0">{current.match_score}% match</span>
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
