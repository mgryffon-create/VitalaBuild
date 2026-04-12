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
import { X, Heart, MapPin, Clock, DollarSign, Briefcase, CheckCircle, MessageCircle, Sparkles, ChevronUp, ChevronDown, Award, Star, User, FileText, ExternalLink } from "lucide-react";

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

  const isSeeker = user?.role === "seeker";

  const fetchCards = useCallback(async () => {
    try {
      const response = isSeeker
        ? await axios.get(`${API}/swipe/jobs`)
        : await axios.get(`${API}/swipe/seekers?job_id=${jobId}`);
      setCards(response.data);
    } catch (error) {
      toast.error("Failed to load cards");
    } finally {
      setLoading(false);
    }
  }, [isSeeker, jobId]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

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
      } else if (action === "like") {
        toast.success("Interest sent!");
      }

      setCurrentIndex((prev) => prev + 1);
      setExpanded(false);
    } catch (error) {
      toast.error("Failed to record action");
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
      <div data-testid="swipe-page" className="max-w-lg mx-auto">
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
          /* Empty State */
          <div className="text-center py-20">
            <Briefcase className="w-16 h-16 mx-auto mb-4 text-muted-foreground/40" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {isSeeker ? "No more jobs right now" : "No candidates to review"}
            </h2>
            <p className="text-muted-foreground mb-6">Check back later for new opportunities.</p>
            <Button
              data-testid="back-to-dashboard-btn"
              variant="outline"
              onClick={() => navigate(isSeeker ? "/seeker" : "/poster")}
            >
              Back to Dashboard
            </Button>
          </div>
        ) : (
          <>
            {/* Card Stack */}
            <div className="relative w-full mb-4 sm:mb-6" style={{ minHeight: expanded ? "auto" : "min(420px, calc(100vh - 280px))" }}>
              <AnimatePresence>
                {cards.slice(currentIndex, currentIndex + 2).reverse().map((card, idx) => {
                  const stackLen = Math.min(2, cards.length - currentIndex);
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
            <div className="flex justify-center gap-6">
              <Button
                data-testid="pass-btn"
                size="lg"
                variant="outline"
                className="w-16 h-16 rounded-full border-2 border-destructive/60 text-destructive hover:bg-destructive hover:text-white transition-all"
                onClick={() => handleAction("pass")}
                disabled={expanded}
              >
                <X className="w-7 h-7" />
              </Button>
              <Button
                data-testid="expand-btn"
                size="lg"
                variant="outline"
                className={`w-12 h-12 rounded-full border-2 self-center transition-all ${
                  expanded
                    ? "border-primary bg-primary text-white"
                    : "border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary"
                }`}
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
              </Button>
              <Button
                data-testid="interested-btn"
                size="lg"
                className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 text-white transition-all shadow-lg shadow-green-500/20"
                onClick={() => handleAction("like")}
                disabled={expanded}
              >
                <Heart className="w-7 h-7" />
              </Button>
            </div>

            {/* Labels */}
            <div className="flex justify-center gap-6 mt-2">
              <span className="text-xs text-muted-foreground w-16 text-center">Pass</span>
              <span className="text-xs text-muted-foreground w-12 text-center">Details</span>
              <span className="text-xs text-muted-foreground w-16 text-center">Interested</span>
            </div>
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
                <Button
                  data-testid="view-match-btn"
                  onClick={() => { setShowMatchDialog(false); navigate("/matches"); }}
                  className="bg-green-500 hover:bg-green-600"
                >
                  <MessageCircle className="w-4 h-4 mr-2" /> Send Message
                </Button>
                <Button
                  data-testid="keep-browsing-btn"
                  variant="outline"
                  onClick={() => setShowMatchDialog(false)}
                >
                  Keep Browsing
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
        scale: 1 - stackOffset * 0.04,
        y: expanded ? 0 : stackOffset * 8,
        zIndex: 10 - stackOffset,
      }}
      drag={isTop && !expanded}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      onDragEnd={handleDragEnd}
      layout
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className={`bg-card rounded-2xl shadow-lg border border-border overflow-hidden ${expanded ? "" : "h-[min(420px,calc(100vh-280px))] sm:h-[520px]"}`}>
        {/* Swipe indicators */}
        {isTop && !expanded && (
          <>
            <motion.div
              className="absolute top-6 right-6 z-10 px-3 py-1.5 rounded-lg bg-green-500 text-white font-bold text-lg rotate-12"
              style={{ opacity: likeOpacity }}
            >
              INTERESTED
            </motion.div>
            <motion.div
              className="absolute top-6 left-6 z-10 px-3 py-1.5 rounded-lg bg-destructive text-white font-bold text-lg -rotate-12"
              style={{ opacity: passOpacity }}
            >
              PASS
            </motion.div>
          </>
        )}

        {/* Header gradient */}
        <div className="h-28 bg-gradient-to-br from-primary/15 via-primary/5 to-secondary/10 relative flex items-center justify-center">
          {isSeeker ? (
            <Briefcase className="w-12 h-12 text-primary/40" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-white shadow flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">{card.full_name?.charAt(0) || "?"}</span>
            </div>
          )}
          {card.compatibility_score > 0 && (
            <div className="absolute bottom-2 right-4 bg-white/90 backdrop-blur rounded-full px-2.5 py-1 shadow-sm flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span className="text-xs font-semibold text-foreground">{card.compatibility_score}% fit</span>
            </div>
          )}
        </div>

        {/* Card body */}
        <div className={`p-4 sm:p-5 ${expanded ? "" : "overflow-y-auto"}`} style={expanded ? {} : { maxHeight: "calc(100% - 112px)" }}>
          {isSeeker ? (
            <SeekerViewContent card={card} expanded={expanded} />
          ) : (
            <PosterViewContent card={card} expanded={expanded} />
          )}
        </div>

        {/* Collapse footer */}
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

/* ── Card content: seeker sees a job ───────────────────────── */
const SeekerViewContent = ({ card, expanded }) => (
  <>
    <h2 className="text-lg font-bold text-foreground leading-tight">{card.title}</h2>
    <p className="text-sm text-muted-foreground mt-0.5">{card.company_name || "Healthcare Facility"}</p>

    <div className="flex flex-wrap gap-1.5 mt-3">
      <Badge variant="secondary" className="text-xs gap-1">
        <MapPin className="w-3 h-3" /> {card.location}
      </Badge>
      {card.pay_range?.min && (
        <Badge variant="outline" className="text-xs gap-1">
          <DollarSign className="w-3 h-3" />
          ${card.pay_range.min.toLocaleString()}-${card.pay_range.max?.toLocaleString()}
        </Badge>
      )}
      {card.duration && (
        <Badge variant="outline" className="text-xs gap-1">
          <Clock className="w-3 h-3" /> {card.duration}
        </Badge>
      )}
    </div>

    <div className="grid grid-cols-2 gap-2 mt-4 p-3 bg-muted/50 rounded-xl text-sm">
      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Specialty</p>
        <p className="font-medium text-foreground">{card.specialty || "General"}</p>
      </div>
      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Experience</p>
        <p className="font-medium text-foreground">{card.experience_required || 0}+ yrs</p>
      </div>
    </div>

    {card.description && (
      <p className={`text-sm text-muted-foreground mt-4 leading-relaxed ${expanded ? "" : "line-clamp-3"}`}>
        {card.description}
      </p>
    )}

    {expanded && (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 space-y-4">
        {card.benefits?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Benefits</p>
            <div className="flex flex-wrap gap-1.5">
              {card.benefits.map((b, i) => (
                <Badge key={i} variant="secondary" className="text-xs"><CheckCircle className="w-3 h-3 mr-1" />{b}</Badge>
              ))}
            </div>
          </div>
        )}
        {card.requirements?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Requirements</p>
            <ul className="space-y-1">
              {card.requirements.map((r, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" /> {r}
                </li>
              ))}
            </ul>
          </div>
        )}
        {card.certifications_required?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Certifications</p>
            <div className="flex flex-wrap gap-1.5">
              {card.certifications_required.map((c, i) => (
                <Badge key={i} variant="outline" className="text-xs"><Award className="w-3 h-3 mr-1" />{c}</Badge>
              ))}
            </div>
          </div>
        )}
        {(card.shift_type || card.start_date) && (
          <div className="grid grid-cols-2 gap-2 p-3 bg-muted/50 rounded-xl text-sm">
            {card.shift_type && (
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Shift</p>
                <p className="font-medium text-foreground">{card.shift_type}</p>
              </div>
            )}
            {card.start_date && (
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Start Date</p>
                <p className="font-medium text-foreground">{card.start_date}</p>
              </div>
            )}
          </div>
        )}
      </motion.div>
    )}

    {/* External application notice */}
    {card.application_workflow_type && card.application_workflow_type !== "in_platform_only" && (
      <div className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
        <p className="text-xs font-medium text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
          {card.application_workflow_type === "external_required_immediately" && "External application required"}
          {card.application_workflow_type === "external_required_after_match" && "External application required after match"}
          {card.application_workflow_type === "external_optional" && "External application may be requested"}
        </p>
        {card.application_workflow_type === "external_required_immediately" && card.external_application_url && (
          <a href={card.external_application_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-1 inline-block">
            Apply externally
          </a>
        )}
      </div>
    )}
  </>
);

