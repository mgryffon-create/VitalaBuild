import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import {
  Briefcase, Users, ShieldCheck, ArrowRight, ArrowLeft, MapPin, Building2, CheckCircle,
} from "lucide-react";

const ORG_TYPES = [
  "Hospital / Health System",
  "Skilled Nursing Facility",
  "Home Health Agency",
  "Staffing Agency",
  "Outpatient Clinic",
  "Rehabilitation Center",
  "Long-Term Care Facility",
  "Other",
];

const INTRO_SLIDES = [
  {
    icon: Briefcase,
    title: "Post jobs in seconds",
    description: "Create structured, high-quality job postings that attract the right candidates with clear pay, shift, and schedule details.",
  },
  {
    icon: Users,
    title: "Match with qualified professionals",
    description: "Our matching system connects you with healthcare workers whose skills, experience, and preferences align with your open roles.",
  },
  {
    icon: ShieldCheck,
    title: "Hire faster with verified credentials",
    description: "Candidates manage licenses, certifications, and compliance documents on the platform, so you can verify readiness instantly.",
  },
];

const EmployerOnboardingFlow = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState("intro"); // intro, profile, done
  const [slideIndex, setSlideIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [existingProfile, setExistingProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    company_name: "",
    org_type: "",
    location: "",
    company_description: "",
  });

  // Check if already onboarded
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([
      axios.get(`${API}/profile/completion`),
      axios.get(`${API}/profile/poster`).catch(() => ({ data: {} })),
    ]).then(([compRes, profRes]) => {
      if (cancelled) return;
      if (compRes.data.complete) {
        navigate("/poster", { replace: true });
        return;
      }
      const profile = profRes.data || {};
      setExistingProfile(profile);
      if (profile.company_name) {
        setForm((prev) => ({
          ...prev,
          company_name: profile.company_name || "",
          org_type: profile.org_type || "",
          location: profile.location || "",
          company_description: profile.company_description || "",
        }));
      }
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user, navigate]);

  const handleSaveProfile = async () => {
    if (!form.company_name.trim()) {
      toast.error("Facility name is required");
      return;
    }
    if (!form.company_description.trim() || form.company_description.trim().length < 20) {
      toast.error("Please add a short description (at least 20 characters)");
      return;
    }

    setSaving(true);
    try {
      await axios.put(`${API}/profile/poster`, {
        company_name: form.company_name.trim(),
        company_description: form.company_description.trim(),
        org_type: form.org_type || null,
        contact_info: {
          location: form.location || null,
        },
      });
      toast.success("Profile saved");
      navigate("/poster/jobs/new");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  // Step: Intro slides
  if (step === "intro") {
    const slide = INTRO_SLIDES[slideIndex];
    const Icon = slide.icon;
    const isLast = slideIndex === INTRO_SLIDES.length - 1;

    return (
      <div data-testid="employer-onboarding-intro" className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full space-y-8">
          {/* Slide indicators */}
          <div className="flex justify-center gap-2">
            {INTRO_SLIDES.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === slideIndex ? "w-8 bg-primary" : "w-2 bg-muted-foreground/20"}`}
              />
            ))}
          </div>

          {/* Slide content */}
          <div className="text-center space-y-4" key={slideIndex}>
            <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
              <Icon className="w-8 h-8 text-primary" />
            </div>
            <h1 data-testid="intro-slide-title" className="text-2xl font-bold text-foreground">
              {slide.title}
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              {slide.description}
            </p>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4">
            <Button
              data-testid="skip-intro-btn"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => setStep("profile")}
            >
              Skip
            </Button>
            <Button
              data-testid="next-intro-btn"
              onClick={() => {
                if (isLast) {
                  setStep("profile");
                } else {
                  setSlideIndex(slideIndex + 1);
                }
              }}
            >
              {isLast ? "Get Started" : "Next"} <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Step: Profile form
  return (
    <div data-testid="employer-onboarding-profile" className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-lg w-full">
        <CardContent className="p-6 sm:p-8 space-y-6">
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground -ml-2 mb-2"
              onClick={() => setStep("intro")}
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <h1 className="text-xl font-bold text-foreground">Set up your facility</h1>
            <p className="text-sm text-muted-foreground mt-1">
              This helps candidates find and trust your postings
            </p>
          </div>

          <div className="space-y-4">
            {/* Facility name */}
            <div className="space-y-1.5">
              <Label htmlFor="company_name">Facility / Company Name *</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="company_name"
                  data-testid="onboarding-company-name"
                  value={form.company_name}
                  onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))}
                  placeholder="e.g., Sunrise Medical Center"
                  className="pl-10"
                />
              </div>
            </div>

            {/* Org type */}
            <div className="space-y-1.5">
              <Label>Organization Type</Label>
              <Select value={form.org_type} onValueChange={(v) => setForm((p) => ({ ...p, org_type: v }))}>
                <SelectTrigger data-testid="onboarding-org-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {ORG_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <Label>Primary Location</Label>
              <LocationAutocomplete
                locations={form.location ? [form.location] : []}
                onAdd={(city) => setForm((p) => ({ ...p, location: city }))}
                onRemove={() => setForm((p) => ({ ...p, location: "" }))}
                testId="onboarding-location"
                placeholder="Search city (e.g., Los Angeles, CA)"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="company_desc">Short Description *</Label>
              <Textarea
                id="company_desc"
                data-testid="onboarding-description"
                value={form.company_description}
                onChange={(e) => setForm((p) => ({ ...p, company_description: e.target.value }))}
                placeholder="What makes your facility a great place to work?"
                rows={3}
              />
              {form.company_description && form.company_description.length < 20 && (
                <p className="text-xs text-amber-500">{20 - form.company_description.length} more characters needed</p>
              )}
            </div>
          </div>

          {/* Submit */}
          <Button
            data-testid="save-profile-btn"
            className="w-full h-11"
            onClick={handleSaveProfile}
            disabled={saving || !form.company_name.trim() || form.company_description.trim().length < 20}
          >
            {saving ? "Saving..." : "Continue to Post Job"} <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            You can update these details anytime from your profile settings
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployerOnboardingFlow;
