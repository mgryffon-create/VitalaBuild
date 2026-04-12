import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  ClipboardCheck, CheckCircle, Clock, AlertTriangle, Upload, Shield,
  ExternalLink, ArrowLeft, Briefcase, XCircle, FileText, Eye
} from "lucide-react";

const STATUS_META = {
  satisfied_from_vault: { label: "From Vault", icon: CheckCircle, className: "text-green-600 bg-green-100 dark:bg-green-900/30" },
  completed: { label: "Completed", icon: CheckCircle, className: "text-green-600 bg-green-100 dark:bg-green-900/30" },
  missing_document: { label: "Missing", icon: XCircle, className: "text-red-600 bg-red-100 dark:bg-red-900/30" },
  document_expired: { label: "Expired", icon: AlertTriangle, className: "text-amber-600 bg-amber-100 dark:bg-amber-900/30" },
  pending_manual_review: { label: "Under Review", icon: Eye, className: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" },
  pending_external_check: { label: "External Check", icon: ExternalLink, className: "text-purple-600 bg-purple-100 dark:bg-purple-900/30" },
  action_required_candidate: { label: "Action Needed", icon: AlertTriangle, className: "text-amber-600 bg-amber-100 dark:bg-amber-900/30" },
  in_progress: { label: "In Progress", icon: Clock, className: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" },
  flagged_issue: { label: "Flagged", icon: AlertTriangle, className: "text-red-600 bg-red-100 dark:bg-red-900/30" },
};

const CASE_STATUS_META = {
  active: { label: "Active", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  cleared: { label: "Cleared", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  flagged: { label: "Flagged", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSeeker = user?.role === "seeker";
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCase, setExpandedCase] = useState(null);

  const fetchCases = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/onboarding/cases`);
      setCases(res.data);
      if (res.data.length === 1) setExpandedCase(res.data[0].id);
    } catch {
      toast.error("Failed to load onboarding data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  const handleMarkComplete = async (reqId) => {
    try {
      await axios.put(`${API}/onboarding/requirements/${reqId}/status`);
      toast.success("Requirement marked as completed");
      fetchCases();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update");
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
      <div data-testid="onboarding-page" className="space-y-5 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(isSeeker ? "/seeker" : "/poster")} className="shrink-0 -ml-1">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              {isSeeker ? "My Onboarding" : "Candidate Onboarding"}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {cases.length === 0
                ? "No active onboarding cases"
                : `${cases.length} onboarding case${cases.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {/* Empty State */}
        {cases.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardCheck className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
              <h3 className="font-semibold text-foreground mb-1">No onboarding cases yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {isSeeker
                  ? "When you accept a job offer, your onboarding requirements will appear here."
                  : "When a candidate accepts an offer, their onboarding case will appear here."}
              </p>
              <Button variant="outline" onClick={() => navigate(isSeeker ? "/seeker/offers" : "/poster/candidates")}>
                {isSeeker ? "View Offers" : "View Candidates"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {cases.map((c) => {
              const caseMeta = CASE_STATUS_META[c.status] || CASE_STATUS_META.active;
              const progress = c.progress || {};
              const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
              const isExpanded = expandedCase === c.id;

              return (
                <Card key={c.id} data-testid={`onboarding-case-${c.id}`}>
                  <CardContent className="p-4 sm:p-5">
                    {/* Case Header */}
                    <button
                      className="w-full text-left"
                      onClick={() => setExpandedCase(isExpanded ? null : c.id)}
                      data-testid={`toggle-case-${c.id}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-foreground text-sm sm:text-base">
                              {c.job?.title || "Healthcare Position"}
                            </h3>
                            <Badge variant="outline" className={`text-[10px] ${caseMeta.className}`}>{caseMeta.label}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {isSeeker ? (c.employer?.full_name || "Employer") : (c.candidate?.full_name || "Candidate")}
                            {c.role_type && ` — ${c.role_type}`}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold text-foreground">{pct}%</p>
                          <p className="text-[10px] text-muted-foreground">{progress.completed}/{progress.total}</p>
                        </div>
                      </div>
                      <Progress value={pct} className="h-1.5 mt-3" />
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {progress.satisfied_from_vault > 0 && (
                          <span className="flex items-center gap-1 text-green-600">
                            <Shield className="w-3 h-3" /> {progress.satisfied_from_vault} from vault
                          </span>
                        )}
                        {progress.pending > 0 && (
                          <span className="flex items-center gap-1 text-amber-600">
                            <Clock className="w-3 h-3" /> {progress.pending} pending
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Expanded Requirements */}
                    {isExpanded && c.requirements && (
                      <div className="mt-4 space-y-2 border-t pt-3">
                        {c.requirements.map((req) => {
                          const sm = STATUS_META[req.status] || STATUS_META.in_progress;
                          const Icon = sm.icon;
                          const isDone = req.status === "satisfied_from_vault" || req.status === "completed";
                          const needsUpload = req.status === "missing_document" || req.status === "document_expired";

                          return (
                            <div
                              key={req.id}
                              data-testid={`req-${req.id}`}
                              className={`flex items-center gap-3 p-3 rounded-lg ${isDone ? "bg-green-50 dark:bg-green-900/10" : "bg-muted/50"}`}
                            >
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${sm.className}`}>
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ${isDone ? "text-green-700 dark:text-green-400 line-through" : "text-foreground"}`}>
                                  {req.label}
                                </p>
                                <p className="text-[10px] text-muted-foreground">{req.notes}</p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Badge variant="outline" className={`text-[9px] ${sm.className}`}>{sm.label}</Badge>
                                {!isDone && isSeeker && needsUpload && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={(e) => { e.stopPropagation(); navigate("/seeker/vault"); }}
                                    data-testid={`upload-for-${req.id}`}
                                  >
                                    <Upload className="w-3 h-3 mr-1" /> Upload
                                  </Button>
                                )}
                                {!isDone && !isSeeker && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={(e) => { e.stopPropagation(); handleMarkComplete(req.id); }}
                                    data-testid={`complete-${req.id}`}
                                  >
                                    <CheckCircle className="w-3 h-3 mr-1" /> Complete
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default OnboardingPage;