/* ── Card content: poster sees a seeker ────────────────────── */
const PosterViewContent = ({ card, expanded }) => (
  <>
    <h2 className="text-lg font-bold text-foreground leading-tight">{card.full_name}</h2>
    <p className="text-sm text-muted-foreground mt-0.5">{card.specialty || "Medical Professional"}</p>

    <div className="flex flex-wrap gap-1.5 mt-3">
      {card.years_experience && (
        <Badge variant="secondary" className="text-xs gap-1">
          <Star className="w-3 h-3" /> {card.years_experience} yrs exp
        </Badge>
      )}
      {card.preferred_locations?.[0] && (
        <Badge variant="outline" className="text-xs gap-1">
          <MapPin className="w-3 h-3" /> {card.preferred_locations[0]}
        </Badge>
      )}
      {card.expected_pay?.min && (
        <Badge variant="outline" className="text-xs gap-1">
          <DollarSign className="w-3 h-3" /> ${card.expected_pay.min}/hr+
        </Badge>
      )}
    </div>

    {card.bio && (
      <p className={`text-sm text-muted-foreground mt-4 leading-relaxed ${expanded ? "" : "line-clamp-3"}`}>
        {card.bio}
      </p>
    )}

    {expanded && (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 space-y-4">
        {card.certifications?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Certifications</p>
            <div className="flex flex-wrap gap-1.5">
              {card.certifications.map((c, i) => (
                <Badge key={i} variant="outline" className="text-xs"><Award className="w-3 h-3 mr-1" />{c.name || c}</Badge>
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
  </>
);

export default SwipePage;
