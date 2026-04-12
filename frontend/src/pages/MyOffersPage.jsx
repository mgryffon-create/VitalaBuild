import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Briefcase, DollarSign, Calendar, Clock, MapPin, CheckCircle,
  XCircle, AlertCircle, Stethoscope, ArrowRight,
} from "lucide-react";

const STATUS_CONFIG = {
  pending:  { label: "Pending",  className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200" },
  accepted: { label: "Accepted", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200" },
  rejected: { label: "Declined", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200" },
  expired:  { label: "Expired",  className: "bg-muted text-muted-foreground border-border" },
  withdrawn:{ label: "Withdrawn",className: "bg-muted text-muted-foreground border-border" },
};

const MyOffersPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewOffer, setReviewOffer] = useState(null);
  const [responseNotes, setResponseNotes] = useState("");
  const [responding, setResponding] = useState(false);

  const fetchOffers = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/hiring/offers`);
      setOffers(res.data);
    } catch {
      toast.error("Failed to load offers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOffers(); }, [fetchOffers]);

  const handleRespond = async (accepted) => {
    if (!reviewOffer) return;
    setResponding(true);
    try {
      await axios.put(`${API}/hiring/offers/${reviewOffer.id}/respond`, {
        accepted,
        notes: responseNotes,
      });
      toast.success(accepted ? "Offer accepted!" : "Offer declined");
      setReviewOffer(null);
      setResponseNotes("");
      fetchOffers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to respond");
    } finally {
      setResponding(false);
    }
  };

  const pendingCount = offers.filter((o) => o.status === "pending").length;

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
      <div data-testid="offers-page" className="space-y-4 sm:space-y-6 max-w-4xl">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Offers</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {offers.length === 0
              ? "No offers yet — keep finding jobs!"
              : `${offers.length} offer${offers.length !== 1 ? "s" : ""} received`}
          </p>
        </div>

        {/* Pending alert */}
        {pendingCount > 0 && (
          <Alert className="border-amber-400 bg-amber-50 dark:bg-amber-900/10">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-amber-700 dark:text-amber-400">
              You have <strong>{pendingCount}</strong> pending offer{pendingCount !== 1 ? "s" : ""} awaiting your response.
            </AlertDescription>
          </Alert>
        )}

        {/* Empty state */}
        {offers.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Briefcase className="w-14 h-14 mx-auto mb-4 text-muted-foreground/40" />
              <h2 className="text-lg font-semibold text-foreground mb-2">No offers yet</h2>
              <p className="text-sm text-muted-foreground mb-6">
                When an employer sends you an offer it will appear here.
              </p>
              <Button
                data-testid="find-jobs-offers-btn"
                variant="outline"
                onClick={() => navigate("/seeker/swipe")}
              >
                Find Jobs <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {offers.map((offer) => {
              const cfg = STATUS_CONFIG[offer.status] || STATUS_CONFIG.pending;
              const isPending = offer.status === "pending";

              return (
                <Card
                  key={offer.id}
                  data-testid={`offer-card-${offer.id}`}
                  className={`transition-colors ${isPending ? "border-amber-300 dark:border-amber-700" : ""}`}
                >
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-col gap-3">
                      {/* Left — details */}
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-base sm:text-lg text-foreground">{offer.position_title}</h3>
                          <Badge variant="outline" className={`text-[10px] ${cfg.className}`}>{cfg.label}</Badge>
                        </div>

                        <p className="text-sm text-muted-foreground">
                          {offer.company_name || "Healthcare Facility"}
                        </p>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                          {offer.job?.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 shrink-0" /> {offer.job.location}
                            </span>
                          )}
                          {offer.salary_amount > 0 && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3.5 h-3.5 shrink-0" />
                              ${offer.salary_amount.toLocaleString()} / {offer.salary_type || "hr"}
                            </span>
                          )}
                          {offer.start_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 shrink-0" />
                              Start: {new Date(offer.start_date).toLocaleDateString()}
                            </span>
                          )}
                          {offer.job?.specialty && (
                            <span className="flex items-center gap-1">
                              <Stethoscope className="w-3.5 h-3.5 shrink-0" /> {offer.job.specialty}
                            </span>
                          )}
                        </div>

                        {offer.benefits_summary && (
                          <p className="text-sm text-muted-foreground leading-relaxed">{offer.benefits_summary}</p>
                        )}

                        {offer.conditions?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {offer.conditions.map((c, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>
                            ))}
                          </div>
                        )}

                        {isPending && offer.expiration_date && (
                          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 mt-1">
                            <Clock className="w-3.5 h-3.5" />
                            Expires {new Date(offer.expiration_date).toLocaleDateString()}
                          </div>
                        )}

                        {offer.status === "accepted" && offer.responded_at && (
                          <p className="text-xs text-green-600 dark:text-green-400">
                            Accepted on {new Date(offer.responded_at).toLocaleDateString()}
                          </p>
                        )}
                        {offer.status === "rejected" && offer.responded_at && (
                          <p className="text-xs text-red-500">
                            Declined on {new Date(offer.responded_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>

                      {/* Right — actions */}
                      {isPending && (
                        <div className="flex gap-2 shrink-0 self-start">
                          <Button
                            data-testid={`decline-offer-${offer.id}`}
                            variant="outline"
                            className="border-destructive/40 text-destructive hover:bg-destructive hover:text-white"
                            onClick={() => {
                              setReviewOffer(offer);
                            }}
                          >
                            <XCircle className="w-4 h-4 mr-1" /> Decline
                          </Button>
                          <Button
                            data-testid={`accept-offer-${offer.id}`}
                            className="bg-green-500 hover:bg-green-600 text-white"
                            onClick={() => {
                              setReviewOffer(offer);
                            }}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" /> Accept
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Review / Respond Dialog */}
      <Dialog open={!!reviewOffer} onOpenChange={() => { setReviewOffer(null); setResponseNotes(""); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Offer</DialogTitle>
            <DialogDescription>
              {reviewOffer?.position_title} at {reviewOffer?.company_name || "Healthcare Facility"}
            </DialogDescription>
          </DialogHeader>

          {reviewOffer && (
            <div className="space-y-4 py-2">
              {/* Offer summary */}
              <div className="p-4 bg-muted rounded-xl space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Pay Rate</p>
                    <p className="font-medium text-foreground">
                      ${reviewOffer.salary_amount?.toLocaleString()} / {reviewOffer.salary_type || "hr"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Start Date</p>
                    <p className="font-medium text-foreground">
                      {reviewOffer.start_date ? new Date(reviewOffer.start_date).toLocaleDateString() : "TBD"}
                    </p>
                  </div>
                </div>
                {reviewOffer.benefits_summary && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Benefits</p>
                    <p className="text-sm text-foreground">{reviewOffer.benefits_summary}</p>
                  </div>
                )}
                {reviewOffer.conditions?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Conditions</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {reviewOffer.conditions.map((c, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{c}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Expiration warning */}
              {reviewOffer.expiration_date && (
                <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-900/10">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <AlertDescription className="text-amber-600 dark:text-amber-400 text-sm">
                    This offer expires on {new Date(reviewOffer.expiration_date).toLocaleDateString()}
                  </AlertDescription>
                </Alert>
              )}

              {/* Notes */}
              <div>
                <Label>Notes for employer (optional)</Label>
                <Textarea
                  data-testid="offer-response-notes"
                  value={responseNotes}
                  onChange={(e) => setResponseNotes(e.target.value)}
                  placeholder="Any message for the employer..."
                  className="mt-1"
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              data-testid="dialog-decline-btn"
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive hover:text-white"
              onClick={() => handleRespond(false)}
              disabled={responding}
            >
              <XCircle className="w-4 h-4 mr-1" /> Decline
            </Button>
            <Button
              data-testid="dialog-accept-btn"
              className="bg-green-500 hover:bg-green-600 text-white"
              onClick={() => handleRespond(true)}
              disabled={responding}
            >
              <CheckCircle className="w-4 h-4 mr-1" /> {responding ? "Processing..." : "Accept Offer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default MyOffersPage;
