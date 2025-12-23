import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Users, Plus, Mail, Clock, CheckCircle, Copy, ExternalLink } from "lucide-react";

const ReferencesPage = () => {
  const { user } = useAuth();
  const [references, setReferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestForm, setRequestForm] = useState({
    referee_email: "",
    referee_name: "",
    relationship: "",
    message: ""
  });

  const isSeeker = user?.role === "seeker";

  const relationships = isSeeker
    ? [
        "Direct Supervisor",
        "Colleague",
        "Charge Nurse",
        "Department Manager",
        "Clinical Director",
        "Physician",
        "Other"
      ]
    : [
        "Current Employee",
        "Former Employee",
        "Department Staff",
        "Nursing Staff",
        "Administrative Staff",
        "Other"
      ];

  useEffect(() => {
    fetchReferences();
  }, []);

  const fetchReferences = async () => {
    try {
      const response = await axios.get(`${API}/references/pending`);
      setReferences(response.data);
    } catch (error) {
      toast.error("Failed to load references");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReference = async () => {
    if (!requestForm.referee_email || !requestForm.referee_name || !requestForm.relationship) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const response = await axios.post(`${API}/references/request`, requestForm);
      toast.success("Reference request sent!");
      setShowRequestDialog(false);
      setRequestForm({ referee_email: "", referee_name: "", relationship: "", message: "" });
      fetchReferences();
      
      // Show the submission link for testing
      if (response.data.submission_link) {
        toast.info(`Submission link: ${window.location.origin}${response.data.submission_link}`, {
          duration: 10000
        });
      }
    } catch (error) {
      toast.error("Failed to send reference request");
    } finally {
      setSubmitting(false);
    }
  };

  const copySubmissionLink = (ref) => {
    const link = `${window.location.origin}/references/submit/${ref.token}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copied to clipboard");
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

  const pendingRefs = references.filter(r => r.status === "pending");
  const completedRefs = references.filter(r => r.status === "completed");

  return (
    <DashboardLayout>
      <div data-testid="references-page" className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">References</h1>
            <p className="text-muted-foreground mt-1">
              {isSeeker
                ? "Request references from colleagues and supervisors"
                : "Request facility reviews from current employees"}
            </p>
          </div>
          <Button
            data-testid="request-reference-btn"
            onClick={() => setShowRequestDialog(true)}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-2" /> Request Reference
          </Button>
        </div>

        {/* Info Card */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Blind Reference System</p>
                <p className="text-sm text-muted-foreground">
                  {isSeeker
                    ? "Your references will only be visible to employers after you match with a job. You won't see the content of the references."
                    : "Facility reviews will only be visible to job seekers after they match with your job. You won't see the content of the reviews."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* References Stats */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-3xl font-bold text-foreground">{pendingRefs.length}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-3xl font-bold text-foreground">{completedRefs.length}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-secondary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* References List */}
        {references.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h2 className="text-xl font-semibold text-foreground mb-2">No reference requests yet</h2>
              <p className="text-muted-foreground mb-6">
                {isSeeker
                  ? "Request references from colleagues to strengthen your profile"
                  : "Request facility reviews from current employees"}
              </p>
              <Button
                data-testid="request-first-ref-btn"
                onClick={() => setShowRequestDialog(true)}
                className="bg-primary hover:bg-primary/90"
              >
                Request Your First Reference
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Pending References */}
            {pendingRefs.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-3">Pending Requests</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingRefs.map((ref) => (
                    <Card key={ref.id} className="hover-lift">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-semibold text-foreground">{ref.referee_name}</p>
                            <p className="text-sm text-muted-foreground">{ref.relationship}</p>
                          </div>
                          <Badge variant="outline" className="text-accent border-accent">
                            <Clock className="w-3 h-3 mr-1" /> Pending
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mb-3">
                          <Mail className="w-3 h-3" /> {ref.referee_email}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            data-testid={`copy-link-${ref.id}`}
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => copySubmissionLink(ref)}
                          >
                            <Copy className="w-3 h-3 mr-1" /> Copy Link
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Completed References */}
            {completedRefs.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-3">Completed References</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {completedRefs.map((ref) => (
                    <Card key={ref.id} className="hover-lift">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-semibold text-foreground">{ref.referee_name}</p>
                            <p className="text-sm text-muted-foreground">{ref.relationship}</p>
                          </div>
                          <Badge className="bg-secondary/10 text-secondary">
                            <CheckCircle className="w-3 h-3 mr-1" /> Completed
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {ref.referee_email}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Reference content hidden (visible to matches only)
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Request Dialog */}
        <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Reference</DialogTitle>
              <DialogDescription>
                {isSeeker
                  ? "Request a professional reference from a colleague or supervisor"
                  : "Request a facility review from a current employee"}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="referee_name">Referee Name *</Label>
                <Input
                  data-testid="referee-name-input"
                  id="referee_name"
                  value={requestForm.referee_name}
                  onChange={(e) => setRequestForm(prev => ({ ...prev, referee_name: e.target.value }))}
                  placeholder="John Smith"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="referee_email">Referee Email *</Label>
                <Input
                  data-testid="referee-email-input"
                  id="referee_email"
                  type="email"
                  value={requestForm.referee_email}
                  onChange={(e) => setRequestForm(prev => ({ ...prev, referee_email: e.target.value }))}
                  placeholder="john.smith@hospital.com"
                />
              </div>

              <div className="space-y-2">
                <Label>Relationship *</Label>
                <Select
                  value={requestForm.relationship}
                  onValueChange={(value) => setRequestForm(prev => ({ ...prev, relationship: value }))}
                >
                  <SelectTrigger data-testid="relationship-select">
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    {relationships.map((rel) => (
                      <SelectItem key={rel} value={rel}>{rel}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Personal Message (Optional)</Label>
                <Textarea
                  data-testid="referee-message-input"
                  id="message"
                  value={requestForm.message}
                  onChange={(e) => setRequestForm(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Add a personal note to your request..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRequestDialog(false)}>
                Cancel
              </Button>
              <Button
                data-testid="send-request-btn"
                onClick={handleRequestReference}
                disabled={submitting}
                className="bg-primary hover:bg-primary/90"
              >
                {submitting ? "Sending..." : "Send Request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default ReferencesPage;
