import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  MessageCircle, Send, ArrowLeft, ChevronRight, Shield, MapPin,
  Clock, Award, Briefcase, FileText, User, ExternalLink, PanelRightOpen,
  PanelRightClose, Star, ShieldCheck, Bell, UserCheck, Phone, Mail,
  XCircle, Eye, Loader2, CheckCircle, Building, DollarSign, Lock,
} from "lucide-react";

const STAGE_BADGE = {
  interested: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  matched: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  interviewing: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  offer_sent: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  hired: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

const STAGE_LABEL = {
  interested: "Applicant",
  matched: "Match",
  interviewing: "Interviewing",
  offer_sent: "Offer Sent",
  hired: "Onboarding",
};

const TEMPLATES = [
  { key: "availability", label: "Ask Availability" },
  { key: "interview_request", label: "Request Interview" },
  { key: "application_request", label: "Send Application" },
  { key: "offer_notification", label: "Notify Offer" },
];

/* ── Full Candidate Profile Panel (scrollable content + sticky actions) ── */
const CandidateProfilePanel = ({ candidateId, jobId, stage, onClose, onStageAction, actionLoading }) => {
  const [ctx, setCtx] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!candidateId) return;
    setLoading(true);
    const url = jobId
      ? `${API}/pipeline/candidates/${candidateId}/context?job_id=${jobId}`
      : `${API}/pipeline/candidates/${candidateId}/context`;
    axios.get(url)
      .then((res) => setCtx(res.data))
      .catch(() => setCtx(null))
      .finally(() => setLoading(false));
  }, [candidateId, jobId]);

  if (loading) {
    return (
      <div data-testid="profile-panel-loading" className="w-80 border-l bg-card flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (!ctx) {
    return (
      <div className="w-80 border-l bg-card flex items-center justify-center p-4">
        <p className="text-xs text-muted-foreground text-center">Unable to load candidate profile. Please try again.</p>
      </div>
    );
  }

  const canMessage = ["matched", "interviewing", "offer_sent", "hired"].includes(stage);

  return (
    <div data-testid="candidate-profile-panel" className="w-80 border-l bg-card flex flex-col overflow-hidden">
      {/* Panel header */}
      <div className="p-3 border-b flex items-center justify-between shrink-0">
        <p className="text-xs font-semibold text-foreground">Candidate Profile</p>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose} data-testid="close-profile-panel">
          <PanelRightClose className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Scrollable profile content */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Identity */}
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-lg font-semibold text-primary">
              {ctx.full_name?.charAt(0) || "?"}
            </div>
            <p className="text-sm font-semibold mt-2">{ctx.full_name}</p>
            <p className="text-[10px] text-muted-foreground">{ctx.specialty || "Healthcare Professional"}</p>
            {ctx.city_state && (
              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" /> {ctx.city_state}
              </p>
            )}
            {ctx.compliance_ready && (
              <Badge variant="outline" className="mt-1.5 text-[9px] bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200">
                <CheckCircle className="w-3 h-3 mr-1" /> Compliance Ready
              </Badge>
            )}
          </div>

          {/* Contact info — privacy gated */}
          <div data-testid="contact-info-section" className="rounded-lg border p-2.5 space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Contact</p>
            {ctx.contact_available ? (
              <>
                {ctx.phone && (
                  <p data-testid="candidate-phone" className="text-xs text-foreground flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-muted-foreground" /> {ctx.phone}
                  </p>
                )}
                {ctx.email && (
                  <p data-testid="candidate-email" className="text-xs text-foreground flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-muted-foreground" /> {ctx.email}
                  </p>
                )}
                {!ctx.phone && !ctx.email && (
                  <p className="text-[10px] text-muted-foreground">No contact details on file</p>
                )}
              </>
            ) : (
              <p data-testid="contact-gated-hint" className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                <Lock className="w-3 h-3" /> Contact details available after match
              </p>
            )}
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-foreground">{ctx.years_experience || "—"}</p>
              <p className="text-[9px] text-muted-foreground">Yrs Exp</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-foreground">{ctx.vault_docs}</p>
              <p className="text-[9px] text-muted-foreground">Documents</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-foreground">{ctx.references?.verified || 0}/{ctx.references?.total || 0}</p>
              <p className="text-[9px] text-muted-foreground">Verified Refs</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-foreground">{ctx.training?.compliance_rate || 0}%</p>
              <p className="text-[9px] text-muted-foreground">Compliance</p>
            </div>
          </div>

          {/* Licenses */}
          {ctx.licenses?.length > 0 && (
            <div data-testid="licenses-section">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Licenses</p>
              <div className="space-y-1.5">
                {ctx.licenses.map((l, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px] bg-muted/40 rounded-md px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className={`w-3 h-3 ${l.verification_status === "verified" ? "text-green-600" : "text-muted-foreground"}`} />
                      <span className="font-medium">{l.license_type}</span>
                      {l.state && <span className="text-muted-foreground">({l.state})</span>}
                    </div>
                    {l.expiration_date && (
                      <span className="text-muted-foreground text-[9px]">Exp: {l.expiration_date}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Certifications */}
          {ctx.certifications?.length > 0 && (
            <div data-testid="certifications-section">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Certifications</p>
              <div className="flex flex-wrap gap-1">
                {ctx.certifications.slice(0, 10).map((c, i) => (
                  <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    {typeof c === "string" ? c : c?.name || c?.certification || ""}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Work History */}
          {ctx.work_history?.length > 0 && (
            <div data-testid="work-history-section">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Work History</p>
              <div className="space-y-2">
                {ctx.work_history.slice(0, 4).map((w, i) => (
                  <div key={i} className="border-l-2 border-primary/20 pl-2.5">
                    <p className="text-[10px] font-medium text-foreground">{w.title || w.position || "Role"}</p>
                    <p className="text-[9px] text-muted-foreground">{w.facility || w.employer || w.company || ""}</p>
                    {(w.start_date || w.duration) && (
                      <p className="text-[9px] text-muted-foreground/70">{w.start_date}{w.end_date ? ` – ${w.end_date}` : w.duration ? ` · ${w.duration}` : ""}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documents summary */}
          {ctx.vault_docs > 0 && (
            <div data-testid="documents-section">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Documents</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-muted-foreground">{ctx.vault_docs} on file</span>
                {ctx.vault_categories?.map((cat, i) => (
                  <span key={i} className="text-[8px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">{cat}</span>
                ))}
              </div>
            </div>
          )}

          {/* Skills */}
          {ctx.skills?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Skills</p>
              <div className="flex flex-wrap gap-1">
                {ctx.skills.slice(0, 10).map((s, i) => (
                  <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{typeof s === "string" ? s : s?.skill || s?.name || ""}</span>
                ))}
              </div>
            </div>
          )}

          {/* Preferences */}
          {(ctx.preferred_shift || ctx.preferred_locations?.length > 0) && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Preferences</p>
              {ctx.preferred_shift && (
                <p className="text-[10px] text-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> {ctx.preferred_shift}</p>
              )}
              {ctx.preferred_locations?.length > 0 && (
                <p className="text-[10px] text-foreground flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" /> {ctx.preferred_locations.slice(0, 3).join(", ")}</p>
              )}
            </div>
          )}

          {/* References */}
          {ctx.references?.top?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">References</p>
              <div className="space-y-1.5">
                {ctx.references.top.map((r, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[10px]">
                    {r.verified ? <ShieldCheck className="w-3 h-3 text-green-600 shrink-0" /> : <User className="w-3 h-3 text-muted-foreground shrink-0" />}
                    <span className="text-foreground truncate">{r.name}</span>
                    <span className="text-muted-foreground">({r.relationship})</span>
                    {r.rating && <span className="flex items-center gap-0.5 text-amber-500"><Star className="w-2.5 h-2.5" />{r.rating}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bio */}
          {ctx.bio && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">About</p>
              <p className="text-[10px] text-foreground/80 leading-relaxed">{ctx.bio.slice(0, 300)}{ctx.bio.length > 300 ? "..." : ""}</p>
            </div>
          )}

          {/* Bottom padding for sticky actions */}
          <div className="h-2" />
        </div>
      </ScrollArea>

      {/* Sticky action bar — stage-driven */}
      <div data-testid="profile-action-bar" className="border-t p-3 shrink-0 bg-card">
        <div className="flex gap-2">
          {stage === "interested" && (
            <>
              <Button
                data-testid="panel-pass-btn"
                variant="outline"
                size="sm"
                className="flex-1 text-muted-foreground"
                disabled={actionLoading}
                onClick={() => onStageAction("pass")}
              >
                <XCircle className="w-3.5 h-3.5 mr-1" /> Pass
              </Button>
              <Button
                data-testid="panel-accept-btn"
                size="sm"
                className="flex-1"
                disabled={actionLoading}
                onClick={() => onStageAction("accept")}
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <UserCheck className="w-3.5 h-3.5 mr-1" />}
                Accept
              </Button>
            </>
          )}
          {(stage === "matched" || stage === "interviewing") && (
            <>
              <Button
                data-testid="panel-offer-btn"
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={actionLoading}
                onClick={() => onStageAction("send_offer")}
              >
                <Send className="w-3.5 h-3.5 mr-1" /> Send Offer
              </Button>
              <Button
                data-testid="panel-message-btn"
                size="sm"
                className="flex-1"
                disabled={actionLoading}
                onClick={() => onStageAction("message")}
              >
                <MessageCircle className="w-3.5 h-3.5 mr-1" /> Message
              </Button>
            </>
          )}
          {stage === "offer_sent" && (
            <>
              <Button
                data-testid="panel-view-offer-btn"
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={actionLoading}
                onClick={() => onStageAction("view_offer")}
              >
                <Eye className="w-3.5 h-3.5 mr-1" /> View Offer
              </Button>
              <Button
                data-testid="panel-message-btn"
                size="sm"
                className="flex-1"
                disabled={actionLoading}
                onClick={() => onStageAction("message")}
              >
                <MessageCircle className="w-3.5 h-3.5 mr-1" /> Message
              </Button>
            </>
          )}
          {stage === "hired" && (
            <Button
              data-testid="panel-message-btn"
              size="sm"
              className="flex-1"
              disabled={actionLoading}
              onClick={() => onStageAction("message")}
            >
              <MessageCircle className="w-3.5 h-3.5 mr-1" /> Message
            </Button>
          )}
        </div>
        {!canMessage && stage === "interested" && (
          <p className="text-[9px] text-muted-foreground text-center mt-1.5 italic">Messaging unlocks after acceptance</p>
        )}
      </div>
    </div>
  );
};

/* ── Main Page ── */
const EmployerMessagingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showContext, setShowContext] = useState(true);
  const [nudges, setNudges] = useState([]);
  const [jobExtLinks, setJobExtLinks] = useState({});
  const [stageActionLoading, setStageActionLoading] = useState(false);
  const endRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const [pipeRes, matchRes, nudgeRes] = await Promise.all([
        axios.get(`${API}/pipeline/candidates`).catch(() => ({ data: { candidates: {}, stats: {} } })),
        axios.get(`${API}/matches`).catch(() => ({ data: [] })),
        axios.get(`${API}/pipeline/nudges`).catch(() => ({ data: { nudges: [] } })),
      ]);
      setNudges(nudgeRes.data.nudges || []);

      const allCandidates = Object.values(pipeRes.data.candidates || {}).flat();
      const convos = [];
      const seen = new Set();
      const extLinks = {};

      for (const c of allCandidates) {
        if (seen.has(c.candidate_id)) continue;
        seen.add(c.candidate_id);
        convos.push({
          id: c.candidate_id,
          candidate_id: c.candidate_id,
          match_id: c.match_id || null,
          job_id: c.job_id,
          job_title: c.job?.title || "",
          job_location: c.job?.location || "",
          job_pay_range: c.job?.pay_range || null,
          name: c.seeker?.full_name || "Applicant",
          specialty: c.seeker?.specialty,
          stage: c.stage,
          last_message: c.last_message,
          has_verified_refs: c.has_verified_refs,
        });
      }

      for (const m of matchRes.data) {
        if (seen.has(m.seeker?.id)) continue;
        seen.add(m.seeker?.id);
        convos.push({
          id: m.seeker?.id || m.id,
          candidate_id: m.seeker?.id,
          match_id: m.id,
          job_id: m.job_id || m.job?.id,
          job_title: m.job?.title || "",
          job_location: m.job?.location || "",
          job_pay_range: m.job?.pay_range || null,
          name: m.seeker?.full_name || "Applicant",
          specialty: m.seeker?.specialty,
          stage: "matched",
          last_message: null,
        });
      }

      // Fetch job external links for unique job_ids
      const jobIds = [...new Set(convos.map(c => c.job_id).filter(Boolean))];
      for (const jid of jobIds) {
        try {
          const jRes = await axios.get(`${API}/jobs/${jid}`);
          const j = jRes.data;
          if (j.application_workflow_type && j.application_workflow_type !== "in_platform_only" && j.external_application_url) {
            extLinks[jid] = { url: j.external_application_url, type: j.application_workflow_type };
          }
        } catch { /* ignore */ }
      }
      setJobExtLinks(extLinks);

      setConversations(convos);
      const target = searchParams.get("candidate");
      if (target) {
        const found = convos.find((c) => c.candidate_id === target);
        if (found) setSelected(found);
      }
    } catch {
      toast.error("Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchMessages = useCallback(async () => {
    if (!selected) return;
    try {
      let matchId = selected.match_id;
      if (!matchId) {
        const swipe = await axios.get(`${API}/matches`);
        const match = swipe.data.find((m) => m.seeker?.id === selected.candidate_id);
        matchId = match?.id;
      }
      if (matchId) {
        const res = await axios.get(`${API}/matches/${matchId}/messages`);
        setMessages(res.data);
      } else {
        setMessages([]);
      }
    } catch {
      setMessages([]);
    }
  }, [selected]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = async (text) => {
    const content = text || newMsg.trim();
    if (!content || !selected) return;
    setSending(true);
    try {
      let matchId = selected.match_id;
      if (!matchId) {
        const swipe = await axios.get(`${API}/matches`);
        const match = swipe.data.find((m) => m.seeker?.id === selected.candidate_id);
        matchId = match?.id;
      }
      if (!matchId) { toast.error("Accept this candidate first to start messaging"); setSending(false); return; }
      await axios.post(`${API}/matches/${matchId}/messages`, { content });
      setNewMsg("");
      fetchMessages();
    } catch (err) {
      if (err.response?.status === 404) {
        toast.error("Candidate no longer available");
      } else if (err.response?.status === 403) {
        toast.error("Action not allowed in current stage");
      } else {
        toast.error("Server error — please retry");
      }
    } finally {
      setSending(false);
    }
  };

  const applyTemplate = async (key) => {
    try {
      const res = await axios.post(`${API}/pipeline/templates/render`, { template_key: key });
      let text = res.data.text;
      text = text.replace("{name}", selected?.name || "").replace("{job}", selected?.job_title || "this");
      if (key === "application_request" && selected?.job_id && jobExtLinks[selected.job_id]) {
        text += `\n\nApplication link: ${jobExtLinks[selected.job_id].url}`;
      }
      setNewMsg(text);
    } catch {
      toast.error("Failed to load template");
    }
  };

  const handleStageAction = async (action) => {
    if (!selected) return;
    if (action === "message") {
      // Focus the message input
      const input = document.querySelector('[data-testid="chat-input"]');
      if (input) input.focus();
      return;
    }
    if (action === "view_offer") {
      navigate(`/poster/hiring?tab=offers`);
      return;
    }

    setStageActionLoading(true);
    try {
      const stageMap = {
        accept: "matched",
        pass: "passed",
        send_offer: "offer_sent",
      };
      const newStage = stageMap[action];
      if (!newStage) return;
      await axios.put(`${API}/pipeline/candidates/${selected.candidate_id}/${selected.job_id}/stage`, { stage: newStage });
      const labels = { matched: "Candidate accepted — messaging enabled", passed: "Candidate passed", offer_sent: "Moved to Offers" };
      toast.success(labels[newStage] || `Moved to ${newStage}`);
      fetchData();
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === "string") {
        toast.error(detail);
      } else if (err.response?.status === 409) {
        toast.error("Candidate already in this stage");
      } else if (err.response?.status === 404) {
        toast.error("Candidate no longer available");
      } else if (err.response?.status === 403) {
        toast.error("Action not allowed in current stage");
      } else {
        toast.error("Server error — please retry");
      }
    } finally {
      setStageActionLoading(false);
    }
  };

  // Filtered conversations
  const filtered = filter === "all"
    ? conversations
    : filter === "matched"
      ? conversations.filter((c) => c.stage === "matched" || c.stage === "interviewing")
      : conversations.filter((c) => c.stage === filter);
  const nudgeMap = new Map(nudges.map(n => [n.candidate_id, n]));
  const selectedNudge = selected ? nudgeMap.get(selected.candidate_id) : null;
  const selectedExtLink = selected?.job_id ? jobExtLinks[selected.job_id] : null;

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div data-testid="employer-messaging-page" className="h-[calc(100vh-8rem)] flex flex-col">
        {/* Header with back nav */}
        <div className="flex items-center gap-2 mb-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate("/poster/pipeline")} data-testid="back-to-pipeline">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Messages</h1>
        </div>

        <div className="flex-1 flex gap-0 min-h-0">
          {/* Left: Conversation list */}
          <div className={`w-full lg:w-80 flex-shrink-0 flex flex-col border rounded-l-xl bg-card ${selected ? "hidden lg:flex" : "flex"}`}>
            <div className="p-2 border-b flex gap-1 overflow-x-auto">
              {[{ id: "all", label: "All" }, { id: "interested", label: "Applicants" }, { id: "matched", label: "Matches" }, { id: "offer_sent", label: "Offers" }].map((f) => (
                <button key={f.id} onClick={() => setFilter(f.id)} data-testid={`filter-${f.id}`} className={`px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors ${filter === f.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <ScrollArea className="flex-1">
              {filtered.length === 0 ? (
                <div className="p-6 text-center"><MessageCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" /><p className="text-xs text-muted-foreground">No conversations</p></div>
              ) : (
                filtered.map((c) => {
                  const hasNudge = nudgeMap.has(c.candidate_id);
                  return (
                    <button key={c.id} onClick={() => setSelected(c)} data-testid={`convo-${c.id}`} className={`w-full p-3 text-left border-b transition-colors ${selected?.id === c.id ? "bg-primary/5" : "hover:bg-muted/50"}`}>
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-semibold text-primary">
                            {c.name?.charAt(0)}
                          </div>
                          {hasNudge && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-card" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-medium text-foreground truncate">{c.name}</p>
                            {c.has_verified_refs && <Shield className="w-3 h-3 text-green-600 shrink-0" />}
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate">{c.specialty || "Healthcare Professional"}</p>
                          {c.job_title && (
                            <p className="text-[9px] text-primary/70 truncate flex items-center gap-0.5">
                              <Briefcase className="w-2.5 h-2.5 shrink-0" /> {c.job_title}
                            </p>
                          )}
                          {c.last_message && <p className="text-[9px] text-muted-foreground truncate mt-0.5">{c.last_message.content}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-0.5 shrink-0">
                          <Badge variant="outline" className={`text-[8px] ${STAGE_BADGE[c.stage] || ""}`}>{STAGE_LABEL[c.stage] || c.stage}</Badge>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </ScrollArea>
          </div>

          {/* Center: Chat */}
          {selected ? (
            <div className="flex-1 flex flex-col border-y border-r rounded-r-xl bg-card min-w-0">
              {/* Chat Header with job context */}
              <div className="p-3 border-b shrink-0">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8 shrink-0" onClick={() => setSelected(null)} data-testid="back-to-list-btn">
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-semibold text-primary">
                    {selected.name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{selected.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{selected.specialty}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className={`text-[9px] ${STAGE_BADGE[selected.stage] || ""}`}>{STAGE_LABEL[selected.stage] || selected.stage}</Badge>
                  </div>
                  <Button variant="ghost" size="icon" className="hidden lg:flex h-8 w-8" onClick={() => setShowContext(!showContext)} data-testid="toggle-context-btn">
                    {showContext ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
                  </Button>
                </div>
                {/* Job context bar */}
                {selected.job_title && (
                  <div data-testid="job-context-bar" className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground bg-muted/40 rounded-lg px-2.5 py-1.5">
                    <Briefcase className="w-3 h-3 text-primary shrink-0" />
                    <span className="font-medium text-foreground truncate">{selected.job_title}</span>
                    {selected.job_location && (
                      <span className="flex items-center gap-0.5 shrink-0"><MapPin className="w-2.5 h-2.5" />{selected.job_location}</span>
                    )}
                    {selected.job_pay_range && (selected.job_pay_range.min > 0 || selected.job_pay_range.max > 0) && (
                      <span className="flex items-center gap-0.5 shrink-0">
                        <DollarSign className="w-2.5 h-2.5" />${selected.job_pay_range.min}–${selected.job_pay_range.max}/hr
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Nudge alert */}
              {selectedNudge && (
                <div data-testid="chat-nudge-alert" className="mx-3 mt-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center gap-2">
                  <Bell className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <p className="text-[10px] text-amber-700 dark:text-amber-300 flex-1">{selectedNudge.message} <span className="text-muted-foreground">({selectedNudge.days_idle}d)</span></p>
                </div>
              )}

              {/* External application link */}
              {selectedExtLink && (
                <div data-testid="external-app-link" className="mx-3 mt-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex items-center gap-2">
                  <ExternalLink className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <p className="text-[10px] text-blue-700 dark:text-blue-300 flex-1">This job requires an external application</p>
                  <a href={selectedExtLink.url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-medium text-blue-700 dark:text-blue-300 underline shrink-0">Open Link</a>
                </div>
              )}

              {/* Messages */}
              <ScrollArea className="flex-1 p-3">
                {selected.stage === "interested" ? (
                  <div className="text-center py-12">
                    <UserCheck className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-sm font-medium text-foreground mb-1">Accept this candidate to start messaging</p>
                    <p className="text-xs text-muted-foreground mb-4">Use the profile panel to accept or pass</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8"><MessageCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" /><p className="text-xs text-muted-foreground">Start the conversation</p></div>
                ) : (
                  <div className="space-y-2">
                    {messages.map((m) => (
                      <div key={m.id} className={`flex ${m.sender_id === user?.id ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${m.sender_id === user?.id ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md"}`}>
                          <p>{m.content}</p>
                          <p className={`text-[9px] mt-0.5 ${m.sender_id === user?.id ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                            {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={endRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Quick templates + input */}
              {selected.stage !== "interested" && (
                <div className="px-3 py-1.5 border-t flex gap-1 overflow-x-auto shrink-0">
                  {TEMPLATES.map((t) => (
                    <button key={t.key} onClick={() => applyTemplate(t.key)} data-testid={`tpl-${t.key}`} className="px-2 py-1 rounded-full bg-muted text-[9px] font-medium text-muted-foreground hover:bg-muted/80 whitespace-nowrap shrink-0">
                      {t.label}
                    </button>
                  ))}
                  {selectedExtLink && (
                    <button onClick={() => applyTemplate("application_request")} data-testid="send-ext-link-btn" className="px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-[9px] font-medium text-blue-700 dark:text-blue-300 whitespace-nowrap shrink-0">
                      <ExternalLink className="w-2.5 h-2.5 inline mr-0.5" /> Send App Link
                    </button>
                  )}
                </div>
              )}

              {/* Message input */}
              <div className="p-3 border-t shrink-0">
                {selected.stage === "interested" ? (
                  <p className="text-xs text-center text-muted-foreground py-1">Accept candidate from the profile panel to start messaging</p>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
                    <Input data-testid="chat-input" value={newMsg} onChange={(e) => setNewMsg(e.target.value)} placeholder="Type a message..." disabled={sending} className="flex-1 h-9 text-sm" />
                    <Button data-testid="chat-send-btn" type="submit" disabled={sending || !newMsg.trim()} className="h-9 w-9 p-0">
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 hidden lg:flex items-center justify-center border rounded-r-xl bg-card">
              <div className="text-center"><MessageCircle className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" /><p className="text-sm text-muted-foreground">Select a conversation</p></div>
            </div>
          )}

          {/* Right: Full Candidate Profile Panel (desktop only, default open) */}
          {selected && showContext && (
            <CandidateProfilePanel
              candidateId={selected.candidate_id}
              jobId={selected.job_id}
              stage={selected.stage}
              onClose={() => setShowContext(false)}
              onStageAction={handleStageAction}
              actionLoading={stageActionLoading}
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default EmployerMessagingPage;
