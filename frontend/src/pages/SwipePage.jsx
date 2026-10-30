import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  X, Heart, MapPin, Clock, DollarSign, Briefcase, CheckCircle, Sparkles,
  ChevronDown, Award, Star, User, ExternalLink, Calendar, Home, Zap, RotateCcw
} from "lucide-react";

// ── Smart title generation ───────────────────────────────
function smartTitle(card) {
  // If title is generic/ID-like, generate from specialty + shift
  const title = card.title || "";
  const isGeneric = /test|posting|job\s*\d|^\d+$/i.test(title) || title.length < 5;

  if (!isGeneric) return title;

  // Build from specialty
  let parts = [];
  if (card.specialty) {
    // "Registered Nurse (RN) - ICU/Critical Care" → "ICU RN"
    const match = card.specialty.match(/\(([^)]+)\)\s*-\s*(.+)/);
    if (match) {
      parts.push(`${match[2].trim()} ${match[1].trim()}`);
    } else {
      const simple = card.specialty.match(/\(([^)]+)\)/);
      parts.push(simple ? simple[1] : card.specialty);
    }
  } else {
    parts.push("Healthcare Position");
  }

  if (card.shift_type) {
    parts[0] += ` – ${card.shift_type}`;
  }

  return parts[0];
}

// ── Format pay for display ───────────────────────────────
function formatWeeklyPay(card) {
  // Prefer structured weekly_pay if available
  if (card.weekly_pay > 0) return `$${card.weekly_pay.toLocaleString()}/week`;
  // Fallback to pay_range (backward compat)
  const { min, max } = card.pay_range || {};
  if (!min && !max) return null;
  if (min > 200) return `$${min.toLocaleString()}/week`; // Already weekly
  if (min > 0) return `$${(min * 36).toLocaleString()}/week`; // Hourly → weekly estimate
  return null;
}

function formatPayBreakdown(card) {
  const parts = [];
  if (card.base_rate > 0) parts.push(`$${card.base_rate}/hr`);
  if (card.weekly_stipend > 0) parts.push(`$${card.weekly_stipend} stipend`);
  if (card.overtime_rate > 0) parts.push(`OT: $${card.overtime_rate}/hr`);
  if (parts.length > 0) return parts.join(" + ");
  // Fallback
  const { min } = card.pay_range || {};
  if (min > 0 && min <= 200) return `$${min}/hr base`;
  return null;
}

// ── Human-readable date formatting ───────────────────────
function formatStartDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr + (dateStr.includes("T") ? "" : "T00:00:00"));
    const month = d.toLocaleString("en-US", { month: "short" });
    const day = d.getDate();
    return `${month} ${day}`;
  } catch {
    return dateStr;
  }
}

function matchLabel(card) {
  const tier = card.match_tier;
  if (tier === "strong") return { text: "Strong Match", cls: "text-green-600 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" };
  if (tier === "possible") return { text: "Possible Match", cls: "text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800" };
  if (tier === "expanded") return { text: "Expanded", cls: "text-muted-foreground bg-muted/50 border-muted-foreground/20" };
  // Fallback for poster-side cards (no tier)
  const score = card.compatibility_score;
  if (!score || score <= 0) return null;
  if (score >= 70) return { text: "Strong Match", cls: "text-green-600 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" };
  if (score >= 40) return { text: "Possible Match", cls: "text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800" };
  return null;
}

