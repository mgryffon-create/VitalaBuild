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
  ArrowRight, Mail, CheckCircle, AlertTriangle, Shield, Users, Send, MessageCircle
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
  const [candidateCount, setCandidateCount] = useState(0);
  const [offerCount, setOfferCount] = useState(0);
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
      const [statsRes, jobsRes, candidatesRes, offersRes, verifyRes] = await Promise.all([
        axios.get(`${API}/stats`),
        axios.get(`${API}/jobs`),
        axios.get(`${API}/employer/candidates`).catch(() => ({ data: [] })),
        axios.get(`${API}/hiring/offers`).catch(() => ({ data: [] })),
        axios.get(`${API}/employer/verification-status`).catch(() => ({ data: null })),
      ]);
      setStats(statsRes.data);
      setJobs(jobsRes.data);
      setCandidateCount(candidatesRes.data.length);
      setOfferCount(offersRes.data.length);
      setVerificationStatus(verifyRes.data);
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

  return (
    <DashboardLayout>
      <div data-testid="poster-dashboard" className="space-y-8 max-w-5xl">

        {/* Verification Alerts */}
        {verificationStatus && !verificationStatus.business_email_verified && (
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

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">
              Welcome back, {user?.full_name?.split(" ")[0] || "there"}
            </h1>
            <p className="text-muted-foreground mt-1">Manage your job postings and find the best candidates.</p>
          </div>
          <Button
            data-testid="post-job-btn"
            onClick={() => navigate("/poster/jobs/new")}
            className="bg-primary hover:bg-primary/90"
            disabled={!verificationStatus?.business_email_verified}
          >
            <Plus className="mr-2 w-4 h-4" /> Post New Job
          </Button>
        </div>

        {/* Quick Actions */}
        <section data-testid="section-employer-quick-actions">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              data-testid="qa-post-job"
              className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/40 hover:bg-muted/50 transition-all text-left"
              onClick={() => navigate("/poster/jobs/new")}
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Plus className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm text-foreground">Post Job</p>
              </div>
            </button>
            <button
              data-testid="qa-view-candidates"
              className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-green-500/40 hover:bg-muted/50 transition-all text-left"
              onClick={() => navigate("/poster/candidates")}
            >
              <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm text-foreground">Candidates</p>
              </div>
            </button>
            <button
              data-testid="qa-view-matches"
              className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-blue-500/40 hover:bg-muted/50 transition-all text-left"
              onClick={() => navigate("/matches")}
            >
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                <MessageCircle className="w-4 h-4 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm text-foreground">Matches</p>
              </div>
            </button>
            <button
              data-testid="qa-edit-profile"
              className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-secondary/40 hover:bg-muted/50 transition-all text-left"
              onClick={() => navigate("/poster/profile")}
            >
              <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                <Edit className="w-4 h-4 text-secondary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm text-foreground">Company Profile</p>
              </div>
            </button>
          </div>
        </section>

        {/* Stats */}
        <section data-testid="section-employer-stats">
          <div className="grid sm:grid-cols-3 gap-4">
            <Card className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => {}}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground">{stats?.active_jobs || 0}</p>
                  <p className="text-xs text-muted-foreground">Jobs Posted</p>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-green-500/40 transition-colors" onClick={() => navigate("/poster/candidates")}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground">{candidateCount}</p>
                  <p className="text-xs text-muted-foreground">Candidates</p>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-blue-500/40 transition-colors" onClick={() => navigate("/poster/offers-sent")}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Send className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground">{offerCount}</p>
                  <p className="text-xs text-muted-foreground">Offers Sent</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

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
                  <p className="text-sm text-muted-foreground mb-4">Create your first job posting to start finding candidates</p>
                  <Button data-testid="create-first-job-btn" onClick={() => navigate("/poster/jobs/new")} className="bg-primary hover:bg-primary/90">
                    Post Your First Job
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {jobs.map((job) => (
                    <div key={job.id} className="p-5 hover:bg-muted/30 transition-colors">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground truncate">{job.title}</h3>
                            <Badge className={job.is_active ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}>
                              {job.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.location}</span>
                            {job.duration && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{job.duration}</span>}
                            {job.pay_range?.min > 0 && (
                              <span className="flex items-center gap-1">
                                <DollarSign className="w-3.5 h-3.5" />
                                ${job.pay_range.min.toLocaleString()}-${job.pay_range.max?.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button data-testid={`view-candidates-${job.id}`} variant="outline" size="sm" onClick={() => navigate("/poster/candidates")}>
                            <Eye className="w-4 h-4 mr-1" /> Candidates
                          </Button>
                          <Button data-testid={`edit-job-${job.id}`} variant="ghost" size="sm" onClick={() => navigate(`/poster/jobs/${job.id}/edit`)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button data-testid={`delete-job-${job.id}`} variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteJobId(job.id)}>
                            <Trash2 className="w-4 h-4" />
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
