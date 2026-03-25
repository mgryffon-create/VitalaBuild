import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { MessageCircle, Send, Briefcase, MapPin, DollarSign, Clock, Stethoscope, ArrowLeft } from "lucide-react";

const STATUS_CONFIG = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200" },
  matched: { label: "Matched", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200" },
  offer:   { label: "Offer",   className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200" },
};

const MatchesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSeeker = user?.role === "seeker";

  const [applications, setApplications] = useState([]);
  const [legacyMatches, setLegacyMatches] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  /* ── Fetch data ─────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    try {
      if (isSeeker) {
        const res = await axios.get(`${API}/seeker/applications`);
        setApplications(res.data);
      } else {
        const res = await axios.get(`${API}/matches`);
        setLegacyMatches(res.data);
      }
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [isSeeker]);

  const fetchMessages = useCallback(async (matchId) => {
    if (!matchId) return;
    try {
      const res = await axios.get(`${API}/matches/${matchId}/messages`);
      setMessages(res.data);
    } catch {
      setMessages([]);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (selected?.match_id) fetchMessages(selected.match_id);
    else if (selected?.id && !isSeeker) fetchMessages(selected.id);
    else setMessages([]);
  }, [selected, fetchMessages, isSeeker]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── Send message ───────────────────────────────────────── */
  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const matchId = isSeeker ? selected?.match_id : selected?.id;
    if (!matchId) return;

    setSending(true);
    try {
      await axios.post(`${API}/matches/${matchId}/messages`, { content: newMessage.trim() });
      setNewMessage("");
      fetchMessages(matchId);
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  /* ── Unified list for display ───────────────────────────── */
  const items = isSeeker ? applications : legacyMatches;

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
      <div data-testid="matches-page" className="h-[calc(100vh-8rem)]">
        <h1 className="text-2xl font-bold text-foreground mb-6">Matches</h1>

        {items.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Briefcase className="w-16 h-16 mx-auto mb-4 text-muted-foreground/40" />
              <h2 className="text-xl font-semibold text-foreground mb-2">No matches yet</h2>
              <p className="text-muted-foreground mb-6">
                {isSeeker
                  ? "Start finding jobs to see them here."
                  : "Wait for seekers to express interest in your jobs."}
              </p>
              <Button
                data-testid="find-jobs-matches-btn"
                onClick={() => navigate(isSeeker ? "/seeker/swipe" : "/poster")}
                className="bg-primary hover:bg-primary/90"
              >
                {isSeeker ? "Find Jobs" : "View Dashboard"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6 h-full">
            {/* ── Left Column: list ──────────────────────── */}
            <Card className="lg:col-span-1 h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {isSeeker ? "Your Applications" : "Conversations"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-16rem)]">
                  <div className="space-y-1 p-2">
                    {items.map((item) => {
                      const id = item.id;
                      const isActive = selected?.id === id;
                      const status = item.status || "matched";
                      const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

                      return (
                        <button
                          key={id}
                          data-testid={`match-item-${id}`}
                          onClick={() => setSelected(item)}
                          className={`w-full p-3 rounded-xl text-left transition-all ${
                            isActive ? "bg-primary/10 border border-primary/20" : "hover:bg-muted"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              {isSeeker ? (
                                <Briefcase className="w-5 h-5 text-primary" />
                              ) : (
                                <span className="text-sm font-semibold text-primary">
                                  {item.seeker?.full_name?.charAt(0) || "?"}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-foreground truncate">
                                {isSeeker ? item.job?.title : item.seeker?.full_name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {isSeeker
                                  ? item.job?.company_name || "Healthcare Facility"
                                  : item.seeker?.specialty || "Medical Professional"}
                              </p>
                            </div>
                            <Badge variant="outline" className={`text-[10px] shrink-0 ${cfg.className}`}>
                              {cfg.label}
                            </Badge>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* ── Right Column: detail + chat ────────────── */}
            <Card className="lg:col-span-2 h-full flex flex-col">
              {selected ? (
                <>
                  {/* Detail Header */}
                  <CardHeader className="border-b border-border pb-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        {isSeeker ? (
                          <Briefcase className="w-6 h-6 text-primary" />
                        ) : (
                          <span className="text-lg font-semibold text-primary">
                            {selected.seeker?.full_name?.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg leading-tight">
                          {isSeeker ? selected.job?.title : selected.seeker?.full_name}
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                          {isSeeker && selected.job?.company_name && (
                            <span>{selected.job.company_name}</span>
                          )}
                          {isSeeker && selected.job?.location && (
                            <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{selected.job.location}</span>
                          )}
                          {isSeeker && selected.job?.pay_range?.min && (
                            <span className="flex items-center gap-0.5">
                              <DollarSign className="w-3 h-3" />
                              ${selected.job.pay_range.min.toLocaleString()}-${selected.job.pay_range.max?.toLocaleString()}
                            </span>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={`mt-2 text-xs ${(STATUS_CONFIG[selected.status] || STATUS_CONFIG.matched).className}`}
                        >
                          {(STATUS_CONFIG[selected.status] || STATUS_CONFIG.matched).label}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  {/* Messages or pending state */}
                  {(selected.match_id || !isSeeker) ? (
                    <>
                      <ScrollArea className="flex-1 p-4">
                        <div className="space-y-3">
                          {messages.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
                              <p className="text-sm">No messages yet. Start the conversation!</p>
                            </div>
                          ) : (
                            messages.map((msg) => (
                              <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[70%] px-3.5 py-2.5 rounded-2xl text-sm ${
                                  msg.sender_id === user?.id
                                    ? "bg-primary text-primary-foreground rounded-br-md"
                                    : "bg-muted text-foreground rounded-bl-md"
                                }`}>
                                  <p>{msg.content}</p>
                                  <p className={`text-[10px] mt-1 ${msg.sender_id === user?.id ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </p>
                                </div>
                              </div>
                            ))
                          )}
                          <div ref={messagesEndRef} />
                        </div>
                      </ScrollArea>

                      <div className="p-4 border-t border-border">
                        <form onSubmit={handleSend} className="flex gap-2">
                          <Input
                            data-testid="message-input"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type a message..."
                            disabled={sending}
                            className="flex-1"
                          />
                          <Button
                            data-testid="send-message-btn"
                            type="submit"
                            disabled={sending || !newMessage.trim()}
                            className="bg-primary hover:bg-primary/90"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                        </form>
                      </div>
                    </>
                  ) : (
                    /* Pending — no chat yet */
                    <div className="flex-1 flex items-center justify-center p-8">
                      <div className="text-center max-w-xs">
                        <Clock className="w-10 h-10 mx-auto mb-3 text-amber-500/60" />
                        <p className="font-medium text-foreground mb-1">Waiting for a match</p>
                        <p className="text-sm text-muted-foreground">
                          The employer hasn&apos;t reviewed your application yet.
                          You&apos;ll be able to message once they express interest.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <CardContent className="flex-1 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Stethoscope className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Select a job to view details</p>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MatchesPage;
