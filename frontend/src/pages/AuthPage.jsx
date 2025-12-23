import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/App";
import { toast } from "sonner";
import { Heart, Briefcase, User, Mail, Lock, ArrowLeft } from "lucide-react";

const AuthPage = () => {
  const navigate = useNavigate();
  const { login, register, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState("seeker");

  // Redirect if already logged in - use useEffect to avoid setState during render
  useEffect(() => {
    if (user) {
      navigate(user.role === "seeker" ? "/seeker" : "/poster", { replace: true });
    }
  }, [user, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const formData = new FormData(e.target);
    
    try {
      const userData = await login(
        formData.get("email"),
        formData.get("password")
      );
      navigate(userData.role === "seeker" ? "/seeker" : "/poster");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const formData = new FormData(e.target);
    
    if (formData.get("password") !== formData.get("confirmPassword")) {
      toast.error("Passwords don't match");
      setIsLoading(false);
      return;
    }
    
    try {
      const userData = await register(
        formData.get("email"),
        formData.get("password"),
        selectedRole,
        formData.get("fullName")
      );
      navigate(userData.role === "seeker" ? "/seeker/profile" : "/poster/profile");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-secondary rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
        </div>
        
        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <img 
              src="/images/vitalamatch-logo.png" 
              alt="VitalaMatch" 
              className="h-14 w-auto"
            />
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight font-['Montserrat']">
            Where Healthcare Careers Find Their Perfect Match
          </h1>
          <p className="text-white/80 text-lg max-w-md">
            Join thousands of medical professionals connecting with top healthcare facilities every day.
          </p>
        </div>
        
        <div className="relative z-10 flex items-center gap-4">
          <img
            src="https://images.unsplash.com/photo-1758691463582-11aea602cd4a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2MzR8MHwxfHNlYXJjaHwzfHxzbWlsaW5nJTIwZG9jdG9yJTIwcG9ydHJhaXQlMjB3aGl0ZSUyMGNvYXR8ZW58MHx8fHwxNzY2Mjc5MjcwfDA&ixlib=rb-4.1.0&q=85"
            alt="Doctor"
            className="w-12 h-12 rounded-full object-cover border-2 border-white"
          />
          <img
            src="https://images.unsplash.com/photo-1587500154541-1cafd74f0efc?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njl8MHwxfHNlYXJjaHwzfHxudXJzZSUyMHNjcnVicyUyMHBvcnRyYWl0JTIwaG9zcGl0YWx8ZW58MHx8fHwxNzY2Mjc5MjcxfDA&ixlib=rb-4.1.0&q=85"
            alt="Nurse"
            className="w-12 h-12 rounded-full object-cover border-2 border-white -ml-4"
          />
          <span className="text-white/80 text-sm">+5,000 professionals matched</span>
        </div>
      </div>

      {/* Right Panel - Auth Forms */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <button
            onClick={() => navigate("/")}
            className="lg:hidden flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger data-testid="login-tab" value="login">Sign In</TabsTrigger>
              <TabsTrigger data-testid="register-tab" value="register">Create Account</TabsTrigger>
            </TabsList>

            {/* Login Tab */}
            <TabsContent value="login">
              <Card className="border-0 shadow-none">
                <CardHeader className="px-0">
                  <CardTitle className="text-2xl">Welcome back</CardTitle>
                  <CardDescription>Enter your credentials to access your account</CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          data-testid="login-email-input"
                          id="login-email"
                          name="email"
                          type="email"
                          placeholder="you@example.com"
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          data-testid="login-password-input"
                          id="login-password"
                          name="password"
                          type="password"
                          placeholder="••••••••"
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    <Button
                      data-testid="login-submit-btn"
                      type="submit"
                      className="w-full bg-primary hover:bg-primary/90"
                      disabled={isLoading}
                    >
                      {isLoading ? "Signing in..." : "Sign In"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Register Tab */}
            <TabsContent value="register">
              <Card className="border-0 shadow-none">
                <CardHeader className="px-0">
                  <CardTitle className="text-2xl">Create an account</CardTitle>
                  <CardDescription>Choose your role and get started</CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  {/* Role Selection */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <button
                      type="button"
                      data-testid="role-seeker-btn"
                      onClick={() => setSelectedRole("seeker")}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        selectedRole === "seeker"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <User className={`w-6 h-6 mx-auto mb-2 ${selectedRole === "seeker" ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`text-sm font-medium ${selectedRole === "seeker" ? "text-primary" : "text-foreground"}`}>
                        Job Seeker
                      </span>
                    </button>
                    <button
                      type="button"
                      data-testid="role-poster-btn"
                      onClick={() => setSelectedRole("poster")}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        selectedRole === "poster"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <Briefcase className={`w-6 h-6 mx-auto mb-2 ${selectedRole === "poster" ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`text-sm font-medium ${selectedRole === "poster" ? "text-primary" : "text-foreground"}`}>
                        Employer
                      </span>
                    </button>
                  </div>

                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-name">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          data-testid="register-name-input"
                          id="register-name"
                          name="fullName"
                          placeholder="John Doe"
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          data-testid="register-email-input"
                          id="register-email"
                          name="email"
                          type="email"
                          placeholder="you@example.com"
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          data-testid="register-password-input"
                          id="register-password"
                          name="password"
                          type="password"
                          placeholder="••••••••"
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-confirm">Confirm Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          data-testid="register-confirm-input"
                          id="register-confirm"
                          name="confirmPassword"
                          type="password"
                          placeholder="••••••••"
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    <Button
                      data-testid="register-submit-btn"
                      type="submit"
                      className="w-full bg-primary hover:bg-primary/90"
                      disabled={isLoading}
                    >
                      {isLoading ? "Creating account..." : "Create Account"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
