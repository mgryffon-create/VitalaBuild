import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { PageHeader } from "@/components/PageHeader";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Briefcase, DollarSign, Calendar, Clock, MapPin, CheckCircle,
  XCircle, AlertCircle, Stethoscope, ArrowRight, ShieldAlert, AlertTriangle, Info,
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
  const [typedSignature, setTypedSignature] = useState("");
  const [responding, setResponding] = useState(false);
  const [conflicts, setConflicts] = useState(null);
  const [conflictsLoading, setConflictsLoading] = useState(false);

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

  const openReview = async (offer) => {
    setReviewOffer(offer);
    setResponseNotes("");
    setConflicts(null);
    if (offer.status === "pending") {
      setConflictsLoading(true);
      try {
        const res = await axios.get(`${API}/hiring/offers/${offer.id}/conflicts`);
        setConflicts(res.data);
      } catch {
        setConflicts(null);
      } finally {
        setConflictsLoading(false);
      }
    }
  };

  const closeReview = () => {
    setReviewOffer(null);
    setResponseNotes("");
    setTypedSignature("");
    setConflicts(null);
  };

  const handleRespond = async (accepted) => {
    if (!reviewOffer) return;
    if (accepted && (!typedSignature || typedSignature.trim().length < 2)) {
      toast.error("Please type your full legal name to accept this offer");
      return;
    }
    setResponding(true);
    try {
      await axios.put(`${API}/hiring/offers/${reviewOffer.id}/respond`, {
        accepted,
        notes: responseNotes,
        typed_signature: accepted ? typedSignature.trim() : null,
      });
      toast.success(accepted ? "Offer accepted!" : "Offer declined");
      closeReview();
      fetchOffers();
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (error.response?.status === 409 && typeof detail === "object") {
        toast.error("Cannot accept — conflicts with existing assignment");
        setConflicts({
          has_hard_block: true,
          hard_blocks: detail.hard_blocks || [],
          soft_warnings: detail.soft_warnings || [],
        });
      } else {
        toast.error(typeof detail === "string" ? detail : "Failed to respond");
      }
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
        <PageHeader title="Offers" backTo="/matches" subtitle={
          offers.length === 0 ? "No offers yet — keep finding jobs!" : `${offers.length} offer${offers.length !== 1 ? "s" : ""} received`
        } />

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
                            onClick={() => openReview(offer)}
                          >
                            <XCircle className="w-4 h-4 mr-1" /> Decline
                          </Button>
                          <Button
                            data-testid={`accept-offer-${offer.id}`}
                            className="bg-green-500 hover:bg-green-600 text-white"
                            onClick={() => openReview(offer)}
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
      <Dialog open={!!reviewOffer} onOpenChange={closeReview}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Offer</DialogTitle>
            <DialogDescription>
              {reviewOffer?.position_title} at {reviewOffer?.company_name || "Healthcare Facility"}
            </DialogDescription>
          </DialogHeader>

          {reviewOffer && (
            <div className="space-y-4 py-2">
              {/* Conflict alerts */}
              {conflictsLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                  Checking for scheduling conflicts...
                </div>
              )}

              {conflicts?.has_hard_block && (
                <Alert data-testid="conflict-hard-block" className="border-red-400 bg-red-50 dark:bg-red-900/10">
                  <ShieldAlert className="h-4 w-4 text-red-500" />
                  <AlertDescription className="text-red-700 dark:text-red-400">
                    <p className="font-semibold mb-1.5">This offer conflicts with an existing assignment</p>
                    <ul className="space-y-1">
                      {conflicts.hard_blocks.map((b, i) => (
                        <li key={i} className="text-sm flex items-start gap-1.5">
                          <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {b}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {conflicts && !conflicts.has_hard_block && conflicts.soft_warnings?.length > 0 && (
                <Alert data-testid="conflict-soft-warning" className="border-amber-400 bg-amber-50 dark:bg-amber-900/10">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <AlertDescription className="text-amber-700 dark:text-amber-400">
                    <p className="font-semibold mb-1.5">Review before accepting</p>
                    <ul className="space-y-1">
                      {conflicts.soft_warnings.map((w, i) => (
                        <li key={i} className="text-sm flex items-start gap-1.5">
                          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {w}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {conflicts?.existing_assignments?.length > 0 && (
                <div data-testid="existing-assignments" className="p-3 bg-muted/50 rounded-lg space-y-1.5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Your Active Assignments</p>
                  {conflicts.existing_assignments.map((a, i) => (
                    <div key={i} className="text-sm text-foreground flex items-center gap-2">
                      <Briefcase className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium">{a.title}</span>
                      {a.location && <span className="text-muted-foreground">· {a.location}</span>}
                      {a.end && <span className="text-muted-foreground">· ends {new Date(a.end).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                      {!a.end && <span className="text-amber-600 text-xs">· ongoing</span>}
                    </div>
                  ))}
                </div>
              )}
              {/* Offer summary — structured sections */}
              <div className="space-y-4">
                {/* Pay & Schedule */}
                <div className="p-4 bg-muted rounded-xl space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pay & Schedule</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pay Rate</p>
                      <p className="font-semibold text-foreground text-base">
                        ${reviewOffer.salary_amount?.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">/ {reviewOffer.salary_type || "hr"}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Start Date</p>
                      <p className="font-medium text-foreground">
                        {reviewOffer.start_date ? new Date(reviewOffer.start_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "TBD"}
                      </p>
                    </div>
                    {reviewOffer.shift_details && (
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Shift</p>
                        <p className="font-medium text-foreground">{reviewOffer.shift_details}</p>
                      </div>
                    )}
                    {reviewOffer.contract_length && (
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Contract</p>
                        <p className="font-medium text-foreground">{reviewOffer.contract_length}</p>
                      </div>
                    )}
                    {reviewOffer.overtime_rate > 0 && (
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Overtime</p>
                        <p className="font-medium text-foreground">${reviewOffer.overtime_rate}/hr</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Compensation extras */}
                {(reviewOffer.sign_on_bonus > 0 || reviewOffer.completion_bonus > 0 || reviewOffer.housing_stipend > 0 || reviewOffer.travel_stipend > 0 || reviewOffer.approved_time_off) && (
                  <div className="p-4 bg-green-50/50 dark:bg-green-950/10 rounded-xl border border-green-100 dark:border-green-900/30 space-y-2">
                    <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">Compensation Extras</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {reviewOffer.sign_on_bonus > 0 && (
                        <div className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-green-600" /><span>Sign-on: <strong>${reviewOffer.sign_on_bonus.toLocaleString()}</strong></span></div>
                      )}
                      {reviewOffer.completion_bonus > 0 && (
                        <div className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-green-600" /><span>Completion: <strong>${reviewOffer.completion_bonus.toLocaleString()}</strong></span></div>
                      )}
                      {reviewOffer.housing_stipend > 0 && (
                        <div className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-green-600" /><span>Housing: <strong>${reviewOffer.housing_stipend.toLocaleString()}/mo</strong></span></div>
                      )}
                      {reviewOffer.travel_stipend > 0 && (
                        <div className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-green-600" /><span>Travel: <strong>${reviewOffer.travel_stipend.toLocaleString()}</strong></span></div>
                      )}
                    </div>
                    {reviewOffer.approved_time_off && (
                      <p className="text-sm text-foreground flex items-center gap-1.5 mt-1"><Clock className="w-3.5 h-3.5 text-green-600" /> PTO: {reviewOffer.approved_time_off}</p>
                    )}
                  </div>
                )}

                {/* Benefits */}
                {reviewOffer.benefits_summary && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Benefits</p>
                    <p className="text-sm text-foreground">{reviewOffer.benefits_summary}</p>
                  </div>
                )}

                {/* Conditions */}
                {reviewOffer.conditions?.length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Conditions</p>
                    <div className="flex flex-wrap gap-1.5">
                      {reviewOffer.conditions.map((c, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{c}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom notes from employer */}
                {reviewOffer.custom_notes && (
                  <div className="p-3 bg-blue-50/50 dark:bg-blue-950/10 rounded-lg border border-blue-100 dark:border-blue-900/30">
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">Note from Employer</p>
                    <p className="text-sm text-foreground">{reviewOffer.custom_notes}</p>
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

              {/* Typed Signature for acceptance */}
              {reviewOffer?.status === "pending" && (
                <div data-testid="typed-signature-section" className="p-4 bg-muted/50 rounded-lg border space-y-2">
                  <Label className="text-xs font-semibold">Electronic Signature</Label>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    By typing your full legal name below, you agree to the terms of this offer and authorize VitalaMatch to process your acceptance.
                  </p>
                  <Input
                    data-testid="typed-signature-input"
                    value={typedSignature}
                    onChange={(e) => setTypedSignature(e.target.value)}
                    placeholder="Type your full legal name"
                    className="h-10 text-base font-medium italic"
                    autoComplete="name"
                  />
                </div>
              )}
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
              className={conflicts?.has_hard_block
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-green-500 hover:bg-green-600 text-white"}
              onClick={() => handleRespond(true)}
              disabled={responding || conflictsLoading || conflicts?.has_hard_block}
            >
              {conflicts?.has_hard_block ? (
                <><ShieldAlert className="w-4 h-4 mr-1" /> Blocked</>
              ) : (
                <><CheckCircle className="w-4 h-4 mr-1" /> {responding ? "Processing..." : "Accept Offer"}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default MyOffersPage;
