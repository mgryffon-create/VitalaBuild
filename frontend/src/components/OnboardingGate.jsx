import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth, API } from "@/App";
import axios from "axios";
import { CheckCircle, Circle, ArrowRight, ExternalLink } from "lucide-react";

// Where each check item should route when clicked
const SEEKER_CHECK_CONFIG = {
  specialty:                { label: "Role & Specialty",             route: "/seeker/profile",                                          tab: "basic" },
  years_experience:         { label: "Years of Experience",          route: "/seeker/profile",                                          tab: "basic" },
  availability:             { label: "Availability",                 route: "/seeker/profile",                                          tab: "basic" },
  preferred_shift:          { label: "Shift Preference",             route: "/seeker/profile",                                          tab: "basic" },
  travel_readiness:         { label: "Travel Readiness",             route: "/seeker/profile",                                          tab: "preferences" },
  job_type_preference:      { label: "Job Type Preference",          route: "/seeker/profile",                                          tab: "preferences" },
  experience_highlights:    { label: "Experience Highlights (2+)",   route: "/seeker/profile",                                          tab: "basic" },
  certifications_or_licenses: { label: "Certification or License",   route: "/seeker/vault?category=certification&from=completion",      isVault: true },
};

const POSTER_LABELS = {
  company_name:       { label: "Company Name",                       route: "/poster/profile" },
  company_description:{ label: "Company Description",                route: "/poster/profile" },
  contact_info:       { label: "Contact Info",                       route: "/poster/profile" },
  has_job_posted:     { label: "At Least 1 Job Posted",              route: "/poster/create-job" },
  has_complete_job:   { label: "Job with Role, Specialty & Location", route: "/poster/create-job" },
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

  const configMap = user?.role === "seeker" ? SEEKER_CHECK_CONFIG : POSTER_LABELS;
  const profilePath = user?.role === "seeker" ? "/seeker/profile" : "/poster/profile";
  const incompleteItems = Object.entries(status.checks || {}).filter(([, done]) => !done);

  const handleCheckClick = (key) => {
    const config = configMap[key];
    if (!config?.route) {
      navigate(profilePath);
      return;
    }
    navigate(config.route);
  };

  return (
    <div data-testid="onboarding-gate" className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-6 space-y-5">
          <div className="text-center">
            <h2 className="text-lg font-bold text-foreground">Complete Your Profile</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {user?.role === "seeker"
                ? "Add your license and role to start viewing jobs"
                : "Finish setting up to unlock all features"}
            </p>
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

          {/* Checklist — clickable items */}
          <div className="space-y-1">
            {Object.entries(status.checks || {}).map(([key, done]) => {
              const config = configMap[key] || {};
              return (
                <button
                  key={key}
                  data-testid={`check-${key}`}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                    done
                      ? "text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 cursor-pointer"
                  }`}
                  onClick={() => !done && handleCheckClick(key)}
                  disabled={done}
                >
                  {done ? (
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                  )}
                  <span className="text-sm flex-1">{config.label || key}</span>
                  {!done && config.isVault && (
                    <ExternalLink className="w-3 h-3 text-muted-foreground/60" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Primary CTA — routes to first incomplete item */}
          <Button
            data-testid="complete-profile-cta"
            className="w-full h-11"
            onClick={() => {
              if (incompleteItems.length > 0) {
                handleCheckClick(incompleteItems[0][0]);
              } else {
                navigate(profilePath);
              }
            }}
          >
            Continue Setup <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingGate;
