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
  ArrowRight, ShieldCheck, MapPin, Star, ChevronRight, BarChart
} from "lucide-react";

const STAGES = [
  { id: "interested", label: "Interested", color: "border-amber-400", bg: "bg-amber-50 dark:bg-amber-900/10", badge: "bg-amber-100 text-amber-700" },
  { id: "matched", label: "Matched", color: "border-green-400", bg: "bg-green-50 dark:bg-green-900/10", badge: "bg-green-100 text-green-700" },
  { id: "interviewing", label: "Interviewing", color: "border-blue-400", bg: "bg-blue-50 dark:bg-blue-900/10", badge: "bg-blue-100 text-blue-700" },
  { id: "offer_sent", label: "Offer Sent", color: "border-purple-400", bg: "bg-purple-50 dark:bg-purple-900/10", badge: "bg-purple-100 text-purple-700" },
  { id: "hired", label: "Hired", color: "border-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/10", badge: "bg-emerald-100 text-emerald-700" },
];

const NEXT_STAGE = { interested: "matched", matched: "interviewing", interviewing: "offer_sent", offer_sent: "hired" };
const NEXT_LABEL = { interested: "Match", matched: "Interview", interviewing: "Send Offer", offer_sent: "Hire" };

const PipelineCard = ({ candidate, onMove, onMessage }) => {
  const c = candidate;
  return (
    <Card data-testid={`pipeline-card-${c.id}`} className="mb-2 hover:border-primary/30 transition-colors cursor-pointer">
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-semibold text-primary">
            {c.seeker?.full_name?.charAt(0) || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-medium text-xs text-foreground truncate">{c.seeker?.full_name || "Candidate"}</p>
              {c.has_verified_refs && <ShieldCheck className="w-3 h-3 text-green-600 shrink-0" />}
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
  const [loading, setLoading] = useState(true);

  const fetchPipeline = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/pipeline/candidates`);
      setData(res.data);
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

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div></DashboardLayout>;
  }

  const stats = data.stats || {};

  return (
    <DashboardLayout>
      <div data-testid="hiring-pipeline-page" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Hiring Pipeline</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">{stats.total || 0} candidates across all stages</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BarChart className="w-4 h-4" />
            <span>{stats.hired || 0} hired</span>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STAGES.map((s) => (
            <div key={s.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${s.badge}`}>
              {s.label}: {stats[s.id] || 0}
            </div>
          ))}
        </div>

        {/* Kanban Board — horizontal scroll on mobile, grid on desktop */}
        <div className="flex gap-3 overflow-x-auto pb-4 snap-x" style={{ minHeight: "calc(100vh - 14rem)" }}>
          {STAGES.map((stage) => {
            const cards = data.candidates?.[stage.id] || [];
            return (
              <div
                key={stage.id}
                data-testid={`pipeline-col-${stage.id}`}
                className={`flex-shrink-0 w-[260px] sm:w-[280px] lg:flex-1 rounded-xl border-t-[3px] ${stage.color} bg-card`}
              >
                <div className={`px-3 py-2.5 border-b ${stage.bg}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">{stage.label}</p>
                    <Badge variant="secondary" className="text-[9px] h-5 px-1.5">{cards.length}</Badge>
                  </div>
                </div>
                <ScrollArea className="p-2" style={{ maxHeight: "calc(100vh - 20rem)" }}>
                  {cards.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-[10px] text-muted-foreground">No candidates</p>
                    </div>
                  ) : (
                    cards.map((c) => (
                      <PipelineCard key={c.id} candidate={c} onMove={moveCandidate} onMessage={openMessage} />
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
