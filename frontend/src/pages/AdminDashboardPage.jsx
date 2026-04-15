import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import {
  Users, Briefcase, FileText, Shield, Activity, Settings,
  Search, UserCheck, UserX, CheckCircle, XCircle, Clock,
  AlertTriangle, Eye, BarChart, ChevronRight, Database,
  RefreshCw, MessageCircle, Award, Loader2,
} from "lucide-react";

/* ── Stat Card ── */
const StatCard = ({ icon: Icon, label, value, color = "text-primary" }) => (
  <Card data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
    <CardContent className="p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-muted ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </CardContent>
  </Card>
);

/* ── Overview Tab ── */
const OverviewTab = ({ stats, loading }) => {
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  if (!stats) return null;
  return (
    <div className="space-y-4" data-testid="admin-overview">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard icon={Users} label="Total Users" value={stats.total_users} />
        <StatCard icon={UserCheck} label="Seekers" value={stats.seekers} color="text-blue-500" />
        <StatCard icon={Briefcase} label="Employers" value={stats.employers} color="text-green-500" />
        <StatCard icon={Briefcase} label="Active Jobs" value={stats.active_jobs} color="text-amber-500" />
        <StatCard icon={MessageCircle} label="Matches" value={stats.total_matches} color="text-purple-500" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Award} label="Offers Sent" value={stats.offers_sent} color="text-indigo-500" />
        <StatCard icon={CheckCircle} label="Offers Accepted" value={stats.offers_accepted} color="text-emerald-500" />
        <StatCard icon={Activity} label="Onboarding Active" value={stats.onboarding_active} color="text-cyan-500" />
        <StatCard icon={AlertTriangle} label="Docs Need Review" value={stats.docs_needs_review + stats.docs_unverified} color="text-red-500" />
      </div>
    </div>
  );
};

