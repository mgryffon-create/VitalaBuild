import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { FileText, Users, AlertTriangle, ArrowRight, Briefcase, MapPin, Clock } from "lucide-react";
import VitalaIcon from "@/components/VitalaIcon";

const SeekerDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [expiringDocs, setExpiringDocs] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, docsRes, matchesRes] = await Promise.all([
        axios.get(`${API}/stats`),
        axios.get(`${API}/documents/expiring`),
        axios.get(`${API}/matches`)
      ]);
      
      setStats(statsRes.data);
      setExpiringDocs(docsRes.data);
      setRecentMatches(matchesRes.data.slice(0, 3));
    } catch (error) {
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
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

        {/* Profile Completion Alert */}
        {!user?.profile_complete && (
          <Card className="border-accent/50 bg-accent/5">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Complete your profile</p>
                  <p className="text-sm text-muted-foreground">
                    A complete profile increases your chances of matching
                  </p>
                </div>
              </div>
              <Button
                data-testid="complete-profile-btn"
                onClick={() => navigate("/seeker/profile")}
                variant="outline"
                className="border-accent text-accent hover:bg-accent hover:text-white"
              >
                Complete Profile
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="hover-lift">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Matches</p>
                  <p className="text-3xl font-bold text-foreground">{stats?.matches || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Heart className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover-lift">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending References</p>
                  <p className="text-3xl font-bold text-foreground">{stats?.pending_references || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-secondary" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover-lift">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed References</p>
                  <p className="text-3xl font-bold text-foreground">{stats?.completed_references || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover-lift">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Expiring Documents</p>
                  <p className="text-3xl font-bold text-foreground">{stats?.expiring_documents || 0}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  stats?.expiring_documents > 0 ? "bg-destructive/10" : "bg-muted"
                }`}>
                  <FileText className={`w-6 h-6 ${
                    stats?.expiring_documents > 0 ? "text-destructive" : "text-muted-foreground"
                  }`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
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

          {/* Recent Matches */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Recent Matches</CardTitle>
                <CardDescription>Your latest job matches</CardDescription>
              </div>
              <Button
                data-testid="view-all-matches-btn"
                variant="ghost"
                size="sm"
                onClick={() => navigate("/matches")}
              >
                View All <ArrowRight className="ml-1 w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {recentMatches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Heart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No matches yet</p>
                  <Button
                    data-testid="start-matching-btn"
                    className="mt-4"
                    variant="outline"
                    onClick={() => navigate("/seeker/swipe")}
                  >
                    Start Matching
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentMatches.map((match) => (
                    <div
                      key={match.id}
                      className="p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                      onClick={() => navigate("/matches")}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-foreground">{match.job?.title}</p>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <Briefcase className="w-4 h-4" />
                            <span>{match.job?.company_name || "Healthcare Facility"}</span>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {match.job?.location}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {match.job?.duration}
                            </span>
                          </div>
                        </div>
                        <Badge className="bg-primary/10 text-primary">Matched</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid sm:grid-cols-3 gap-4">
          <Card
            className="hover-lift cursor-pointer"
            onClick={() => navigate("/seeker/profile")}
          >
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Edit Profile</p>
                <p className="text-sm text-muted-foreground">Update your information</p>
              </div>
            </CardContent>
          </Card>
          
          <Card
            className="hover-lift cursor-pointer"
            onClick={() => navigate("/seeker/documents")}
          >
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Manage Documents</p>
                <p className="text-sm text-muted-foreground">Upload certifications</p>
              </div>
            </CardContent>
          </Card>
          
          <Card
            className="hover-lift cursor-pointer"
            onClick={() => navigate("/references")}
          >
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Request References</p>
                <p className="text-sm text-muted-foreground">Build your credentials</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SeekerDashboard;
