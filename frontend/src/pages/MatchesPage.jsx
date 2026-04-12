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

  /* ── Item List Component ───────────────────── */
  const ItemList = ({ onSelect }) => (
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
            onClick={() => onSelect(item)}
            className={`w-full p-3 rounded-xl text-left transition-all ${
              isActive ? "bg-primary/10 border border-primary/20" : "hover:bg-muted active:bg-muted"
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
  );

  /* ── Detail/Chat Panel ─────────────────────── */
  const DetailPanel = ({ item, onBack }) => (
    <div className="flex flex-col h-full">
      {/* Detail Header */}
      <div className="border-b border-border p-3 sm:p-4">
        <div className="flex items-start gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 -ml-1 lg:hidden" data-testid="match-back-btn">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            {isSeeker ? (
              <Briefcase className="w-5 h-5 text-primary" />
            ) : (
              <span className="text-base font-semibold text-primary">
                {item.seeker?.full_name?.charAt(0)}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm sm:text-base leading-tight truncate">
              {isSeeker ? item.job?.title : item.seeker?.full_name}
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
              {isSeeker && item.job?.company_name && <span>{item.job.company_name}</span>}
              {isSeeker && item.job?.location && (
                <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{item.job.location}</span>
              )}
              {isSeeker && item.job?.pay_range?.min && (
                <span className="flex items-center gap-0.5">
                  <DollarSign className="w-3 h-3" />
                  ${item.job.pay_range.min.toLocaleString()}-${item.job.pay_range.max?.toLocaleString()}
                </span>
              )}
            </div>
            <Badge
              variant="outline"
              className={`mt-1.5 text-[10px] ${(STATUS_CONFIG[item.status] || STATUS_CONFIG.matched).className}`}
            >
              {(STATUS_CONFIG[item.status] || STATUS_CONFIG.matched).label}
            </Badge>
          </div>
        </div>
      </div>

      {/* Messages or pending state */}
      {(item.match_id || !isSeeker) ? (
        <>
          <ScrollArea className="flex-1 p-3 sm:p-4">
            <div className="space-y-3">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] sm:max-w-[70%] px-3 py-2 rounded-2xl text-sm ${
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

          <div className="p-3 sm:p-4 border-t border-border">
            <form onSubmit={handleSend} className="flex gap-2">
              <Input
                data-testid="message-input"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                disabled={sending}
                className="flex-1 h-10"
              />
              <Button
                data-testid="send-message-btn"
                type="submit"
                disabled={sending || !newMessage.trim()}
                className="bg-primary hover:bg-primary/90 h-10 w-10 p-0 sm:w-auto sm:px-4"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center p-6">
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
    </div>
  );

  return (
    <DashboardLayout>
      <div data-testid="matches-page">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-4">Matches</h1>

        {items.length === 0 ? (
          <Card>
            <CardContent className="py-12 sm:py-16 text-center">
              <Briefcase className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-muted-foreground/40" />
              <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-2">No matches yet</h2>
              <p className="text-sm text-muted-foreground mb-6">
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
          <>
            {/* Desktop: side-by-side layout */}
            <div className="hidden lg:grid lg:grid-cols-3 gap-4" style={{ height: "calc(100vh - 10rem)" }}>
              <Card className="lg:col-span-1 h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    {isSeeker ? "Your Applications" : "Conversations"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[calc(100vh-14rem)]">
                    <ItemList onSelect={setSelected} />
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2 h-full flex flex-col">
                {selected ? (
                  <DetailPanel item={selected} />
                ) : (
                  <CardContent className="flex-1 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <Stethoscope className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Select an item to view details</p>
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>

            {/* Mobile: full-screen toggle between list and detail */}
            <div className="lg:hidden">
              {selected ? (
                <Card className="min-h-[calc(100vh-12rem)]  flex flex-col">
                  <DetailPanel item={selected} onBack={() => setSelected(null)} />
                </Card>
              ) : (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      {isSeeker ? "Your Applications" : "Conversations"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ItemList onSelect={setSelected} />
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MatchesPage;
