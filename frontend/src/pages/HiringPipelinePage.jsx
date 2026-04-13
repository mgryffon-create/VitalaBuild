import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Users, Briefcase, CheckCircle, Clock, MessageCircle, Send,
  ArrowRight, ShieldCheck, MapPin, Star, ChevronRight, BarChart,
  AlertTriangle, Bell, Zap
} from "lucide-react";

// UI stages — "interviewing" is hidden, merged visually into "Matches"
const STAGES = [
  { id: "interested", label: "Applicants", color: "border-amber-400", bg: "bg-amber-50 dark:bg-amber-950/20", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  { id: "matched", label: "Matches", subtitle: "Accepted + Interviewing", color: "border-green-400", bg: "bg-green-50 dark:bg-green-950/20", badge: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300", merges: ["interviewing"] },
  { id: "offer_sent", label: "Offers", color: "border-purple-400", bg: "bg-purple-50 dark:bg-purple-950/20", badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  { id: "hired", label: "Onboarding", color: "border-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/20", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
];

// Backend stages still flow through "interviewing" — UI skips it visually
const NEXT_STAGE = { interested: "matched", matched: "offer_sent", offer_sent: "hired" };
const NEXT_LABEL = { interested: "Match", matched: "Send Offer", offer_sent: "Onboard" };

// Sub-stage badges shown on cards within the Matches column
const SUB_BADGE = {
  matched: { label: "Accepted", className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  interviewing: { label: "Interviewing", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
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
            {n.action === "match" && "Review"}
            {n.action === "message" && "Message"}
            {n.action === "advance" && "Advance"}
            {n.action === "follow_up" && "Follow Up"}
          </Button>
        </div>
      ))}
    </div>
  );
};

const PipelineCard = ({ candidate, onMove, onMessage, nudgeIds, showSubBadge }) => {
  const c = candidate;
  const isNudged = nudgeIds.has(c.candidate_id);
  const sub = showSubBadge ? SUB_BADGE[c.stage] : null;
  return (
    <Card
      data-testid={`pipeline-card-${c.id}`}
      className={`mb-2 transition-colors cursor-pointer ${isNudged ? "border-amber-300 dark:border-amber-700 ring-1 ring-amber-200 dark:ring-amber-800" : "hover:border-primary/30"}`}
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
            {c.seeker?.skills?.length > 0 && (
              <div className="flex flex-wrap gap-0.5 mt-1">
                {c.seeker.skills.slice(0, 3).map((s, i) => (
                  <span key={i} className="text-[8px] px-1 py-0 rounded bg-muted text-muted-foreground">{s}</span>
                ))}
              </div>
            )}
            {c.last_message && (
              <p className="text-[9px] text-muted-foreground mt-1 truncate flex items-center gap-0.5">
                <MessageCircle className="w-2.5 h-2.5" /> {c.last_message.content}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 mt-2">
          <Button variant="ghost" size="sm" className="h-6 text-[10px] flex-1 px-1" onClick={(e) => { e.stopPropagation(); onMessage(c); }} data-testid={`msg-${c.id}`}>
            <MessageCircle className="w-3 h-3 mr-0.5" /> Message
          </Button>
          {NEXT_STAGE[c.stage] && (
            <Button size="sm" className="h-6 text-[10px] flex-1 px-1" onClick={(e) => { e.stopPropagation(); onMove(c, NEXT_STAGE[c.stage]); }} data-testid={`advance-${c.id}`}>
              {NEXT_LABEL[c.stage]} <ChevronRight className="w-3 h-3 ml-0.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const HiringPipelinePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState({ candidates: {}, stats: {} });
  const [nudges, setNudges] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const moveCandidate = async (candidate, newStage) => {
    try {
      await axios.put(`${API}/pipeline/candidates/${candidate.candidate_id}/${candidate.job_id}/stage`, { stage: newStage });
      toast.success(`Moved to ${newStage.replace(/_/g, " ")}`);
      fetchPipeline();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to move");
    }
  };

  const openMessage = (candidate) => {
    navigate(`/poster/messages?candidate=${candidate.candidate_id}`);
  };

  const handleNudgeAction = (nudge) => {
    if (nudge.action === "message" || nudge.action === "follow_up") {
      navigate(`/poster/messages?candidate=${nudge.candidate_id}`);
    } else {
      // For match/advance, navigate to pipeline (already here) — highlight the card
      toast.info(`Review ${nudge.candidate_name} in the ${nudge.stage} column`);
    }
  };

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div></DashboardLayout>;
  }

  const stats = data.stats || {};
  const nudgeIds = new Set(nudges.map((n) => n.candidate_id));

  // Merge backend stage data: "interviewing" cards fold into the "matched" UI column
  const mergedCandidates = {};
  for (const stage of STAGES) {
    const base = data.candidates?.[stage.id] || [];
    const merged = stage.merges
      ? [...base, ...(stage.merges.flatMap(m => data.candidates?.[m] || []))]
      : base;
    mergedCandidates[stage.id] = merged;
  }

  // Merged stats for the pills
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

        {/* Nudge Banner */}
        <NudgeBanner nudges={nudges} onAction={handleNudgeAction} />

        {/* Stats bar */}
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
                      <PipelineCard key={c.id} candidate={c} onMove={moveCandidate} onMessage={openMessage} nudgeIds={nudgeIds} showSubBadge={!!stage.merges} />
                    ))
                  )}
                </ScrollArea>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default HiringPipelinePage;
