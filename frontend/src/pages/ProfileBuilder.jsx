import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { User, Mail, Phone, MapPin, Plus, X, Briefcase, Award, DollarSign, Heart, Save, CheckCircle } from "lucide-react";

const ProfileBuilder = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({});

  const isSeeker = user?.role === "seeker";

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const endpoint = isSeeker ? "/profile/seeker" : "/profile/poster";
      const response = await axios.get(`${API}${endpoint}`);
      setProfile(response.data || {});
    } catch (error) {
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

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
          <SeekerProfileForm profile={profile} updateField={updateField} addToArray={addToArray} removeFromArray={removeFromArray} />
        ) : (
          <PosterProfileForm profile={profile} updateField={updateField} />
        )}
      </div>
    </DashboardLayout>
  );
};

// Seeker Profile Form
const SeekerProfileForm = ({ profile, updateField, addToArray, removeFromArray }) => {
  const [newCert, setNewCert] = useState({ name: "", expiration: "" });
  const [newLicense, setNewLicense] = useState({ name: "", state: "", expiration: "" });
  const [newBenefit, setNewBenefit] = useState("");
  const [newLocation, setNewLocation] = useState("");

  const specialties = [
    "Registered Nurse (RN)",
    "Licensed Practical Nurse (LPN)",
    "Nurse Practitioner (NP)",
    "Physician Assistant (PA)",
    "Medical Assistant",
    "Certified Nursing Assistant (CNA)",
    "Radiologic Technologist",
    "Physical Therapist",
    "Occupational Therapist",
    "Respiratory Therapist",
    "Pharmacist",
    "Lab Technician",
    "Other"
  ];

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
    "Tuition Reimbursement"
  ];

  return (
    <div className="space-y-6">
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
            <Briefcase className="w-5 h-5 text-primary" />
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
                  {specialties.map((spec) => (
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
              placeholder="Tell employers about yourself..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Certifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            Certifications
          </CardTitle>
          <CardDescription>Your professional certifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              data-testid="new-cert-name-input"
              placeholder="Certification name"
              value={newCert.name}
              onChange={(e) => setNewCert({ ...newCert, name: e.target.value })}
            />
            <Input
              data-testid="new-cert-exp-input"
              type="date"
              value={newCert.expiration}
              onChange={(e) => setNewCert({ ...newCert, expiration: e.target.value })}
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
          <div className="flex flex-wrap gap-2">
            {(profile.certifications || []).map((cert, index) => (
              <Badge key={index} variant="secondary" className="flex items-center gap-1 py-1 px-2">
                <Award className="w-3 h-3" />
                {cert.name}
                {cert.expiration && <span className="text-xs opacity-70">({cert.expiration})</span>}
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
        </CardContent>
      </Card>

      {/* Licenses */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-primary" />
            Licenses
          </CardTitle>
          <CardDescription>Your professional licenses</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              data-testid="new-license-name-input"
              placeholder="License type"
              value={newLicense.name}
              onChange={(e) => setNewLicense({ ...newLicense, name: e.target.value })}
            />
            <Input
              data-testid="new-license-state-input"
              placeholder="State"
              value={newLicense.state}
              onChange={(e) => setNewLicense({ ...newLicense, state: e.target.value })}
              className="w-24"
            />
            <Input
              data-testid="new-license-exp-input"
              type="date"
              value={newLicense.expiration}
              onChange={(e) => setNewLicense({ ...newLicense, expiration: e.target.value })}
            />
            <Button
              data-testid="add-license-btn"
              type="button"
              variant="outline"
              onClick={() => {
                if (newLicense.name) {
                  addToArray("licenses", newLicense);
                  setNewLicense({ name: "", state: "", expiration: "" });
                }
              }}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(profile.licenses || []).map((lic, index) => (
              <Badge key={index} variant="outline" className="flex items-center gap-1 py-1 px-2">
                <CheckCircle className="w-3 h-3" />
                {lic.name} ({lic.state})
                <button
                  type="button"
                  onClick={() => removeFromArray("licenses", index)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pay & Benefits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Pay Expectations & Benefits
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

          <div className="space-y-2">
            <Label>Desired Benefits</Label>
            <div className="flex gap-2">
              <Select value={newBenefit} onValueChange={setNewBenefit}>
                <SelectTrigger data-testid="benefit-select">
                  <SelectValue placeholder="Select benefit" />
                </SelectTrigger>
                <SelectContent>
                  {benefitOptions.map((benefit) => (
                    <SelectItem key={benefit} value={benefit}>{benefit}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                data-testid="add-benefit-btn"
                type="button"
                variant="outline"
                onClick={() => {
                  if (newBenefit && !(profile.desired_benefits || []).includes(newBenefit)) {
                    addToArray("desired_benefits", newBenefit);
                    setNewBenefit("");
                  }
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {(profile.desired_benefits || []).map((benefit, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  <Heart className="w-3 h-3" />
                  {benefit}
                  <button
                    type="button"
                    onClick={() => removeFromArray("desired_benefits", index)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
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
          <CardDescription>Where you'd like to work</CardDescription>
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
    </div>
  );
};

// Poster Profile Form
const PosterProfileForm = ({ profile, updateField }) => {
  return (
    <div className="space-y-6">
      {/* Company Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
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
