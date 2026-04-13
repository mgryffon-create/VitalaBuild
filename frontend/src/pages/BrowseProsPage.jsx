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
  Search, Heart, X, ChevronRight, MapPin, Clock, ShieldCheck,
  FileText, Star, Briefcase, User, ArrowRight
} from "lucide-react";

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
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Browse Pros</h1>
          <p className="text-xs text-muted-foreground">{remaining > 0 ? `${remaining} pros available` : "No more pros to browse"}</p>
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
                {/* Header */}
                <div className="bg-primary/5 p-4 flex items-start gap-3">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0">
                    {current.full_name?.charAt(0) || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-semibold text-foreground">{current.full_name}</h2>
                    <p className="text-sm text-muted-foreground">{current.specialty || "Healthcare Professional"}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {current.years_experience && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="w-3 h-3" /> {current.years_experience} yrs
                        </span>
                      )}
                      {current.preferred_locations?.length > 0 && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <MapPin className="w-3 h-3" /> {current.preferred_locations[0]}
                        </span>
                      )}
                      {current.verified_references > 0 && (
                        <span className="text-[10px] text-green-600 flex items-center gap-0.5">
                          <ShieldCheck className="w-3 h-3" /> {current.verified_references} verified ref{current.verified_references > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="p-4 space-y-3">
                  {current.bio && (
                    <p className="text-sm text-foreground/80 leading-relaxed">{current.bio.slice(0, 200)}{current.bio.length > 200 ? "..." : ""}</p>
                  )}

                  {current.skills?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Skills</p>
                      <div className="flex flex-wrap gap-1">
                        {current.skills.slice(0, 8).map((s, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {current.certifications?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Certifications</p>
                      <div className="flex flex-wrap gap-1">
                        {current.certifications.slice(0, 5).map((c, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                            {typeof c === "string" ? c : c.name || c.title || "Cert"}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick stats */}
                  <div className="flex gap-3">
                    {current.vault_documents > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <FileText className="w-3 h-3" /> {current.vault_documents} docs
                      </div>
                    )}
                    {current.preferred_shift && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="w-3 h-3" /> {current.preferred_shift}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions — fixed on mobile */}
            <div data-testid="browse-actions" className="fixed bottom-20 left-0 right-0 z-50 sm:static sm:bottom-auto sm:z-auto">
              <div className="flex justify-center items-center gap-5 px-6 py-3 sm:py-0 bg-background/90 backdrop-blur-md sm:bg-transparent sm:backdrop-blur-none">
                <Button
                  data-testid="browse-pass-btn"
                  size="lg"
                  variant="outline"
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-destructive/50 text-destructive hover:bg-destructive hover:text-white active:scale-90 transition-all"
                  onClick={() => handlePass(current.id)}
                  disabled={acting}
                >
                  <X className="w-6 h-6 sm:w-7 sm:h-7" />
                </Button>
                <Button
                  data-testid="browse-interested-btn"
                  size="lg"
                  className="w-[4.5rem] h-[4.5rem] sm:w-16 sm:h-16 rounded-full bg-green-500 hover:bg-green-600 text-white active:scale-90 transition-all shadow-xl shadow-green-500/30"
                  onClick={() => handleInterested(current.id)}
                  disabled={acting}
                >
                  <Heart className="w-7 h-7 sm:w-7 sm:h-7" />
                </Button>
              </div>
              <div className="flex justify-center items-center gap-5 px-6">
                <span className="text-[10px] text-muted-foreground w-14 sm:w-16 text-center">Pass</span>
                <span className="text-[10px] text-muted-foreground w-[4.5rem] sm:w-16 text-center font-semibold text-green-600">Interested</span>
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
