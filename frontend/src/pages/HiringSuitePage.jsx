import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { 
  Briefcase, Send, FileText, Users, Clock, CheckCircle, XCircle, 
  AlertCircle, Plus, Trash2, Eye, Download, Upload, Star, Building
} from "lucide-react";

const HiringSuitePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("offers");
  const [offers, setOffers] = useState([]);
  const [employments, setEmployments] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [showOfferDialog, setShowOfferDialog] = useState(false);
  const [showPolicyDialog, setShowPolicyDialog] = useState(false);
  const [showOnboardingDialog, setShowOnboardingDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [selectedEmployment, setSelectedEmployment] = useState(null);
  const [selectedReviewTarget, setSelectedReviewTarget] = useState(null);
  
  // Form states
  const [offerForm, setOfferForm] = useState({
    match_id: "",
    job_id: "",
    seeker_id: "",
    position_title: "",
    salary_amount: "",
    salary_type: "annual",
    start_date: "",
    expiration_date: "",
    conditions: [],
    benefits_summary: "",
    additional_terms: ""
  });
  
  const [policyForm, setPolicyForm] = useState({
    title: "",
    description: "",
    file_data: "",
    file_name: "",
    requires_signature: true,
    version: "1.0"
  });
  
  const [reviewForm, setReviewForm] = useState({
    employment_id: "",
    rating: 5,
    communication_rating: 5,
    professionalism_rating: 5,
    reliability_rating: 5,
    review_text: "",
    would_recommend: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [offersRes, employmentsRes, policiesRes, reviewsRes, matchesRes] = await Promise.all([
        axios.get(`${API}/hiring/offers`),
        axios.get(`${API}/hiring/employments`),
        axios.get(`${API}/hiring/policies`),
        axios.get(`${API}/hiring/reviews/pending`),
        axios.get(`${API}/matches`)
      ]);
      setOffers(offersRes.data);
      setEmployments(employmentsRes.data);
      setPolicies(policiesRes.data);
      setPendingReviews(reviewsRes.data);
      setMatches(matchesRes.data);
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOffer = async () => {
    try {
      const conditions = offerForm.conditions.length > 0 
        ? offerForm.conditions 
        : ["Background check", "Drug screening", "License verification"];
      
      await axios.post(`${API}/hiring/offers`, {
        ...offerForm,
        salary_amount: parseFloat(offerForm.salary_amount),
        conditions
      });
      toast.success("Offer sent successfully!");
      setShowOfferDialog(false);
      setOfferForm({
        match_id: "", job_id: "", seeker_id: "", position_title: "",
        salary_amount: "", salary_type: "annual", start_date: "",
        expiration_date: "", conditions: [], benefits_summary: "", additional_terms: ""
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send offer");
    }
  };

  const handleWithdrawOffer = async (offerId) => {
    if (!confirm("Are you sure you want to withdraw this offer?")) return;
    try {
      await axios.delete(`${API}/hiring/offers/${offerId}`);
      toast.success("Offer withdrawn");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to withdraw offer");
    }
  };

  const handleUploadPolicy = async () => {
    try {
      await axios.post(`${API}/hiring/policies`, policyForm);
      toast.success("Policy uploaded successfully!");
      setShowPolicyDialog(false);
      setPolicyForm({ title: "", description: "", file_data: "", file_name: "", requires_signature: true, version: "1.0" });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to upload policy");
    }
  };

  const handleDeletePolicy = async (policyId) => {
    if (!confirm("Are you sure you want to delete this policy?")) return;
    try {
      await axios.delete(`${API}/hiring/policies/${policyId}`);
      toast.success("Policy deleted");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete policy");
    }
  };

  const handleSubmitReview = async () => {
    try {
      await axios.post(`${API}/hiring/reviews`, reviewForm);
      toast.success("Review submitted!");
      setShowReviewDialog(false);
      setReviewForm({
        employment_id: "", rating: 5, communication_rating: 5,
        professionalism_rating: 5, reliability_rating: 5,
        review_text: "", would_recommend: true
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to submit review");
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        setPolicyForm(prev => ({ ...prev, file_data: base64, file_name: file.name }));
      };
      reader.readAsDataURL(file);
    }
  };

  const selectMatchForOffer = (match) => {
    setOfferForm(prev => ({
      ...prev,
      match_id: match.id,
      job_id: match.job_id,
      seeker_id: match.seeker_id,
      position_title: match.job?.title || ""
    }));
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-yellow-100 text-yellow-800",
      accepted: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
      withdrawn: "bg-gray-100 text-gray-800",
      expired: "bg-orange-100 text-orange-800",
      onboarding: "bg-blue-100 text-blue-800",
      active: "bg-green-100 text-green-800",
      completed: "bg-purple-100 text-purple-800"
    };
    return <Badge className={styles[status] || "bg-gray-100"}>{status}</Badge>;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Hiring Suite</h1>
            <p className="text-muted-foreground">Manage offers, onboarding, and employee relations</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="offers">Offers ({offers.length})</TabsTrigger>
            <TabsTrigger value="onboarding">Onboarding ({employments.filter(e => e.status === 'onboarding').length})</TabsTrigger>
            <TabsTrigger value="policies">Policies ({policies.length})</TabsTrigger>
            <TabsTrigger value="reviews">Reviews ({pendingReviews.length})</TabsTrigger>
          </TabsList>

          {/* OFFERS TAB */}
          <TabsContent value="offers" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setShowOfferDialog(true)}>
                <Plus className="w-4 h-4 mr-2" /> Send Offer
              </Button>
            </div>
            
            {offers.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Briefcase className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No offers sent yet</p>
                  <Button className="mt-4" onClick={() => setShowOfferDialog(true)}>
                    Send Your First Offer
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {offers.map((offer) => (
                  <Card key={offer.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{offer.position_title}</h3>
                            {getStatusBadge(offer.status)}
                          </div>
                          <p className="text-muted-foreground">To: {offer.seeker?.full_name}</p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                            <span>${offer.salary_amount.toLocaleString()} / {offer.salary_type}</span>
                            <span>Start: {new Date(offer.start_date).toLocaleDateString()}</span>
                            <span>Expires: {new Date(offer.expiration_date).toLocaleDateString()}</span>
                          </div>
                        </div>
                        {offer.status === "pending" && (
                          <Button variant="outline" size="sm" onClick={() => handleWithdrawOffer(offer.id)}>
                            <XCircle className="w-4 h-4 mr-1" /> Withdraw
                          </Button>
                        )}
                      </div>
                      {offer.conditions?.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-medium mb-2">Conditions:</p>
                          <div className="flex flex-wrap gap-2">
                            {offer.conditions.map((cond, i) => (
                              <Badge key={i} variant="outline">{cond}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ONBOARDING TAB */}
          <TabsContent value="onboarding" className="space-y-4">
            {employments.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No active employments</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {employments.map((emp) => (
                  <Card key={emp.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{emp.position_title}</h3>
                            {getStatusBadge(emp.status)}
                          </div>
                          <p className="text-muted-foreground">{emp.seeker?.full_name}</p>
                          <p className="text-sm text-muted-foreground">Start Date: {new Date(emp.start_date).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground mb-1">Onboarding Progress</p>
                          <Progress value={emp.onboarding_progress} className="w-32" />
                          <p className="text-sm font-medium mt-1">{emp.onboarding_progress}%</p>
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => {
                          setSelectedEmployment(emp);
                          setShowOnboardingDialog(true);
                        }}>
                          <Eye className="w-4 h-4 mr-1" /> View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* POLICIES TAB */}
          <TabsContent value="policies" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setShowPolicyDialog(true)}>
                <Upload className="w-4 h-4 mr-2" /> Upload Policy
              </Button>
            </div>
            
            {policies.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No policies uploaded yet</p>
                  <Button className="mt-4" onClick={() => setShowPolicyDialog(true)}>
                    Upload Your First Policy
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {policies.map((policy) => (
                  <Card key={policy.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{policy.title}</h3>
                          <p className="text-sm text-muted-foreground">{policy.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline">v{policy.version}</Badge>
                            {policy.requires_signature && (
                              <Badge variant="secondary">Signature Required</Badge>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleDeletePolicy(policy.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* REVIEWS TAB */}
          <TabsContent value="reviews" className="space-y-4">
            {pendingReviews.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Star className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No pending reviews</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {pendingReviews.map((item) => (
                  <Card key={item.employment_id}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{item.position_title}</h3>
                          <p className="text-muted-foreground">Employee: {item.other_party?.full_name}</p>
                          <p className="text-sm text-muted-foreground">{item.days_employed} days employed</p>
                        </div>
                        <Button onClick={() => {
                          setSelectedReviewTarget(item);
                          setReviewForm(prev => ({ ...prev, employment_id: item.employment_id }));
                          setShowReviewDialog(true);
                        }}>
                          <Star className="w-4 h-4 mr-1" /> Leave Review
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Send Offer Dialog */}
        <Dialog open={showOfferDialog} onOpenChange={setShowOfferDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Send Employment Offer</DialogTitle>
              <DialogDescription>Create a conditional job offer for a matched candidate</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Select Match</Label>
                <Select value={offerForm.match_id} onValueChange={(v) => {
                  const match = matches.find(m => m.id === v);
                  if (match) selectMatchForOffer(match);
                }}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a matched candidate" />
                  </SelectTrigger>
                  <SelectContent>
                    {matches.map((match) => (
                      <SelectItem key={match.id} value={match.id}>
                        {match.seeker?.full_name} - {match.job?.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Position Title</Label>
                  <Input
                    value={offerForm.position_title}
                    onChange={(e) => setOfferForm(prev => ({ ...prev, position_title: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Salary Type</Label>
                  <Select value={offerForm.salary_type} onValueChange={(v) => setOfferForm(prev => ({ ...prev, salary_type: v }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="annual">Annual</SelectItem>
                      <SelectItem value="hourly">Hourly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Salary Amount ($)</Label>
                <Input
                  type="number"
                  value={offerForm.salary_amount}
                  onChange={(e) => setOfferForm(prev => ({ ...prev, salary_amount: e.target.value }))}
                  placeholder="75000"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={offerForm.start_date}
                    onChange={(e) => setOfferForm(prev => ({ ...prev, start_date: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Offer Expiration</Label>
                  <Input
                    type="date"
                    value={offerForm.expiration_date}
                    onChange={(e) => setOfferForm(prev => ({ ...prev, expiration_date: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>Benefits Summary</Label>
                <Textarea
                  value={offerForm.benefits_summary}
                  onChange={(e) => setOfferForm(prev => ({ ...prev, benefits_summary: e.target.value }))}
                  placeholder="Health insurance, 401k, PTO..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Additional Terms</Label>
                <Textarea
                  value={offerForm.additional_terms}
                  onChange={(e) => setOfferForm(prev => ({ ...prev, additional_terms: e.target.value }))}
                  placeholder="Any additional terms or conditions..."
                  className="mt-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowOfferDialog(false)}>Cancel</Button>
              <Button onClick={handleCreateOffer} disabled={!offerForm.match_id || !offerForm.salary_amount}>
                <Send className="w-4 h-4 mr-1" /> Send Offer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Upload Policy Dialog */}
        <Dialog open={showPolicyDialog} onOpenChange={setShowPolicyDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Policy Document</DialogTitle>
              <DialogDescription>Upload company handbooks, arbitration agreements, etc.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Title</Label>
                <Input
                  value={policyForm.title}
                  onChange={(e) => setPolicyForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Employee Handbook"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={policyForm.description}
                  onChange={(e) => setPolicyForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of this policy document"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Version</Label>
                <Input
                  value={policyForm.version}
                  onChange={(e) => setPolicyForm(prev => ({ ...prev, version: e.target.value }))}
                  placeholder="1.0"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Document File (PDF)</Label>
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="mt-1"
                />
                {policyForm.file_name && (
                  <p className="text-sm text-muted-foreground mt-1">Selected: {policyForm.file_name}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="requires_signature"
                  checked={policyForm.requires_signature}
                  onChange={(e) => setPolicyForm(prev => ({ ...prev, requires_signature: e.target.checked }))}
                />
                <Label htmlFor="requires_signature">Requires employee signature</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPolicyDialog(false)}>Cancel</Button>
              <Button onClick={handleUploadPolicy} disabled={!policyForm.title || !policyForm.file_data}>
                <Upload className="w-4 h-4 mr-1" /> Upload
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Onboarding Details Dialog */}
        <Dialog open={showOnboardingDialog} onOpenChange={setShowOnboardingDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Onboarding Details</DialogTitle>
              <DialogDescription>{selectedEmployment?.seeker?.full_name} - {selectedEmployment?.position_title}</DialogDescription>
            </DialogHeader>
            <OnboardingDetails employment={selectedEmployment} onRefresh={fetchData} />
          </DialogContent>
        </Dialog>

        {/* Review Dialog */}
        <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Leave a Review</DialogTitle>
              <DialogDescription>Review your experience with {selectedReviewTarget?.other_party?.full_name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Overall Rating</Label>
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setReviewForm(prev => ({ ...prev, rating: star }))}
                      className={`p-1 ${reviewForm.rating >= star ? 'text-yellow-500' : 'text-gray-300'}`}
                    >
                      <Star className="w-6 h-6 fill-current" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm">Communication</Label>
                  <Select value={String(reviewForm.communication_rating)} onValueChange={(v) => setReviewForm(prev => ({ ...prev, communication_rating: parseInt(v) }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Professionalism</Label>
                  <Select value={String(reviewForm.professionalism_rating)} onValueChange={(v) => setReviewForm(prev => ({ ...prev, professionalism_rating: parseInt(v) }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Reliability</Label>
                  <Select value={String(reviewForm.reliability_rating)} onValueChange={(v) => setReviewForm(prev => ({ ...prev, reliability_rating: parseInt(v) }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Written Review</Label>
                <Textarea
                  value={reviewForm.review_text}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, review_text: e.target.value }))}
                  placeholder="Share your experience..."
                  className="mt-1"
                  rows={4}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="would_recommend"
                  checked={reviewForm.would_recommend}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, would_recommend: e.target.checked }))}
                />
                <Label htmlFor="would_recommend">I would recommend working with this person</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReviewDialog(false)}>Cancel</Button>
              <Button onClick={handleSubmitReview} disabled={!reviewForm.review_text}>
                Submit Review
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

// Onboarding Details Component
const OnboardingDetails = ({ employment, onRefresh }) => {
  const [checklist, setChecklist] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOnboardingData = useCallback(async () => {
    try {
      const [checklistRes, docsRes] = await Promise.all([
        axios.get(`${API}/hiring/onboarding/${employment.id}`),
        axios.get(`${API}/hiring/documents/${employment.id}`)
      ]);
      setChecklist(checklistRes.data);
      setDocuments(docsRes.data);
    } catch (error) {
      console.error("Failed to fetch onboarding data");
    } finally {
      setLoading(false);
    }
  }, [employment?.id]);

  useEffect(() => {
    if (employment?.id) {
      fetchOnboardingData();
    }
  }, [employment?.id, fetchOnboardingData]);

  const handleReviewDocument = async (docId, approved) => {
    try {
      await axios.put(`${API}/hiring/documents/${docId}/review?approved=${approved}`);
      toast.success(approved ? "Document approved" : "Document rejected");
      fetchOnboardingData();
      onRefresh();
    } catch (error) {
      toast.error("Failed to review document");
    }
  };

  if (loading) {
    return <div className="py-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-semibold mb-3">Checklist Items</h4>
        <div className="space-y-2">
          {checklist?.items?.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                {item.status === "completed" ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <Clock className="w-5 h-5 text-yellow-500" />
                )}
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
              <Badge variant={item.status === "completed" ? "default" : "secondary"}>
                {item.status}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-semibold mb-3">Submitted Documents</h4>
        {documents.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No documents submitted yet</p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">{doc.document_type.toUpperCase()}</p>
                  <p className="text-sm text-muted-foreground">Submitted: {new Date(doc.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={doc.status === "approved" ? "default" : doc.status === "rejected" ? "destructive" : "secondary"}>
                    {doc.status}
                  </Badge>
                  {doc.status === "submitted" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => handleReviewDocument(doc.id, true)}>
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleReviewDocument(doc.id, false)}>
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HiringSuitePage;
