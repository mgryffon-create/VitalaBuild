import { useState, useEffect, useRef } from "react";
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
  Briefcase, FileText, Clock, CheckCircle, XCircle, 
  AlertCircle, Building, DollarSign, Calendar, Star, Edit
} from "lucide-react";

const MyOffersPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("offers");
  const [offers, setOffers] = useState([]);
  const [employments, setEmployments] = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [showOfferDialog, setShowOfferDialog] = useState(false);
  const [showOnboardingDialog, setShowOnboardingDialog] = useState(false);
  const [showDocumentDialog, setShowDocumentDialog] = useState(false);
  const [showPolicyDialog, setShowPolicyDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [selectedEmployment, setSelectedEmployment] = useState(null);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [selectedReviewTarget, setSelectedReviewTarget] = useState(null);
  const [policies, setPolicies] = useState([]);
  
  // Form states
  const [responseNotes, setResponseNotes] = useState("");
  const [documentForm, setDocumentForm] = useState({
    document_type: "",
    form_data: {},
    signature: ""
  });
  const signatureRef = useRef(null);
  
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
      const [offersRes, employmentsRes, reviewsRes] = await Promise.all([
        axios.get(`${API}/hiring/offers`),
        axios.get(`${API}/hiring/employments`),
        axios.get(`${API}/hiring/reviews/pending`)
      ]);
      setOffers(offersRes.data);
      setEmployments(employmentsRes.data);
      setPendingReviews(reviewsRes.data);
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRespondToOffer = async (accepted) => {
    if (!selectedOffer) return;
    try {
      await axios.put(`${API}/hiring/offers/${selectedOffer.id}/respond`, {
        accepted,
        notes: responseNotes
      });
      toast.success(accepted ? "Offer accepted! Welcome aboard!" : "Offer declined");
      setShowOfferDialog(false);
      setSelectedOffer(null);
      setResponseNotes("");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to respond to offer");
    }
  };

  const handleSubmitDocument = async () => {
    if (!selectedEmployment) return;
    try {
      await axios.post(`${API}/hiring/documents`, {
        employment_id: selectedEmployment.id,
        document_type: documentForm.document_type,
        form_data: documentForm.form_data,
        signature: documentForm.signature,
        signed_at: new Date().toISOString()
      });
      toast.success("Document submitted successfully!");
      setShowDocumentDialog(false);
      setDocumentForm({ document_type: "", form_data: {}, signature: "" });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to submit document");
    }
  };

  const handleSignPolicy = async () => {
    if (!selectedPolicy || !selectedEmployment) return;
    try {
      await axios.post(`${API}/hiring/policies/${selectedPolicy.id}/sign?employment_id=${selectedEmployment.id}`, {
        policy_id: selectedPolicy.id,
        signature: documentForm.signature
      });
      toast.success("Policy signed successfully!");
      setShowPolicyDialog(false);
      setSelectedPolicy(null);
      fetchPoliciesForEmployment(selectedEmployment.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to sign policy");
    }
  };

  const fetchPoliciesForEmployment = async (employmentId) => {
    try {
      const response = await axios.get(`${API}/hiring/policies/for-employment/${employmentId}`);
      setPolicies(response.data);
    } catch (error) {
      console.error("Failed to fetch policies");
    }
  };

  const handleSubmitReview = async () => {
    try {
      await axios.post(`${API}/hiring/reviews`, reviewForm);
      toast.success("Review submitted! Thank you for your feedback.");
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

  const documentTypes = [
    { value: "i9", label: "I-9 Employment Eligibility" },
    { value: "w4", label: "W-4 Tax Withholding" },
    { value: "state_tax", label: "State Tax Form" },
    { value: "direct_deposit", label: "Direct Deposit Setup" },
    { value: "emergency_contact", label: "Emergency Contact" }
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  const pendingOffers = offers.filter(o => o.status === "pending");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Offers & Employment</h1>
          <p className="text-muted-foreground">View offers, complete onboarding, and manage your employment</p>
        </div>

        {/* Pending Offers Alert */}
        {pendingOffers.length > 0 && (
          <Alert className="bg-primary/10 border-primary">
            <Briefcase className="h-4 w-4" />
            <AlertDescription>
              You have <strong>{pendingOffers.length}</strong> pending offer(s) awaiting your response!
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="offers">Offers ({offers.length})</TabsTrigger>
            <TabsTrigger value="onboarding">Onboarding ({employments.filter(e => e.status === 'onboarding').length})</TabsTrigger>
            <TabsTrigger value="reviews">Reviews ({pendingReviews.length})</TabsTrigger>
          </TabsList>

          {/* OFFERS TAB */}
          <TabsContent value="offers" className="space-y-4">
            {offers.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Briefcase className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No offers received yet</p>
                  <p className="text-sm text-muted-foreground mt-2">Keep swiping to find your dream job!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {offers.map((offer) => (
                  <Card key={offer.id} className={offer.status === "pending" ? "border-primary" : ""}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{offer.position_title}</h3>
                            {getStatusBadge(offer.status)}
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Building className="w-4 h-4" />
                            <span>{offer.company_name || "Healthcare Facility"}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-4 h-4" />
                              ${offer.salary_amount.toLocaleString()} / {offer.salary_type}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              Start: {new Date(offer.start_date).toLocaleDateString()}
                            </span>
                          </div>
                          {offer.benefits_summary && (
                            <p className="text-sm text-muted-foreground">{offer.benefits_summary}</p>
                          )}
                        </div>
                        {offer.status === "pending" && (
                          <Button onClick={() => {
                            setSelectedOffer(offer);
                            setShowOfferDialog(true);
                          }}>
                            Review Offer
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
                      {offer.status === "pending" && (
                        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                          <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                            <Clock className="w-4 h-4" />
                            <span className="text-sm">Expires: {new Date(offer.expiration_date).toLocaleDateString()}</span>
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
                  <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No active employments</p>
                  <p className="text-sm text-muted-foreground mt-2">Accept an offer to start onboarding</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {employments.map((emp) => (
                  <Card key={emp.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{emp.position_title}</h3>
                            {getStatusBadge(emp.status)}
                          </div>
                          <p className="text-muted-foreground">{emp.company_name || "Healthcare Facility"}</p>
                          <p className="text-sm text-muted-foreground">Start Date: {new Date(emp.start_date).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground mb-1">Progress</p>
                          <Progress value={emp.onboarding_progress} className="w-32" />
                          <p className="text-sm font-medium mt-1">{emp.onboarding_progress}%</p>
                        </div>
                      </div>
                      
                      {emp.status === "onboarding" && (
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <Button variant="outline" onClick={() => {
                              setSelectedEmployment(emp);
                              setShowDocumentDialog(true);
                            }}>
                              <FileText className="w-4 h-4 mr-1" /> Submit Documents
                            </Button>
                            <Button variant="outline" onClick={() => {
                              setSelectedEmployment(emp);
                              fetchPoliciesForEmployment(emp.id);
                              setShowOnboardingDialog(true);
                            }}>
                              <Edit className="w-4 h-4 mr-1" /> View Policies
                            </Button>
                          </div>
                        </div>
                      )}
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
                          <p className="text-muted-foreground">Employer: {item.other_party?.full_name}</p>
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

        {/* Offer Response Dialog */}
        <Dialog open={showOfferDialog} onOpenChange={setShowOfferDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Review Job Offer</DialogTitle>
              <DialogDescription>Review the offer details and respond</DialogDescription>
            </DialogHeader>
            {selectedOffer && (
              <div className="space-y-4 py-4">
                <div className="p-4 bg-muted rounded-lg space-y-3">
                  <h3 className="font-semibold text-lg">{selectedOffer.position_title}</h3>
                  <p className="text-muted-foreground">{selectedOffer.company_name}</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Salary</p>
                      <p className="font-medium">${selectedOffer.salary_amount.toLocaleString()} / {selectedOffer.salary_type}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Start Date</p>
                      <p className="font-medium">{new Date(selectedOffer.start_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  {selectedOffer.benefits_summary && (
                    <div>
                      <p className="text-muted-foreground text-sm">Benefits</p>
                      <p>{selectedOffer.benefits_summary}</p>
                    </div>
                  )}
                  {selectedOffer.conditions?.length > 0 && (
                    <div>
                      <p className="text-muted-foreground text-sm">Conditions</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {selectedOffer.conditions.map((cond, i) => (
                          <Badge key={i} variant="outline">{cond}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <Label>Response Notes (Optional)</Label>
                  <Textarea
                    value={responseNotes}
                    onChange={(e) => setResponseNotes(e.target.value)}
                    placeholder="Any message for the employer..."
                    className="mt-1"
                  />
                </div>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This offer expires on {new Date(selectedOffer.expiration_date).toLocaleDateString()}
                  </AlertDescription>
                </Alert>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => handleRespondToOffer(false)}>
                <XCircle className="w-4 h-4 mr-1" /> Decline
              </Button>
              <Button onClick={() => handleRespondToOffer(true)}>
                <CheckCircle className="w-4 h-4 mr-1" /> Accept Offer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Submit Document Dialog */}
        <Dialog open={showDocumentDialog} onOpenChange={setShowDocumentDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit Onboarding Document</DialogTitle>
              <DialogDescription>Complete and submit your employment documents</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Document Type</Label>
                <Select value={documentForm.document_type} onValueChange={(v) => setDocumentForm(prev => ({ ...prev, document_type: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {documentForm.document_type === "i9" && (
                <div className="space-y-3">
                  <div>
                    <Label>Legal Name</Label>
                    <Input
                      onChange={(e) => setDocumentForm(prev => ({ ...prev, form_data: { ...prev.form_data, legal_name: e.target.value } }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>SSN (Last 4 digits)</Label>
                    <Input
                      maxLength={4}
                      onChange={(e) => setDocumentForm(prev => ({ ...prev, form_data: { ...prev.form_data, ssn_last4: e.target.value } }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Citizenship Status</Label>
                    <Select onValueChange={(v) => setDocumentForm(prev => ({ ...prev, form_data: { ...prev.form_data, citizenship: v } }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="citizen">U.S. Citizen</SelectItem>
                        <SelectItem value="permanent_resident">Permanent Resident</SelectItem>
                        <SelectItem value="work_authorized">Work Authorized Non-Citizen</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {documentForm.document_type === "w4" && (
                <div className="space-y-3">
                  <div>
                    <Label>Filing Status</Label>
                    <Select onValueChange={(v) => setDocumentForm(prev => ({ ...prev, form_data: { ...prev.form_data, filing_status: v } }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Single</SelectItem>
                        <SelectItem value="married_filing_jointly">Married Filing Jointly</SelectItem>
                        <SelectItem value="head_of_household">Head of Household</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Allowances</Label>
                    <Input
                      type="number"
                      onChange={(e) => setDocumentForm(prev => ({ ...prev, form_data: { ...prev.form_data, allowances: e.target.value } }))}
                      className="mt-1"
                    />
                  </div>
                </div>
              )}

              {documentForm.document_type === "direct_deposit" && (
                <div className="space-y-3">
                  <div>
                    <Label>Bank Name</Label>
                    <Input
                      onChange={(e) => setDocumentForm(prev => ({ ...prev, form_data: { ...prev.form_data, bank_name: e.target.value } }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Routing Number</Label>
                    <Input
                      onChange={(e) => setDocumentForm(prev => ({ ...prev, form_data: { ...prev.form_data, routing_number: e.target.value } }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Account Number</Label>
                    <Input
                      onChange={(e) => setDocumentForm(prev => ({ ...prev, form_data: { ...prev.form_data, account_number: e.target.value } }))}
                      className="mt-1"
                    />
                  </div>
                </div>
              )}

              {documentForm.document_type === "emergency_contact" && (
                <div className="space-y-3">
                  <div>
                    <Label>Contact Name</Label>
                    <Input
                      onChange={(e) => setDocumentForm(prev => ({ ...prev, form_data: { ...prev.form_data, contact_name: e.target.value } }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Relationship</Label>
                    <Input
                      onChange={(e) => setDocumentForm(prev => ({ ...prev, form_data: { ...prev.form_data, relationship: e.target.value } }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Phone Number</Label>
                    <Input
                      onChange={(e) => setDocumentForm(prev => ({ ...prev, form_data: { ...prev.form_data, phone: e.target.value } }))}
                      className="mt-1"
                    />
                  </div>
                </div>
              )}

              <div>
                <Label>Digital Signature (Type your full name)</Label>
                <Input
                  value={documentForm.signature}
                  onChange={(e) => setDocumentForm(prev => ({ ...prev, signature: e.target.value }))}
                  placeholder="Your full legal name"
                  className="mt-1 font-cursive italic"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDocumentDialog(false)}>Cancel</Button>
              <Button onClick={handleSubmitDocument} disabled={!documentForm.document_type || !documentForm.signature}>
                Submit Document
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Policies Dialog */}
        <Dialog open={showOnboardingDialog} onOpenChange={setShowOnboardingDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Company Policies</DialogTitle>
              <DialogDescription>Review and sign required policy documents</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {policies.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No policies to sign</p>
              ) : (
                policies.map((policy) => (
                  <div key={policy.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div>
                      <h4 className="font-medium">{policy.title}</h4>
                      <p className="text-sm text-muted-foreground">{policy.description}</p>
                      <Badge variant="outline" className="mt-1">v{policy.version}</Badge>
                    </div>
                    {policy.signed ? (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" /> Signed
                      </Badge>
                    ) : (
                      <Button size="sm" onClick={() => {
                        setSelectedPolicy(policy);
                        setShowPolicyDialog(true);
                      }}>
                        Sign
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Sign Policy Dialog */}
        <Dialog open={showPolicyDialog} onOpenChange={setShowPolicyDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sign Policy: {selectedPolicy?.title}</DialogTitle>
              <DialogDescription>By signing, you acknowledge you have read and agree to this policy</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription>
                  {selectedPolicy?.description}
                </AlertDescription>
              </Alert>
              <div>
                <Label>Digital Signature (Type your full name)</Label>
                <Input
                  value={documentForm.signature}
                  onChange={(e) => setDocumentForm(prev => ({ ...prev, signature: e.target.value }))}
                  placeholder="Your full legal name"
                  className="mt-1 font-cursive italic"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPolicyDialog(false)}>Cancel</Button>
              <Button onClick={handleSignPolicy} disabled={!documentForm.signature}>
                Sign Policy
              </Button>
            </DialogFooter>
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
                  placeholder="Share your experience working here..."
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
                <Label htmlFor="would_recommend">I would recommend this employer to others</Label>
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

export default MyOffersPage;