const SwipePage = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [matchData, setMatchData] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [lastSwipedIndex, setLastSwipedIndex] = useState(null);
  const [hasHidden, setHasHidden] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const isSeeker = user?.role === "seeker";

  const fetchCards = useCallback(async (expand = false) => {
    try {
      if (isSeeker) {
        const response = await axios.get(`${API}/swipe/jobs${expand ? "?expand=true" : ""}`);
        const data = response.data;
        setCards(data.jobs || []);
        setHasHidden(data.has_hidden || false);
      } else {
        const response = await axios.get(`${API}/swipe/seekers?job_id=${jobId}`);
        setCards(response.data);
      }
    } catch {
      toast.error("Failed to load cards");
    } finally {
      setLoading(false);
    }
  }, [isSeeker, jobId]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const handleExpandSearch = async () => {
    setIsExpanded(true);
    setLoading(true);
    await fetchCards(true);
  };

  const handleAction = async (action) => {
    if (currentIndex >= cards.length) return;
    const card = cards[currentIndex];
    try {
      const response = isSeeker
        ? await axios.post(`${API}/swipe`, { target_id: card.id, action })
        : await axios.post(`${API}/swipe?job_id=${jobId}`, { target_id: card.id, action });

      if (response.data.matched) {
        setMatchData({ ...response.data, card });
        setShowMatchDialog(true);
      } else if (response.data.pending) {
        toast.success("Interest saved — match pending", { description: "Add your essential documents and role details to open the conversation." });
      } else if (action === "like") {
        toast.success("Marked as interested!", {
          description: isSeeker ? `${smartTitle(card)} — ${card.company_name || "Facility"}` : card.full_name,
        });
      }
      setLastSwipedIndex(currentIndex);
      setCurrentIndex((prev) => prev + 1);
      setExpanded(false);
    } catch {
      toast.error("Failed to record action");
    }
  };

  const handleRewind = () => {
    if (lastSwipedIndex !== null && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setLastSwipedIndex(null);
      toast("Rewound to previous card", { description: "Take another look" });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const currentCard = cards[currentIndex];
  const remaining = cards.length - currentIndex;

  return (
    <DashboardLayout>
      <div data-testid="swipe-page" className="max-w-lg lg:max-w-2xl mx-auto">
        {isSeeker && <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm mb-4"><p className="font-medium">Explore now. Finish setup when you’re ready.</p><p className="text-muted-foreground text-xs mt-1">Save jobs you’re interested in. Essential uploads and an eligible role are needed before a match can open.</p><button className="text-primary text-xs underline mt-2" onClick={() => window.location.assign("/seeker/profile?step=medical")}>Add essential documents</button></div>}
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              {isSeeker ? "Find Jobs" : "Review Candidates"}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {remaining > 0 ? `${remaining} remaining` : "All caught up"}
            </p>
          </div>
        </div>

        {!currentCard ? (
          <div className="text-center py-20">
            <Briefcase className="w-16 h-16 mx-auto mb-4 text-muted-foreground/40" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {isSeeker
                ? (hasHidden && !isExpanded ? "No more top matches" : "No more jobs right now")
                : "No candidates to review"}
            </h2>
            <p className="text-muted-foreground mb-6">
              {isSeeker && hasHidden && !isExpanded
                ? "We've shown your strongest results. Expand to see more options."
                : "Check back later for new opportunities."}
            </p>
            <div className="flex flex-col items-center gap-3">
              {isSeeker && hasHidden && !isExpanded && (
                <Button data-testid="expand-search-btn" onClick={handleExpandSearch} variant="default">
                  Expand Search
                </Button>
              )}
              <Button data-testid="back-to-dashboard-btn" variant="outline" onClick={() => navigate(isSeeker ? "/seeker" : "/poster")}>
                Back to Dashboard
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Wrapper: on desktop, flex column with reserved action bar space */}
            {/* Wrapper: normal flow on all sizes — card stacks into actions */}
            <div>

            {/* Card Stack */}
            <div
              className="relative w-full pb-28 sm:pb-4 lg:pb-0"
              style={{ height: expanded ? "auto" : undefined, minHeight: expanded ? undefined : "min(380px, calc(100vh - 320px))" }}
            >
              <AnimatePresence>
                {cards.slice(currentIndex, currentIndex + 3).reverse().map((card, idx) => {
                  const stackLen = Math.min(3, cards.length - currentIndex);
                  const isTop = idx === stackLen - 1;
                  return (
                    <JobCard
                      key={card.id}
                      card={card}
                      isSeeker={isSeeker}
                      isTop={isTop}
                      expanded={isTop && expanded}
                      onExpand={() => setExpanded(!expanded)}
                      onSwipe={handleAction}
                      stackOffset={stackLen - 1 - idx}
                    />
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Action Buttons */}
            <div data-testid="swipe-actions" className="fixed bottom-20 left-0 right-0 z-50 sm:static sm:bottom-auto sm:z-auto sm:mt-5 lg:mt-6 lg:shrink-0 lg:py-2">
              <div className="flex justify-center items-center gap-3 lg:gap-5 px-6 py-3 sm:py-0 bg-background/90 backdrop-blur-md sm:bg-transparent sm:backdrop-blur-none">
                {/* Rewind */}
                <div className="flex flex-col items-center">
                  <Button
                    data-testid="rewind-btn"
                    size="lg"
                    variant="outline"
                    className={`w-10 h-10 lg:w-12 lg:h-12 rounded-full border-2 transition-all ${lastSwipedIndex !== null ? "border-blue-400 text-blue-500 hover:bg-blue-50" : "border-muted-foreground/20 text-muted-foreground/30 cursor-not-allowed"}`}
                    onClick={handleRewind}
                    disabled={lastSwipedIndex === null || expanded}
                  >
                    <RotateCcw className="w-4 h-4 lg:w-5 lg:h-5" />
                  </Button>
                  <span className="text-[10px] lg:text-xs text-muted-foreground mt-1">Undo</span>
                </div>
                <div className="flex flex-col items-center">
                  <Button
                    data-testid="pass-btn"
                    size="lg"
                    variant="outline"
                    className="w-14 h-14 sm:w-16 sm:h-16 lg:w-[4.5rem] lg:h-[4.5rem] rounded-full border-2 border-destructive/40 text-destructive hover:bg-destructive hover:text-white active:scale-90 transition-all"
                    onClick={() => handleAction("pass")}
                    disabled={expanded}
                  >
                    <X className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8" />
                  </Button>
                  <span className="text-[10px] lg:text-xs text-muted-foreground mt-1">Pass</span>
                </div>
                <div className="flex flex-col items-center">
                  <Button
                    data-testid="expand-btn"
                    size="lg"
                    variant="outline"
                    className={`w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-full border-2 transition-all ${
                      expanded
                        ? "border-primary bg-primary text-white"
                        : "border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary"
                    }`}
                    onClick={() => setExpanded(!expanded)}
                  >
                    <ChevronDown className={`w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 transition-transform ${expanded ? "" : "rotate-180"}`} />
                  </Button>
                  <span className="text-[10px] lg:text-xs text-muted-foreground mt-1">Details</span>
                </div>
                <div className="flex flex-col items-center">
                  <Button
                    data-testid="interested-btn"
                    size="lg"
                    className="w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] lg:w-20 lg:h-20 rounded-full bg-green-500 hover:bg-green-600 text-white active:scale-90 transition-all shadow-xl shadow-green-500/30"
                    onClick={() => handleAction("like")}
                    disabled={expanded}
                  >
                    <Heart className="w-7 h-7 lg:w-9 lg:h-9" />
                  </Button>
                  <span className="text-[10px] lg:text-xs font-semibold text-green-600 mt-1">Interested</span>
                </div>
              </div>
            </div>
            </div>{/* Close lg:flex wrapper */}
          </>
        )}

        {/* Match Dialog */}
        <Dialog open={showMatchDialog} onOpenChange={setShowMatchDialog}>
          <DialogContent className="sm:max-w-md text-center">
            <div className="py-6">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-green-500" />
              </div>
              <DialogHeader>
                <DialogTitle className="text-2xl text-center">It&apos;s a Match!</DialogTitle>
                <DialogDescription className="text-center">
                  {isSeeker
                    ? `${matchData?.card?.company_name || "The employer"} is also interested in you!`
                    : `You matched with ${matchData?.seeker?.full_name}!`}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-6 flex flex-col gap-3">
                <Button data-testid="view-match-btn" onClick={() => { setShowMatchDialog(false); navigate("/matches"); }}>
                  View Match
                </Button>
                <Button variant="outline" data-testid="keep-swiping-btn" onClick={() => setShowMatchDialog(false)}>
                  Keep Looking
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

/* ── Job Card ─────────────────────────────────────────────── */
const JobCard = ({ card, isSeeker, isTop, expanded, onExpand, onSwipe, stackOffset }) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const likeOpacity = useTransform(x, [0, 80], [0, 1]);
  const passOpacity = useTransform(x, [-80, 0], [1, 0]);

  const handleDragEnd = (_, info) => {
    if (expanded) return;
    if (info.offset.x > 100) onSwipe("like");
    else if (info.offset.x < -100) onSwipe("pass");
    else if (info.offset.y < -80 && onExpand) onExpand();
  };

  return (
    <motion.div
      className={`${expanded ? "relative" : "absolute"} w-full`}
      style={{
        x: isTop && !expanded ? x : 0,
        rotate: isTop && !expanded ? rotate : 0,
        scale: 1 - stackOffset * 0.035,
        y: expanded ? 0 : stackOffset * 10,
        zIndex: 10 - stackOffset,
        opacity: stackOffset >= 2 ? 0.5 : 1,
      }}
      drag={isTop && !expanded}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      onDragEnd={handleDragEnd}
      layout
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className={`bg-card rounded-2xl shadow-lg border border-border overflow-hidden ${stackOffset > 0 ? "shadow-md" : "shadow-xl lg:shadow-2xl"} ${expanded ? "" : "h-[min(420px,calc(100vh-320px))] sm:h-[440px] lg:h-[min(400px,calc(100vh-340px))]"}`}>
        {/* Swipe indicators */}
        {isTop && !expanded && (
          <>
            <motion.div className="absolute top-6 right-6 z-10 px-3 py-1.5 rounded-lg bg-green-500 text-white font-bold text-lg rotate-12" style={{ opacity: likeOpacity }}>
              INTERESTED
            </motion.div>
            <motion.div className="absolute top-6 left-6 z-10 px-3 py-1.5 rounded-lg bg-destructive text-white font-bold text-lg -rotate-12" style={{ opacity: passOpacity }}>
              PASS
            </motion.div>
          </>
        )}

        {/* Card body */}
        <div className={`${expanded ? "" : "overflow-y-auto h-full"}`}>
          {isSeeker ? (
            <SeekerViewContent card={card} expanded={expanded} />
          ) : (
            <PosterViewContent card={card} expanded={expanded} />
          )}
        </div>

        {expanded && (
          <div className="px-5 pb-4">
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={onExpand}>
              <ChevronDown className="w-4 h-4 mr-1" /> Show less
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

/* ── Card content: seeker sees a job (DECISION-FIRST) ──────── */
const SeekerViewContent = ({ card, expanded }) => {
  const title = smartTitle(card);
  const weeklyPay = formatWeeklyPay(card);
  const breakdown = formatPayBreakdown(card);
  const match = matchLabel(card);
  const hasExp = card.experience_required > 0;
  const reasons = card.match_reasons || [];

  return (
    <div>
      {/* Top tinted section */}
      <div className="px-5 pt-5 pb-4 lg:px-7 lg:pt-7 lg:pb-5 bg-gradient-to-b from-green-50/60 to-transparent dark:from-green-900/10 dark:to-transparent">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {weeklyPay && (
              <p data-testid="job-pay" className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-green-600 tracking-tight leading-none">{weeklyPay}</p>
            )}
            {breakdown && <p className="text-xs lg:text-sm text-muted-foreground mt-0.5">{breakdown}</p>}
            <h2 data-testid="job-title" className={`font-bold text-foreground leading-tight ${weeklyPay ? "text-base lg:text-lg mt-2" : "text-xl lg:text-2xl"}`}>{title}</h2>
            <p className="text-sm lg:text-base text-muted-foreground mt-0.5">{card.company_name || "Healthcare Facility"}</p>
          </div>
          {match && (
            <div data-testid="match-tier-badge" className={`shrink-0 px-2.5 py-1.5 lg:px-3 lg:py-2 rounded-lg border text-center ${match.cls}`}>
              <span className="text-xs lg:text-sm font-bold">{match.text}</span>
            </div>
          )}
        </div>
        {/* Why this job — reason line */}
        {reasons.length > 0 && (
          <div data-testid="match-reasons" className="mt-2 lg:mt-3 flex flex-wrap gap-x-3 gap-y-0.5">
            {reasons.map((r, i) => (
              <span key={i} className="text-xs lg:text-sm text-muted-foreground flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-primary/60 shrink-0" />{r}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="px-5 pb-5 lg:px-7 lg:pb-6">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="w-3.5 h-3.5 shrink-0" /><span>{card.location || "Location TBD"}</span>
        </div>
        {/* Primary chips — decision-critical */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {card.shift_type && <Badge className="text-xs gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0"><Clock className="w-3 h-3" /> {card.shift_type}</Badge>}
          {card.duration && <Badge variant="secondary" className="text-xs gap-1"><Calendar className="w-3 h-3" /> {card.duration}</Badge>}
          {card.start_date && <Badge variant="secondary" className="text-xs gap-1">Starts {formatStartDate(card.start_date)}</Badge>}
        </div>
        {/* Secondary chips — supporting context */}
        {(card.weekly_hours || (card.stipend && card.stipend !== "Not included") || hasExp || card.certifications_required?.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {card.weekly_hours && <Badge variant="outline" className="text-xs text-muted-foreground font-normal">{card.weekly_hours} hrs/week</Badge>}
            {card.stipend && card.stipend !== "Not included" && <Badge variant="outline" className="text-xs text-muted-foreground font-normal gap-1"><Home className="w-3 h-3" /> {card.stipend}</Badge>}
            {hasExp && <Badge variant="outline" className="text-xs text-muted-foreground font-normal">{card.experience_required}+ yrs exp</Badge>}
            {card.certifications_required?.length > 0 && <Badge variant="outline" className="text-xs text-muted-foreground font-normal gap-1"><Award className="w-3 h-3" /> {card.certifications_required.join(", ")}</Badge>}
          </div>
        )}
        {card.description && !expanded && <p className="text-xs text-muted-foreground/70 mt-3 leading-relaxed line-clamp-1">{card.description}</p>}
        {expanded && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 space-y-4">
            {card.description && <p className="text-sm text-muted-foreground leading-relaxed">{card.description}</p>}
            {card.benefits?.length > 0 && (<div><p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Benefits</p><div className="flex flex-wrap gap-1.5">{card.benefits.map((b, i) => <Badge key={i} variant="secondary" className="text-xs"><CheckCircle className="w-3 h-3 mr-1" />{b}</Badge>)}</div></div>)}
            {card.requirements?.length > 0 && (<div><p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Requirements</p><ul className="space-y-1">{card.requirements.map((r, i) => <li key={i} className="text-sm text-muted-foreground flex items-start gap-2"><CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" /> {r}</li>)}</ul></div>)}
            {card.time_off_policy && (<div className="px-3 py-2 bg-muted/50 rounded-lg"><p className="text-[11px] text-muted-foreground uppercase tracking-wide">Time Off</p><p className="text-sm font-medium text-foreground">{card.time_off_policy}</p></div>)}
          </motion.div>
        )}
        {card.application_workflow_type && card.application_workflow_type !== "in_platform_only" && (
          <div className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              {card.application_workflow_type === "external_required_immediately" && "External application required"}
              {card.application_workflow_type === "external_required_after_match" && "External application after match"}
              {card.application_workflow_type === "external_optional" && "External application optional"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Card content: poster sees a seeker ────────────────────── */
const PosterViewContent = ({ card, expanded }) => (
  <div className="p-5">
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        {/* Pay expectation — prominent */}
        {card.expected_pay?.min > 0 && (
          <p className="text-2xl font-extrabold text-foreground tracking-tight leading-none">
            ${card.expected_pay.min}/hr{card.expected_pay.max > card.expected_pay.min ? `–$${card.expected_pay.max}/hr` : "+"}
          </p>
        )}
        <h2 className={`font-bold text-foreground leading-tight ${card.expected_pay?.min > 0 ? "text-base mt-1.5" : "text-xl"}`}>
          {card.full_name}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">{card.specialty || "Medical Professional"}</p>
      </div>
      {card.compatibility_score > 0 && (
        <div className="shrink-0 flex flex-col items-center rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-2.5 py-1.5">
          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          <span className="text-sm font-bold text-amber-700 dark:text-amber-400">{card.compatibility_score}%</span>
          <span className="text-[9px] text-amber-600/70">match</span>
        </div>
      )}
    </div>

    <div className="flex flex-wrap gap-1.5 mt-3">
      {card.years_experience > 0 && (
        <Badge variant="secondary" className="text-xs gap-1">
          <Star className="w-3 h-3" /> {card.years_experience} yrs
        </Badge>
      )}
      {card.preferred_locations?.[0] && (
        <Badge variant="secondary" className="text-xs gap-1">
          <MapPin className="w-3 h-3" /> {card.preferred_locations[0]}
        </Badge>
      )}
      {card.availability && (
        <Badge variant="outline" className="text-xs gap-1">
          <Zap className="w-3 h-3" /> {card.availability}
        </Badge>
      )}
      {card.preferred_shift && (
        <Badge variant="outline" className="text-xs gap-1">
          <Clock className="w-3 h-3" /> {card.preferred_shift}
        </Badge>
      )}
    </div>

    {card.experience_highlights?.length > 0 && (
      <div className="mt-3 space-y-1">
        {card.experience_highlights.slice(0, expanded ? 5 : 2).map((h, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
            <span className="line-clamp-1">{h}</span>
          </div>
        ))}
      </div>
    )}

    {card.bio && (
      <p className={`text-sm text-muted-foreground mt-3 leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
        {card.bio}
      </p>
    )}

    {expanded && (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 space-y-4">
        {card.skills?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {card.skills.slice(0, 8).map((s, i) => (
                <Badge key={i} variant="outline" className="text-xs">{typeof s === "string" ? s : s?.name || ""}</Badge>
              ))}
            </div>
          </div>
        )}
        {card.certifications?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Certifications</p>
            <div className="flex flex-wrap gap-1.5">
              {card.certifications.map((c, i) => (
                <Badge key={i} variant="secondary" className="text-xs"><Award className="w-3 h-3 mr-1" />{c.name || c}</Badge>
              ))}
            </div>
          </div>
        )}
        {card.licenses?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Licenses</p>
            <div className="flex flex-wrap gap-1.5">
              {card.licenses.map((l, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{l.name} ({l.state})</Badge>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    )}
  </div>
);

export default SwipePage;
