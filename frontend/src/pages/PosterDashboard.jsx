import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Briefcase, Plus, MapPin, DollarSign, Clock, Eye, Edit, Trash2,
  ArrowRight, Mail, CheckCircle, AlertTriangle, Shield, Users, Send, MessageCircle,
  ClipboardCheck, Flag
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PosterDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [candidateCounts, setCandidateCounts] = useState({ total: 0, applicants: 0, matched: 0 });
  const [offerCount, setOfferCount] = useState(0);
  const [onboardingCount, setOnboardingCount] = useState(0);
  const [onboardingCases, setOnboardingCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteJobId, setDeleteJobId] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [businessEmail, setBusinessEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verifyStep, setVerifyStep] = useState("email");
  const [sendingVerification, setSendingVerification] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, jobsRes, candidatesRes, offersRes, verifyRes, onbRes] = await Promise.all([
        axios.get(`${API}/stats`),
        axios.get(`${API}/jobs`),
        axios.get(`${API}/employer/candidates`).catch(() => ({ data: [] })),
        axios.get(`${API}/hiring/offers`).catch(() => ({ data: [] })),
        axios.get(`${API}/employer/verification-status`).catch(() => ({ data: null })),
        axios.get(`${API}/onboarding/cases`).catch(() => ({ data: [] })),
      ]);
      setStats(statsRes.data);
      setJobs(jobsRes.data);

      // Compute exclusive stage counts — each pro exists in exactly ONE stage
      const allCandidates = Array.isArray(candidatesRes.data) ? candidatesRes.data : [];
      const allOffers = Array.isArray(offersRes.data) ? offersRes.data : [];
      const allCases = Array.isArray(onbRes.data) ? onbRes.data : [];

      // Onboarding: active cases (not cleared/completed/rejected)
      const activeOnboarding = allCases.filter(c =>
        c.status !== "cleared" && c.status !== "completed" && c.status !== "rejected"
      );
      const onboardingSeekerIds = new Set(activeOnboarding.map(c => c.candidate_id));

      // Offers: only pending offers, excluding pros already in onboarding
      const activeOfferSeekerIds = new Set(
        allOffers
          .filter(o => o.status === "pending" && !onboardingSeekerIds.has(o.seeker_id))
          .map(o => o.seeker_id)
      );

      // From candidates: applicants = pending (not in any later stage)
      // matched = matched status AND not in offers/onboarding
      const applicants = allCandidates.filter(c =>
        c.status === "pending" &&
        !activeOfferSeekerIds.has(c.seeker_id) &&
        !onboardingSeekerIds.has(c.seeker_id)
      );
      const matched = allCandidates.filter(c =>
        c.status === "matched" &&
        !activeOfferSeekerIds.has(c.seeker_id) &&
        !onboardingSeekerIds.has(c.seeker_id)
      );

      setCandidateCounts({
        total: allCandidates.length,
        applicants: applicants.length,
        matched: matched.length,
      });
      setOfferCount(activeOfferSeekerIds.size);
      setVerificationStatus(verifyRes.data);
      setOnboardingCases(allCases);
      setOnboardingCount(activeOnboarding.length);
    } catch (error) {
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSendVerification = async () => {
    if (!businessEmail || !businessEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    setSendingVerification(true);
    try {
      await axios.post(`${API}/employer/verify-email/send`, { business_email: businessEmail });
      toast.success("Verification email sent!");
      setVerifyStep("code");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send verification email");
    } finally {
      setSendingVerification(false);
    }
  };

  const handleConfirmVerification = async () => {
    if (!verificationCode) { toast.error("Please enter the verification code"); return; }
    setSendingVerification(true);
    try {
      await axios.post(`${API}/employer/verify-email/confirm`, { token: verificationCode });
      toast.success("Business email verified!");
      setShowVerifyDialog(false);
      setVerifyStep("email");
      setBusinessEmail("");
      setVerificationCode("");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Invalid verification code");
    } finally {
      setSendingVerification(false);
    }
  };

  const handleDeleteJob = async () => {
    if (!deleteJobId) return;
    try {
      await axios.delete(`${API}/jobs/${deleteJobId}`);
      setJobs(jobs.filter(j => j.id !== deleteJobId));
      toast.success("Job deleted");
    } catch (error) {
      toast.error("Failed to delete job");
    } finally {
      setDeleteJobId(null);
    }
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

  const canPost = verificationStatus?.business_email_verified || verificationStatus?.dev_bypass_active;

  return (
    <DashboardLayout>
      <div data-testid="poster-dashboard" className="space-y-6 sm:space-y-8 max-w-5xl">

        {/* Verification Alerts */}
        {verificationStatus && !verificationStatus.business_email_verified && !verificationStatus.dev_bypass_active && (
          <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-900/20">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <AlertTitle className="text-amber-700 dark:text-amber-400 font-semibold">
              Business Email Verification Required
            </AlertTitle>
            <AlertDescription className="text-amber-600 dark:text-amber-300">
              <p className="mb-3">Verify your business email to post jobs and access all employer features.</p>
              <Button onClick={() => setShowVerifyDialog(true)} className="bg-amber-500 hover:bg-amber-600 text-white">
                <Mail className="w-4 h-4 mr-2" /> Verify Business Email
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {verificationStatus?.business_email_verified && (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <AlertTitle className="text-green-700 dark:text-green-400 font-semibold flex items-center gap-2">
              Verified Employer
              <Badge className="bg-green-500 text-white text-xs"><Shield className="w-3 h-3 mr-1" /> Verified</Badge>
            </AlertTitle>
            <AlertDescription className="text-green-600 dark:text-green-300">
              Your business email <strong>{verificationStatus.business_email}</strong> has been verified.
            </AlertDescription>
          </Alert>
        )}

        {/* Header + Primary CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
              Welcome back, {user?.full_name?.split(" ")[0] || "there"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage your job postings and find the best pros.</p>
          </div>
        </div>
        <Button
          data-testid="post-job-btn"
          onClick={() => navigate("/poster/jobs/new")}
          size="lg"
          className={`w-full h-12 text-base font-semibold shadow-md ${canPost ? "bg-primary hover:bg-primary/90 shadow-primary/20" : "bg-muted text-muted-foreground cursor-not-allowed"}`}
          disabled={!canPost}
        >
          {canPost ? <Plus className="mr-2 w-5 h-5" /> : <Shield className="mr-2 w-5 h-5" />}
          Post New Job
        </Button>
        {!canPost && (
          <p data-testid="post-job-locked-msg" className="text-xs text-amber-600 dark:text-amber-400 -mt-4">
            Verify your business email to post jobs
          </p>
        )}

        {/* Quick Actions */}
        <section data-testid="section-employer-quick-actions">
          <div className="grid grid-cols-3 gap-3">
            <button
              data-testid="qa-browse-pros"
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-center"
              onClick={() => navigate("/poster/candidates")}
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <p className="font-medium text-sm text-foreground leading-tight">Browse<br/>Pros</p>
            </button>
            <button
              data-testid="qa-view-matches"
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border hover:border-blue-500/40 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all text-center"
              onClick={() => navigate("/poster/messages")}
            >
              <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-blue-600" />
              </div>
              <p className="font-medium text-sm text-foreground leading-tight">View<br/>Matches</p>
            </button>
            <button
              data-testid="qa-edit-profile"
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border hover:border-secondary/40 hover:bg-muted/50 transition-all text-center"
              onClick={() => navigate("/poster/profile")}
            >
              <div className="w-11 h-11 rounded-xl bg-secondary/10 flex items-center justify-center">
                <Edit className="w-5 h-5 text-secondary" />
              </div>
              <p className="font-medium text-sm text-foreground leading-tight">Edit<br/>Profile</p>
            </button>
          </div>
        </section>

        {/* Jobs Snapshot */}
        <section data-testid="section-jobs-snapshot">
          <div className="flex items-center justify-between px-4 py-3 rounded-xl border bg-card">
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Jobs Snapshot</h2>
              <p className="text-2xl font-bold text-primary leading-tight">{stats?.active_jobs || 0} <span className="text-sm font-normal text-muted-foreground">active jobs</span></p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/poster/jobs/new")} data-testid="snapshot-post-job" className="text-xs">
              <Briefcase className="w-3.5 h-3.5 mr-1.5" /> Manage
            </Button>
          </div>
        </section>

        {/* Hiring Flow — pros only */}
        <section data-testid="section-hiring-flow">
          <div className="mb-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Hiring Flow</h2>
            <p className="text-[10px] text-muted-foreground">Current pros in each hiring stage</p>
          </div>
          <div className="flex items-stretch rounded-xl border bg-card overflow-hidden">
            <button onClick={() => navigate("/poster/pipeline")} data-testid="flow-applicants" className="flex-1 flex flex-col items-center justify-center gap-0 py-3 px-1 hover:bg-muted/40 transition-colors border-r min-w-0">
              <p className="text-[10px] font-semibold text-foreground">Applicants</p>
              <p className="text-lg font-bold text-amber-600 leading-tight">{candidateCounts.applicants}</p>
              <p className="text-[8px] text-muted-foreground">Interested now</p>
            </button>
            <div className="flex items-center -mx-1 z-10"><ArrowRight className="w-2.5 h-2.5 text-muted-foreground/40" /></div>
            <button onClick={() => navigate("/poster/messages")} data-testid="flow-matches" className="flex-1 flex flex-col items-center justify-center gap-0 py-3 px-1 hover:bg-muted/40 transition-colors border-r min-w-0">
              <p className="text-[10px] font-semibold text-foreground">Matches</p>
              <p className="text-lg font-bold text-green-600 leading-tight">{candidateCounts.matched}</p>
              <p className="text-[8px] text-muted-foreground">Accepted / interviewing</p>
            </button>
            <div className="flex items-center -mx-1 z-10"><ArrowRight className="w-2.5 h-2.5 text-muted-foreground/40" /></div>
            <button onClick={() => navigate("/poster/offers-sent")} data-testid="flow-offers" className="flex-1 flex flex-col items-center justify-center gap-0 py-3 px-1 hover:bg-muted/40 transition-colors border-r min-w-0">
              <p className="text-[10px] font-semibold text-foreground">Offers</p>
              <p className="text-lg font-bold text-purple-600 leading-tight">{offerCount}</p>
              <p className="text-[8px] text-muted-foreground">Pending offers</p>
            </button>
            <div className="flex items-center -mx-1 z-10"><ArrowRight className="w-2.5 h-2.5 text-muted-foreground/40" /></div>
            <button onClick={() => navigate("/poster/compliance")} data-testid="flow-onboarding" className="flex-1 flex flex-col items-center justify-center gap-0 py-3 px-1 hover:bg-muted/40 transition-colors min-w-0">
              <p className="text-[10px] font-semibold text-foreground">Onboarding</p>
              <p className="text-lg font-bold text-emerald-600 leading-tight">{onboardingCount}</p>
              <p className="text-[8px] text-muted-foreground">Active onboarding</p>
            </button>
          </div>
        </section>

        {/* Onboarding Progress */}
        {onboardingCases.length > 0 && (
          <section data-testid="section-onboarding">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-foreground">Onboarding Progress</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate("/poster/onboarding")} className="text-xs">
                View All <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
            <div className="space-y-2">
              {onboardingCases.slice(0, 3).map((c) => {
                const p = c.progress || {};
                const isFlagged = c.status === "flagged";
                const isCleared = c.status === "cleared";
                return (
                  <Card
                    key={c.id}
                    data-testid={`onb-card-${c.id}`}
                    className={`cursor-pointer transition-colors ${isFlagged ? "border-red-300 dark:border-red-700" : isCleared ? "border-green-300 dark:border-green-700" : "hover:border-primary/30"}`}
                    onClick={() => navigate("/poster/onboarding")}
                  >
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm text-foreground truncate">{c.candidate?.full_name || "Applicant"}</p>
                            {isCleared && <Badge className="bg-green-100 text-green-700 text-[9px]"><CheckCircle className="w-2.5 h-2.5 mr-0.5" /> Cleared</Badge>}
                            {isFlagged && <Badge className="bg-red-100 text-red-700 text-[9px]"><Flag className="w-2.5 h-2.5 mr-0.5" /> Flagged</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">{c.job?.title} — {c.role_type}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-base font-bold text-foreground">{p.percent || 0}%</p>
                          <p className="text-[9px] text-muted-foreground">{p.completed || 0}/{p.total || 0} done</p>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${isCleared ? "bg-green-500" : isFlagged ? "bg-red-500" : "bg-primary"}`}
                          style={{ width: `${p.percent || 0}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                        {(p.satisfied_from_vault || 0) > 0 && <span className="text-green-600"><Shield className="w-2.5 h-2.5 inline mr-0.5" />{p.satisfied_from_vault} vault</span>}
                        {(p.pending_review || 0) > 0 && <span className="text-blue-600"><Eye className="w-2.5 h-2.5 inline mr-0.5" />{p.pending_review} review</span>}
                        {(p.pending_external || 0) > 0 && <span className="text-purple-600">{p.pending_external} external</span>}
                        {(p.flagged || 0) > 0 && <span className="text-red-600"><Flag className="w-2.5 h-2.5 inline mr-0.5" />{p.flagged} flagged</span>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Jobs List */}
        <section data-testid="section-jobs">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-foreground">Your Job Postings</h2>
          </div>
          <Card>
            <CardContent className="p-0">
              {jobs.length === 0 ? (
                <div className="text-center py-16">
                  <Briefcase className="w-14 h-14 mx-auto mb-4 text-muted-foreground/40" />
                  <p className="text-lg font-medium text-foreground">No jobs posted yet</p>
                  <p className="text-sm text-muted-foreground mb-4">Create your first job posting to start finding pros</p>
                  <Button data-testid="create-first-job-btn" onClick={() => navigate("/poster/jobs/new")} className="bg-primary hover:bg-primary/90">
                    Post Your First Job
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {jobs.map((job) => (
                    <div key={job.id} className="p-4 sm:p-5 hover:bg-muted/30 transition-colors">
                      <div className="flex flex-col gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground truncate text-sm sm:text-base">{job.title}</h3>
                            <Badge className={`text-[10px] shrink-0 ${job.is_active ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}`}>
                              {job.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs sm:text-sm text-muted-foreground">
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>
                            {job.duration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{job.duration}</span>}
                            {job.pay_range?.min > 0 && (
                              <span className="flex items-center gap-1">
                                <DollarSign className="w-3 h-3" />
                                ${job.pay_range.min.toLocaleString()}-${job.pay_range.max?.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button data-testid={`view-candidates-${job.id}`} variant="outline" size="sm" onClick={() => navigate("/poster/pipeline")} className="flex-1 sm:flex-none text-xs sm:text-sm h-8 sm:h-9">
                            <Eye className="w-3.5 h-3.5 mr-1" /> Applicants
                          </Button>
                          <Button data-testid={`edit-job-${job.id}`} variant="ghost" size="sm" onClick={() => navigate(`/poster/jobs/${job.id}/edit`)} className="h-8 sm:h-9 w-8 sm:w-9 p-0">
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button data-testid={`delete-job-${job.id}`} variant="ghost" size="sm" className="text-destructive hover:text-destructive h-8 sm:h-9 w-8 sm:w-9 p-0" onClick={() => setDeleteJobId(job.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteJobId} onOpenChange={() => setDeleteJobId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job Posting?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="confirm-delete-job-btn" onClick={handleDeleteJob} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Verify Email Dialog */}
      <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" /> Verify Business Email
            </DialogTitle>
            <DialogDescription>
              {verifyStep === "email" ? "Enter your company email to verify." : "Enter the 6-digit code sent to your email."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {verifyStep === "email" ? (
              <div>
                <Label htmlFor="business-email">Business Email Address</Label>
                <Input id="business-email" type="email" placeholder="you@yourcompany.com" value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} className="mt-1" />
                <p className="text-xs text-muted-foreground mt-2">Must be a company domain email.</p>
              </div>
            ) : (
              <>
                <div className="text-center mb-4">
                  <Mail className="w-12 h-12 mx-auto text-primary mb-2" />
                  <p className="text-sm text-muted-foreground">Verification sent to <strong>{businessEmail}</strong></p>
                </div>
                <div>
                  <Label htmlFor="verification-code">Verification Code</Label>
                  <Input id="verification-code" placeholder="Enter 6-digit code" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value.toUpperCase())} className="mt-1 text-center text-lg tracking-widest" maxLength={6} />
                </div>
                <Button variant="link" onClick={() => setVerifyStep("email")} className="text-sm">Use a different email</Button>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowVerifyDialog(false); setVerifyStep("email"); setBusinessEmail(""); setVerificationCode(""); }}>Cancel</Button>
            {verifyStep === "email" ? (
              <Button onClick={handleSendVerification} disabled={sendingVerification || !businessEmail}>{sendingVerification ? "Sending..." : "Send Verification"}</Button>
            ) : (
              <Button onClick={handleConfirmVerification} disabled={sendingVerification || !verificationCode}>{sendingVerification ? "Verifying..." : "Verify Email"}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default PosterDashboard;
