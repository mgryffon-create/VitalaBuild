import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  ClipboardCheck, CheckCircle, Clock, AlertTriangle, Shield, ExternalLink,
  ArrowLeft, XCircle, Eye, Flag, FileText, Users, Briefcase, Search, Edit
} from "lucide-react";

const STATUS_META = {
  satisfied_from_vault: { label: "From Vault", icon: CheckCircle, cls: "text-green-600 bg-green-100 dark:bg-green-900/30" },
  completed: { label: "Completed", icon: CheckCircle, cls: "text-green-600 bg-green-100 dark:bg-green-900/30" },
  missing_document: { label: "Missing", icon: XCircle, cls: "text-red-600 bg-red-100 dark:bg-red-900/30" },
  document_expired: { label: "Expired", icon: AlertTriangle, cls: "text-amber-600 bg-amber-100 dark:bg-amber-900/30" },
  pending_manual_review: { label: "Review", icon: Eye, cls: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" },
  pending_external_check: { label: "External", icon: ExternalLink, cls: "text-purple-600 bg-purple-100 dark:bg-purple-900/30" },
  action_required_candidate: { label: "Action", icon: AlertTriangle, cls: "text-amber-600 bg-amber-100 dark:bg-amber-900/30" },
  in_progress: { label: "In Progress", icon: Clock, cls: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" },
  flagged_issue: { label: "Flagged", icon: Flag, cls: "text-red-600 bg-red-100 dark:bg-red-900/30" },
};

const CASE_STATUS = {
  active: { label: "Active", cls: "bg-blue-100 text-blue-700" },
  cleared: { label: "Cleared", cls: "bg-green-100 text-green-700" },
  flagged: { label: "Flagged", cls: "bg-red-100 text-red-700" },
};

const REQ_STATUS_OPTIONS = [
  "satisfied_from_vault", "completed", "missing_document", "document_expired",
  "pending_manual_review", "pending_external_check", "action_required_candidate",
  "in_progress", "flagged_issue",
];

const AdminOnboardingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState(null);
  const [caseDetail, setCaseDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editReq, setEditReq] = useState(null);
  const [editForm, setEditForm] = useState({ status: "", notes: "", vault_document_id: "" });
  const [vaultDocs, setVaultDocs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");

  const fetchCases = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/onboarding/cases`);
      setCases(res.data);
    } catch {
      toast.error("Failed to load cases");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  const openCaseDetail = async (caseId) => {
    setSelectedCase(caseId);
    setDetailLoading(true);
    try {
      const res = await axios.get(`${API}/admin/onboarding/cases/${caseId}`);
      setCaseDetail(res.data);
      // Fetch candidate vault docs for manual matching
      if (res.data.candidate?.id) {
        const vRes = await axios.get(`${API}/admin/vault/documents/${res.data.candidate.id}`);
        setVaultDocs(vRes.data);
      }
    } catch {
      toast.error("Failed to load case detail");
    } finally {
      setDetailLoading(false);
    }
  };

  const openEditReq = (req) => {
    setEditReq(req);
    setEditForm({ status: req.status, notes: req.notes || "", vault_document_id: "" });
  };

  const handleUpdateReq = async () => {
    if (!editReq) return;
    setSaving(true);
    try {
      const payload = {};
      if (editForm.status && editForm.status !== editReq.status) payload.status = editForm.status;
      if (editForm.notes !== (editReq.notes || "")) payload.notes = editForm.notes;
      if (editForm.vault_document_id) payload.vault_document_id = editForm.vault_document_id;
      if (Object.keys(payload).length === 0) { toast.info("No changes"); setSaving(false); return; }
      await axios.put(`${API}/admin/onboarding/requirements/${editReq.id}`, payload);
      toast.success("Requirement updated");
      setEditReq(null);
      if (selectedCase) openCaseDetail(selectedCase);
      fetchCases();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const filtered = filter === "all" ? cases : cases.filter((c) => c.status === filter);
  const stats = {
    total: cases.length,
    active: cases.filter((c) => c.status === "active").length,
    cleared: cases.filter((c) => c.status === "cleared").length,
    flagged: cases.filter((c) => c.status === "flagged").length,
  };

  if (user?.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Admin access required</p>
        </div>
      </DashboardLayout>
    );
  }

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
      <div data-testid="admin-onboarding-page" className="space-y-5 max-w-6xl">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Admin — Onboarding Management</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">{cases.length} total cases</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {[
            { label: "Total", value: stats.total, color: "bg-muted", onClick: () => setFilter("all") },
            { label: "Active", value: stats.active, color: "bg-blue-100 dark:bg-blue-900/30", onClick: () => setFilter("active") },
            { label: "Cleared", value: stats.cleared, color: "bg-green-100 dark:bg-green-900/30", onClick: () => setFilter("cleared") },
            { label: "Flagged", value: stats.flagged, color: "bg-red-100 dark:bg-red-900/30", onClick: () => setFilter("flagged") },
          ].map((s) => (
            <button key={s.label} onClick={s.onClick} className={`p-3 rounded-lg text-center ${s.color} ${filter === s.label.toLowerCase() || (s.label === "Total" && filter === "all") ? "ring-2 ring-primary" : ""}`}>
              <p className="text-lg sm:text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">{s.label}</p>
            </button>
          ))}
        </div>

        {/* Cases List */}
        {filtered.length === 0 ? (
          <Card><CardContent className="py-12 text-center">
            <ClipboardCheck className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No cases match this filter</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((c) => {
              const cs = CASE_STATUS[c.status] || CASE_STATUS.active;
              const p = c.progress || {};
              return (
                <Card key={c.id} data-testid={`admin-case-${c.id}`} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => openCaseDetail(c.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-foreground text-sm">{c.candidate?.full_name || "Candidate"}</p>
                          <Badge variant="outline" className={`text-[10px] ${cs.cls}`}>{cs.label}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{c.job?.title || "Position"} — {c.employer?.full_name || "Employer"}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Role: {c.role_type} | {c.state}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold text-foreground">{p.percent || 0}%</p>
                        <p className="text-[10px] text-muted-foreground">{p.completed || 0}/{p.total || 0}</p>
                        {(p.flagged || 0) > 0 && <Badge className="bg-red-500 text-white text-[9px] mt-1">{p.flagged} flagged</Badge>}
                      </div>
                    </div>
                    <Progress value={p.percent || 0} className="h-1.5 mt-2" />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Case Detail Dialog */}
      <Dialog open={!!selectedCase} onOpenChange={() => { setSelectedCase(null); setCaseDetail(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailLoading ? (
            <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : caseDetail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {caseDetail.candidate?.full_name} — {caseDetail.job?.title}
                  <Badge variant="outline" className={`text-xs ${(CASE_STATUS[caseDetail.status] || CASE_STATUS.active).cls}`}>
                    {(CASE_STATUS[caseDetail.status] || CASE_STATUS.active).label}
                  </Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 mt-2">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Role: <strong>{caseDetail.role_type}</strong></span>
                  <span>State: <strong>{caseDetail.state || "N/A"}</strong></span>
                  <span>Progress: <strong>{caseDetail.progress?.percent || 0}%</strong></span>
                </div>
                <Progress value={caseDetail.progress?.percent || 0} className="h-2" />

                {/* Requirements */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">Requirements ({caseDetail.requirements?.length || 0})</h4>
                  {caseDetail.requirements?.map((req) => {
                    const sm = STATUS_META[req.status] || STATUS_META.in_progress;
                    const Icon = sm.icon;
                    const isDone = req.status === "satisfied_from_vault" || req.status === "completed";
                    return (
                      <div key={req.id} className={`flex items-center gap-3 p-3 rounded-lg border ${isDone ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800" : req.status === "flagged_issue" ? "bg-red-50 dark:bg-red-900/10 border-red-200" : "bg-muted/30 border-border"}`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${sm.cls}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{req.label}</p>
                          <p className="text-[10px] text-muted-foreground">{req.notes}</p>
                          {req.document_match?.vault_document && (
                            <p className="text-[10px] text-blue-600 mt-0.5">
                              Linked: {req.document_match.vault_document.file_name || req.document_match.vault_document.subtype}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="outline" className={`text-[9px] ${sm.cls}`}>{sm.label}</Badge>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); openEditReq(req); }} data-testid={`edit-req-${req.id}`}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Edit Requirement Dialog */}
      <Dialog open={!!editReq} onOpenChange={() => setEditReq(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit: {editReq?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger data-testid="admin-status-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REQ_STATUS_OPTIONS.map((s) => {
                    const m = STATUS_META[s];
                    return <SelectItem key={s} value={s}>{m?.label || s}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea data-testid="admin-notes-input" value={editForm.notes} onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Add admin notes..." />
            </div>
            <div className="space-y-1.5">
              <Label>Attach Vault Document (optional)</Label>
              <Select value={editForm.vault_document_id || "none"} onValueChange={(v) => setEditForm((p) => ({ ...p, vault_document_id: v === "none" ? "" : v }))}>
                <SelectTrigger data-testid="admin-vault-attach"><SelectValue placeholder="Select vault doc" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {vaultDocs.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.file_name || d.subtype || d.category} ({d.category})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditReq(null)}>Cancel</Button>
            <Button data-testid="admin-save-req-btn" onClick={handleUpdateReq} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminOnboardingPage;
