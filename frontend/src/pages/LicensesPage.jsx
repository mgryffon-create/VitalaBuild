import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Shield, Plus, Trash2, CheckCircle, Clock, XCircle, AlertTriangle, ExternalLink, FileCheck } from "lucide-react";

const LicensesPage = () => {
  const { user } = useAuth();
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newLicense, setNewLicense] = useState({
    license_type: "",
    license_number: "",
    state: "",
    expiration_date: "",
    compact_license: false
  });

  const licenseTypes = [
    "RN - Registered Nurse",
    "LPN - Licensed Practical Nurse",
    "LVN - Licensed Vocational Nurse",
    "NP - Nurse Practitioner",
    "APRN - Advanced Practice RN",
    "CNS - Clinical Nurse Specialist",
    "CRNA - Nurse Anesthetist",
    "CNM - Certified Nurse Midwife",
    "CNA - Certified Nursing Assistant",
    "PT - Physical Therapist",
    "PTA - Physical Therapy Assistant",
    "OT - Occupational Therapist",
    "OTA - Occupational Therapy Assistant",
    "SLP - Speech Language Pathologist",
    "RT - Respiratory Therapist",
    "Pharmacist",
    "Pharmacy Technician",
    "Radiology Technologist",
    "Medical Laboratory Technologist",
    "Paramedic",
    "EMT",
    "Other"
  ];

  const states = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
  ];

  useEffect(() => {
    fetchLicenses();
  }, []);

  const fetchLicenses = async () => {
    try {
      const response = await axios.get(`${API}/licenses`);
      setLicenses(response.data);
    } catch (error) {
      toast.error("Failed to load licenses");
    } finally {
      setLoading(false);
    }
  };

  const handleAddLicense = async () => {
    if (!newLicense.license_type || !newLicense.license_number || !newLicense.state) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API}/licenses`, newLicense);
      toast.success("License added successfully");
      setShowAddDialog(false);
      setNewLicense({
        license_type: "",
        license_number: "",
        state: "",
        expiration_date: "",
        compact_license: false
      });
      fetchLicenses();
    } catch (error) {
      toast.error("Failed to add license");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLicense = async (licenseId) => {
    try {
      await axios.delete(`${API}/licenses/${licenseId}`);
      toast.success("License deleted");
      setLicenses(licenses.filter(l => l.id !== licenseId));
    } catch (error) {
      toast.error("Failed to delete license");
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "verified":
      case "nursys_verified":
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            {status === "nursys_verified" ? "Nursys Verified" : "Verified"}
          </Badge>
        );
      case "pending":
      case "nursys_pending":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-200">
            <Clock className="w-3 h-3 mr-1" />
            {status === "nursys_pending" ? "Nursys Pending" : "Pending"}
          </Badge>
        );
      case "rejected":
      case "nursys_failed":
        return (
          <Badge className="bg-red-500/10 text-red-600 border-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            {status === "nursys_failed" ? "Verification Failed" : "Rejected"}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Unknown
          </Badge>
        );
    }
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
      <div data-testid="licenses-page" className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">License Verification</h1>
            <p className="text-muted-foreground mt-1">
              Manage and verify your professional licenses
            </p>
          </div>
          <Button
            data-testid="add-license-btn"
            onClick={() => setShowAddDialog(true)}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-2" /> Add License
          </Button>
        </div>

        {/* Info Card */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">License Verification System</p>
                <p className="text-sm text-muted-foreground">
                  Add your professional licenses for verification. Employers can request Nursys verification after matching.
                  Verified licenses display a badge on your profile, increasing trust with potential employers.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Licenses List */}
        {licenses.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Shield className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h2 className="text-xl font-semibold text-foreground mb-2">No licenses added yet</h2>
              <p className="text-muted-foreground mb-6">
                Add your professional licenses to get verified and stand out to employers
              </p>
              <Button
                data-testid="add-first-license-btn"
                onClick={() => setShowAddDialog(true)}
                className="bg-primary hover:bg-primary/90"
              >
                Add Your First License
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {licenses.map((license) => (
              <Card key={license.id} className="hover-lift">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        license.verification_status === "verified" || license.verification_status === "nursys_verified"
                          ? "bg-green-500/10"
                          : "bg-primary/10"
                      }`}>
                        <Shield className={`w-5 h-5 ${
                          license.verification_status === "verified" || license.verification_status === "nursys_verified"
                            ? "text-green-600"
                            : "text-primary"
                        }`} />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{license.license_type}</p>
                        <p className="text-sm text-muted-foreground">{license.state}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteLicense(license.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="space-y-2 mb-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">License #</span>
                      <span className="font-mono text-foreground">{license.license_number}</span>
                    </div>
                    {license.expiration_date && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Expires</span>
                        <span className="text-foreground">{license.expiration_date}</span>
                      </div>
                    )}
                    {license.compact_license && (
                      <div className="flex items-center gap-1 text-sm text-secondary">
                        <FileCheck className="w-3 h-3" />
                        <span>Compact License (Multi-state)</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="pt-3 border-t border-border">
                    {getStatusBadge(license.verification_status)}
                    {license.verified_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Verified on {new Date(license.verified_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Add License Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Professional License</DialogTitle>
              <DialogDescription>
                Enter your license details for verification
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>License Type *</Label>
                <Select
                  value={newLicense.license_type}
                  onValueChange={(value) => setNewLicense({ ...newLicense, license_type: value })}
                >
                  <SelectTrigger data-testid="license-type-select">
                    <SelectValue placeholder="Select license type" />
                  </SelectTrigger>
                  <SelectContent>
                    {licenseTypes.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>License Number *</Label>
                <Input
                  data-testid="license-number-input"
                  value={newLicense.license_number}
                  onChange={(e) => setNewLicense({ ...newLicense, license_number: e.target.value })}
                  placeholder="e.g., RN123456"
                />
              </div>

              <div className="space-y-2">
                <Label>State *</Label>
                <Select
                  value={newLicense.state}
                  onValueChange={(value) => setNewLicense({ ...newLicense, state: value })}
                >
                  <SelectTrigger data-testid="license-state-select">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {states.map((state) => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Expiration Date</Label>
                <Input
                  data-testid="license-exp-input"
                  type="date"
                  value={newLicense.expiration_date}
                  onChange={(e) => setNewLicense({ ...newLicense, expiration_date: e.target.value })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="compact"
                  data-testid="compact-license-checkbox"
                  checked={newLicense.compact_license}
                  onCheckedChange={(checked) => setNewLicense({ ...newLicense, compact_license: checked })}
                />
                <Label htmlFor="compact" className="text-sm cursor-pointer">
                  This is a Compact License (allows practice in multiple states)
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button
                data-testid="submit-license-btn"
                onClick={handleAddLicense}
                disabled={submitting}
                className="bg-primary hover:bg-primary/90"
              >
                {submitting ? "Adding..." : "Add License"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default LicensesPage;
