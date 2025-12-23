import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Shield, CheckCircle, XCircle, Clock, User, FileText, ExternalLink, AlertTriangle } from "lucide-react";

const VerificationAdminPage = () => {
  const { user } = useAuth();
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [showDecisionDialog, setShowDecisionDialog] = useState(false);
  const [decision, setDecision] = useState({ approved: true, notes: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPendingVerifications();
  }, []);

  const fetchPendingVerifications = async () => {
    try {
      const response = await axios.get(`${API}/licenses/verification/pending`);
      setPendingVerifications(response.data);
    } catch (error) {
      toast.error("Failed to load verifications");
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async () => {
    if (!selectedVerification) return;

    setSubmitting(true);
    try {
      await axios.post(
        `${API}/licenses/verification/${selectedVerification.id}/decide`,
        decision
      );
      toast.success(`License ${decision.approved ? "verified" : "rejected"} successfully`);
      setShowDecisionDialog(false);
      setSelectedVerification(null);
      setDecision({ approved: true, notes: "" });
      fetchPendingVerifications();
    } catch (error) {
      toast.error("Failed to process verification");
    } finally {
      setSubmitting(false);
    }
  };

  const openDecisionDialog = (verification, approve) => {
    setSelectedVerification(verification);
    setDecision({ approved: approve, notes: "" });
    setShowDecisionDialog(true);
  };

  if (user?.role === "seeker") {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="py-16 text-center">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Access Restricted</h2>
            <p className="text-muted-foreground">
              This page is only available for employers and administrators.
            </p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

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
      <div data-testid="verification-admin-page" className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">License Verification</h1>
          <p className="text-muted-foreground mt-1">
            Review and verify candidate licenses
          </p>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-3xl font-bold text-foreground">
                    {pendingVerifications.filter(v => v.status === "pending").length}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-yellow-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Verifications */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Verifications</CardTitle>
            <CardDescription>
              Review license documents and verify credentials
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingVerifications.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">All caught up!</p>
                <p className="text-sm">No pending verifications at this time.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingVerifications.map((verification) => (
                  <div
                    key={verification.id}
                    className="p-4 border border-border rounded-xl hover:border-primary/50 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <User className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">
                            {verification.user?.full_name || "Unknown User"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {verification.license?.license_type} - {verification.license?.state}
                          </p>
                          <p className="text-sm font-mono text-muted-foreground">
                            License #: {verification.license?.license_number}
                          </p>
                          {verification.license?.expiration_date && (
                            <p className="text-sm text-muted-foreground">
                              Expires: {verification.license?.expiration_date}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                          <Clock className="w-3 h-3 mr-1" />
                          {verification.verification_type === "nursys" ? "Nursys" : "Manual"}
                        </Badge>
                        
                        <Button
                          data-testid={`verify-${verification.id}`}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => openDecisionDialog(verification, true)}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" /> Verify
                        </Button>
                        <Button
                          data-testid={`reject-${verification.id}`}
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive hover:bg-destructive hover:text-white"
                          onClick={() => openDecisionDialog(verification, false)}
                        >
                          <XCircle className="w-4 h-4 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Decision Dialog */}
        <Dialog open={showDecisionDialog} onOpenChange={setShowDecisionDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {decision.approved ? "Verify License" : "Reject License"}
              </DialogTitle>
              <DialogDescription>
                {decision.approved
                  ? "Confirm that you have verified this license is valid and active."
                  : "Provide a reason for rejecting this license verification."}
              </DialogDescription>
            </DialogHeader>
            
            {selectedVerification && (
              <div className="py-4">
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Applicant</span>
                        <span className="font-medium">{selectedVerification.user?.full_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">License Type</span>
                        <span className="font-medium">{selectedVerification.license?.license_type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">License #</span>
                        <span className="font-mono">{selectedVerification.license?.license_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">State</span>
                        <span className="font-medium">{selectedVerification.license?.state}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <div className="mt-4 space-y-2">
                  <Label>Notes (optional)</Label>
                  <Textarea
                    data-testid="verification-notes"
                    value={decision.notes}
                    onChange={(e) => setDecision({ ...decision, notes: e.target.value })}
                    placeholder={decision.approved 
                      ? "Add any notes about the verification..."
                      : "Please provide a reason for rejection..."
                    }
                    rows={3}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDecisionDialog(false)}>
                Cancel
              </Button>
              <Button
                data-testid="confirm-decision-btn"
                onClick={handleDecision}
                disabled={submitting}
                className={decision.approved ? "bg-green-600 hover:bg-green-700" : "bg-destructive hover:bg-destructive/90"}
              >
                {submitting ? "Processing..." : decision.approved ? "Confirm Verification" : "Confirm Rejection"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default VerificationAdminPage;
