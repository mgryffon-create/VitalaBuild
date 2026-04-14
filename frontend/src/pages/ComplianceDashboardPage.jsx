import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  ShieldCheck, Users, BookOpen, AlertTriangle, CheckCircle, Clock,
  ArrowLeft, Plus, UserCheck, XCircle, BarChart
} from "lucide-react";

const STATUS_CLS = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  expired: "bg-red-100 text-red-700",
  waived: "bg-amber-100 text-amber-700",
};

const ComplianceDashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);
  const [showCourse, setShowCourse] = useState(false);
  const [assignForm, setAssignForm] = useState({ user_id: "", course_id: "", due_date: "" });
  const [courseForm, setCourseForm] = useState({ title: "", category: "general", credit_hours: 0, duration_minutes: 0 });
  const [candidates, setCandidates] = useState([]);
  const [saving, setSaving] = useState(false);
  const [baseline, setBaseline] = useState([]);
  const [baselineLoading, setBaselineLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [sRes, aRes, cRes, rRes, candRes, blRes] = await Promise.all([
        axios.get(`${API}/training/compliance-summary`),
        axios.get(`${API}/training/assignments`),
        axios.get(`${API}/training/courses`),
        axios.get(`${API}/training/compliance-requirements`),
        axios.get(`${API}/employer/candidates`).catch(() => ({ data: [] })),
        axios.get(`${API}/employer/compliance-baseline`).catch(() => ({ data: { requirements: [] } })),
      ]);
      setSummary(sRes.data);
      setAssignments(aRes.data);
      setCourses(cRes.data);
      setRequirements(rRes.data);
      setBaseline(blRes.data.requirements || []);
      // Get unique candidates
      const uniqueUsers = new Map();
      aRes.data.forEach((a) => { if (a.user) uniqueUsers.set(a.user.id, a.user); });
      candRes.data.forEach((c) => { if (c.seeker) uniqueUsers.set(c.seeker.id || c.id, c.seeker); });
      setCandidates(Array.from(uniqueUsers.values()));
    } catch {
      toast.error("Failed to load compliance data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleBaseline = (key) => {
    setBaseline((prev) => prev.map((r) => r.key === key ? { ...r, enabled: !r.enabled } : r));
  };

  const saveBaseline = async () => {
    setBaselineLoading(true);
    try {
      await axios.put(`${API}/employer/compliance-baseline`, { requirements: baseline });
      toast.success("Baseline requirements saved");
    } catch {
      toast.error("Failed to save baseline");
    } finally {
      setBaselineLoading(false);
    }
  };

  const handleCreateCourse = async () => {
    if (!courseForm.title) { toast.error("Course title is required"); return; }
    setSaving(true);
    try {
      await axios.post(`${API}/training/courses`, courseForm);
      toast.success("Course created");
      setShowCourse(false);
      setCourseForm({ title: "", category: "general", credit_hours: 0, duration_minutes: 0 });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create");
    } finally { setSaving(false); }
  };

  const handleAssignTraining = async () => {
    if (!assignForm.user_id || !assignForm.course_id) { toast.error("Select a candidate and course"); return; }
    setSaving(true);
    try {
      await axios.post(`${API}/training/assignments`, assignForm);
      toast.success("Training assigned");
      setShowAssign(false);
      setAssignForm({ user_id: "", course_id: "", due_date: "" });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to assign");
    } finally { setSaving(false); }
  };

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div></DashboardLayout>;
  }

  const compliantCount = assignments.filter((a) => a.completion_status === "completed").length;
  const nonCompliantCount = assignments.filter((a) => a.completion_status !== "completed" && a.completion_status !== "waived").length;

  return (
    <DashboardLayout>
      <div data-testid="compliance-dashboard" className="space-y-5 max-w-5xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/poster")} className="shrink-0 -ml-1">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Compliance Dashboard</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Track training and compliance across your team</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCourse(true)} data-testid="add-course-btn">
              <Plus className="w-3.5 h-3.5 mr-1" /> Course
            </Button>
            <Button size="sm" onClick={() => setShowAssign(true)} data-testid="assign-training-btn">
              <Plus className="w-3.5 h-3.5 mr-1" /> Assign
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {[
            { label: "Total Assigned", value: summary?.total_assignments || 0, icon: BookOpen, color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600" },
            { label: "Completed", value: summary?.completed || 0, icon: CheckCircle, color: "bg-green-100 dark:bg-green-900/30 text-green-600" },
            { label: "Overdue", value: summary?.overdue || 0, icon: AlertTriangle, color: (summary?.overdue || 0) > 0 ? "bg-red-100 dark:bg-red-900/30 text-red-600" : "bg-muted text-muted-foreground" },
            { label: "Compliance", value: `${summary?.compliance_rate || 100}%`, icon: BarChart, color: "bg-purple-100 dark:bg-purple-900/30 text-purple-600" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}>
                  <s.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <p className="text-lg sm:text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Baseline Requirements */}
        <Card data-testid="baseline-requirements-card">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Baseline Requirements</h3>
                <p className="text-xs text-muted-foreground">Applied automatically to all new hires</p>
              </div>
              <Button
                data-testid="save-baseline-btn"
                size="sm"
                onClick={saveBaseline}
                disabled={baselineLoading}
              >
                {baselineLoading ? "Saving..." : "Save"}
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {baseline.map((req) => (
                <button
                  key={req.key}
                  data-testid={`baseline-${req.key}`}
                  onClick={() => toggleBaseline(req.key)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-colors ${
                    req.enabled
                      ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/10"
                      : "border-muted-foreground/20 bg-muted/20 opacity-60"
                  }`}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                    req.enabled ? "bg-green-500 text-white" : "bg-muted-foreground/20"
                  }`}>
                    {req.enabled && <CheckCircle className="w-3.5 h-3.5" />}
                  </div>
                  <span className="text-xs font-medium text-foreground">{req.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Assignments Table */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Training Assignments ({assignments.length})</h3>
            {assignments.length === 0 ? (
              <div className="text-center py-8">
                <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground mb-3">No training assigned yet</p>
                <Button variant="outline" size="sm" onClick={() => setShowAssign(true)}>Assign Training</Button>
              </div>
            ) : (
              <div className="space-y-2">
                {assignments.map((a) => {
                  const isOverdue = a.due_date && new Date(a.due_date) < new Date() && a.completion_status !== "completed";
                  return (
                    <div key={a.id} data-testid={`compliance-row-${a.id}`} className={`flex items-center gap-3 p-3 rounded-lg ${isOverdue ? "bg-red-50 dark:bg-red-900/10" : "bg-muted/30"}`}>
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-semibold text-primary">
                        {a.user?.full_name?.charAt(0) || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{a.user?.full_name || "Candidate"}</p>
                        <p className="text-xs text-muted-foreground">{a.course?.title || "Course"}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {a.due_date && <span className={`text-[10px] ${isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>{a.due_date.slice(0, 10)}</span>}
                        <Badge variant="outline" className={`text-[9px] ${STATUS_CLS[a.completion_status] || STATUS_CLS.not_started}`}>
                          {a.completion_status?.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Course Dialog */}
      <Dialog open={showCourse} onOpenChange={setShowCourse}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create Training Course</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Course Title *</Label>
              <Input data-testid="course-title-input" value={courseForm.title} onChange={(e) => setCourseForm((p) => ({ ...p, title: e.target.value }))} placeholder="e.g., BLS Certification" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={courseForm.category} onValueChange={(v) => setCourseForm((p) => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["general", "certification", "compliance", "safety", "clinical", "orientation"].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Credit Hours</Label>
                <Input type="number" value={courseForm.credit_hours} onChange={(e) => setCourseForm((p) => ({ ...p, credit_hours: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCourse(false)}>Cancel</Button>
            <Button data-testid="create-course-btn" onClick={handleCreateCourse} disabled={saving || !courseForm.title}>
              {saving ? "Creating..." : "Create Course"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Training Dialog */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Assign Training</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Candidate *</Label>
              <Select value={assignForm.user_id} onValueChange={(v) => setAssignForm((p) => ({ ...p, user_id: v }))}>
                <SelectTrigger data-testid="assign-candidate-select"><SelectValue placeholder="Select candidate" /></SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name || c.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Course *</Label>
              <Select value={assignForm.course_id} onValueChange={(v) => setAssignForm((p) => ({ ...p, course_id: v }))}>
                <SelectTrigger data-testid="assign-course-select"><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" data-testid="assign-due-date" value={assignForm.due_date} onChange={(e) => setAssignForm((p) => ({ ...p, due_date: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssign(false)}>Cancel</Button>
            <Button data-testid="assign-submit-btn" onClick={handleAssignTraining} disabled={saving || !assignForm.user_id || !assignForm.course_id}>
              {saving ? "Assigning..." : "Assign Training"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default ComplianceDashboardPage;
