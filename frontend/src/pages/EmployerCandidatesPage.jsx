import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Users, Briefcase, MapPin, Star, CheckCircle, Clock,
  DollarSign, Send, UserCheck, XCircle, ArrowLeft
} from "lucide-react";

const STATUS_CONFIG = {
  pending:    { label: "Interested",  className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  matched:    { label: "Matched",     className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  offer_sent: { label: "Offer Sent",  className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
};

const EmployerCandidatesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState("all");
  const [showOfferDialog, setShowOfferDialog] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [sending, setSending] = useState(false);

  const [offerForm, setOfferForm] = useState({
    salary_amount: "",
    salary_type: "hourly",
    start_date: "",
    expiration_date: "",
    benefits_summary: "",
    conditions: [],
  });
  const [newCondition, setNewCondition] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [candidatesRes, jobsRes] = await Promise.all([
        axios.get(`${API}/employer/candidates`),
        axios.get(`${API}/jobs`),
      ]);
      setCandidates(candidatesRes.data);
      setJobs(jobsRes.data);
    } catch (error) {
      toast.error("Failed to load candidates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = selectedJob === "all"
    ? candidates
    : candidates.filter(c => c.job_id === selectedJob);

  const counts = {
    pending: candidates.filter(c => c.status === "pending").length,
    matched: candidates.filter(c => c.status === "matched").length,
    offer_sent: candidates.filter(c => c.status === "offer_sent").length,
  };

  const handleAccept = async (candidate) => {
    try {
      await axios.post(`${API}/employer/candidates/${candidate.seeker_id}/accept?job_id=${candidate.job_id}`);
      toast.success(`${candidate.seeker.full_name} accepted!`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to accept candidate");
    }
  };

  const handleSendOffer = async () => {
    if (!selectedCandidate) return;
    if (!offerForm.salary_amount || !offerForm.start_date) {
      toast.error("Please fill in salary and start date");
      return;
    }

    setSending(true);
    try {
      const job = jobs.find(j => j.id === selectedCandidate.job_id);
      const expirationDate = offerForm.expiration_date || (() => {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        return d.toISOString().split("T")[0];
      })();

      await axios.post(`${API}/hiring/offers`, {
        match_id: selectedCandidate.match_id,
        job_id: selectedCandidate.job_id,
        seeker_id: selectedCandidate.seeker_id,
        position_title: job?.title || "Healthcare Position",
        salary_amount: parseFloat(offerForm.salary_amount),
        salary_type: offerForm.salary_type,
        start_date: offerForm.start_date,
        expiration_date: expirationDate,
        conditions: offerForm.conditions,
        benefits_summary: offerForm.benefits_summary || null,
      });
      toast.success("Offer sent successfully!");
      setShowOfferDialog(false);
      setSelectedCandidate(null);
      setOfferForm({ salary_amount: "", salary_type: "hourly", start_date: "", expiration_date: "", benefits_summary: "", conditions: [] });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send offer");
    } finally {
      setSending(false);
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
      <div data-testid="employer-candidates-page" className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/poster")} data-testid="candidates-back-btn" className="shrink-0 -ml-1">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Candidates</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {candidates.length} candidate{candidates.length !== 1 ? "s" : ""} across {jobs.length} job{jobs.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <Card>
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold text-foreground">{counts.pending}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Interested</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold text-foreground">{counts.matched}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Matched</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <Send className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold text-foreground">{counts.offer_sent}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Offers Sent</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter by Job */}
        {jobs.length > 1 && (
          <div className="flex items-center gap-3">
            <Label className="text-sm text-muted-foreground shrink-0">Filter by job:</Label>
            <Select value={selectedJob} onValueChange={setSelectedJob}>
              <SelectTrigger data-testid="job-filter" className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Jobs ({candidates.length})</SelectItem>
                {jobs.map(j => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.title} ({candidates.filter(c => c.job_id === j.id).length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Candidates List */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Users className="w-14 h-14 mx-auto mb-4 text-muted-foreground/40" />
              <h2 className="text-lg font-semibold text-foreground mb-2">No candidates yet</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Candidates will appear here when seekers express interest in your jobs.
              </p>
              <Button variant="outline" onClick={() => navigate("/poster")}>Back to Dashboard</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((c) => {
              const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.pending;
              return (
                <Card key={c.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-base sm:text-lg font-semibold text-primary">
                            {c.seeker.full_name?.charAt(0) || "?"}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-foreground text-sm sm:text-base">{c.seeker.full_name}</p>
                            <Badge variant="outline" className={`text-[10px] ${cfg.className}`}>{cfg.label}</Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs sm:text-sm text-muted-foreground">
                            {c.seeker.specialty && (
                              <span className="flex items-center gap-1"><Star className="w-3 h-3" />{c.seeker.specialty}</span>
                            )}
                            {c.seeker.years_experience && (
                              <span>{c.seeker.years_experience} yrs exp</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 flex-wrap">
                            <Briefcase className="w-3 h-3 shrink-0" /> <span className="truncate">{c.job.title}</span>
                            {c.job.location && <><MapPin className="w-3 h-3 ml-1 shrink-0" /><span>{c.job.location}</span></>}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:self-end">
                        {c.status === "pending" && (
                          <Button
                            data-testid={`accept-candidate-${c.id}`}
                            size="sm"
                            className="bg-green-500 hover:bg-green-600 text-white flex-1 sm:flex-none h-9"
                            onClick={() => handleAccept(c)}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" /> Accept
                          </Button>
                        )}
                        {c.status === "matched" && (
                          <Button
                            data-testid={`send-offer-${c.id}`}
                            size="sm"
                            className="bg-primary hover:bg-primary/90 flex-1 sm:flex-none h-9"
                            onClick={() => {
                              setSelectedCandidate(c);
                              setShowOfferDialog(true);
                            }}
                          >
                            <Send className="w-4 h-4 mr-1" /> Send Offer
                          </Button>
                        )}
                        {c.status === "offer_sent" && (
                          <Badge className="bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
                            <CheckCircle className="w-3 h-3 mr-1" /> Offer Sent
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Send Offer Dialog */}
      <Dialog open={showOfferDialog} onOpenChange={setShowOfferDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Job Offer</DialogTitle>
            <DialogDescription>
              Send an offer to {selectedCandidate?.seeker?.full_name} for {jobs.find(j => j.id === selectedCandidate?.job_id)?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pay Rate *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    data-testid="offer-salary-input"
                    type="number"
                    value={offerForm.salary_amount}
                    onChange={(e) => setOfferForm(p => ({ ...p, salary_amount: e.target.value }))}
                    className="pl-10"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Pay Type</Label>
                <Select value={offerForm.salary_type} onValueChange={(v) => setOfferForm(p => ({ ...p, salary_type: v }))}>
                  <SelectTrigger data-testid="offer-pay-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Input
                  data-testid="offer-start-date"
                  type="date"
                  value={offerForm.start_date}
                  onChange={(e) => setOfferForm(p => ({ ...p, start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Offer Expires</Label>
                <Input
                  data-testid="offer-expiration"
                  type="date"
                  value={offerForm.expiration_date}
                  onChange={(e) => setOfferForm(p => ({ ...p, expiration_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Benefits Summary</Label>
              <Textarea
                data-testid="offer-benefits"
                value={offerForm.benefits_summary}
                onChange={(e) => setOfferForm(p => ({ ...p, benefits_summary: e.target.value }))}
                placeholder="Health insurance, housing stipend, etc."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Conditions</Label>
              <div className="flex gap-2">
                <Input
                  value={newCondition}
                  onChange={(e) => setNewCondition(e.target.value)}
                  placeholder="e.g., Background check"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newCondition.trim()) {
                      setOfferForm(p => ({ ...p, conditions: [...p.conditions, newCondition.trim()] }));
                      setNewCondition("");
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (newCondition.trim()) {
                      setOfferForm(p => ({ ...p, conditions: [...p.conditions, newCondition.trim()] }));
                      setNewCondition("");
                    }
                  }}
                >
                  Add
                </Button>
              </div>
              {offerForm.conditions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {offerForm.conditions.map((c, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {c}
                      <button className="ml-1 hover:text-destructive" onClick={() => setOfferForm(p => ({ ...p, conditions: p.conditions.filter((_, j) => j !== i) }))}>
                        <XCircle className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOfferDialog(false)}>Cancel</Button>
            <Button
              data-testid="confirm-send-offer-btn"
              onClick={handleSendOffer}
              disabled={sending || !offerForm.salary_amount || !offerForm.start_date}
              className="bg-primary hover:bg-primary/90"
            >
              {sending ? "Sending..." : "Send Offer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default EmployerCandidatesPage;
