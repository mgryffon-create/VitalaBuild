import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Shield, Plus, FileText, AlertTriangle, CheckCircle, Clock,
  Trash2, Upload, CreditCard, Heart, Stethoscope, File, X
} from "lucide-react";

const CATEGORY_META = {
  identity: { label: "Identity", icon: CreditCard, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" },
  certification: { label: "Certification", icon: Shield, color: "text-green-600 bg-green-100 dark:bg-green-900/30" },
  license: { label: "License", icon: FileText, color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30" },
  health_record: { label: "Health Record", icon: Heart, color: "text-red-600 bg-red-100 dark:bg-red-900/30" },
  health_screen: { label: "Health Screen", icon: Stethoscope, color: "text-amber-600 bg-amber-100 dark:bg-amber-900/30" },
  resume: { label: "Resume", icon: File, color: "text-foreground bg-muted" },
  miscellaneous: { label: "Other", icon: File, color: "text-muted-foreground bg-muted" },
};

const VERIFICATION_BADGE = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  verified: { label: "Verified", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  unverified: { label: "Unverified", className: "bg-muted text-muted-foreground" },
};

const VaultPage = () => {
  const { user } = useAuth();
  const [docs, setDocs] = useState([]);
  const [categories, setCategories] = useState({});
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [filter, setFilter] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [form, setForm] = useState({
    category: "", subtype: "", issuing_authority: "",
    document_number: "", issue_date: "", expiration_date: "",
    document_date: "", state: "",
  });

  const fetchData = useCallback(async () => {
    try {
      const [docsRes, catsRes] = await Promise.all([
        axios.get(`${API}/vault/documents`),
        axios.get(`${API}/vault/categories`),
      ]);
      setDocs(docsRes.data);
      setCategories(catsRes.data.categories || {});
    } catch {
      toast.error("Failed to load vault");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpload = async () => {
    if (!form.category) {
      toast.error("Please select a category");
      return;
    }
    if (!selectedFile) {
      toast.error("Please select a file to upload");
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("category", form.category);
      if (form.subtype) formData.append("subtype", form.subtype);
      if (form.issuing_authority) formData.append("issuing_authority", form.issuing_authority);
      if (form.document_number) formData.append("document_number", form.document_number);
      if (form.issue_date) formData.append("issue_date", form.issue_date);
      if (form.expiration_date) formData.append("expiration_date", form.expiration_date);
      if (form.document_date) formData.append("document_date", form.document_date);
      if (form.state) formData.append("state", form.state);

      await axios.post(`${API}/vault/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      toast.success("Document uploaded to vault");
      setShowUpload(false);
      setForm({ category: "", subtype: "", issuing_authority: "", document_number: "", issue_date: "", expiration_date: "", document_date: "", state: "" });
      setSelectedFile(null);
      setUploadProgress(0);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to upload");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId) => {
    try {
      await axios.delete(`${API}/vault/documents/${docId}`);
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      toast.success("Document removed");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const filtered = filter === "all" ? docs : docs.filter((d) => d.category === filter);
  const expiredCount = docs.filter((d) => {
    if (!d.expiration_date) return false;
    return new Date(d.expiration_date) < new Date();
  }).length;

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
      <div data-testid="vault-page" className="space-y-5 max-w-5xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Secure Document Vault</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {docs.length} document{docs.length !== 1 ? "s" : ""} stored
              {expiredCount > 0 && <span className="text-amber-600 ml-2">({expiredCount} expired)</span>}
            </p>
          </div>
          <Button data-testid="add-vault-doc-btn" onClick={() => setShowUpload(true)} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-1.5" /> Add Document
          </Button>
        </div>

        {/* Category Stats */}
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          <button
            data-testid="filter-all"
            onClick={() => setFilter("all")}
            className={`p-2 rounded-lg text-center text-xs font-medium transition-all ${
              filter === "all" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-foreground"
            }`}
          >
            All ({docs.length})
          </button>
          {Object.entries(CATEGORY_META).map(([key, meta]) => {
            const count = docs.filter((d) => d.category === key).length;
            return (
              <button
                key={key}
                data-testid={`filter-${key}`}
                onClick={() => setFilter(key)}
                className={`p-2 rounded-lg text-center text-xs font-medium transition-all ${
                  filter === key ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-foreground"
                }`}
              >
                {meta.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Documents Grid */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Shield className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
              <h3 className="font-semibold text-foreground mb-1">
                {filter === "all" ? "Your vault is empty" : `No ${CATEGORY_META[filter]?.label || filter} documents`}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">Upload documents once. Reuse them across job offers.</p>
              <Button variant="outline" onClick={() => setShowUpload(true)}>
                <Upload className="w-4 h-4 mr-1.5" /> Upload Your First Document
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((doc) => {
              const meta = CATEGORY_META[doc.category] || CATEGORY_META.miscellaneous;
              const Icon = meta.icon;
              const vBadge = VERIFICATION_BADGE[doc.verification_status] || VERIFICATION_BADGE.unverified;
              const isExpired = doc.expiration_date && new Date(doc.expiration_date) < new Date();
              return (
                <Card key={doc.id} data-testid={`vault-doc-${doc.id}`} className={`transition-colors ${isExpired ? "border-amber-300 dark:border-amber-700" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{doc.file_name || doc.subtype || doc.category}</p>
                        <p className="text-xs text-muted-foreground">
                          {meta.label}{doc.subtype ? ` — ${doc.subtype.replace(/_/g, " ")}` : ""}
                          {doc.file_size ? ` — ${(doc.file_size / 1024).toFixed(0)} KB` : ""}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] ${vBadge.className}`}>{vBadge.label}</Badge>
                          {isExpired && (
                            <Badge variant="outline" className="text-[10px] bg-red-100 text-red-700 border-red-200">
                              <AlertTriangle className="w-2.5 h-2.5 mr-0.5" /> Expired
                            </Badge>
                          )}
                          {doc.expiration_date && !isExpired && (
                            <span className="text-[10px] text-muted-foreground">Exp: {doc.expiration_date.slice(0, 10)}</span>
                          )}
                          {doc.file_url && (
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline" onClick={(e) => e.stopPropagation()}>View file</a>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(doc.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={(open) => { setShowUpload(open); if (!open) { setSelectedFile(null); setUploadProgress(0); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Document to Vault</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {/* File Picker */}
            <div className="space-y-1.5">
              <Label>File *</Label>
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
                  data-testid="vault-file-dropzone"
                  className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                >
                  <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium text-foreground">Click to select a file</p>
                  <p className="text-xs text-muted-foreground mt-0.5">PDF, JPG, PNG, DOCX — Max 10 MB</p>
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
                <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                  <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v, subtype: "" }))}>
                  <SelectTrigger data-testid="vault-category-select"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_META).map(([k, m]) => (
                      <SelectItem key={k} value={k}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Subtype</Label>
                <Select value={form.subtype} onValueChange={(v) => setForm((p) => ({ ...p, subtype: v }))}>
                  <SelectTrigger data-testid="vault-subtype-select"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {(categories[form.category] || []).map((s) => (
                      <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Issuing Authority</Label>
                <Input value={form.issuing_authority} onChange={(e) => setForm((p) => ({ ...p, issuing_authority: e.target.value }))} placeholder="e.g., CA DMV" />
              </div>
              <div className="space-y-1.5">
                <Label>Document Number</Label>
                <Input value={form.document_number} onChange={(e) => setForm((p) => ({ ...p, document_number: e.target.value }))} placeholder="Optional" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Expiration Date</Label>
                <Input type="date" data-testid="vault-expiration-input" value={form.expiration_date} onChange={(e) => setForm((p) => ({ ...p, expiration_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>State</Label>
                <Input value={form.state} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))} placeholder="e.g., CA" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button>
            <Button data-testid="vault-submit-btn" onClick={handleUpload} disabled={uploading || !form.category || !selectedFile}>
              {uploading ? `Uploading ${uploadProgress}%...` : "Upload to Vault"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default VaultPage;
