import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth, API } from "@/App";
import axios from "axios";
import {
  Briefcase, Shield, MessageCircle, FileText,
  ArrowRight, ChevronRight, CheckCircle, Lock,
} from "lucide-react";

const STEPS = [
  {
    id: "welcome",
    title: "Welcome to VitalaMatch",
    subtitle: "Your single profile. Every healthcare job.",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          VitalaMatch matches you with healthcare jobs based on your role, skills, and preferences.
        </p>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5">
            <Briefcase className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">No long applications</p>
              <p className="text-xs text-muted-foreground">Your profile acts as your universal application for every job on the platform.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5">
            <MessageCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Direct employer connection</p>
              <p className="text-xs text-muted-foreground">Chat directly with hiring managers. No middlemen, no waiting.</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "requirements",
    title: "What you need to get started",
    subtitle: "Just two things to unlock job matches.",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          To show you the right jobs, we need to know your professional role and license.
          This ensures you only see positions you're qualified for.
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-primary">1</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Professional Role</p>
              <p className="text-xs text-muted-foreground">CNA, RN, LPN, or your specific credential</p>
            </div>
            <Lock className="w-4 h-4 text-primary/40" />
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-primary">2</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">License Information</p>
              <p className="text-xs text-muted-foreground">State license or certification details</p>
            </div>
            <Lock className="w-4 h-4 text-primary/40" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center italic">
          That's it! Everything else can be added later.
        </p>
      </div>
    ),
  },
  {
    id: "vault",
    title: "Your Document Vault",
    subtitle: "Upload once, use everywhere.",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your document vault stores your credentials so you never have to re-upload them for every job.
          Once uploaded, they're reused automatically.
        </p>
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30">
          <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-2">You do NOT need everything right now</p>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="text-xs">
              <p className="font-medium text-foreground mb-1">Helpful later:</p>
              <p className="text-muted-foreground">BLS / ACLS</p>
              <p className="text-muted-foreground">TB test</p>
              <p className="text-muted-foreground">Vaccinations</p>
            </div>
            <div className="text-xs">
              <p className="font-medium text-foreground mb-1">After offer only:</p>
              <p className="text-muted-foreground">Background check</p>
              <p className="text-muted-foreground">Drug screen</p>
              <p className="text-muted-foreground">I-9 form</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Uploading more documents helps you get hired faster, but is never required to browse jobs.
        </p>
      </div>
    ),
  },
  {
    id: "flow",
    title: "What happens next",
    subtitle: "From browsing to hired — all in one place.",
    content: (
      <div className="space-y-3">
        {[
          { icon: Briefcase, label: "Browse jobs", desc: "See positions matched to your role" },
          { icon: CheckCircle, label: "Match with employers", desc: "Express interest, get matched" },
          { icon: MessageCircle, label: "Chat directly", desc: "Message hiring managers in-app" },
          { icon: FileText, label: "Receive & accept offers", desc: "Review structured offers with pay, benefits, terms" },
          { icon: Shield, label: "Complete onboarding", desc: "Everything in one shared workspace" },
        ].map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
              i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              <step.icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{step.label}</p>
              <p className="text-xs text-muted-foreground">{step.desc}</p>
            </div>
            {i < 4 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />}
          </div>
        ))}
      </div>
    ),
  },
];

const SeekerWalkthrough = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div data-testid="seeker-walkthrough" className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full">
        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mb-6">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              data-testid={`step-dot-${s.id}`}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-6 bg-primary" : i < step ? "w-3 bg-primary/40" : "w-3 bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="bg-card border rounded-2xl p-6 shadow-sm">
          <div className="text-center mb-5">
            <h2 data-testid="walkthrough-title" className="text-lg font-bold text-foreground">{current.title}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{current.subtitle}</p>
          </div>

          <div data-testid={`walkthrough-step-${current.id}`}>
            {current.content}
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-6">
            {step > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep(step - 1)}
                data-testid="walkthrough-back"
                className="flex-none"
              >
                Back
              </Button>
            )}
            <div className="flex-1" />
            {!isLast ? (
              <Button
                onClick={() => setStep(step + 1)}
                data-testid="walkthrough-next"
                className="min-w-[120px]"
              >
                Next <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={onComplete}
                data-testid="walkthrough-complete"
                className="min-w-[160px]"
              >
                Complete Profile <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>

          {/* Skip link */}
          {!isLast && (
            <button
              onClick={onComplete}
              data-testid="walkthrough-skip"
              className="block w-full text-center text-xs text-muted-foreground/60 hover:text-muted-foreground mt-3 transition-colors"
            >
              Skip intro
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Wrapper that shows walkthrough for first-time seekers, then falls through to OnboardingGate.
 */
export const SeekerOnboardingWrapper = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileStatus, setProfileStatus] = useState(null);

  useEffect(() => {
    if (!user || user.role !== "seeker") {
      setLoading(false);
      return;
    }

    const walkthroughSeen = localStorage.getItem(`walkthrough_seen_${user.id}`);
    
    axios.get(`${API}/profile/completion`)
      .then((res) => {
        setProfileStatus(res.data);
        // Show walkthrough if never seen AND profile is incomplete
        if (!walkthroughSeen && !res.data?.complete) {
          setShowWalkthrough(true);
        }
      })
      .catch(() => {
        setProfileStatus({ complete: true, percentage: 100 });
      })
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (showWalkthrough) {
    return (
      <SeekerWalkthrough
        onComplete={() => {
          localStorage.setItem(`walkthrough_seen_${user.id}`, "true");
          setShowWalkthrough(false);
          navigate("/seeker/profile");
        }}
      />
    );
  }

  // Fall through to children (which includes OnboardingGate)
  return children;
};

export default SeekerWalkthrough;