/* ── Users Tab ── */
const UsersTab = () => {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);
      const res = await axios.get(`${API}/admin/users?${params}`);
      setUsers(res.data);
    } catch { toast.error("Failed to load users"); }
    finally { setLoading(false); }
  }, [search, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const toggleUser = async () => {
    if (!confirmAction) return;
    try {
      await axios.put(`${API}/admin/users/${confirmAction.id}/status`, { is_active: confirmAction.newActive });
      toast.success(confirmAction.newActive ? "User activated" : "User deactivated");
      setConfirmAction(null);
      fetchUsers();
    } catch { toast.error("Failed to update user"); }
  };

  return (
    <div className="space-y-3" data-testid="admin-users">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input data-testid="user-search" placeholder="Search users..." className="pl-8 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select data-testid="role-filter" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="h-9 px-3 rounded-md border bg-background text-sm">
          <option value="">All Roles</option>
          <option value="seeker">Seekers</option>
          <option value="poster">Employers</option>
          <option value="admin">Admins</option>
        </select>
      </div>
      {loading ? <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div> : (
        <div className="border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_100px_80px_80px_80px] gap-2 px-3 py-2 bg-muted text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            <span>Name</span><span>Email</span><span>Role</span><span>Matches</span><span>Docs</span><span>Action</span>
          </div>
          <ScrollArea className="max-h-[400px]">
            {users.map((u) => (
              <div key={u.id} data-testid={`user-row-${u.id}`} className="grid grid-cols-[1fr_1fr_100px_80px_80px_80px] gap-2 px-3 py-2 border-t text-sm items-center">
                <div className="truncate">
                  <span className="font-medium">{u.full_name}</span>
                  {u.is_active === false && <Badge variant="outline" className="ml-1 text-[8px] bg-red-50 text-red-600">Inactive</Badge>}
                </div>
                <span className="text-muted-foreground text-xs truncate">{u.email}</span>
                <Badge variant="outline" className="text-[9px] w-fit">{u.role}</Badge>
                <span className="text-xs text-center">{u.matches || 0}</span>
                <span className="text-xs text-center">{u.vault_docs || u.jobs_posted || 0}</span>
                <div>
                  {u.role !== "admin" && (
                    <Button
                      data-testid={`toggle-user-${u.id}`}
                      variant="ghost" size="sm" className="h-7 text-xs"
                      onClick={() => setConfirmAction({ id: u.id, name: u.full_name, newActive: u.is_active === false })}
                    >
                      {u.is_active === false ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {users.length === 0 && <p className="text-center py-4 text-sm text-muted-foreground">No users found</p>}
          </ScrollArea>
        </div>
      )}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent><AlertDialogHeader>
          <AlertDialogTitle>{confirmAction?.newActive ? "Reactivate" : "Deactivate"} User</AlertDialogTitle>
          <AlertDialogDescription>{confirmAction?.newActive ? "Reactivate" : "Deactivate"} {confirmAction?.name}?</AlertDialogDescription>
        </AlertDialogHeader><AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={toggleUser} data-testid="confirm-toggle-user">Confirm</AlertDialogAction>
        </AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

/* ── Documents Tab ── */
const DocumentsTab = () => {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try { setDocs((await axios.get(`${API}/admin/documents/review`)).data); }
    catch { toast.error("Failed to load documents"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const updateDoc = async (docId, status) => {
    try {
      await axios.put(`${API}/admin/documents/${docId}/verify`, { status });
      toast.success(`Document marked as ${status}`);
      fetchDocs();
    } catch { toast.error("Failed to update document"); }
  };

  return (
    <div className="space-y-3" data-testid="admin-documents">
      <p className="text-sm text-muted-foreground">{docs.length} document{docs.length !== 1 ? "s" : ""} pending review</p>
      {loading ? <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div> : docs.length === 0 ? (
        <div className="text-center py-12"><CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-500/40" /><p className="text-sm text-muted-foreground">All documents reviewed</p></div>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <Card key={d.id} data-testid={`doc-${d.id}`}>
              <CardContent className="p-3 flex items-center gap-3">
                <FileText className="w-8 h-8 text-muted-foreground/40 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{d.subtype || d.category}</p>
                  <p className="text-xs text-muted-foreground">{d.user_name} · {d.user_email}</p>
                  {d.expiration_date && <p className="text-[10px] text-muted-foreground">Exp: {d.expiration_date}</p>}
                  {d.verification_notes && <p className="text-[10px] text-amber-600 mt-0.5">{d.verification_notes}</p>}
                </div>
                <Badge variant="outline" className={`text-[9px] shrink-0 ${d.verification_status === "needs_review" ? "bg-amber-50 text-amber-700" : "bg-muted text-muted-foreground"}`}>{d.verification_status}</Badge>
                <div className="flex gap-1 shrink-0">
                  <Button data-testid={`verify-${d.id}`} size="sm" variant="outline" className="h-7 text-xs text-green-700" onClick={() => updateDoc(d.id, "verified")}>
                    <CheckCircle className="w-3 h-3 mr-1" /> Verify
                  </Button>
                  <Button data-testid={`reject-${d.id}`} size="sm" variant="outline" className="h-7 text-xs text-red-600" onClick={() => updateDoc(d.id, "rejected")}>
                    <XCircle className="w-3 h-3 mr-1" /> Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Jobs Tab ── */
const JobsTab = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/admin/jobs`).then((r) => setJobs(r.data)).catch(() => toast.error("Failed to load jobs")).finally(() => setLoading(false));
  }, []);

  const toggleJob = async (jobId, currentStatus) => {
    const newStatus = currentStatus === "closed" ? "active" : "closed";
    try {
      await axios.put(`${API}/admin/jobs/${jobId}/status`, { status: newStatus });
      toast.success(`Job ${newStatus}`);
      setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, status: newStatus } : j));
    } catch { toast.error("Failed to update job"); }
  };

  return (
    <div className="space-y-3" data-testid="admin-jobs">
      {loading ? <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div> : jobs.length === 0 ? (
        <p className="text-center py-8 text-sm text-muted-foreground">No jobs posted yet</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_80px_80px_80px_80px] gap-2 px-3 py-2 bg-muted text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            <span>Job</span><span>Employer</span><span>Apps</span><span>Matches</span><span>Hires</span><span>Status</span>
          </div>
          <ScrollArea className="max-h-[400px]">
            {jobs.map((j) => (
              <div key={j.id} data-testid={`job-row-${j.id}`} className="grid grid-cols-[1fr_120px_80px_80px_80px_80px] gap-2 px-3 py-2 border-t text-sm items-center">
                <div className="truncate">
                  <span className="font-medium text-xs">{j.title}</span>
                  <p className="text-[10px] text-muted-foreground">{j.location}</p>
                </div>
                <span className="text-xs text-muted-foreground truncate">{j.employer_name}</span>
                <span className="text-xs text-center">{j.applicants}</span>
                <span className="text-xs text-center">{j.matches}</span>
                <span className="text-xs text-center">{j.hires}</span>
                <Button variant="ghost" size="sm" className="h-6 text-[10px]" data-testid={`toggle-job-${j.id}`} onClick={() => toggleJob(j.id, j.status)}>
                  {j.status === "closed" ? "Activate" : "Close"}
                </Button>
              </div>
            ))}
          </ScrollArea>
        </div>
      )}
    </div>
  );
};

/* ── Onboarding Tab ── */
const OnboardingTab = () => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/admin/onboarding`).then((r) => setCases(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-3" data-testid="admin-onboarding">
      {loading ? <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div> : cases.length === 0 ? (
        <p className="text-center py-8 text-sm text-muted-foreground">No onboarding cases</p>
      ) : (
        <div className="space-y-2">
          {cases.map((c) => (
            <Card key={c.id} data-testid={`onboarding-${c.id}`}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{c.candidate_name}</p>
                  <p className="text-[10px] text-muted-foreground">{c.role_type} · {c.status}</p>
                </div>
                <div className="w-20 text-center">
                  <p className="text-lg font-bold text-foreground">{c.progress}%</p>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${c.progress >= 80 ? "bg-green-500" : c.progress >= 40 ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${c.progress}%` }} />
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{c.completed_items}/{c.total_items}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Logs Tab ── */
const LogsTab = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/audit/logs`).then((r) => setLogs(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-3" data-testid="admin-logs">
      {loading ? <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div> : (
        <ScrollArea className="max-h-[500px] border rounded-lg">
          {logs.length === 0 ? <p className="text-center py-8 text-sm text-muted-foreground">No logs</p> : logs.map((l, i) => (
            <div key={i} className="px-3 py-2 border-b text-xs flex items-center gap-3">
              <span className="text-muted-foreground w-[140px] shrink-0">{l.timestamp ? new Date(l.timestamp).toLocaleString() : ""}</span>
              <Badge variant="outline" className="text-[8px] shrink-0">{l.action}</Badge>
              <span className="text-muted-foreground truncate flex-1">{l.user_id?.substring(0, 8)}</span>
            </div>
          ))}
        </ScrollArea>
      )}
    </div>
  );
};

/* ── System Tab ── */
const SystemTab = () => {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    axios.get(`${API}/admin/system/health`).then((r) => setHealth(r.data)).catch(() => {});
  }, []);

  return (
    <div className="space-y-4" data-testid="admin-system">
      {health ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="p-4 text-center">
            <Database className={`w-6 h-6 mx-auto mb-1 ${health.database === "connected" ? "text-green-500" : "text-red-500"}`} />
            <p className="text-sm font-medium">{health.database}</p><p className="text-[10px] text-muted-foreground">Database</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <Activity className="w-6 h-6 mx-auto mb-1 text-green-500" />
            <p className="text-sm font-medium">{health.api}</p><p className="text-[10px] text-muted-foreground">API</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{health.collections}</p><p className="text-[10px] text-muted-foreground">Collections</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{health.recent_errors}</p><p className="text-[10px] text-muted-foreground">Recent Errors</p>
          </CardContent></Card>
        </div>
      ) : <Loader2 className="w-6 h-6 animate-spin mx-auto" />}
    </div>
  );
};

/* ── Main Admin Dashboard ── */
const AdminDashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== "admin") {
      navigate("/");
      return;
    }
    axios.get(`${API}/admin/dashboard/stats`)
      .then((r) => setStats(r.data))
      .catch(() => toast.error("Failed to load admin data"))
      .finally(() => setLoading(false));
  }, [user, navigate]);

  if (user?.role !== "admin") return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-6" data-testid="admin-dashboard">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-xs text-muted-foreground">VitalaMatch Platform Management</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setLoading(true); axios.get(`${API}/admin/dashboard/stats`).then((r) => setStats(r.data)).finally(() => setLoading(false)); }}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="overview" data-testid="tab-overview"><BarChart className="w-3.5 h-3.5 mr-1" /> Overview</TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users"><Users className="w-3.5 h-3.5 mr-1" /> Users</TabsTrigger>
            <TabsTrigger value="documents" data-testid="tab-documents"><FileText className="w-3.5 h-3.5 mr-1" /> Documents</TabsTrigger>
            <TabsTrigger value="jobs" data-testid="tab-jobs"><Briefcase className="w-3.5 h-3.5 mr-1" /> Jobs</TabsTrigger>
            <TabsTrigger value="onboarding" data-testid="tab-onboarding"><Shield className="w-3.5 h-3.5 mr-1" /> Onboarding</TabsTrigger>
            <TabsTrigger value="logs" data-testid="tab-logs"><Activity className="w-3.5 h-3.5 mr-1" /> Logs</TabsTrigger>
            <TabsTrigger value="system" data-testid="tab-system"><Settings className="w-3.5 h-3.5 mr-1" /> System</TabsTrigger>
          </TabsList>

          <TabsContent value="overview"><OverviewTab stats={stats} loading={loading} /></TabsContent>
          <TabsContent value="users"><UsersTab /></TabsContent>
          <TabsContent value="documents"><DocumentsTab /></TabsContent>
          <TabsContent value="jobs"><JobsTab /></TabsContent>
          <TabsContent value="onboarding"><OnboardingTab /></TabsContent>
          <TabsContent value="logs"><LogsTab /></TabsContent>
          <TabsContent value="system"><SystemTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
