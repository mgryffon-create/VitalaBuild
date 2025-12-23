import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Briefcase, MapPin, DollarSign, Clock, Plus, X, Save, ArrowLeft, Award, Gift, FileText, Calendar } from "lucide-react";

const JobFormPage = () => {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(!!jobId);
  const [saving, setSaving] = useState(false);
  const [specialties, setSpecialties] = useState({ nursing: [], allied_health: [], all: [] });
  const [job, setJob] = useState({
    title: "",
    description: "",
    location: "",
    duration: "",
    pay_range: { min: "", max: "" },
    benefits: [],
    time_off_policy: "",
    requirements: [],
    certifications_required: [],
    experience_required: 0,
    specialty: "",
    shift_type: "",
    start_date: ""
  });

  const [newBenefit, setNewBenefit] = useState("");
  const [newRequirement, setNewRequirement] = useState("");
  const [newCert, setNewCert] = useState("");

  const isEdit = !!jobId;

  const durations = [
    "13 weeks",
    "26 weeks",
    "52 weeks",
    "Permanent",
    "Per Diem",
    "PRN"
  ];

  const shiftTypes = [
    "Day Shift (7a-7p)",
    "Night Shift (7p-7a)",
    "Day Shift (8 hr)",
    "Evening Shift",
    "Rotating",
    "Flexible"
  ];

  const commonBenefits = [
    "Health Insurance",
    "Dental Insurance",
    "Vision Insurance",
    "401(k)",
    "Housing Stipend",
    "Travel Reimbursement",
    "Sign-On Bonus",
    "Completion Bonus",
    "Referral Bonus",
    "Continuing Education",
    "License Reimbursement",
    "Meal Allowance"
  ];

  useEffect(() => {
    if (jobId) {
      fetchJob();
    }
  }, [jobId]);

  const fetchJob = async () => {
    try {
      const response = await axios.get(`${API}/jobs/${jobId}`);
      setJob(response.data);
    } catch (error) {
      toast.error("Failed to load job");
      navigate("/poster");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!job.title || !job.description || !job.location || !job.specialty) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...job,
        pay_range: {
          min: parseInt(job.pay_range.min) || 0,
          max: parseInt(job.pay_range.max) || 0
        },
        experience_required: parseInt(job.experience_required) || 0
      };

      if (isEdit) {
        await axios.put(`${API}/jobs/${jobId}`, payload);
        toast.success("Job updated successfully");
      } else {
        await axios.post(`${API}/jobs`, payload);
        toast.success("Job posted successfully");
      }
      navigate("/poster");
    } catch (error) {
      toast.error(`Failed to ${isEdit ? "update" : "create"} job`);
    } finally {
      setSaving(false);
    }
  };

  const addItem = (field, value, setter) => {
    if (value.trim()) {
      setJob(prev => ({ ...prev, [field]: [...(prev[field] || []), value.trim()] }));
      setter("");
    }
  };

  const removeItem = (field, index) => {
    setJob(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));
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
      <div data-testid="job-form-page" className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/poster")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {isEdit ? "Edit Job Posting" : "Post New Job"}
              </h1>
              <p className="text-muted-foreground mt-1">
                {isEdit ? "Update your job listing details" : "Create a new job listing"}
              </p>
            </div>
          </div>
          <Button
            data-testid="save-job-btn"
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary/90"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : isEdit ? "Update Job" : "Post Job"}
          </Button>
        </div>

        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Job Title *</Label>
              <Input
                data-testid="job-title-input"
                id="title"
                value={job.title}
                onChange={(e) => setJob(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., ICU Registered Nurse"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Specialty *</Label>
                <Select
                  value={job.specialty}
                  onValueChange={(value) => setJob(prev => ({ ...prev, specialty: value }))}
                >
                  <SelectTrigger data-testid="specialty-select">
                    <SelectValue placeholder="Select specialty" />
                  </SelectTrigger>
                  <SelectContent>
                    {specialties.map((spec) => (
                      <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    data-testid="location-input"
                    id="location"
                    value={job.location}
                    onChange={(e) => setJob(prev => ({ ...prev, location: e.target.value }))}
                    className="pl-10"
                    placeholder="City, State"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Job Description *</Label>
              <Textarea
                data-testid="description-input"
                id="description"
                value={job.description}
                onChange={(e) => setJob(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the role, responsibilities, and ideal candidate..."
                rows={5}
              />
            </div>
          </CardContent>
        </Card>

        {/* Duration & Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Duration & Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Assignment Duration</Label>
                <Select
                  value={job.duration}
                  onValueChange={(value) => setJob(prev => ({ ...prev, duration: value }))}
                >
                  <SelectTrigger data-testid="duration-select">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    {durations.map((dur) => (
                      <SelectItem key={dur} value={dur}>{dur}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Shift Type</Label>
                <Select
                  value={job.shift_type}
                  onValueChange={(value) => setJob(prev => ({ ...prev, shift_type: value }))}
                >
                  <SelectTrigger data-testid="shift-select">
                    <SelectValue placeholder="Select shift" />
                  </SelectTrigger>
                  <SelectContent>
                    {shiftTypes.map((shift) => (
                      <SelectItem key={shift} value={shift}>{shift}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  data-testid="start-date-input"
                  id="start_date"
                  type="date"
                  value={job.start_date}
                  onChange={(e) => setJob(prev => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Compensation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Compensation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Minimum Hourly Rate</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    data-testid="min-pay-input"
                    type="number"
                    value={job.pay_range.min}
                    onChange={(e) => setJob(prev => ({ 
                      ...prev, 
                      pay_range: { ...prev.pay_range, min: e.target.value } 
                    }))}
                    className="pl-10"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Maximum Hourly Rate</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    data-testid="max-pay-input"
                    type="number"
                    value={job.pay_range.max}
                    onChange={(e) => setJob(prev => ({ 
                      ...prev, 
                      pay_range: { ...prev.pay_range, max: e.target.value } 
                    }))}
                    className="pl-10"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Benefits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary" />
              Benefits Offered
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Select value={newBenefit} onValueChange={setNewBenefit}>
                <SelectTrigger data-testid="benefit-select" className="flex-1">
                  <SelectValue placeholder="Select or type a benefit" />
                </SelectTrigger>
                <SelectContent>
                  {commonBenefits.map((benefit) => (
                    <SelectItem key={benefit} value={benefit}>{benefit}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                data-testid="add-benefit-btn"
                type="button"
                variant="outline"
                onClick={() => addItem("benefits", newBenefit, setNewBenefit)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {job.benefits.map((benefit, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1 py-1 px-2">
                  {benefit}
                  <button
                    type="button"
                    onClick={() => removeItem("benefits", index)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Time Off Policy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Time Off Policy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              data-testid="time-off-input"
              value={job.time_off_policy}
              onChange={(e) => setJob(prev => ({ ...prev, time_off_policy: e.target.value }))}
              placeholder="Describe your time off and PTO policies..."
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Requirements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Job Requirements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Minimum Years of Experience</Label>
              <Input
                data-testid="experience-input"
                type="number"
                min="0"
                value={job.experience_required}
                onChange={(e) => setJob(prev => ({ ...prev, experience_required: e.target.value }))}
                placeholder="0"
                className="w-32"
              />
            </div>

            <div className="space-y-2">
              <Label>Additional Requirements</Label>
              <div className="flex gap-2">
                <Input
                  data-testid="requirement-input"
                  value={newRequirement}
                  onChange={(e) => setNewRequirement(e.target.value)}
                  placeholder="e.g., Must be able to lift 50 lbs"
                  onKeyPress={(e) => e.key === "Enter" && addItem("requirements", newRequirement, setNewRequirement)}
                />
                <Button
                  data-testid="add-requirement-btn"
                  type="button"
                  variant="outline"
                  onClick={() => addItem("requirements", newRequirement, setNewRequirement)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2 mt-2">
                {job.requirements.map((req, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                    <span className="flex-1 text-sm">{req}</span>
                    <button
                      type="button"
                      onClick={() => removeItem("requirements", index)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Required Certifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Required Certifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                data-testid="cert-input"
                value={newCert}
                onChange={(e) => setNewCert(e.target.value)}
                placeholder="e.g., BLS, ACLS, PALS"
                onKeyPress={(e) => e.key === "Enter" && addItem("certifications_required", newCert, setNewCert)}
              />
              <Button
                data-testid="add-cert-btn"
                type="button"
                variant="outline"
                onClick={() => addItem("certifications_required", newCert, setNewCert)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {job.certifications_required.map((cert, index) => (
                <Badge key={index} variant="outline" className="flex items-center gap-1 py-1 px-2">
                  <Award className="w-3 h-3" />
                  {cert}
                  <button
                    type="button"
                    onClick={() => removeItem("certifications_required", index)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Bottom Save Button */}
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => navigate("/poster")}>
            Cancel
          </Button>
          <Button
            data-testid="save-job-bottom-btn"
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary/90"
          >
            {saving ? "Saving..." : isEdit ? "Update Job" : "Post Job"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default JobFormPage;
