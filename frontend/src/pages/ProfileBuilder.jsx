import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { User, Mail, Phone, MapPin, Plus, X, Briefcase, Award, DollarSign, Heart, Save, CheckCircle, FileText, Stethoscope, Clock, Building, Calendar, Upload, Sparkles, Loader2 } from "lucide-react";

const ProfileBuilder = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({});
  const [specialties, setSpecialties] = useState({ nursing: [], allied_health: [], all: [] });

  const isSeeker = user?.role === "seeker";

  const fetchProfile = useCallback(async () => {
    try {
      const endpoint = isSeeker ? "/profile/seeker" : "/profile/poster";
      const response = await axios.get(`${API}${endpoint}`);
      setProfile(response.data || {});
    } catch (error) {
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [isSeeker]);

  const fetchSpecialties = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/specialties`);
      setSpecialties(response.data);
    } catch (error) {
      console.error("Failed to load specialties");
    }
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchSpecialties();
  }, [fetchProfile, fetchSpecialties]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const endpoint = isSeeker ? "/profile/seeker" : "/profile/poster";
      await axios.put(`${API}${endpoint}`, profile);
      
      // Update user's profile_complete status
      const meRes = await axios.get(`${API}/auth/me`);
      updateUser(meRes.data);
      
      toast.success("Profile saved successfully");
    } catch (error) {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const addToArray = (field, value) => {
    const current = profile[field] || [];
    setProfile(prev => ({ ...prev, [field]: [...current, value] }));
  };

  const removeFromArray = (field, index) => {
    const current = profile[field] || [];
    setProfile(prev => ({ ...prev, [field]: current.filter((_, i) => i !== index) }));
  };

  const updateArrayItem = (field, index, value) => {
    const current = profile[field] || [];
    const updated = [...current];
    updated[index] = value;
    setProfile(prev => ({ ...prev, [field]: updated }));
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
      <div data-testid="profile-builder" className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {isSeeker ? "Your Profile" : "Company Profile"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isSeeker
                ? "Build your universal application"
                : "Tell job seekers about your facility"}
            </p>
          </div>
          <Button
            data-testid="save-profile-btn"
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary/90"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save Profile"}
          </Button>
        </div>

        {isSeeker ? (
          <SeekerProfileForm 
            profile={profile} 
            updateField={updateField} 
            addToArray={addToArray} 
            removeFromArray={removeFromArray}
            updateArrayItem={updateArrayItem}
            specialties={specialties}
          />
        ) : (
          <PosterProfileForm profile={profile} updateField={updateField} specialties={specialties} />
        )}
      </div>
    </DashboardLayout>
  );
};

// Seeker Profile Form
const SeekerProfileForm = ({ profile, updateField, addToArray, removeFromArray, updateArrayItem, specialties }) => {
  const [newCert, setNewCert] = useState({ name: "", expiration: "" });
  const [newLicense, setNewLicense] = useState({ name: "", state: "", expiration: "", license_number: "" });
  const [newBenefit, setNewBenefit] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newWorkHistory, setNewWorkHistory] = useState({
    facility_name: "",
    position: "",
    department: "",
    start_date: "",
    end_date: "",
    is_current: false,
    responsibilities: ""
  });
  const [newMedicalRecord, setNewMedicalRecord] = useState({
    record_type: "",
    date_completed: "",
    expiration_date: "",
    result: ""
  });

  const benefitOptions = [
    "Health Insurance",
    "Dental Insurance",
    "Vision Insurance",
    "401(k)",
    "Paid Time Off",
    "Flexible Schedule",
    "Sign-On Bonus",
    "Relocation Assistance",
    "Continuing Education",
    "Tuition Reimbursement",
    "Housing Stipend",
    "Travel Reimbursement"
  ];

  const medicalRecordTypes = [
    "TB Test (PPD/Quantiferon)",
    "COVID-19 Vaccination",
    "COVID-19 Booster",
    "MMR Vaccination",
    "MMR Titers",
    "Hepatitis B Vaccination",
    "Hepatitis B Titers",
    "Varicella Vaccination",
    "Varicella Titers",
    "Tdap Vaccination",
    "Influenza Vaccination",
    "Annual Physical",
    "Drug Screen",
    "Background Check",
    "Fit Test (N95)",
    "Other"
  ];

  return (
    <Tabs defaultValue="basic" className="space-y-6">
      <TabsList className="grid grid-cols-5 w-full">
        <TabsTrigger value="basic" data-testid="tab-basic">Basic Info</TabsTrigger>
        <TabsTrigger value="work" data-testid="tab-work">Work History</TabsTrigger>
        <TabsTrigger value="credentials" data-testid="tab-credentials">Credentials</TabsTrigger>
        <TabsTrigger value="medical" data-testid="tab-medical">Medical Records</TabsTrigger>
        <TabsTrigger value="preferences" data-testid="tab-preferences">Preferences</TabsTrigger>
      </TabsList>

      {/* Basic Info Tab */}
      <TabsContent value="basic" className="space-y-6">
        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Contact Information
            </CardTitle>
            <CardDescription>How employers can reach you</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    data-testid="contact-email-input"
                    id="email"
                    value={profile.contact_info?.email || ""}
                    onChange={(e) => updateField("contact_info", { ...profile.contact_info, email: e.target.value })}
                    className="pl-10"
                    placeholder="you@example.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    data-testid="contact-phone-input"
                    id="phone"
                    value={profile.contact_info?.phone || ""}
                    onChange={(e) => updateField("contact_info", { ...profile.contact_info, phone: e.target.value })}
                    className="pl-10"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  data-testid="contact-address-input"
                  id="address"
                  value={profile.contact_info?.address || ""}
                  onChange={(e) => updateField("contact_info", { ...profile.contact_info, address: e.target.value })}
                  className="pl-10"
                  placeholder="City, State"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Professional Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-primary" />
              Professional Information
            </CardTitle>
            <CardDescription>Your specialty and experience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="specialty">Specialty</Label>
                <Select
                  value={profile.specialty || ""}
                  onValueChange={(value) => updateField("specialty", value)}
                >
                  <SelectTrigger data-testid="specialty-select">
                    <SelectValue placeholder="Select specialty" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-1.5 text-sm font-semibold text-primary">Nursing</div>
                    {specialties.nursing?.map((spec) => (
                      <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                    ))}
                    <div className="px-2 py-1.5 text-sm font-semibold text-secondary border-t mt-2 pt-2">Allied Health</div>
                    {specialties.allied_health?.map((spec) => (
                      <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="experience">Years of Experience</Label>
                <Input
                  data-testid="experience-input"
                  id="experience"
                  type="number"
                  min="0"
                  value={profile.years_experience || ""}
                  onChange={(e) => updateField("years_experience", parseInt(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                data-testid="bio-input"
                id="bio"
                value={profile.bio || ""}
                onChange={(e) => updateField("bio", e.target.value)}
                placeholder="Tell employers about yourself, your experience, and what you're looking for..."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Work History Tab */}
      <TabsContent value="work" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              Work History
            </CardTitle>
            <CardDescription>Your previous employment experience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing Work History */}
            {(profile.work_history || []).length > 0 && (
              <div className="space-y-3 mb-6">
                {profile.work_history.map((job, index) => (
                  <div key={index} className="p-4 border border-border rounded-xl bg-muted/30">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-foreground">{job.position}</h4>
                          {job.is_current && (
                            <Badge className="bg-secondary/10 text-secondary text-xs">Current</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <Building className="w-3 h-3" /> {job.facility_name}
                          {job.department && <span> • {job.department}</span>}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {job.start_date} - {job.is_current ? "Present" : job.end_date}
                        </p>
                        {job.responsibilities && (
                          <p className="text-sm text-muted-foreground mt-2">{job.responsibilities}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFromArray("work_history", index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Work History */}
            <div className="p-4 border border-dashed border-border rounded-xl space-y-4">
              <p className="text-sm font-medium text-foreground">Add Work Experience</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Facility/Hospital Name</Label>
                  <Input
                    data-testid="work-facility-input"
                    value={newWorkHistory.facility_name}
                    onChange={(e) => setNewWorkHistory({ ...newWorkHistory, facility_name: e.target.value })}
                    placeholder="Memorial Hospital"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Position/Title</Label>
                  <Input
                    data-testid="work-position-input"
                    value={newWorkHistory.position}
                    onChange={(e) => setNewWorkHistory({ ...newWorkHistory, position: e.target.value })}
                    placeholder="ICU Registered Nurse"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Department/Unit</Label>
                  <Input
                    data-testid="work-department-input"
                    value={newWorkHistory.department}
                    onChange={(e) => setNewWorkHistory({ ...newWorkHistory, department: e.target.value })}
                    placeholder="Intensive Care Unit"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newWorkHistory.is_current}
                      onChange={(e) => setNewWorkHistory({ ...newWorkHistory, is_current: e.target.checked })}
                      className="rounded border-border"
                    />
                    <span className="text-sm">Currently working here</span>
                  </label>
                </div>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    data-testid="work-start-input"
                    type="month"
                    value={newWorkHistory.start_date}
                    onChange={(e) => setNewWorkHistory({ ...newWorkHistory, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    data-testid="work-end-input"
                    type="month"
                    value={newWorkHistory.end_date}
                    onChange={(e) => setNewWorkHistory({ ...newWorkHistory, end_date: e.target.value })}
                    disabled={newWorkHistory.is_current}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Key Responsibilities</Label>
                <Textarea
                  data-testid="work-responsibilities-input"
                  value={newWorkHistory.responsibilities}
                  onChange={(e) => setNewWorkHistory({ ...newWorkHistory, responsibilities: e.target.value })}
                  placeholder="Describe your key responsibilities and achievements..."
                  rows={3}
                />
              </div>
              <Button
                data-testid="add-work-btn"
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (newWorkHistory.facility_name && newWorkHistory.position) {
                    addToArray("work_history", newWorkHistory);
                    setNewWorkHistory({
                      facility_name: "",
                      position: "",
                      department: "",
                      start_date: "",
                      end_date: "",
                      is_current: false,
                      responsibilities: ""
                    });
                  } else {
                    toast.error("Please enter facility name and position");
                  }
                }}
              >
                <Plus className="w-4 h-4 mr-2" /> Add Work Experience
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Credentials Tab */}
      <TabsContent value="credentials" className="space-y-6">
        {/* Certifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Certifications
            </CardTitle>
            <CardDescription>Your professional certifications (BLS, ACLS, etc.)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 mb-4">
              {(profile.certifications || []).map((cert, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1 py-1.5 px-3">
                  <Award className="w-3 h-3" />
                  {cert.name}
                  {cert.expiration && <span className="text-xs opacity-70 ml-1">exp: {cert.expiration}</span>}
                  <button
                    type="button"
                    onClick={() => removeFromArray("certifications", index)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                data-testid="new-cert-name-input"
                placeholder="Certification name (e.g., BLS, ACLS)"
                value={newCert.name}
                onChange={(e) => setNewCert({ ...newCert, name: e.target.value })}
              />
              <Input
                data-testid="new-cert-exp-input"
                type="date"
                value={newCert.expiration}
                onChange={(e) => setNewCert({ ...newCert, expiration: e.target.value })}
                className="w-40"
              />
              <Button
                data-testid="add-cert-btn"
                type="button"
                variant="outline"
                onClick={() => {
                  if (newCert.name) {
                    addToArray("certifications", newCert);
                    setNewCert({ name: "", expiration: "" });
                  }
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Licenses */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              Professional Licenses
            </CardTitle>
            <CardDescription>Your state nursing/professional licenses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing Licenses */}
            {(profile.licenses || []).length > 0 && (
              <div className="space-y-2 mb-4">
                {profile.licenses.map((lic, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{lic.name} - {lic.state}</p>
                      <p className="text-xs text-muted-foreground">
                        {lic.license_number && `#${lic.license_number} • `}
                        Exp: {lic.expiration || "N/A"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFromArray("licenses", index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="grid sm:grid-cols-4 gap-2">
              <Input
                data-testid="new-license-name-input"
                placeholder="License type (e.g., RN)"
                value={newLicense.name}
                onChange={(e) => setNewLicense({ ...newLicense, name: e.target.value })}
              />
              <Input
                data-testid="new-license-state-input"
                placeholder="State"
                value={newLicense.state}
                onChange={(e) => setNewLicense({ ...newLicense, state: e.target.value })}
              />
              <Input
                data-testid="new-license-number-input"
                placeholder="License #"
                value={newLicense.license_number}
                onChange={(e) => setNewLicense({ ...newLicense, license_number: e.target.value })}
              />
              <Input
                data-testid="new-license-exp-input"
                type="date"
                value={newLicense.expiration}
                onChange={(e) => setNewLicense({ ...newLicense, expiration: e.target.value })}
              />
            </div>
            <Button
              data-testid="add-license-btn"
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                if (newLicense.name && newLicense.state) {
                  addToArray("licenses", newLicense);
                  setNewLicense({ name: "", state: "", expiration: "", license_number: "" });
                }
              }}
            >
              <Plus className="w-4 h-4 mr-2" /> Add License
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Medical Records Tab */}
      <TabsContent value="medical" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Medical Records & Immunizations
            </CardTitle>
            <CardDescription>Track your health clearances and immunization records</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Info Banner */}
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Note:</strong> This section helps you track your medical compliance requirements. 
                Upload actual documents in the Documents section for verification.
              </p>
            </div>

            {/* Existing Medical Records */}
            {(profile.medical_records || []).length > 0 && (
              <div className="space-y-2 mb-4">
                {profile.medical_records.map((record, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{record.record_type}</p>
                      <p className="text-xs text-muted-foreground">
                        Completed: {record.date_completed}
                        {record.expiration_date && ` • Expires: ${record.expiration_date}`}
                        {record.result && ` • Result: ${record.result}`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFromArray("medical_records", index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Medical Record */}
            <div className="p-4 border border-dashed border-border rounded-xl space-y-4">
              <p className="text-sm font-medium text-foreground">Add Medical Record</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Record Type</Label>
                  <Select
                    value={newMedicalRecord.record_type}
                    onValueChange={(value) => setNewMedicalRecord({ ...newMedicalRecord, record_type: value })}
                  >
                    <SelectTrigger data-testid="medical-type-select">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {medicalRecordTypes.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date Completed</Label>
                  <Input
                    data-testid="medical-date-input"
                    type="date"
                    value={newMedicalRecord.date_completed}
                    onChange={(e) => setNewMedicalRecord({ ...newMedicalRecord, date_completed: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expiration Date (if applicable)</Label>
                  <Input
                    data-testid="medical-exp-input"
                    type="date"
                    value={newMedicalRecord.expiration_date}
                    onChange={(e) => setNewMedicalRecord({ ...newMedicalRecord, expiration_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Result (if applicable)</Label>
                  <Input
                    data-testid="medical-result-input"
                    value={newMedicalRecord.result}
                    onChange={(e) => setNewMedicalRecord({ ...newMedicalRecord, result: e.target.value })}
                    placeholder="e.g., Negative, Immune, Complete"
                  />
                </div>
              </div>
              <Button
                data-testid="add-medical-btn"
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (newMedicalRecord.record_type && newMedicalRecord.date_completed) {
                    addToArray("medical_records", newMedicalRecord);
                    setNewMedicalRecord({
                      record_type: "",
                      date_completed: "",
                      expiration_date: "",
                      result: ""
                    });
                  } else {
                    toast.error("Please select record type and completion date");
                  }
                }}
              >
                <Plus className="w-4 h-4 mr-2" /> Add Medical Record
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Preferences Tab */}
      <TabsContent value="preferences" className="space-y-6">
        {/* Pay & Benefits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Pay Expectations
            </CardTitle>
            <CardDescription>Your compensation preferences</CardDescription>
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
                    value={profile.expected_pay?.min || ""}
                    onChange={(e) => updateField("expected_pay", { ...profile.expected_pay, min: parseInt(e.target.value) || 0 })}
                    className="pl-10"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Desired Hourly Rate</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    data-testid="max-pay-input"
                    type="number"
                    value={profile.expected_pay?.max || ""}
                    onChange={(e) => updateField("expected_pay", { ...profile.expected_pay, max: parseInt(e.target.value) || 0 })}
                    className="pl-10"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Desired Benefits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary" />
              Desired Benefits
            </CardTitle>
            <CardDescription>Benefits you&apos;re looking for</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {benefitOptions.map((benefit) => (
                <button
                  key={benefit}
                  type="button"
                  onClick={() => {
                    const current = profile.desired_benefits || [];
                    if (current.includes(benefit)) {
                      updateField("desired_benefits", current.filter(b => b !== benefit));
                    } else {
                      updateField("desired_benefits", [...current, benefit]);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                    (profile.desired_benefits || []).includes(benefit)
                      ? "bg-secondary text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                  }`}
                >
                  {benefit}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Preferred Locations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Preferred Locations
            </CardTitle>
            <CardDescription>Where you&apos;d like to work</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                data-testid="new-location-input"
                placeholder="City, State"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
              />
              <Button
                data-testid="add-location-btn"
                type="button"
                variant="outline"
                onClick={() => {
                  if (newLocation) {
                    addToArray("preferred_locations", newLocation);
                    setNewLocation("");
                  }
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(profile.preferred_locations || []).map((loc, index) => (
                <Badge key={index} variant="outline" className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {loc}
                  <button
                    type="button"
                    onClick={() => removeFromArray("preferred_locations", index)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};

// Poster Profile Form
const PosterProfileForm = ({ profile, updateField, specialties }) => {
  return (
    <div className="space-y-6">
      {/* Company Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5 text-primary" />
            Company Information
          </CardTitle>
          <CardDescription>Tell job seekers about your facility</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company_name">Company/Facility Name</Label>
            <Input
              data-testid="company-name-input"
              id="company_name"
              value={profile.company_name || ""}
              onChange={(e) => updateField("company_name", e.target.value)}
              placeholder="e.g., Memorial Hospital"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company_description">About Your Facility</Label>
            <Textarea
              data-testid="company-description-input"
              id="company_description"
              value={profile.company_description || ""}
              onChange={(e) => updateField("company_description", e.target.value)}
              placeholder="Describe your facility, culture, and what makes it a great place to work..."
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company_logo">Logo URL</Label>
            <Input
              data-testid="company-logo-input"
              id="company_logo"
              value={profile.company_logo || ""}
              onChange={(e) => updateField("company_logo", e.target.value)}
              placeholder="https://..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Contact Information
          </CardTitle>
          <CardDescription>How candidates can reach you</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_email">Contact Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  data-testid="poster-email-input"
                  id="contact_email"
                  type="email"
                  value={profile.contact_info?.email || ""}
                  onChange={(e) => updateField("contact_info", { ...profile.contact_info, email: e.target.value })}
                  className="pl-10"
                  placeholder="hr@company.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_phone">Contact Phone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  data-testid="poster-phone-input"
                  id="contact_phone"
                  value={profile.contact_info?.phone || ""}
                  onChange={(e) => updateField("contact_info", { ...profile.contact_info, phone: e.target.value })}
                  className="pl-10"
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_address">Address</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                data-testid="poster-address-input"
                id="contact_address"
                value={profile.contact_info?.address || ""}
                onChange={(e) => updateField("contact_info", { ...profile.contact_info, address: e.target.value })}
                className="pl-10"
                placeholder="123 Main St, City, State 12345"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileBuilder;
