import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth, API } from "@/App";
import axios from "axios";
import { CheckCircle, Circle, ArrowRight } from "lucide-react";

const SEEKER_LABELS = {
  specialty: "Role & Specialty",
  years_experience: "Years of Experience",
  availability: "Availability",
  preferred_shift: "Shift Preference",
  travel_readiness: "Travel Readiness",
  job_type_preference: "Job Type Preference",
  experience_highlights: "Experience Highlights (2+)",
  certifications_or_licenses: "Certification or License",
};

const POSTER_LABELS = {
  company_name: "Company Name",
  company_description: "Company Description",
  contact_info: "Contact Info",
  has_job_posted: "At Least 1 Job Posted",
  has_complete_job: "Job with Role, Specialty & Location",
};

const OnboardingGate = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    axios.get(`${API}/profile/completion`)
      .then((res) => setStatus(res.data))
      .catch(() => setStatus({ complete: true, percentage: 100 }))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (!status || status.complete) {
    return children;
  }

  const labels = user?.role === "seeker" ? SEEKER_LABELS : POSTER_LABELS;
  const profilePath = user?.role === "seeker" ? "/seeker/profile" : "/poster/profile";

  return (
    <div data-testid="onboarding-gate" className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-6 space-y-5">
          <div className="text-center">
            <h2 className="text-lg font-bold text-foreground">Complete Your Profile</h2>
            <p className="text-sm text-muted-foreground mt-1">Finish setting up to unlock all features</p>
          </div>

          {/* Progress bar */}
          <div data-testid="onboarding-progress">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Profile completion</span>
              <span className="font-semibold text-foreground">{status.percentage}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${status.percentage >= 80 ? "bg-green-500" : status.percentage >= 50 ? "bg-amber-500" : "bg-primary"}`}
                style={{ width: `${status.percentage}%` }}
              />
            </div>
          </div>

          {/* Checklist */}
          <div className="space-y-2">
            {Object.entries(status.checks || {}).map(([key, done]) => (
              <div key={key} className="flex items-center gap-2.5">
                {done ? (
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                )}
                <span className={`text-sm ${done ? "text-foreground" : "text-muted-foreground"}`}>
                  {labels[key] || key}
                </span>
              </div>
            ))}
          </div>

          <Button
            data-testid="complete-profile-cta"
            className="w-full h-11"
            onClick={() => navigate(profilePath)}
          >
            Complete Profile <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingGate;
