import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  ClipboardCheck, CheckCircle, Clock, AlertTriangle, Upload, Shield,
  ExternalLink, ArrowLeft, Briefcase, XCircle, FileText, Eye, X, Flag
} from "lucide-react";

const STATUS_META = {
  satisfied_from_vault: { label: "From Vault", icon: CheckCircle, className: "text-green-600 bg-green-100 dark:bg-green-900/30" },
  completed: { label: "Completed", icon: CheckCircle, className: "text-green-600 bg-green-100 dark:bg-green-900/30" },
  missing_document: { label: "Missing", icon: XCircle, className: "text-red-600 bg-red-100 dark:bg-red-900/30" },
  document_expired: { label: "Expired", icon: AlertTriangle, className: "text-amber-600 bg-amber-100 dark:bg-amber-900/30" },
  pending_manual_review: { label: "Under Review", icon: Eye, className: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" },
  pending_external_check: { label: "External Check", icon: ExternalLink, className: "text-purple-600 bg-purple-100 dark:bg-purple-900/30" },
  action_required_candidate: { label: "Action Needed", icon: AlertTriangle, className: "text-amber-600 bg-amber-100 dark:bg-amber-900/30" },
  in_progress: { label: "In Progress", icon: Clock, className: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" },
  flagged_issue: { label: "Flagged", icon: Flag, className: "text-red-600 bg-red-100 dark:bg-red-900/30" },
};

const CASE_STATUS_META = {
  active: { label: "Active", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  cleared: { label: "Cleared", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  flagged: { label: "Flagged", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

// Map requirement types to vault categories/subtypes for the upload dialog
const REQ_CATEGORY_HINTS = {
  government_id: { category: "identity", subtypes: ["drivers_license", "passport", "state_id"] },
  bls_certification: { category: "certification", subtypes: ["BLS", "CPR", "CPR_BLS"] },
  acls_certification: { category: "certification", subtypes: ["ACLS"] },
  license_verification: { category: "license", subtypes: ["CNA_license", "RN_license", "LPN_license"] },
  tb_screening: { category: "health_screen", subtypes: ["TB_test", "QuantiFERON", "PPD"] },
  vaccination_records: { category: "health_record", subtypes: ["MMR", "HepB", "Varicella", "Flu", "COVID", "Tdap"] },
};

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSeeker = user?.role === "seeker";
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCase, setExpandedCase] = useState(null);

  // Upload dialog state
  const [uploadReq, setUploadReq] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadForm, setUploadForm] = useState({ category: "", subtype: "", expiration_date: "", state: "" });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fetchCases = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/onboarding/cases`);
      setCases(res.data);
      if (res.data.length === 1) setExpandedCase(res.data[0].id);
    } catch {
      toast.error("Failed to load onboarding data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  const handleMarkComplete = async (reqId) => {
    try {
      await axios.put(`${API}/onboarding/requirements/${reqId}/status`);
      toast.success("Requirement marked as completed");
      fetchCases();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update");
    }
  };

  const openUploadDialog = (req) => {
    const hint = REQ_CATEGORY_HINTS[req.type] || {};
    setUploadReq(req);
    setUploadForm({
      category: hint.category || "miscellaneous",
      subtype: hint.subtypes?.[0] || "",
      expiration_date: "",
      state: "",
    });
    setSelectedFile(null);
    setUploadProgress(0);
  };

  const handleUploadForReq = async () => {
    if (!selectedFile || !uploadReq) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("category", uploadForm.category);
      if (uploadForm.subtype) formData.append("subtype", uploadForm.subtype);
      if (uploadForm.expiration_date) formData.append("expiration_date", uploadForm.expiration_date);
      if (uploadForm.state) formData.append("state", uploadForm.state);

      await axios.post(`${API}/onboarding/requirements/${uploadReq.id}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      toast.success("Document uploaded and linked to requirement");
      setUploadReq(null);
      setSelectedFile(null);
      fetchCases();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

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
      <div data-testid="onboarding-page" className="space-y-5 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(isSeeker ? "/seeker" : "/poster")} className="shrink-0 -ml-1">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              {isSeeker ? "My Onboarding" : "Candidate Onboarding"}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {cases.length === 0
                ? "No active onboarding cases"
                : `${cases.length} onboarding case${cases.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {/* Empty State */}
        {cases.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardCheck className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
              <h3 className="font-semibold text-foreground mb-1">No onboarding cases yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {isSeeker
                  ? "When you accept a job offer, your onboarding requirements will appear here."
                  : "When a candidate accepts an offer, their onboarding case will appear here."}
              </p>
              <Button variant="outline" onClick={() => navigate(isSeeker ? "/seeker/offers" : "/poster/candidates")}>
                {isSeeker ? "View Offers" : "View Candidates"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {cases.map((c) => {
              const caseMeta = CASE_STATUS_META[c.status] || CASE_STATUS_META.active;
              const progress = c.progress || {};
              const pct = progress.percent || 0;
              const isExpanded = expandedCase === c.id;

              return (
                <Card key={c.id} data-testid={`onboarding-case-${c.id}`}>
                  <CardContent className="p-4 sm:p-5">
                    {/* Case Header */}
                    <button
                      className="w-full text-left"
                      onClick={() => setExpandedCase(isExpanded ? null : c.id)}
                      data-testid={`toggle-case-${c.id}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-foreground text-sm sm:text-base">
                              {c.job?.title || "Healthcare Position"}
                            </h3>
                            <Badge variant="outline" className={`text-[10px] ${caseMeta.className}`}>{caseMeta.label}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {isSeeker ? (c.employer?.full_name || "Employer") : (c.candidate?.full_name || "Candidate")}
                            {c.role_type && ` — ${c.role_type}`}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold text-foreground">{pct}%</p>
                          <p className="text-[10px] text-muted-foreground">{progress.completed}/{progress.total}</p>
                        </div>
                      </div>
                      <Progress value={pct} className="h-1.5 mt-3" />
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {progress.satisfied_from_vault > 0 && (
                          <span className="flex items-center gap-1 text-green-600">
                            <Shield className="w-3 h-3" /> {progress.satisfied_from_vault} from vault
                          </span>
                        )}
                        {progress.pending > 0 && (
                          <span className="flex items-center gap-1 text-amber-600">
                            <Clock className="w-3 h-3" /> {progress.pending} pending
                          </span>
                        )}
                        {(progress.flagged || 0) > 0 && (
                          <span className="flex items-center gap-1 text-red-600">
                            <Flag className="w-3 h-3" /> {progress.flagged} flagged
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Expanded Requirements */}
                    {isExpanded && c.requirements && (
                      <div className="mt-4 space-y-2 border-t pt-3">
                        {c.requirements.map((req) => {
                          const sm = STATUS_META[req.status] || STATUS_META.in_progress;
                          const Icon = sm.icon;
                          const isDone = req.status === "satisfied_from_vault" || req.status === "completed";
                          const needsUpload = req.status === "missing_document" || req.status === "document_expired";

                          return (
                            <div
                              key={req.id}
                              data-testid={`req-${req.id}`}
                              className={`flex items-center gap-3 p-3 rounded-lg ${isDone ? "bg-green-50 dark:bg-green-900/10" : req.status === "flagged_issue" ? "bg-red-50 dark:bg-red-900/10" : "bg-muted/50"}`}
                            >
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${sm.className}`}>
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ${isDone ? "text-green-700 dark:text-green-400 line-through" : "text-foreground"}`}>
                                  {req.label}
                                </p>
                                <p className="text-[10px] text-muted-foreground">{req.notes}</p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Badge variant="outline" className={`text-[9px] ${sm.className}`}>{sm.label}</Badge>
                                {!isDone && isSeeker && needsUpload && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={(e) => { e.stopPropagation(); openUploadDialog(req); }}
                                    data-testid={`upload-for-${req.id}`}
                                  >
                                    <Upload className="w-3 h-3 mr-1" /> Upload
                                  </Button>
                                )}
                                {!isDone && !isSeeker && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={(e) => { e.stopPropagation(); handleMarkComplete(req.id); }}
                                    data-testid={`complete-${req.id}`}
                                  >
                                    <CheckCircle className="w-3 h-3 mr-1" /> Complete
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Inline Upload Dialog */}
      <Dialog open={!!uploadReq} onOpenChange={(open) => { if (!open) { setUploadReq(null); setSelectedFile(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Upload for: {uploadReq?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {/* File Picker */}
            {selectedFile ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                <FileText className="w-5 h-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(0)} KB</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setSelectedFile(null)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <label
                data-testid="onb-upload-dropzone"
                className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
              >
                <Upload className="w-7 h-7 text-muted-foreground mb-1.5" />
                <p className="text-sm font-medium text-foreground">Select file</p>
                <p className="text-[10px] text-muted-foreground">PDF, JPG, PNG, DOCX — Max 10 MB</p>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      if (f.size > 10 * 1024 * 1024) { toast.error("File too large. Max 10 MB."); return; }
                      setSelectedFile(f);
                    }
                  }}
                />
              </label>
            )}
            {uploading && uploadProgress > 0 && (
              <div className="w-full bg-muted rounded-full h-1.5">
                <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            )}

            {/* Category / Subtype (pre-filled from requirement type) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Select value={uploadForm.category} onValueChange={(v) => setUploadForm((p) => ({ ...p, category: v, subtype: "" }))}>
                  <SelectTrigger data-testid="onb-category-select" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["identity", "certification", "license", "health_record", "health_screen", "resume", "miscellaneous"].map((c) => (
                      <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Subtype</Label>
                <Select value={uploadForm.subtype} onValueChange={(v) => setUploadForm((p) => ({ ...p, subtype: v }))}>
                  <SelectTrigger data-testid="onb-subtype-select" className="h-8 text-xs">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    {(REQ_CATEGORY_HINTS[uploadReq?.type]?.subtypes || []).map((s) => (
                      <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Expiration Date</Label>
                <Input type="date" className="h-8 text-xs" data-testid="onb-expiration" value={uploadForm.expiration_date} onChange={(e) => setUploadForm((p) => ({ ...p, expiration_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">State</Label>
                <Input className="h-8 text-xs" placeholder="e.g., CA" value={uploadForm.state} onChange={(e) => setUploadForm((p) => ({ ...p, state: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setUploadReq(null)}>Cancel</Button>
            <Button data-testid="onb-upload-submit" size="sm" onClick={handleUploadForReq} disabled={uploading || !selectedFile}>
              {uploading ? `Uploading ${uploadProgress}%...` : "Upload & Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default OnboardingPage;
