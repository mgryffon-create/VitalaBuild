import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/App";
import { FileText, Shield, Users, CheckCircle, Lock, LogIn, Briefcase, User } from "lucide-react";

const LandingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const features = [
    { icon: <FileText className="w-5 h-5" />, title: "Universal Application", description: "One profile works across all positions and facilities" },
    { icon: <Lock className="w-5 h-5" />, title: "Secure Document Vault", description: "Store licenses, certifications, and compliance docs safely" },
    { icon: <Shield className="w-5 h-5" />, title: "Verified Credentials", description: "Track certifications and licenses with expiration reminders" },
    { icon: <Users className="w-5 h-5" />, title: "Portable References", description: "Confidential references that follow you across applications" },
  ];

  const benefits = [
    "One profile for every application",
    "Document expiration tracking & alerts",
    "Verified credential management",
    "Direct messaging with employers",
    "Comprehensive profile builder",
    "Secure document storage",
  ];

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      {/* ── Navbar ─────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <img src="/images/vitalamatch-logo.png" alt="VitalaMatch" className="h-8 sm:h-10 w-auto" />
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {user ? (
              <Button
                data-testid="dashboard-btn"
                onClick={() => navigate(user.role === "seeker" ? "/seeker" : "/poster")}
                className="bg-primary hover:bg-primary/90"
                size="sm"
              >
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button data-testid="login-btn" variant="ghost" size="sm" onClick={() => navigate("/auth")}>
                  Sign In
                </Button>
                <Button
                  data-testid="get-started-btn"
                  onClick={() => navigate("/auth")}
                  className="bg-primary hover:bg-primary/90 hidden sm:inline-flex"
                  size="sm"
                >
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero Section ───────────────────────────────── */}
      <section className="pt-20 sm:pt-28 pb-8 sm:pb-16 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left — copy + CTA buttons (visible on first screen mobile) */}
            <div className="space-y-5 sm:space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/10 text-secondary border border-secondary/20">
                <span className="text-xs sm:text-sm font-medium">For Healthcare Professionals</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight tracking-tight">
                Your Healthcare
                <span className="text-primary"> Career </span>
                Starts Here
              </h1>

              <p className="text-base sm:text-lg text-muted-foreground max-w-lg leading-relaxed">
                A secure platform to manage credentials, connect with top facilities, and find your next opportunity.
              </p>

              {/* Primary CTA — above the fold on mobile */}
              <div data-testid="hero-cta-group" className="flex flex-col sm:flex-row gap-3">
                <Button
                  data-testid="hero-seeker-btn"
                  size="lg"
                  onClick={() => navigate("/auth")}
                  className="bg-primary hover:bg-primary/90 text-base w-full sm:w-auto px-8 py-5"
                >
                  <Briefcase className="w-4 h-4 mr-2" /> I&apos;m a Job Seeker
                </Button>
                <Button
                  data-testid="hero-employer-btn"
                  size="lg"
                  variant="outline"
                  onClick={() => navigate("/auth")}
                  className="text-base w-full sm:w-auto px-8 py-5"
                >
                  <User className="w-4 h-4 mr-2" /> I&apos;m an Employer
                </Button>
              </div>
            </div>

            {/* Right — hero image (small banner on mobile, large on desktop) */}
            <div className="relative">
              <div className="rounded-2xl lg:rounded-3xl overflow-hidden shadow-xl">
                <img
                  src="https://images.unsplash.com/photo-1758691463393-a2aa9900af8a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2MzR8MHwxfHNlYXJjaHwxfHxzbWlsaW5nJTIwZG9jdG9yJTIwcG9ydHJhaXQlMjB3aGl0ZSUyMGNvYXR8ZW58MHx8fHwxNzY2Mjc5MjcwfDA&ixlib=rb-4.1.0&q=85"
                  alt="Healthcare Professional"
                  className="w-full h-[180px] sm:h-[280px] lg:h-[440px] object-cover"
                />
              </div>
              <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-primary/20 rounded-full blur-3xl hidden lg:block" />
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-secondary/20 rounded-full blur-3xl hidden lg:block" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature Cards ──────────────────────────────── */}
      <section id="features" className="py-10 sm:py-16 px-4 sm:px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">
              Why VitalaMatch?
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
              Built for healthcare professionals who value security and efficiency
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            {features.map((f, i) => (
              <div key={i} className="p-4 sm:p-5 rounded-xl bg-card border border-border hover-lift">
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                  {f.icon}
                </div>
                <h3 className="text-sm sm:text-base font-semibold text-foreground mb-1">{f.title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Benefits ───────────────────────────────────── */}
      <section className="py-10 sm:py-16 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Image — small banner on mobile */}
            <div className="rounded-2xl lg:rounded-3xl overflow-hidden shadow-lg order-2 lg:order-1">
              <img
                src="https://images.unsplash.com/photo-1762625570087-6d98fca29531?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBtZWRpY2FsJTIwaW50ZXJpb3J8ZW58MHx8fHwxNzY2Mjc5MjczfDA&ixlib=rb-4.1.0&q=85"
                alt="Modern Medical Facility"
                className="w-full h-[160px] sm:h-[240px] lg:h-[380px] object-cover"
              />
            </div>
            {/* Copy */}
            <div className="space-y-5 order-1 lg:order-2">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">
                Everything You Need in One Platform
              </h2>
              <div className="grid gap-2.5 sm:gap-3">
                {benefits.map((b, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
                      <CheckCircle className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm sm:text-base text-foreground">{b}</span>
                  </div>
                ))}
              </div>
              <Button
                data-testid="benefits-cta-btn"
                onClick={() => navigate("/auth")}
                className="bg-secondary hover:bg-secondary/90 w-full sm:w-auto"
              >
                Create Your Profile
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ─────────────────────────────────── */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 bg-primary">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Ready to Take the Next Step?
          </h2>
          <p className="text-primary-foreground/80 text-sm sm:text-base mb-6 max-w-xl mx-auto">
            Join thousands of healthcare professionals and facilities already using VitalaMatch
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Button
              data-testid="cta-seeker-btn"
              size="lg"
              onClick={() => navigate("/auth")}
              className="bg-white text-primary hover:bg-white/90 w-full sm:w-auto"
            >
              I&apos;m a Job Seeker
            </Button>
            <Button
              data-testid="cta-poster-btn"
              size="lg"
              variant="outline"
              onClick={() => navigate("/auth")}
              className="border-white text-white hover:bg-white/10 w-full sm:w-auto"
            >
              I&apos;m an Employer
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────── */}
      <footer className="py-8 px-4 sm:px-6 border-t border-border">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <img src="/images/vitalamatch-logo.png" alt="VitalaMatch" className="h-7 w-auto" />
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <a href="/terms" className="hover:text-foreground transition-colors" data-testid="footer-terms">Terms of Service</a>
            <a href="/privacy" className="hover:text-foreground transition-colors" data-testid="footer-privacy">Privacy Policy</a>
            <span>&copy; 2025 VitalaMatch</span>
          </div>
        </div>
      </footer>

      {/* ── Sticky Mobile Action Bar ───────────────────── */}
      {!user && (
        <div
          data-testid="mobile-sticky-bar"
          className="md:hidden fixed bottom-0 left-0 right-0 z-[10001] bg-card border-t border-border px-3 py-2.5"
        >
          <div className="flex items-center gap-2">
            <Button
              data-testid="sticky-seeker-btn"
              size="sm"
              onClick={() => navigate("/auth")}
              className="flex-1 bg-primary hover:bg-primary/90 text-xs h-9"
            >
              <Briefcase className="w-3.5 h-3.5 mr-1" /> Job Seeker
            </Button>
            <Button
              data-testid="sticky-employer-btn"
              size="sm"
              variant="outline"
              onClick={() => navigate("/auth")}
              className="flex-1 text-xs h-9"
            >
              <User className="w-3.5 h-3.5 mr-1" /> Employer
            </Button>
            <Button
              data-testid="sticky-login-btn"
              size="sm"
              variant="ghost"
              onClick={() => navigate("/auth")}
              className="text-xs h-9 px-3"
            >
              <LogIn className="w-3.5 h-3.5 mr-1" /> Login
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
