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
  Clock, Award, Briefcase, FileText, User
} from "lucide-react";

const STAGE_BADGE = {
  interested: "bg-amber-100 text-amber-700",
  matched: "bg-green-100 text-green-700",
  interviewing: "bg-blue-100 text-blue-700",
  offer_sent: "bg-purple-100 text-purple-700",
  hired: "bg-emerald-100 text-emerald-700",
};

const TEMPLATES = [
  { key: "availability", label: "Ask Availability" },
  { key: "interview_request", label: "Request Interview" },
  { key: "application_request", label: "Send Application" },
  { key: "offer_notification", label: "Notify Offer" },
];

const EmployerMessagingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [pipeline, setPipeline] = useState({ candidates: {}, stats: {} });
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const endRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const [pipeRes, matchRes] = await Promise.all([
        axios.get(`${API}/pipeline/candidates`).catch(() => ({ data: { candidates: {}, stats: {} } })),
        axios.get(`${API}/matches`).catch(() => ({ data: [] })),
      ]);
      setPipeline(pipeRes.data);
      // Build conversation list from pipeline candidates who have matches
      const allCandidates = Object.values(pipeRes.data.candidates || {}).flat();
      // Merge with legacy matches
      const convos = [];
      const seen = new Set();
      for (const c of allCandidates) {
        if (seen.has(c.candidate_id)) continue;
        seen.add(c.candidate_id);
        convos.push({
          id: c.candidate_id,
          candidate_id: c.candidate_id,
          job_id: c.job_id,
          name: c.seeker?.full_name || "Candidate",
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
          name: m.seeker?.full_name || "Candidate",
          specialty: m.seeker?.specialty,
          stage: "matched",
          last_message: null,
        });
      }
      setConversations(convos);
      // Auto-select from URL param
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
    // Find match_id for this conversation
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

  const useTemplate = async (key) => {
    try {
      const res = await axios.post(`${API}/pipeline/templates/render`, { template_key: key });
      let text = res.data.text;
      text = text.replace("{name}", selected?.name || "").replace("{job}", "the position");
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

  const filtered = filter === "all" ? conversations : conversations.filter((c) => c.stage === filter);

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div data-testid="employer-messaging-page" className="h-[calc(100vh-8rem)] flex flex-col">
        <h1 className="text-xl font-bold text-foreground mb-3">Messages</h1>

        <div className="flex-1 flex gap-3 min-h-0">
          {/* Left: Conversation list (hidden on mobile when selected) */}
          <div className={`w-full lg:w-80 flex-shrink-0 flex flex-col border rounded-xl bg-card ${selected ? "hidden lg:flex" : "flex"}`}>
            {/* Filters */}
            <div className="p-2 border-b flex gap-1 overflow-x-auto">
              {[{ id: "all", label: "All" }, { id: "interested", label: "New" }, { id: "matched", label: "Matched" }, { id: "interviewing", label: "Interview" }].map((f) => (
                <button key={f.id} onClick={() => setFilter(f.id)} className={`px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors ${filter === f.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <ScrollArea className="flex-1">
              {filtered.length === 0 ? (
                <div className="p-6 text-center"><MessageCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" /><p className="text-xs text-muted-foreground">No conversations</p></div>
              ) : (
                filtered.map((c) => (
                  <button key={c.id} onClick={() => setSelected(c)} data-testid={`convo-${c.id}`} className={`w-full p-3 text-left border-b transition-colors ${selected?.id === c.id ? "bg-primary/5" : "hover:bg-muted/50"}`}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-semibold text-primary">
                        {c.name?.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-medium text-foreground truncate">{c.name}</p>
                          {c.has_verified_refs && <Shield className="w-3 h-3 text-green-600 shrink-0" />}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">{c.specialty || "Healthcare Professional"}</p>
                        {c.last_message && <p className="text-[9px] text-muted-foreground truncate mt-0.5">{c.last_message.content}</p>}
                      </div>
                      <Badge variant="outline" className={`text-[8px] shrink-0 ${STAGE_BADGE[c.stage] || ""}`}>{c.stage?.replace(/_/g, " ")}</Badge>
                    </div>
                  </button>
                ))
              )}
            </ScrollArea>
          </div>

          {/* Right: Chat + Context */}
          {selected ? (
            <div className="flex-1 flex flex-col border rounded-xl bg-card min-w-0">
              {/* Chat Header */}
              <div className="p-3 border-b flex items-center gap-3">
                <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8 shrink-0" onClick={() => setSelected(null)}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-semibold text-primary">
                  {selected.name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{selected.name}</p>
                  <p className="text-[10px] text-muted-foreground">{selected.specialty}</p>
                </div>
                <Badge variant="outline" className={`text-[9px] ${STAGE_BADGE[selected.stage] || ""}`}>{selected.stage?.replace(/_/g, " ")}</Badge>
              </div>

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
                  <button key={t.key} onClick={() => useTemplate(t.key)} className="px-2 py-1 rounded-full bg-muted text-[9px] font-medium text-muted-foreground hover:bg-muted/80 whitespace-nowrap shrink-0">
                    {t.label}
                  </button>
                ))}
                {selected.stage !== "hired" && (
                  <button onClick={() => moveStage(selected.stage === "interested" ? "matched" : selected.stage === "matched" ? "interviewing" : "offer_sent")} className="px-2 py-1 rounded-full bg-primary/10 text-[9px] font-medium text-primary whitespace-nowrap shrink-0">
                    Advance Stage <ChevronRight className="w-2.5 h-2.5 inline" />
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
            <div className="flex-1 hidden lg:flex items-center justify-center border rounded-xl bg-card">
              <div className="text-center"><MessageCircle className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" /><p className="text-sm text-muted-foreground">Select a conversation</p></div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default EmployerMessagingPage;
