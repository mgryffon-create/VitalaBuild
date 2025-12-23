import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/App";
import { Heart, Briefcase, Shield, Users, ArrowRight, CheckCircle } from "lucide-react";

const LandingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const features = [
    {
      icon: <Heart className="w-6 h-6" />,
      title: "Swipe to Match",
      description: "Find your perfect job or candidate with our intuitive matching system"
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Verified Credentials",
      description: "Track certifications, licenses, and medical records with expiration reminders"
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Blind References",
      description: "Confidential reference system that protects both seekers and facilities"
    },
    {
      icon: <Briefcase className="w-6 h-6" />,
      title: "Smart Compatibility",
      description: "AI-powered matching based on skills, preferences, and requirements"
    }
  ];

  const benefits = [
    "Universal application for all positions",
    "Document expiration tracking",
    "Flexible notification preferences",
    "Direct messaging after matching",
    "Comprehensive profile builder",
    "Location-based job matching"
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground font-['Manrope']">VitalaMatch</span>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <Button
                data-testid="dashboard-btn"
                onClick={() => navigate(user.role === "seeker" ? "/seeker" : "/poster")}
                className="bg-primary hover:bg-primary/90"
              >
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button
                  data-testid="login-btn"
                  variant="ghost"
                  onClick={() => navigate("/auth")}
                >
                  Sign In
                </Button>
                <Button
                  data-testid="get-started-btn"
                  onClick={() => navigate("/auth")}
                  className="bg-primary hover:bg-primary/90"
                >
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8 animate-fade-in-up">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 text-secondary border border-secondary/20">
                <span className="text-sm font-medium">For Healthcare Professionals</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight tracking-tight">
                Find Your Perfect
                <span className="text-primary"> Medical Career </span>
                Match
              </h1>
              <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                Swipe through opportunities, connect with top healthcare facilities, and land your dream position with our innovative matching platform.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button
                  data-testid="hero-get-started-btn"
                  size="lg"
                  onClick={() => navigate("/auth")}
                  className="bg-primary hover:bg-primary/90 text-lg px-8 py-6"
                >
                  Start Matching <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                <Button
                  data-testid="hero-learn-more-btn"
                  size="lg"
                  variant="outline"
                  className="text-lg px-8 py-6"
                >
                  Learn More
                </Button>
              </div>
            </div>
            <div className="relative animate-fade-in-up stagger-2">
              <div className="relative z-10 rounded-3xl overflow-hidden shadow-2xl">
                <img
                  src="https://images.unsplash.com/photo-1758691463393-a2aa9900af8a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2MzR8MHwxfHNlYXJjaHwxfHxzbWlsaW5nJTIwZG9jdG9yJTIwcG9ydHJhaXQlMjB3aGl0ZSUyMGNvYXR8ZW58MHx8fHwxNzY2Mjc5MjcwfDA&ixlib=rb-4.1.0&q=85"
                  alt="Medical Professional"
                  className="w-full h-[500px] object-cover"
                />
              </div>
              <div className="absolute -bottom-6 -left-6 w-48 h-48 bg-primary/20 rounded-full blur-3xl"></div>
              <div className="absolute -top-6 -right-6 w-32 h-32 bg-secondary/20 rounded-full blur-3xl"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Why Choose VitalaMatch?
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              We've reimagined healthcare recruiting with modern technology and a user-first approach
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className={`p-6 rounded-2xl bg-card border border-border hover-lift animate-fade-in-up stagger-${index + 1}`}
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative animate-fade-in-up">
              <div className="rounded-3xl overflow-hidden shadow-xl">
                <img
                  src="https://images.unsplash.com/photo-1762625570087-6d98fca29531?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBtZWRpY2FsJTIwaW50ZXJpb3J8ZW58MHx8fHwxNzY2Mjc5MjczfDA&ixlib=rb-4.1.0&q=85"
                  alt="Modern Medical Facility"
                  className="w-full h-[400px] object-cover"
                />
              </div>
            </div>
            <div className="space-y-8 animate-fade-in-up stagger-2">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
                Everything You Need in One Platform
              </h2>
              <div className="grid gap-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-secondary/10 text-secondary flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <span className="text-foreground">{benefit}</span>
                  </div>
                ))}
              </div>
              <Button
                data-testid="benefits-cta-btn"
                onClick={() => navigate("/auth")}
                className="bg-secondary hover:bg-secondary/90"
              >
                Create Your Profile
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-primary">
        <div className="max-w-4xl mx-auto text-center animate-fade-in-up">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to Find Your Match?
          </h2>
          <p className="text-primary-foreground/80 text-lg mb-8 max-w-2xl mx-auto">
            Join thousands of healthcare professionals and facilities already connecting on VitalaMatch
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button
              data-testid="cta-seeker-btn"
              size="lg"
              onClick={() => navigate("/auth")}
              className="bg-white text-primary hover:bg-white/90"
            >
              I'm a Job Seeker
            </Button>
            <Button
              data-testid="cta-poster-btn"
              size="lg"
              variant="outline"
              onClick={() => navigate("/auth")}
              className="border-white text-white hover:bg-white/10"
            >
              I'm Hiring
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Heart className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-foreground">VitalaMatch</span>
            </div>
            <p className="text-muted-foreground text-sm">
              © 2024 VitalaMatch. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
