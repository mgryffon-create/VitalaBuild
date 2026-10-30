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
import { MessageCircle, Send, Briefcase, MapPin, DollarSign, Clock, Stethoscope, ArrowLeft, CheckCircle, Building, Gift, ExternalLink } from "lucide-react";

const STATUS_CONFIG = {
  pending_documents: { label: "Pending essentials", className: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  pending:    { label: "Pending",          className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200", icon: Clock },
  matched:    { label: "Matched",          className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200", icon: CheckCircle },
  offer_sent: { label: "Offer Received",   className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200", icon: Gift },
  offer:      { label: "Offer Received",   className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200", icon: Gift },
  accepted:   { label: "Accepted",         className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200", icon: CheckCircle },
  declined:   { label: "Declined",         className: "bg-muted text-muted-foreground border-border", icon: Clock },
};

/* ── Item List — extracted as stable component ── */
const ItemList = ({ items, selected, isSeeker, onSelect }) => (
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

/* ── Detail/Chat Panel — extracted as stable component with OWN message state ── */
const DetailPanel = ({ item, isSeeker, userId, onBack }) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const matchId = item?.status === "pending_documents" ? null : (isSeeker ? item?.match_id : item?.id);

  const fetchMessages = useCallback(async () => {
    if (!matchId) return;
    try {
      const res = await axios.get(`${API}/matches/${matchId}/messages`);
      setMessages(res.data);
    } catch {
      setMessages([]);
    }
  }, [matchId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !matchId) return;
    setSending(true);
    try {
      await axios.post(`${API}/matches/${matchId}/messages`, { content: newMessage.trim() });
      setNewMessage("");
      fetchMessages();
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const hasMessaging = !!matchId;

  return (
    <div className="flex flex-col h-full">
      {/* Detail Header — always shows back nav + full context */}
      <div className="border-b border-border p-3 sm:p-4 shrink-0">
        <div className="flex items-start gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 -ml-1" data-testid="match-back-btn">
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
            {/* Job/employer context — always visible */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
              {isSeeker && item.job?.company_name && (
                <span className="flex items-center gap-0.5 font-medium text-foreground/80">
                  <Building className="w-3 h-3" />{item.job.company_name}
                </span>
              )}
              {isSeeker && item.job?.location && (
                <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{item.job.location}</span>
              )}
              {isSeeker && item.job?.pay_range?.min > 0 && (
                <span className="flex items-center gap-0.5">
                  <DollarSign className="w-3 h-3" />
                  ${item.job.pay_range.min.toLocaleString()}–${item.job.pay_range.max?.toLocaleString()}
                </span>
              )}
              {isSeeker && item.job?.specialty && (
                <span className="flex items-center gap-0.5 text-primary/70">{item.job.specialty}</span>
              )}
            </div>
            <Badge
              variant="outline"
              className={`mt-1.5 text-[10px] ${(STATUS_CONFIG[item.status] || STATUS_CONFIG.matched).className}`}
              data-testid="match-status-badge"
            >
              {(STATUS_CONFIG[item.status] || STATUS_CONFIG.matched).label}
            </Badge>
          </div>
        </div>
      </div>

      {/* Offer received banner — shown for seekers when offer_sent */}
      {isSeeker && (item.status === "offer_sent" || item.status === "offer") && (
        <div data-testid="offer-received-banner" className="mx-3 sm:mx-4 mt-3 p-3 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/80 dark:bg-purple-950/30">
          <div className="flex items-start gap-2.5">
            <Gift className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">Offer Received</p>
              {item.offer ? (
                <div className="mt-1 space-y-0.5">
                  <p className="text-xs text-purple-600 dark:text-purple-400">{item.offer.position_title}</p>
                  {item.offer.salary_amount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      <DollarSign className="w-3 h-3 inline" />
                      {item.offer.salary_amount.toLocaleString()}/{item.offer.salary_type || "annual"}
                    </p>
                  )}
                  {item.offer.start_date && (
                    <p className="text-xs text-muted-foreground">
                      Start: {item.offer.start_date}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-purple-600/80 dark:text-purple-400/80 mt-0.5">The employer has sent you an offer for this position.</p>
              )}
              <Button
                data-testid="view-offer-btn"
                size="sm"
                variant="outline"
                className="mt-2 h-7 text-xs border-purple-300 text-purple-700 hover:bg-purple-100 dark:border-purple-700 dark:text-purple-300"
                onClick={() => navigate("/seeker/offers")}
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                View & Respond to Offer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Messages or pending state */}
      {hasMessaging ? (
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
                  <div key={msg.id} className={`flex ${msg.sender_id === userId ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] sm:max-w-[70%] px-3 py-2 rounded-2xl text-sm ${
                      msg.sender_id === userId
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    }`}>
                      <p>{msg.content}</p>
                      <p className={`text-[10px] mt-1 ${msg.sender_id === userId ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="p-3 sm:p-4 border-t border-border shrink-0">
            <form onSubmit={handleSend} className="flex gap-2">
              <Input
                data-testid="message-input"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                disabled={sending}
                className="flex-1 h-10"
                autoFocus={false}
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
            <p className="font-medium text-foreground mb-1">{item.status === "pending_documents" ? "Your match is on hold" : "Waiting for a match"}</p>
            <p className="text-sm text-muted-foreground">
              {item.status === "pending_documents" ? `Add the essentials to move forward: ${(item.readiness?.missing_documents || []).join(", ") || item.readiness?.role_reason || "role details"}. Other profile sections can wait.` : "The employer hasn’t reviewed your application yet. You’ll be able to message once they express interest."}
            </p>
            {isSeeker && item.status === "pending_documents" && <Button className="mt-4" onClick={() => window.location.assign(item.readiness?.missing_documents?.length ? "/seeker/profile?step=medical" : "/seeker/profile?step=professional")}>Add essential documents</Button>}
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Main Page ── */
const MatchesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSeeker = user?.role === "seeker";

  const [applications, setApplications] = useState([]);
  const [legacyMatches, setLegacyMatches] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      if (isSeeker) {
        const res = await axios.get(`${API}/seeker/applications`);
        setApplications(res.data);
      } else {
        const res = await axios.get(`${API}/matches`);
        setLegacyMatches(res.data);
      }
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [isSeeker]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const items = isSeeker ? applications : legacyMatches;

  const statusCounts = isSeeker ? {
    pending: applications.filter(a => a.status === "pending" || a.status === "pending_documents").length,
    matched: applications.filter(a => a.status === "matched").length,
    offer: applications.filter(a => a.status === "offer" || a.status === "offer_sent").length,
  } : null;

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
      <div data-testid="matches-page">
        <div className="flex items-center gap-2 mb-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => navigate(isSeeker ? "/seeker/swipe" : "/poster/pipeline")}
            data-testid="matches-back-btn"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Matches</h1>
        </div>

        {isSeeker && items.length > 0 && statusCounts && (
          <div data-testid="matches-status-summary" className="flex gap-2 mb-4 overflow-x-auto pb-1">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 whitespace-nowrap">
              <Clock className="w-3 h-3" /> Pending: {statusCounts.pending}
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 whitespace-nowrap">
              <CheckCircle className="w-3 h-3" /> Matched: {statusCounts.matched}
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 whitespace-nowrap">
              <Gift className="w-3 h-3" /> Offers: {statusCounts.offer}
            </div>
          </div>
        )}

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
                    <ItemList items={items} selected={selected} isSeeker={isSeeker} onSelect={setSelected} />
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2 h-full flex flex-col">
                {selected ? (
                  <DetailPanel key={selected.id} item={selected} isSeeker={isSeeker} userId={user?.id} />
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

            {/* Mobile: full-screen toggle */}
            <div className="lg:hidden">
              {selected ? (
                <Card className="min-h-[calc(100vh-12rem)] flex flex-col">
                  <DetailPanel key={selected.id} item={selected} isSeeker={isSeeker} userId={user?.id} onBack={() => setSelected(null)} />
                </Card>
              ) : (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      {isSeeker ? "Your Applications" : "Conversations"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ItemList items={items} selected={selected} isSeeker={isSeeker} onSelect={setSelected} />
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
