import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Users, Briefcase, CheckCircle, Clock, MessageCircle, Send,
  ShieldCheck, MapPin, Star, ChevronRight, BarChart,
  AlertTriangle, Bell, Award, XCircle, Eye, UserCheck, Loader2,
} from "lucide-react";

// UI stages
const STAGES = [
  { id: "interested", label: "Applicants", color: "border-amber-400", bg: "bg-amber-50 dark:bg-amber-950/20", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  { id: "matched", label: "Matches", subtitle: "Accepted + Interviewing", color: "border-green-400", bg: "bg-green-50 dark:bg-green-950/20", badge: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300", merges: ["interviewing"] },
  { id: "offer_sent", label: "Offers", color: "border-purple-400", bg: "bg-purple-50 dark:bg-purple-950/20", badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  { id: "hired", label: "Onboarding", color: "border-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/20", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
];

const NEXT_STAGE = { interested: "matched", matched: "offer_sent", offer_sent: "hired" };
const NEXT_LABEL = { interested: "Accept Candidate", matched: "Send Offer", offer_sent: "Start Onboarding" };

const SUB_BADGE = {
  matched: { label: "Accepted", className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  interviewing: { label: "Interviewing", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
};

const STAGE_LABEL_MAP = {
  interested: "Applicant",
  matched: "Match",
  interviewing: "Match",
  offer_sent: "Offer Sent",
  hired: "Onboarding",
};

const NudgeBanner = ({ nudges, onAction }) => {
  if (!nudges?.length) return null;
  const top = nudges.slice(0, 3);
  return (
    <div data-testid="nudge-banner" className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 p-3 space-y-2">
      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
        <Bell className="w-4 h-4" />
        <p className="text-xs font-semibold">Action Needed — {nudges.length} applicant{nudges.length > 1 ? "s" : ""} waiting</p>
      </div>
      {top.map((n) => (
        <div key={`${n.candidate_id}_${n.job_id}`} className="flex items-center justify-between gap-2 pl-6">
          <p className="text-[11px] text-foreground/80 flex-1 truncate">
            <span className="font-medium">{n.candidate_name}</span>
            <span className="text-muted-foreground"> — {n.message}</span>
            <span className="ml-1 text-amber-600 dark:text-amber-400 text-[10px]">({n.days_idle}d idle)</span>
          </p>
          <Button
            size="sm"
            variant={n.priority === "high" ? "default" : "outline"}
            className="h-6 text-[10px] px-2 shrink-0"
            onClick={() => onAction(n)}
            data-testid={`nudge-action-${n.candidate_id}`}
          >
            Review
          </Button>
        </div>
      ))}
    </div>
  );
};

/* ── Pipeline Card — click opens profile modal, NO auto-progression ── */
const PipelineCard = ({ candidate, onClick, nudgeIds, showSubBadge }) => {
  const c = candidate;
  const isNudged = nudgeIds.has(c.candidate_id);
  const sub = showSubBadge ? SUB_BADGE[c.stage] : null;
  const tier = c.match_tier;
  const reasons = c.match_reasons || [];
  const isStrong = tier === "strong";
  const ob = c.onboarding_progress;

  return (
    <Card
      data-testid={`pipeline-card-${c.id}`}
      className={`mb-2 transition-colors cursor-pointer ${
        isNudged
          ? "border-amber-300 dark:border-amber-700 ring-1 ring-amber-200 dark:ring-amber-800"
          : isStrong
            ? "border-green-200 dark:border-green-800/60 hover:border-green-300 dark:hover:border-green-700"
            : "hover:border-primary/30"
      }`}
      onClick={() => onClick(c)}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-semibold text-primary">
            {c.seeker?.full_name?.charAt(0) || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-medium text-xs text-foreground truncate">{c.seeker?.full_name || "Applicant"}</p>
              {c.has_verified_refs && <ShieldCheck className="w-3 h-3 text-green-600 shrink-0" />}
              {isNudged && <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />}
              {sub && <span className={`text-[8px] px-1.5 py-0 rounded-full font-medium shrink-0 ${sub.className}`}>{sub.label}</span>}
            </div>
            <p className="text-[10px] text-muted-foreground truncate">{c.seeker?.specialty || c.job?.title}</p>
            {/* Match reasons */}
            {reasons.length > 0 && (
              <div data-testid={`match-reasons-${c.id}`} className="mt-0.5">
                {reasons.map((r, i) => (
                  <p key={i} className="text-[9px] text-primary/70 truncate leading-tight">{r}</p>
                ))}
              </div>
            )}
            {c.seeker?.skills?.length > 0 && (
              <div className="flex flex-wrap gap-0.5 mt-1">
                {c.seeker.skills.slice(0, 3).map((s, i) => (
                  <span key={i} className="text-[8px] px-1 py-0 rounded bg-muted text-muted-foreground">{typeof s === 'string' ? s : s?.skill || s?.name || ''}</span>
                ))}
              </div>
            )}
            {c.last_message && (
              <p className="text-[9px] text-muted-foreground mt-1 truncate flex items-center gap-0.5">
                <MessageCircle className="w-2.5 h-2.5" /> {c.last_message.content}
              </p>
            )}
            {/* Onboarding progress bar */}
            {ob && (
              <div data-testid={`onboarding-progress-${c.id}`} className="mt-1.5">
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-[8px] font-semibold ${
                    ob.status_label === "ready" ? "text-green-600" :
                    ob.status_label === "blocked" ? "text-red-600" : "text-blue-600"
                  }`}>
                    {ob.status_label === "ready" ? "Ready" : ob.status_label === "blocked" ? "Blocked" : "In Progress"}
                  </span>
                  <span className="text-[8px] text-muted-foreground">{ob.completed}/{ob.total}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      ob.status_label === "ready" ? "bg-green-500" :
                      ob.status_label === "blocked" ? "bg-red-500" : "bg-blue-500"
                    }`}
                    style={{ width: `${ob.percent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {tier && (
              <span data-testid={`match-badge-${c.id}`} className={`text-[8px] px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap ${
                tier === "strong"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
              }`}>
                {tier === "strong" ? "Strong" : "Possible"}
              </span>
            )}
            <Eye className="w-3.5 h-3.5 text-muted-foreground/40" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/* ── Onboarding Detail Section (inside modal for hired candidates) ── */
const OnboardingDetailSection = ({ progress }) => {
  const ob = progress;
  if (!ob) return null;

  const statusColor = ob.status_label === "ready" ? "text-green-600" : ob.status_label === "blocked" ? "text-red-600" : "text-blue-600";
  const barColor = ob.status_label === "ready" ? "bg-green-500" : ob.status_label === "blocked" ? "bg-red-500" : "bg-blue-500";

  return (
    <div data-testid="onboarding-detail-section" className="space-y-3">
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Onboarding Progress</p>
          <span className={`text-xs font-semibold ${statusColor}`}>
            {ob.status_label === "ready" ? "Ready" : ob.status_label === "blocked" ? "Blocked" : "In Progress"}
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${ob.percent}%` }} />
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">{ob.completed} of {ob.total} requirements complete</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {ob.completed > 0 && (
          <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
            <p className="text-[10px] font-semibold text-green-700 dark:text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Completed</p>
            <p className="text-lg font-bold text-green-600">{ob.completed}</p>
          </div>
        )}
        {ob.missing > 0 && (
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
            <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Missing</p>
            <p className="text-lg font-bold text-amber-600">{ob.missing}</p>
          </div>
        )}
        {ob.expired > 0 && (
          <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
            <p className="text-[10px] font-semibold text-red-700 dark:text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3" /> Expired</p>
            <p className="text-lg font-bold text-red-600">{ob.expired}</p>
          </div>
        )}
        {ob.pending_external > 0 && (
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
            <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Pending External</p>
            <p className="text-lg font-bold text-blue-600">{ob.pending_external}</p>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Candidate Profile Modal ── */
const CandidateProfileModal = ({ candidate, open, onClose, onAction, actionLoading }) => {
  const c = candidate;
  if (!c) return null;

  const stage = c.stage;
  const canMessage = stage !== "interested";
  const nextStage = NEXT_STAGE[stage];
  const nextLabel = NEXT_LABEL[stage];
  const tier = c.match_tier;
  const reasons = c.match_reasons || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto" data-testid="candidate-profile-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
              {c.seeker?.full_name?.charAt(0) || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <span className="block">{c.seeker?.full_name || "Candidate"}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-normal text-muted-foreground">{STAGE_LABEL_MAP[stage] || stage}</span>
                {tier && (
                  <span data-testid="modal-match-badge" className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                    tier === "strong"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                  }`}>
                    {tier === "strong" ? "Strong Match" : "Possible Match"}
                  </span>
                )}
              </div>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">Candidate profile and actions</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Match reasons */}
          {reasons.length > 0 && (
            <div data-testid="modal-match-reasons" className="flex flex-col gap-0.5">
              {reasons.map((r, i) => (
                <p key={i} className="text-xs text-primary/80 flex items-center gap-1.5">
                  <CheckCircle className="w-3 h-3 shrink-0" /> {r}
                </p>
              ))}
            </div>
          )}
          {/* Profile details */}
          <div className="space-y-2">
            {c.seeker?.specialty && (
              <div className="flex items-center gap-2 text-sm">
                <Briefcase className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>{c.seeker.specialty}</span>
              </div>
            )}
            {c.seeker?.years_experience > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Star className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>{c.seeker.years_experience} years experience</span>
              </div>
            )}
            {c.seeker?.preferred_shift && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>{c.seeker.preferred_shift}</span>
              </div>
            )}
            {c.seeker?.preferred_locations?.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>{c.seeker.preferred_locations.slice(0, 3).join(", ")}</span>
              </div>
            )}
          </div>

          {/* Skills */}
          {c.seeker?.skills?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Skills</p>
              <div className="flex flex-wrap gap-1">
                {c.seeker.skills.slice(0, 8).map((s, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {typeof s === 'string' ? s : s?.skill || s?.name || ''}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Trust signals */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {c.has_verified_refs && (
              <span className="flex items-center gap-1 text-green-600">
                <ShieldCheck className="w-3.5 h-3.5" /> Verified references
              </span>
            )}
            {c.vault_docs > 0 && (
              <span className="flex items-center gap-1">
                <Award className="w-3.5 h-3.5" /> {c.vault_docs} documents
              </span>
            )}
          </div>

          {/* Job context */}
          {c.job?.title && (
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Applied for</p>
              <p className="text-sm font-medium">{c.job.title}</p>
              {c.job.location && <p className="text-xs text-muted-foreground">{c.job.location}</p>}
            </div>
          )}

          {/* Offer status (if in offer stage) */}
          {c.offer_status && (
            <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800">
              <p className="text-xs text-purple-600 font-medium">Offer Status: {c.offer_status}</p>
            </div>
          )}

          {/* Onboarding progress detail (hired stage) */}
          {c.onboarding_progress && (
            <OnboardingDetailSection progress={c.onboarding_progress} />
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {/* Messaging — gated by stage */}
          <Button
            data-testid="modal-message-btn"
            variant="outline"
            className="flex-1"
            disabled={!canMessage || actionLoading}
            onClick={() => onAction("message", c)}
          >
            <MessageCircle className="w-4 h-4 mr-1.5" />
            {canMessage ? "Message" : "Accept to message"}
          </Button>

          {/* Stage advancement */}
          {nextStage && (
            <Button
              data-testid="modal-advance-btn"
              className="flex-1"
              disabled={actionLoading}
              onClick={() => onAction("advance", c)}
            >
              {actionLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <UserCheck className="w-4 h-4 mr-1.5" />}
              {nextLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ── Main Page ── */
const HiringPipelinePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState({ candidates: {}, stats: {} });
  const [nudges, setNudges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // {type, candidate, stage}
  const [actionLoading, setActionLoading] = useState(false);

  const fetchPipeline = useCallback(async () => {
    try {
      const [pipeRes, nudgeRes] = await Promise.all([
        axios.get(`${API}/pipeline/candidates`),
        axios.get(`${API}/pipeline/nudges`).catch(() => ({ data: { nudges: [] } })),
      ]);
      setData(pipeRes.data);
      setNudges(nudgeRes.data.nudges || []);
    } catch {
      toast.error("Failed to load pipeline");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPipeline(); }, [fetchPipeline]);

  const handleCardClick = (candidate) => {
    setSelectedCandidate(candidate);
  };

  const handleModalAction = (action, candidate) => {
    if (action === "message") {
      const stage = candidate.stage;
      if (stage === "interested") {
        toast.error("Accept this candidate first to start messaging");
        return;
      }
      setSelectedCandidate(null);
      navigate(`/poster/messages?candidate=${candidate.candidate_id}`);
    } else if (action === "advance") {
      const nextStage = NEXT_STAGE[candidate.stage];
      if (!nextStage) return;
      setConfirmAction({ type: "advance", candidate, stage: nextStage });
    }
  };

  const executeAdvance = async () => {
    if (!confirmAction) return;
    const { candidate, stage } = confirmAction;
    setActionLoading(true);
    try {
      await axios.put(
        `${API}/pipeline/candidates/${candidate.candidate_id}/${candidate.job_id}/stage`,
        { stage }
      );
      const label = NEXT_LABEL[candidate.stage] || stage;
      toast.success(`Candidate moved — ${label.replace("Accept Candidate", "Moved to Matches").replace("Send Offer", "Moved to Offers").replace("Start Onboarding", "Moved to Onboarding")}`);
      setConfirmAction(null);
      setSelectedCandidate(null);
      fetchPipeline();
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === "string") {
        toast.error(detail);
      } else if (err.response?.status === 409) {
        toast.error("Conflict — this candidate may have already been moved");
      } else if (err.response?.status === 404) {
        toast.error("Candidate or job not found");
      } else {
        toast.error("Connection issue — please try again");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleNudgeAction = (nudge) => {
    // Find the candidate in the pipeline data and open their profile
    const allCandidates = Object.values(data.candidates || {}).flat();
    const found = allCandidates.find(
      (c) => c.candidate_id === nudge.candidate_id && c.job_id === nudge.job_id
    );
    if (found) {
      setSelectedCandidate(found);
    } else {
      navigate(`/poster/messages?candidate=${nudge.candidate_id}`);
    }
  };

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div></DashboardLayout>;
  }

  const stats = data.stats || {};
  const nudgeIds = new Set(nudges.map((n) => n.candidate_id));

  // Merge backend stage data
  const mergedCandidates = {};
  for (const stage of STAGES) {
    const base = data.candidates?.[stage.id] || [];
    const merged = stage.merges
      ? [...base, ...(stage.merges.flatMap(m => data.candidates?.[m] || []))]
      : base;
    mergedCandidates[stage.id] = merged;
  }

  const mergedStats = {};
  for (const stage of STAGES) {
    const base = stats[stage.id] || 0;
    const extra = stage.merges ? stage.merges.reduce((sum, m) => sum + (stats[m] || 0), 0) : 0;
    mergedStats[stage.id] = base + extra;
  }

  return (
    <DashboardLayout>
      <div data-testid="hiring-pipeline-page" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Hiring Flow</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">{stats.total || 0} applicants across all stages</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BarChart className="w-4 h-4" />
            <span>{stats.hired || 0} hired</span>
          </div>
        </div>

        <NudgeBanner nudges={nudges} onAction={handleNudgeAction} />

        <div className="flex gap-2 overflow-x-auto pb-1">
          {STAGES.map((s) => (
            <div key={s.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${s.badge}`}>
              {s.label}: {mergedStats[s.id] || 0}
            </div>
          ))}
        </div>

        {/* Kanban Board */}
        <div className="flex gap-3 overflow-x-auto pb-4 snap-x" style={{ minHeight: "calc(100vh - 16rem)" }}>
          {STAGES.map((stage) => {
            const cards = mergedCandidates[stage.id] || [];
            return (
              <div
                key={stage.id}
                data-testid={`pipeline-col-${stage.id}`}
                className={`flex-shrink-0 w-[260px] sm:w-[280px] lg:flex-1 rounded-xl border-t-[3px] ${stage.color} bg-card`}
              >
                <div className={`px-3 py-2.5 border-b ${stage.bg}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-foreground">{stage.label}</p>
                      {stage.subtitle && <p className="text-[9px] text-muted-foreground">{stage.subtitle}</p>}
                    </div>
                    <Badge variant="secondary" className="text-[9px] h-5 px-1.5">{cards.length}</Badge>
                  </div>
                </div>
                <ScrollArea className="p-2" style={{ maxHeight: "calc(100vh - 22rem)" }}>
                  {cards.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-[10px] text-muted-foreground">No applicants</p>
                    </div>
                  ) : (
                    cards.map((c) => (
                      <PipelineCard
                        key={`${stage.id}_${c.id}`}
                        candidate={c}
                        onClick={handleCardClick}
                        nudgeIds={nudgeIds}
                        showSubBadge={!!stage.merges}
                      />
                    ))
                  )}
                </ScrollArea>
              </div>
            );
          })}
        </div>
      </div>

      {/* Candidate Profile Modal */}
      <CandidateProfileModal
        candidate={selectedCandidate}
        open={!!selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
        onAction={handleModalAction}
        actionLoading={actionLoading}
      />

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => !actionLoading && setConfirmAction(null)}>
        <AlertDialogContent data-testid="confirm-advance-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Action</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.stage === "matched" && `Move ${confirmAction?.candidate?.seeker?.full_name || "this candidate"} to Matches? They'll become an accepted candidate for this role.`}
              {confirmAction?.stage === "offer_sent" && `Move ${confirmAction?.candidate?.seeker?.full_name || "this candidate"} to Offers? You'll need to create an offer from the Offers page.`}
              {confirmAction?.stage === "hired" && `Start onboarding for ${confirmAction?.candidate?.seeker?.full_name || "this candidate"}? This will move them to the Onboarding stage.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading} data-testid="confirm-cancel-btn">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeAdvance}
              disabled={actionLoading}
              data-testid="confirm-proceed-btn"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              {actionLoading ? "Processing..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default HiringPipelinePage;
