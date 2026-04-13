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
  PanelRightClose, Star, BookOpen, ShieldCheck, Bell
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
  interviewing: "Match",
  offer_sent: "Offer",
  hired: "Onboarding",
};

const TEMPLATES = [
  { key: "availability", label: "Ask Availability" },
  { key: "interview_request", label: "Request Interview" },
  { key: "application_request", label: "Send Application" },
  { key: "offer_notification", label: "Notify Offer" },
];

const CandidateContextPanel = ({ candidateId, onClose }) => {
  const [ctx, setCtx] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!candidateId) return;
    setLoading(true);
    axios.get(`${API}/pipeline/candidates/${candidateId}/context`)
      .then((res) => setCtx(res.data))
      .catch(() => setCtx(null))
      .finally(() => setLoading(false));
  }, [candidateId]);

  if (loading) {
    return (
      <div className="w-72 border-l bg-card p-4 flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (!ctx) return null;

  return (
    <div data-testid="candidate-context-panel" className="w-72 border-l bg-card flex flex-col overflow-hidden">
      <div className="p-3 border-b flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">Applicant Profile</p>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <PanelRightClose className="w-3.5 h-3.5" />
        </Button>
      </div>
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-4">
          {/* Basic info */}
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-sm font-semibold text-primary">
              {ctx.full_name?.charAt(0) || "?"}
            </div>
            <p className="text-sm font-medium mt-2">{ctx.full_name}</p>
            <p className="text-[10px] text-muted-foreground">{ctx.specialty || "Healthcare Professional"}</p>
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

          {/* Skills */}
          {ctx.skills?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Skills</p>
              <div className="flex flex-wrap gap-1">
                {ctx.skills.slice(0, 8).map((s, i) => (
                  <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{s}</span>
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

          {/* References detail */}
          {ctx.references?.top?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Top References</p>
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
              <p className="text-[10px] text-foreground/80 leading-relaxed">{ctx.bio.slice(0, 200)}{ctx.bio.length > 200 ? "..." : ""}</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

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
  const [showContext, setShowContext] = useState(false);
  const [nudges, setNudges] = useState([]);
  const [jobExtLinks, setJobExtLinks] = useState({});
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
          job_id: c.job_id,
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
          name: m.seeker?.full_name || "Applicant",
          specialty: m.seeker?.specialty,
          stage: "matched",
          last_message: null,
        });
      }

      // Fetch job external links for all unique job_ids
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
      const swipe = await axios.get(`${API}/matches`);
      const match = swipe.data.find((m) => m.seeker?.id === selected.candidate_id);
      if (match) {
        const res = await axios.get(`${API}/matches/${match.id}/messages`);
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
      const swipe = await axios.get(`${API}/matches`);
      const match = swipe.data.find((m) => m.seeker?.id === selected.candidate_id);
      if (!match) { toast.error("No match found — accept candidate first"); setSending(false); return; }
      await axios.post(`${API}/matches/${match.id}/messages`, { content });
      setNewMsg("");
      fetchMessages();
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const applyTemplate = async (key) => {
    try {
      const res = await axios.post(`${API}/pipeline/templates/render`, { template_key: key });
      let text = res.data.text;
      text = text.replace("{name}", selected?.name || "").replace("{job}", selected?.specialty || "this");
      // If using application_request template and there's an external link, append it
      if (key === "application_request" && selected?.job_id && jobExtLinks[selected.job_id]) {
        text += `\n\nApplication link: ${jobExtLinks[selected.job_id].url}`;
      }
      setNewMsg(text);
    } catch {
      toast.error("Failed to load template");
    }
  };

  const moveStage = async (newStage) => {
    if (!selected) return;
    try {
      await axios.put(`${API}/pipeline/candidates/${selected.candidate_id}/${selected.job_id}/stage`, { stage: newStage });
      toast.success(`Moved to ${newStage.replace(/_/g, " ")}`);
      fetchData();
    } catch {
      toast.error("Failed to update stage");
    }
  };

  // Filter: "matched" filter includes "interviewing" stage (merged visually)
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
        <h1 className="text-xl font-bold text-foreground mb-3">Messages</h1>

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
                          {c.last_message && <p className="text-[9px] text-muted-foreground truncate mt-0.5">{c.last_message.content}</p>}
                        </div>
                        <Badge variant="outline" className={`text-[8px] shrink-0 ${STAGE_BADGE[c.stage] || ""}`}>{STAGE_LABEL[c.stage] || c.stage}</Badge>
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
              {/* Chat Header */}
              <div className="p-3 border-b flex items-center gap-3">
                <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8 shrink-0" onClick={() => setSelected(null)} data-testid="back-to-list-btn">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-semibold text-primary">
                  {selected.name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{selected.name}</p>
                  <p className="text-[10px] text-muted-foreground">{selected.specialty}</p>
                </div>
                <Badge variant="outline" className={`text-[9px] ${STAGE_BADGE[selected.stage] || ""}`}>{STAGE_LABEL[selected.stage] || selected.stage}</Badge>
                <Button variant="ghost" size="icon" className="hidden lg:flex h-8 w-8" onClick={() => setShowContext(!showContext)} data-testid="toggle-context-btn">
                  {showContext ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
                </Button>
              </div>

              {/* Nudge alert inside chat */}
              {selectedNudge && (
                <div data-testid="chat-nudge-alert" className="mx-3 mt-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center gap-2">
                  <Bell className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <p className="text-[10px] text-amber-700 dark:text-amber-300 flex-1">{selectedNudge.message} <span className="text-muted-foreground">({selectedNudge.days_idle}d)</span></p>
                </div>
              )}

              {/* External application link banner */}
              {selectedExtLink && (
                <div data-testid="external-app-link" className="mx-3 mt-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex items-center gap-2">
                  <ExternalLink className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <p className="text-[10px] text-blue-700 dark:text-blue-300 flex-1">
                    This job requires an external application
                  </p>
                  <a href={selectedExtLink.url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-medium text-blue-700 dark:text-blue-300 underline shrink-0">
                    Open Link
                  </a>
                </div>
              )}

              {/* Messages */}
              <ScrollArea className="flex-1 p-3">
                {messages.length === 0 ? (
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

              {/* Quick actions */}
              <div className="px-3 py-1.5 border-t flex gap-1 overflow-x-auto">
                {TEMPLATES.map((t) => (
                  <button key={t.key} onClick={() => applyTemplate(t.key)} data-testid={`tpl-${t.key}`} className="px-2 py-1 rounded-full bg-muted text-[9px] font-medium text-muted-foreground hover:bg-muted/80 whitespace-nowrap shrink-0">
                    {t.label}
                  </button>
                ))}
                {selected.stage !== "hired" && (
                  <button onClick={() => moveStage(selected.stage === "interested" ? "matched" : (selected.stage === "matched" || selected.stage === "interviewing") ? "offer_sent" : "hired")} data-testid="advance-stage-btn" className="px-2 py-1 rounded-full bg-primary/10 text-[9px] font-medium text-primary whitespace-nowrap shrink-0">
                    Advance Stage <ChevronRight className="w-2.5 h-2.5 inline" />
                  </button>
                )}
                {selectedExtLink && (
                  <button onClick={() => applyTemplate("application_request")} data-testid="send-ext-link-btn" className="px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-[9px] font-medium text-blue-700 dark:text-blue-300 whitespace-nowrap shrink-0">
                    <ExternalLink className="w-2.5 h-2.5 inline mr-0.5" /> Send App Link
                  </button>
                )}
              </div>

              {/* Input */}
              <div className="p-3 border-t">
                <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
                  <Input data-testid="chat-input" value={newMsg} onChange={(e) => setNewMsg(e.target.value)} placeholder="Type a message..." disabled={sending} className="flex-1 h-9 text-sm" />
                  <Button data-testid="chat-send-btn" type="submit" disabled={sending || !newMsg.trim()} className="h-9 w-9 p-0">
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </div>
          ) : (
            <div className="flex-1 hidden lg:flex items-center justify-center border rounded-r-xl bg-card">
              <div className="text-center"><MessageCircle className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" /><p className="text-sm text-muted-foreground">Select a conversation</p></div>
            </div>
          )}

          {/* Right: Candidate Context Panel (desktop only) */}
          {selected && showContext && (
            <CandidateContextPanel candidateId={selected.candidate_id} onClose={() => setShowContext(false)} />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default EmployerMessagingPage;
