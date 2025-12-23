import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Users, Briefcase, Plus, MapPin, DollarSign, Clock, Eye, Edit, Trash2, ArrowRight } from "lucide-react";
import VitalaIcon from "@/components/VitalaIcon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PosterDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteJobId, setDeleteJobId] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, jobsRes, matchesRes] = await Promise.all([
        axios.get(`${API}/stats`),
        axios.get(`${API}/jobs`),
        axios.get(`${API}/matches`)
      ]);
      
      setStats(statsRes.data);
      setJobs(jobsRes.data);
      setRecentMatches(matchesRes.data.slice(0, 3));
    } catch (error) {
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteJob = async () => {
    if (!deleteJobId) return;
    
    try {
      await axios.delete(`${API}/jobs/${deleteJobId}`);
      setJobs(jobs.filter(j => j.id !== deleteJobId));
      toast.success("Job deleted successfully");
    } catch (error) {
      toast.error("Failed to delete job");
    } finally {
      setDeleteJobId(null);
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
      <div data-testid="poster-dashboard" className="space-y-8">
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Welcome back, {user?.full_name?.split(" ")[0]}!
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your job postings and find the best candidates
            </p>
          </div>
          <Button
            data-testid="post-job-btn"
            onClick={() => navigate("/poster/jobs/new")}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="mr-2 w-4 h-4" /> Post New Job
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-3 gap-4">
          <Card className="hover-lift">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Jobs</p>
                  <p className="text-3xl font-bold text-foreground">{stats?.active_jobs || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover-lift">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Matches</p>
                  <p className="text-3xl font-bold text-foreground">{stats?.matches || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                  <Heart className="w-6 h-6 text-secondary" />
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
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Jobs List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Your Job Postings</CardTitle>
              <CardDescription>Manage and review candidates for your jobs</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Briefcase className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No jobs posted yet</p>
                <p className="text-sm mb-4">Create your first job posting to start finding candidates</p>
                <Button
                  data-testid="create-first-job-btn"
                  onClick={() => navigate("/poster/jobs/new")}
                  className="bg-primary hover:bg-primary/90"
                >
                  Post Your First Job
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="p-4 rounded-xl border border-border hover:border-primary/50 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg text-foreground">{job.title}</h3>
                          <Badge className={job.is_active ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}>
                            {job.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {job.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {job.duration}
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            ${job.pay_range?.min?.toLocaleString()} - ${job.pay_range?.max?.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {job.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          data-testid={`view-candidates-${job.id}`}
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/poster/swipe/${job.id}`)}
                        >
                          <Eye className="w-4 h-4 mr-1" /> View Candidates
                        </Button>
                        <Button
                          data-testid={`edit-job-${job.id}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/poster/jobs/${job.id}/edit`)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          data-testid={`delete-job-${job.id}`}
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteJobId(job.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
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
              <CardDescription>Candidates who matched with your jobs</CardDescription>
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
              </div>
            ) : (
              <div className="space-y-3">
                {recentMatches.map((match) => (
                  <div
                    key={match.id}
                    className="p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                    onClick={() => navigate("/matches")}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{match.seeker?.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {match.seeker?.specialty || "Medical Professional"} • {match.seeker?.years_experience || 0} years exp
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-primary/10 text-primary">Matched</Badge>
                        <p className="text-xs text-muted-foreground mt-1">for {match.job?.title}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteJobId} onOpenChange={() => setDeleteJobId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job Posting?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the job posting and remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="confirm-delete-job-btn"
              onClick={handleDeleteJob}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default PosterDashboard;
