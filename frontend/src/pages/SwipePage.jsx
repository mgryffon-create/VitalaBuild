import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { X, Heart, MapPin, Clock, DollarSign, Briefcase, Award, Star, CheckCircle, MessageCircle, Sparkles, ChevronUp, ChevronDown, User, FileText, Gift, Calendar, HelpCircle } from "lucide-react";
import VitalaIcon from "@/components/VitalaIcon";

const SwipePage = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [matchData, setMatchData] = useState(null);
  const [expandedCard, setExpandedCard] = useState(false);

  const isSeeker = user?.role === "seeker";

  const fetchCards = useCallback(async () => {
    try {
      let response;
      if (isSeeker) {
        response = await axios.get(`${API}/swipe/jobs`);
      } else {
        response = await axios.get(`${API}/swipe/seekers?job_id=${jobId}`);
      }
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

  const handleSwipe = async (direction) => {
    if (currentIndex >= cards.length || expandedCard) return;

    const card = cards[currentIndex];
    const action = direction === "right" ? "like" : direction === "down" ? "maybe" : "pass";

    try {
      let response;
      if (isSeeker) {
        response = await axios.post(`${API}/swipe`, {
          target_id: card.id,
          action: action
        });
      } else {
        response = await axios.post(`${API}/swipe?job_id=${jobId}`, {
          target_id: card.id,
          action: action
        });
      }

      if (response.data.matched) {
        setMatchData({
          ...response.data,
          card: card
        });
        setShowMatchDialog(true);
      }

      setCurrentIndex(prev => prev + 1);
      setExpandedCard(false);
    } catch (error) {
      toast.error("Failed to record swipe");
    }
  };

  const handleExpandToggle = () => {
    setExpandedCard(!expandedCard);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  const currentCard = cards[currentIndex];
  const isEmpty = !currentCard;

  return (
    <DashboardLayout>
      <div data-testid="swipe-page" className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            {isSeeker ? "Find Your Perfect Job" : "Review Candidates"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isSeeker
              ? "Swipe right on jobs you're interested in"
              : "Swipe right on candidates you'd like to match with"}
          </p>
        </div>

        {isEmpty ? (
          <div className="text-center py-16">
            <VitalaIcon className="w-24 h-24 mx-auto mb-4 opacity-50" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {isSeeker ? "No more jobs to show" : "No candidates to review"}
            </h2>
            <p className="text-muted-foreground mb-6">
              {isSeeker
                ? "Check back later for new opportunities"
                : "Wait for more job seekers to express interest"}
            </p>
            <Button
              data-testid="back-to-dashboard-btn"
              onClick={() => navigate(isSeeker ? "/seeker" : "/poster")}
              variant="outline"
            >
              Back to Dashboard
            </Button>
          </div>
        ) : (
          <>
            {/* Swipe up hint */}
            <div className="text-center mb-4">
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground"
              >
                <ChevronUp className="w-4 h-4" />
                <span>Swipe up for more details</span>
              </motion.div>
            </div>

            {/* Card Stack */}
            <div className="relative w-full max-w-md mx-auto mb-8" style={{ height: expandedCard ? "auto" : "550px" }}>
              <AnimatePresence>
                {cards.slice(currentIndex, currentIndex + 3).reverse().map((card, index) => {
                  const isTopCard = index === cards.slice(currentIndex, currentIndex + 3).length - 1;
                  return (
                    <SwipeCard
                      key={card.id}
                      card={card}
                      isSeeker={isSeeker}
                      isTop={isTopCard}
                      onSwipe={handleSwipe}
                      expanded={isTopCard && expandedCard}
                      onExpandToggle={isTopCard ? handleExpandToggle : undefined}
                      style={{
                        zIndex: index,
                        scale: 1 - (cards.slice(currentIndex, currentIndex + 3).length - 1 - index) * 0.05,
                        y: (cards.slice(currentIndex, currentIndex + 3).length - 1 - index) * 10
                      }}
                    />
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center gap-4">
              <Button
                data-testid="swipe-left-btn"
                size="lg"
                variant="outline"
                className="w-14 h-14 rounded-full border-2 border-destructive text-destructive hover:bg-destructive hover:text-white"
                onClick={() => handleSwipe("left")}
                disabled={expandedCard}
              >
                <X className="w-7 h-7" />
              </Button>
              <Button
                data-testid="swipe-maybe-btn"
                size="lg"
                variant="outline"
                className="w-14 h-14 rounded-full border-2 border-amber-500 text-amber-500 hover:bg-amber-500 hover:text-white"
                onClick={() => handleSwipe("down")}
                disabled={expandedCard}
                title="Maybe - Review Later"
              >
                <HelpCircle className="w-7 h-7" />
              </Button>
              <Button
                data-testid="expand-card-btn"
                size="lg"
                variant="outline"
                className={`w-14 h-14 rounded-full border-2 transition-colors ${
                  expandedCard 
                    ? "border-primary bg-primary text-white" 
                    : "border-primary text-primary hover:bg-primary hover:text-white"
                }`}
                onClick={handleExpandToggle}
              >
                {expandedCard ? <ChevronDown className="w-7 h-7" /> : <ChevronUp className="w-7 h-7" />}
              </Button>
              <Button
                data-testid="swipe-right-btn"
                size="lg"
                className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90 p-2"
                onClick={() => handleSwipe("right")}
                disabled={expandedCard}
              >
                <VitalaIcon className="w-8 h-8" />
              </Button>
            </div>
          </>
        )}

        {/* Match Dialog */}
        <Dialog open={showMatchDialog} onOpenChange={setShowMatchDialog}>
          <DialogContent className="sm:max-w-md text-center">
            <div className="py-6">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-secondary/20 flex items-center justify-center animate-pulse-ring">
                <Sparkles className="w-10 h-10 text-secondary" />
              </div>
              <DialogHeader>
                <DialogTitle className="text-2xl text-center">It&apos;s a Match!</DialogTitle>
                <DialogDescription className="text-center">
                  {isSeeker
                    ? `${matchData?.card?.company_name || "The employer"} is interested in you!`
                    : `You matched with ${matchData?.seeker?.full_name}!`}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-6 flex flex-col gap-3">
                <Button
                  data-testid="view-match-btn"
                  onClick={() => {
                    setShowMatchDialog(false);
                    navigate("/matches");
                  }}
                  className="bg-secondary hover:bg-secondary/90"
                >
                  <MessageCircle className="w-4 h-4 mr-2" /> Send Message
                </Button>
                <Button
                  data-testid="keep-swiping-btn"
                  variant="outline"
                  onClick={() => setShowMatchDialog(false)}
                >
                  Keep Swiping
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

// Enhanced Swipe Card Component with expand functionality
const SwipeCard = ({ card, isSeeker, isTop, onSwipe, style, expanded, onExpandToggle }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);
  
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [-100, 0], [1, 0]);
  const maybeOpacity = useTransform(y, [0, 100], [0, 1]);

  const handleDragEnd = (event, info) => {
    if (expanded) return;
    
    // Horizontal swipe
    if (Math.abs(info.offset.x) > Math.abs(info.offset.y)) {
      if (info.offset.x > 100) {
        onSwipe("right");
      } else if (info.offset.x < -100) {
        onSwipe("left");
      }
    } 
    // Vertical swipe
    else {
      // Swipe up to expand
      if (info.offset.y < -80 && onExpandToggle) {
        onExpandToggle();
      }
      // Swipe down for "maybe"
      else if (info.offset.y > 100) {
        onSwipe("down");
      }
    }
  };

  return (
    <motion.div
      className={`${expanded ? "relative" : "absolute"} w-full`}
      style={{
        x: isTop && !expanded ? x : 0,
        y: isTop && !expanded ? y : 0,
        rotate: isTop && !expanded ? rotate : 0,
        opacity,
        scale: style.scale,
        ...(expanded ? {} : { y: style.y }),
        zIndex: style.zIndex
      }}
      drag={isTop && !expanded ? true : false}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      onDragEnd={handleDragEnd}
      whileTap={!expanded ? { cursor: "grabbing" } : {}}
      layout
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <motion.div 
        className={`swipe-card w-full bg-card rounded-3xl shadow-xl border border-border overflow-hidden ${
          expanded ? "min-h-[700px]" : "h-[550px]"
        }`}
        layout
      >
        {/* Like/Nope/Maybe Indicators */}
        {isTop && !expanded && (
          <>
            <motion.div
              className="absolute top-8 right-8 z-10 px-4 py-2 rounded-lg border-4 border-secondary text-secondary font-bold text-2xl rotate-12"
              style={{ opacity: likeOpacity }}
            >
              LIKE
            </motion.div>
            <motion.div
              className="absolute top-8 left-8 z-10 px-4 py-2 rounded-lg border-4 border-destructive text-destructive font-bold text-2xl -rotate-12"
              style={{ opacity: nopeOpacity }}
            >
              NOPE
            </motion.div>
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 px-4 py-2 rounded-lg border-4 border-amber-500 text-amber-500 font-bold text-2xl"
              style={{ opacity: maybeOpacity }}
            >
              MAYBE
            </motion.div>
          </>
        )}

        {/* Card Content */}
        <div className="h-full flex flex-col">
          {/* Header with image or gradient */}
          <div className={`${expanded ? "h-56" : "h-44"} bg-gradient-to-br from-primary/20 to-secondary/20 relative flex-shrink-0 transition-all duration-300`}>
            {isSeeker && card.company_logo ? (
              <img src={card.company_logo} alt="" className="w-full h-full object-cover" />
            ) : !isSeeker && card.profile_image ? (
              <img src={card.profile_image} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {isSeeker ? (
                  <Briefcase className="w-16 h-16 text-primary/50" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-lg">
                    <span className="text-4xl font-bold text-primary">
                      {card.full_name?.charAt(0) || "?"}
                    </span>
                  </div>
                )}
              </div>
            )}
            
            {/* Compatibility Score */}
            <div className="absolute -bottom-6 right-6 score-ring bg-white rounded-full shadow-lg p-1">
              <svg className="w-14 h-14">
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="none"
                  stroke="hsl(var(--muted))"
                  strokeWidth="4"
                />
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="none"
                  stroke="hsl(var(--secondary))"
                  strokeWidth="4"
                  strokeDasharray={`${(card.compatibility_score || 0) * 1.5} 150`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="score-text text-secondary">{card.compatibility_score || 0}%</span>
            </div>

            {/* Expand indicator on card */}
            {isTop && !expanded && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                <motion.div
                  animate={{ y: [0, -3, 0] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="bg-white/90 backdrop-blur rounded-full px-3 py-1 shadow-md"
                >
                  <ChevronUp className="w-4 h-4 text-primary" />
                </motion.div>
              </div>
            )}
          </div>

          {/* Content - Scrollable when expanded */}
          <div className={`flex-1 ${expanded ? "overflow-hidden" : "overflow-y-auto"}`}>
            <ScrollArea className={expanded ? "h-[420px]" : "h-full"}>
              <div className="p-6 pt-8">
                {isSeeker ? (
                  // Job Card Content
                  <JobCardContent card={card} expanded={expanded} />
                ) : (
                  // Seeker Card Content
                  <SeekerCardContent card={card} expanded={expanded} />
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Collapse button when expanded */}
          {expanded && onExpandToggle && (
            <div className="p-4 border-t border-border">
              <Button
                data-testid="collapse-card-btn"
                variant="ghost"
                className="w-full"
                onClick={onExpandToggle}
              >
                <ChevronDown className="w-4 h-4 mr-2" /> Show Less
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// Job Card Content Component
const JobCardContent = ({ card, expanded }) => {
  return (
    <>
      {/* Title & Company */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-foreground">{card.title}</h2>
        <p className="text-muted-foreground flex items-center gap-1">
          <Briefcase className="w-4 h-4" />
          {card.company_name || "Healthcare Facility"}
        </p>
      </div>

      {/* Key Info Badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Badge variant="secondary" className="flex items-center gap-1">
          <MapPin className="w-3 h-3" /> {card.location}
        </Badge>
        <Badge variant="outline" className="flex items-center gap-1">
          <Clock className="w-3 h-3" /> {card.duration}
        </Badge>
        <Badge variant="outline" className="flex items-center gap-1">
          <DollarSign className="w-3 h-3" />
          ${card.pay_range?.min?.toLocaleString()} - ${card.pay_range?.max?.toLocaleString()}
        </Badge>
      </div>

      {/* Specialty & Experience */}
      <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-muted/50 rounded-xl">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Specialty</p>
          <p className="font-medium text-foreground">{card.specialty || "General"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Experience Req.</p>
          <p className="font-medium text-foreground">{card.experience_required || 0}+ years</p>
        </div>
      </div>

      {/* Brief Description (always visible) */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground font-medium mb-1">About This Role</p>
        <p className={`text-sm text-foreground ${expanded ? "" : "line-clamp-2"}`}>
          {card.description}
        </p>
      </div>

      {/* Benefits Preview (always visible) */}
      {card.benefits?.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1">
            <Gift className="w-4 h-4 text-secondary" /> Benefits Offered
          </p>
          <div className="flex flex-wrap gap-1">
            {card.benefits.slice(0, expanded ? card.benefits.length : 3).map((benefit, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                <CheckCircle className="w-3 h-3 mr-1" /> {benefit}
              </Badge>
            ))}
            {!expanded && card.benefits.length > 3 && (
              <Badge variant="outline" className="text-xs">+{card.benefits.length - 3} more</Badge>
            )}
          </div>
        </div>
      )}

      {/* Expanded Content */}
      {expanded && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4 pt-4 border-t border-border"
        >
          {/* Time Off Policy */}
          {card.time_off_policy && (
            <div>
              <p className="text-sm font-medium text-foreground mb-1 flex items-center gap-1">
                <Calendar className="w-4 h-4 text-primary" /> Time Off Policy
              </p>
              <p className="text-sm text-muted-foreground">{card.time_off_policy}</p>
            </div>
          )}

          {/* Requirements */}
          {card.requirements?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1">
                <FileText className="w-4 h-4 text-primary" /> Requirements
              </p>
              <ul className="space-y-1">
                {card.requirements.map((req, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-secondary flex-shrink-0 mt-0.5" />
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Required Certifications */}
          {card.certifications_required?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1">
                <Award className="w-4 h-4 text-primary" /> Required Certifications
              </p>
              <div className="flex flex-wrap gap-1">
                {card.certifications_required.map((cert, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    <Award className="w-3 h-3 mr-1" /> {cert}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Shift Type & Start Date */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-xl">
            {card.shift_type && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Shift Type</p>
                <p className="font-medium text-foreground">{card.shift_type}</p>
              </div>
            )}
            {card.start_date && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Start Date</p>
                <p className="font-medium text-foreground">{card.start_date}</p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </>
  );
};

// Seeker Card Content Component
const SeekerCardContent = ({ card, expanded }) => {
  return (
    <>
      {/* Name & Title */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-foreground">{card.full_name}</h2>
        <p className="text-muted-foreground flex items-center gap-1">
          <User className="w-4 h-4" />
          {card.specialty || "Medical Professional"}
        </p>
      </div>

      {/* Key Info Badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        {card.years_experience && (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Star className="w-3 h-3" /> {card.years_experience} years exp
          </Badge>
        )}
        {card.preferred_locations?.length > 0 && (
          <Badge variant="outline" className="flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {card.preferred_locations[0]}
          </Badge>
        )}
        {card.expected_pay?.min && (
          <Badge variant="outline" className="flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            ${card.expected_pay.min}/hr+
          </Badge>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-muted/50 rounded-xl">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Specialty</p>
          <p className="font-medium text-foreground">{card.specialty || "General"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Experience</p>
          <p className="font-medium text-foreground">{card.years_experience || 0} years</p>
        </div>
      </div>

      {/* Bio Preview */}
      {card.bio && (
        <div className="mb-4">
          <p className="text-sm text-muted-foreground font-medium mb-1">About</p>
          <p className={`text-sm text-foreground ${expanded ? "" : "line-clamp-2"}`}>
            {card.bio}
          </p>
        </div>
      )}

      {/* Certifications Preview */}
      {card.certifications?.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1">
            <Award className="w-4 h-4 text-secondary" /> Certifications
          </p>
          <div className="flex flex-wrap gap-1">
            {card.certifications.slice(0, expanded ? card.certifications.length : 3).map((cert, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                <Award className="w-3 h-3 mr-1" /> {cert.name || cert}
              </Badge>
            ))}
            {!expanded && card.certifications.length > 3 && (
              <Badge variant="secondary" className="text-xs">+{card.certifications.length - 3} more</Badge>
            )}
          </div>
        </div>
      )}

      {/* Expanded Content */}
      {expanded && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4 pt-4 border-t border-border"
        >
          {/* Licenses */}
          {card.licenses?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-primary" /> Active Licenses
              </p>
              <div className="flex flex-wrap gap-1">
                {card.licenses.map((lic, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {lic.name} ({lic.state})
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Desired Benefits */}
          {card.desired_benefits?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1">
                <Gift className="w-4 h-4 text-primary" /> Looking For
              </p>
              <div className="flex flex-wrap gap-1">
                {card.desired_benefits.map((benefit, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {benefit}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Preferred Locations (All) */}
          {card.preferred_locations?.length > 1 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1">
                <MapPin className="w-4 h-4 text-primary" /> Preferred Locations
              </p>
              <div className="flex flex-wrap gap-1">
                {card.preferred_locations.map((loc, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    <MapPin className="w-3 h-3 mr-1" /> {loc}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Pay Expectations */}
          {card.expected_pay && (
            <div className="p-3 bg-muted/50 rounded-xl">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Pay Expectations</p>
              <p className="font-medium text-foreground">
                ${card.expected_pay.min?.toLocaleString()} - ${card.expected_pay.max?.toLocaleString()}/hr
              </p>
            </div>
          )}

          {/* Contact Info (if available) */}
          {card.contact_info && (
            <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
              <p className="text-xs text-primary uppercase tracking-wide mb-2">Contact Information</p>
              {card.contact_info.email && (
                <p className="text-sm text-foreground">{card.contact_info.email}</p>
              )}
              {card.contact_info.phone && (
                <p className="text-sm text-muted-foreground">{card.contact_info.phone}</p>
              )}
            </div>
          )}
        </motion.div>
      )}
    </>
  );
};

export default SwipePage;
