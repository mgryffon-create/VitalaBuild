import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { X, Heart, MapPin, Clock, DollarSign, Briefcase, Award, Star, CheckCircle, MessageCircle, Sparkles } from "lucide-react";

const SwipePage = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [matchData, setMatchData] = useState(null);

  const isSeeker = user?.role === "seeker";

  useEffect(() => {
    fetchCards();
  }, [jobId]);

  const fetchCards = async () => {
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
  };

  const handleSwipe = async (direction) => {
    if (currentIndex >= cards.length) return;

    const card = cards[currentIndex];
    const action = direction === "right" ? "like" : "pass";

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
    } catch (error) {
      toast.error("Failed to record swipe");
    }
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
        <div className="text-center mb-8">
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
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
              {isSeeker ? (
                <Briefcase className="w-12 h-12 text-muted-foreground" />
              ) : (
                <Heart className="w-12 h-12 text-muted-foreground" />
              )}
            </div>
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
            {/* Card Stack */}
            <div className="relative w-full max-w-md h-[550px] mx-auto mb-8">
              {cards.slice(currentIndex, currentIndex + 3).reverse().map((card, index) => (
                <SwipeCard
                  key={card.id}
                  card={card}
                  isSeeker={isSeeker}
                  isTop={index === cards.slice(currentIndex, currentIndex + 3).length - 1}
                  onSwipe={handleSwipe}
                  style={{
                    zIndex: index,
                    scale: 1 - (cards.slice(currentIndex, currentIndex + 3).length - 1 - index) * 0.05,
                    y: (cards.slice(currentIndex, currentIndex + 3).length - 1 - index) * 10
                  }}
                />
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center gap-6">
              <Button
                data-testid="swipe-left-btn"
                size="lg"
                variant="outline"
                className="w-16 h-16 rounded-full border-2 border-destructive text-destructive hover:bg-destructive hover:text-white"
                onClick={() => handleSwipe("left")}
              >
                <X className="w-8 h-8" />
              </Button>
              <Button
                data-testid="swipe-right-btn"
                size="lg"
                className="w-16 h-16 rounded-full bg-secondary hover:bg-secondary/90"
                onClick={() => handleSwipe("right")}
              >
                <Heart className="w-8 h-8" />
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
                <DialogTitle className="text-2xl text-center">It's a Match!</DialogTitle>
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

// Swipe Card Component with Framer Motion
const SwipeCard = ({ card, isSeeker, isTop, onSwipe, style }) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);
  
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [-100, 0], [1, 0]);

  const handleDragEnd = (event, info) => {
    if (info.offset.x > 100) {
      onSwipe("right");
    } else if (info.offset.x < -100) {
      onSwipe("left");
    }
  };

  return (
    <motion.div
      className="absolute w-full h-full"
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        opacity,
        scale: style.scale,
        y: style.y,
        zIndex: style.zIndex
      }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      whileTap={{ cursor: "grabbing" }}
    >
      <div className="swipe-card w-full h-full bg-card rounded-3xl shadow-xl border border-border overflow-hidden">
        {/* Like/Nope Indicators */}
        {isTop && (
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
          </>
        )}

        {/* Card Content */}
        <div className="h-full flex flex-col">
          {/* Header with image or gradient */}
          <div className="h-48 bg-gradient-to-br from-primary/20 to-secondary/20 relative">
            {isSeeker && card.company_logo ? (
              <img src={card.company_logo} alt="" className="w-full h-full object-cover" />
            ) : !isSeeker && card.profile_image ? (
              <img src={card.profile_image} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {isSeeker ? (
                  <Briefcase className="w-16 h-16 text-primary/50" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center">
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
          </div>

          {/* Content */}
          <div className="flex-1 p-6 pt-8 overflow-y-auto">
            {isSeeker ? (
              // Job Card Content
              <>
                <h2 className="text-xl font-bold text-foreground">{card.title}</h2>
                <p className="text-muted-foreground">{card.company_name || "Healthcare Facility"}</p>
                
                <div className="flex flex-wrap gap-2 mt-4">
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
                
                <p className="text-sm text-muted-foreground mt-4 line-clamp-3">
                  {card.description}
                </p>
                
                {card.benefits?.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-foreground mb-2">Benefits</p>
                    <div className="flex flex-wrap gap-1">
                      {card.benefits.slice(0, 4).map((benefit, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" /> {benefit}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              // Seeker Card Content
              <>
                <h2 className="text-xl font-bold text-foreground">{card.full_name}</h2>
                <p className="text-muted-foreground">{card.specialty || "Medical Professional"}</p>
                
                <div className="flex flex-wrap gap-2 mt-4">
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
                </div>
                
                {card.bio && (
                  <p className="text-sm text-muted-foreground mt-4 line-clamp-3">
                    {card.bio}
                  </p>
                )}
                
                {card.certifications?.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-foreground mb-2">Certifications</p>
                    <div className="flex flex-wrap gap-1">
                      {card.certifications.slice(0, 4).map((cert, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          <Award className="w-3 h-3 mr-1" /> {cert.name || cert}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SwipePage;
