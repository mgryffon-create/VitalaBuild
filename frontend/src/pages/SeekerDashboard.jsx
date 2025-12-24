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
import { FileText, Users, AlertTriangle, ArrowRight, Briefcase, MapPin, Clock, User, CheckCircle, Upload, MessageCircle, Shield, Star } from "lucide-react";
import VitalaIcon from "@/components/VitalaIcon";

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

  // Calculate profile completion percentage
  const getProfileCompletion = () => {
    if (!profile) return 0;
    const fields = ['specialty', 'years_experience', 'desired_locations', 'phone', 'bio'];
    const completed = fields.filter(f => profile[f] && (Array.isArray(profile[f]) ? profile[f].length > 0 : true)).length;
    return Math.round((completed / fields.length) * 100);
  };

  const profileCompletion = getProfileCompletion();

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
      <div data-testid="seeker-dashboard" className="space-y-8">
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Welcome back, {user?.full_name?.split(" ")[0]}!
            </h1>
            <p className="text-muted-foreground mt-1">
              Find your next healthcare opportunity
            </p>
          </div>
          <Button
            data-testid="start-swiping-btn"
            onClick={() => navigate("/seeker/swipe")}
            className="bg-primary hover:bg-primary/90"
          >
            Start Swiping <VitalaIcon className="ml-2 w-5 h-5" />
          </Button>
        </div>

        {/* ⭐ FEATURED: Profile, Documents, Matches - Primary Action Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Profile Card */}
          <Card className="border-2 border-primary/20 hover:border-primary/40 transition-colors hover-lift">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                {profileCompletion === 100 ? (
                  <Badge className="bg-green-500">Complete</Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-500 border-amber-500">{profileCompletion}%</Badge>
                )}
              </div>
              <CardTitle className="text-lg mt-3">My Profile</CardTitle>
              <CardDescription>Stand out to employers</CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={profileCompletion} className="h-2 mb-4" />
              <div className="space-y-2 text-sm text-muted-foreground mb-4">
                <div className="flex items-center gap-2">
                  {profile?.specialty ? <CheckCircle className="w-4 h-4 text-green-500" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                  <span>Specialty: {profile?.specialty || "Not set"}</span>
                </div>
                <div className="flex items-center gap-2">
                  {profile?.years_experience ? <CheckCircle className="w-4 h-4 text-green-500" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                  <span>Experience: {profile?.years_experience ? `${profile.years_experience} years` : "Not set"}</span>
                </div>
              </div>
              <Button 
                data-testid="edit-profile-btn"
                onClick={() => navigate("/seeker/profile")} 
                className="w-full"
              >
                {profileCompletion === 100 ? "Edit Profile" : "Complete Profile"}
              </Button>
            </CardContent>
          </Card>

          {/* Documents Card */}
          <Card className="border-2 border-secondary/20 hover:border-secondary/40 transition-colors hover-lift">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-secondary" />
                </div>
                {stats?.expiring_documents > 0 ? (
                  <Badge variant="destructive">{stats.expiring_documents} Expiring</Badge>
                ) : (
                  <Badge className="bg-green-500">Up to Date</Badge>
                )}
              </div>
              <CardTitle className="text-lg mt-3">Documentation</CardTitle>
              <CardDescription>Licenses & certifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground mb-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Shield className="w-4 h-4" /> Licenses
                  </span>
                  <span className="font-medium text-foreground">{stats?.total_documents || 0} uploaded</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Star className="w-4 h-4" /> Certifications
                  </span>
                  <span className="font-medium text-foreground">{stats?.certifications || 0} verified</span>
                </div>
                {expiringDocs.length > 0 && (
                  <div className="p-2 bg-destructive/10 rounded-lg mt-2">
                    <p className="text-destructive text-xs font-medium">
                      ⚠️ {expiringDocs[0]?.document_type} expires in {expiringDocs[0]?.days_until_expiry} days
                    </p>
                  </div>
                )}
              </div>
              <Button 
                data-testid="manage-docs-btn"
                onClick={() => navigate("/seeker/documents")} 
                variant="secondary"
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" /> Manage Documents
              </Button>
            </CardContent>
          </Card>

          {/* Matches Card */}
          <Card className="border-2 border-accent/20 hover:border-accent/40 transition-colors hover-lift">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <VitalaIcon className="w-8 h-8" />
                </div>
                <Badge className="bg-primary">{stats?.matches || 0} Matches</Badge>
              </div>
              <CardTitle className="text-lg mt-3">My Matches</CardTitle>
              <CardDescription>Connect with employers</CardDescription>
            </CardHeader>
            <CardContent>
              {recentMatches.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {recentMatches.slice(0, 2).map((match) => (
                    <div key={match.id} className="p-2 bg-muted rounded-lg">
                      <p className="font-medium text-sm truncate">{match.job?.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{match.job?.company_name || "Healthcare Facility"}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground mb-4">
                  <p className="text-sm">No matches yet</p>
                  <p className="text-xs">Start swiping to find jobs!</p>
                </div>
              )}
              <Button 
                data-testid="view-matches-btn"
                onClick={() => navigate("/matches")} 
                variant="outline"
                className="w-full border-accent text-accent hover:bg-accent hover:text-white"
              >
                <MessageCircle className="w-4 h-4 mr-2" /> View All Matches
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Profile Completion Alert (if incomplete) */}
        {profileCompletion < 100 && (
          <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-900/10">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Complete your profile to get more matches!</p>
                  <p className="text-sm text-muted-foreground">
                    Employers prefer candidates with complete profiles
                  </p>
                </div>
              </div>
              <Button
                data-testid="complete-profile-alert-btn"
                onClick={() => navigate("/seeker/profile")}
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                Complete Now
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Stats Overview */}
        <div className="grid sm:grid-cols-4 gap-4">
          <Card className="hover-lift">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Matches</p>
                  <p className="text-2xl font-bold text-foreground">{stats?.matches || 0}</p>
                </div>
                <VitalaIcon className="w-8 h-8 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover-lift">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Pending References</p>
                  <p className="text-2xl font-bold text-foreground">{stats?.pending_references || 0}</p>
                </div>
                <Users className="w-6 h-6 text-secondary opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover-lift">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Completed Refs</p>
                  <p className="text-2xl font-bold text-foreground">{stats?.completed_references || 0}</p>
                </div>
                <CheckCircle className="w-6 h-6 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover-lift">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Job Offers</p>
                  <p className="text-2xl font-bold text-foreground">{stats?.offers || 0}</p>
                </div>
                <Briefcase className="w-6 h-6 text-accent opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Content */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Expiring Documents */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Document Renewals</CardTitle>
                <CardDescription>Documents expiring within 30 days</CardDescription>
              </div>
              <Button
                data-testid="view-all-docs-btn"
                variant="ghost"
                size="sm"
                onClick={() => navigate("/seeker/documents")}
              >
                View All <ArrowRight className="ml-1 w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {expiringDocs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No documents expiring soon</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {expiringDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{doc.document_type}</p>
                          <p className="text-xs text-muted-foreground">{doc.file_name}</p>
                        </div>
                      </div>
                      <Badge
                        className={`${
                          doc.days_until_expiry <= 7
                            ? "badge-expiring"
                            : doc.days_until_expiry <= 14
                            ? "badge-warning"
                            : "badge-valid"
                        }`}
                      >
                        {doc.days_until_expiry} days
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
              <CardDescription>Get things done faster</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div
                className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                onClick={() => navigate("/seeker/swipe")}
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <VitalaIcon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Find New Jobs</p>
                  <p className="text-xs text-muted-foreground">Swipe through opportunities</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
              
              <div
                className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                onClick={() => navigate("/seeker/licenses")}
              >
                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-secondary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Verify Licenses</p>
                  <p className="text-xs text-muted-foreground">Add professional licenses</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
              
              <div
                className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                onClick={() => navigate("/references")}
              >
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-accent" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Request References</p>
                  <p className="text-xs text-muted-foreground">Build your credentials</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>

              <div
                className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                onClick={() => navigate("/seeker/offers")}
              >
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-green-500" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">View Job Offers</p>
                  <p className="text-xs text-muted-foreground">Check pending offers</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SeekerDashboard;
