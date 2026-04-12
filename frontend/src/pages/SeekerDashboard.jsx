import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  FileText, AlertTriangle, ArrowRight, Briefcase, User,
  CheckCircle, Upload, MessageCircle, Shield, Stethoscope, XCircle, Sparkles
} from "lucide-react";

const SeekerDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [expiringDocs, setExpiringDocs] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [statsRes, docsRes, matchesRes, profileRes] = await Promise.all([
        axios.get(`${API}/stats`),
        axios.get(`${API}/documents/expiring`),
        axios.get(`${API}/matches`),
        axios.get(`${API}/profile/seeker`).catch(() => ({ data: null }))
      ]);
      setStats(statsRes.data);
      setExpiringDocs(docsRes.data);
      setRecentMatches(matchesRes.data.slice(0, 3));
      setProfile(profileRes.data);
    } catch (error) {
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const profileFields = [
    { key: "specialty", label: "Specialty" },
    { key: "years_experience", label: "Experience" },
    { key: "phone", label: "Phone", nested: "contact_info" },
    { key: "bio", label: "Bio" },
    { key: "desired_locations", label: "Preferred Locations", isArray: true },
  ];

  const getFieldValue = (field) => {
    if (field.nested) return profile?.[field.nested]?.[field.key];
    return profile?.[field.key];
  };

  const isFieldComplete = (field) => {
    const val = getFieldValue(field);
    if (field.isArray) return Array.isArray(val) && val.length > 0;
    return !!val;
  };

  const completedCount = profileFields.filter(isFieldComplete).length;
  const profileCompletion = profile
    ? Math.round((completedCount / profileFields.length) * 100)
    : 0;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div data-testid="seeker-dashboard" className="space-y-5 sm:space-y-8 max-w-4xl">

        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
              Welcome back, {user?.full_name?.split(" ")[0] || "there"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Here&apos;s what needs your attention today.
            </p>
          </div>
          <Button
            data-testid="find-jobs-btn"
            onClick={() => navigate("/seeker/swipe")}
            className="bg-primary hover:bg-primary/90 shadow-sm w-full sm:w-auto"
          >
            Find Jobs <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>

        {/* ── Resume Upload Prompt ─────────────────────── */}
        {profileCompletion < 50 && (
          <Card data-testid="resume-upload-prompt" className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground">Build your profile in seconds</p>
                <p className="text-xs text-muted-foreground">Upload your resume and we&apos;ll fill in your profile automatically.</p>
              </div>
              <Button size="sm" onClick={() => navigate("/seeker/resume-onboarding")} data-testid="resume-onboarding-cta">
                <Upload className="w-3.5 h-3.5 mr-1" /> Upload Resume
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Quick Actions (compact, near top) ──────────── */}
        <section data-testid="section-quick-actions">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              data-testid="qa-find-jobs"
              className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/40 hover:bg-muted/50 transition-all text-left"
              onClick={() => navigate("/seeker/swipe")}
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Stethoscope className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm text-foreground">Find Jobs</p>
              </div>
            </button>
            <button
              data-testid="qa-upload-license"
              className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-secondary/40 hover:bg-muted/50 transition-all text-left"
              onClick={() => navigate("/seeker/vault")}
            >
              <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4 text-secondary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm text-foreground">Document Vault</p>
              </div>
            </button>
            <button
              data-testid="qa-upload-docs"
              className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-accent/40 hover:bg-muted/50 transition-all text-left"
              onClick={() => navigate("/seeker/documents")}
            >
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <Upload className="w-4 h-4 text-accent" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm text-foreground">Upload Docs</p>
              </div>
            </button>
            <button
              data-testid="qa-complete-profile"
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                profileCompletion < 100
                  ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 hover:border-amber-400"
                  : "bg-card border-border hover:border-primary/40 hover:bg-muted/50"
              }`}
              onClick={() => navigate("/seeker/profile")}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                profileCompletion < 100 ? "bg-amber-500/10" : "bg-primary/10"
              }`}>
                <User className={`w-4 h-4 ${profileCompletion < 100 ? "text-amber-600" : "text-primary"}`} />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm text-foreground">
                  {profileCompletion < 100 ? "Complete Profile" : "Edit Profile"}
                </p>
              </div>
            </button>
          </div>
        </section>

        {/* ── Section: Profile Status ────────────────────── */}
        <section data-testid="section-profile-status">
          <h2 className="text-base font-semibold text-foreground mb-3">Profile Status</h2>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">
                  {completedCount} of {profileFields.length} fields complete
                </span>
                <Badge
                  className={
                    profileCompletion === 100
                      ? "bg-green-500/10 text-green-600 border-green-200"
                      : "bg-amber-500/10 text-amber-600 border-amber-200"
                  }
                  variant="outline"
                >
                  {profileCompletion}%
                </Badge>
              </div>
              <Progress value={profileCompletion} className="h-2 mb-4" />

              {profileCompletion < 100 && (
                <div className="grid sm:grid-cols-2 gap-2 mb-4">
                  {profileFields.map((f) => {
                    const done = isFieldComplete(f);
                    return (
                      <div
                        key={f.key}
                        className={`flex items-center gap-2 text-sm rounded-md px-3 py-2 ${
                          done ? "text-muted-foreground" : "bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {done ? (
                          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-amber-500 shrink-0" />
                        )}
                        {f.label}
                      </div>
                    );
                  })}
                </div>
              )}

              <Button
                data-testid="edit-profile-btn"
                variant={profileCompletion === 100 ? "outline" : "default"}
                onClick={() => navigate("/seeker/profile")}
                className="w-full sm:w-auto"
              >
                {profileCompletion === 100 ? "Edit Profile" : "Complete Profile"}
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* ── Section: Credentials & Documents ───────────── */}
        <section data-testid="section-credentials">
          <h2 className="text-base font-semibold text-foreground mb-3">Credentials &amp; Documents</h2>
          <Card>
            <CardContent className="p-5">
              <div className="grid sm:grid-cols-3 gap-4 mb-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Shield className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="text-2xl font-bold text-foreground leading-none">{stats?.total_documents || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">Licenses uploaded</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <FileText className="w-5 h-5 text-secondary shrink-0" />
                  <div>
                    <p className="text-2xl font-bold text-foreground leading-none">{stats?.certifications || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">Documents uploaded</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                  <div>
                    <p className="text-2xl font-bold text-foreground leading-none">
                      {stats?.expiring_documents > 0 ? (
                        <span className="text-destructive">{stats.expiring_documents} expiring</span>
                      ) : (
                        "All valid"
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Verification status</p>
                  </div>
                </div>
              </div>

              {expiringDocs.length > 0 && (
                <div className="space-y-2 mb-4">
                  {expiringDocs.slice(0, 2).map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-destructive/5 border border-destructive/10"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                        <span className="text-foreground font-medium">{doc.document_type}</span>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-destructive border-destructive/30"
                      >
                        {doc.days_until_expiry} days left
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  data-testid="manage-licenses-btn"
                  variant="outline"
                  onClick={() => navigate("/seeker/licenses")}
                  className="flex-1 sm:flex-none"
                >
                  <Shield className="w-4 h-4 mr-2" /> Manage Licenses
                </Button>
                <Button
                  data-testid="manage-docs-btn"
                  variant="outline"
                  onClick={() => navigate("/seeker/documents")}
                  className="flex-1 sm:flex-none"
                >
                  <Upload className="w-4 h-4 mr-2" /> Upload Documents
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Section: Matches & Offers ──────────────────── */}
        <section data-testid="section-matches-offers">
          <h2 className="text-base font-semibold text-foreground mb-3">Matches &amp; Offers</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Matches */}
            <Card
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => navigate("/matches")}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-3xl font-bold text-foreground">{stats?.matches || 0}</p>
                </div>
                <p className="font-medium text-sm text-foreground">Matches</p>
                <p className="text-xs text-muted-foreground">Employers interested in you</p>

                {recentMatches.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {recentMatches.slice(0, 2).map((m) => (
                      <div key={m.id} className="text-xs px-2.5 py-1.5 bg-muted rounded-md truncate">
                        {m.job?.title || "Healthcare Position"} &mdash; {m.job?.company_name || "Facility"}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Offers */}
            <Card
              className="cursor-pointer hover:border-green-500/40 transition-colors"
              onClick={() => navigate("/seeker/offers")}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <Briefcase className="w-5 h-5 text-green-600" />
                  </div>
                  <p className="text-3xl font-bold text-foreground">{stats?.offers || 0}</p>
                </div>
                <p className="font-medium text-sm text-foreground">Offers</p>
                <p className="text-xs text-muted-foreground">Pending job offers to review</p>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default SeekerDashboard;
