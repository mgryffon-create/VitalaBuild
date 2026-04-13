import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Shield, Plus, FileText, AlertTriangle, CheckCircle, Clock,
  Trash2, Upload, CreditCard, Heart, ClipboardCheck, X, Eye,
  ArrowLeft, Search, Tag
} from "lucide-react";
import { DOCUMENT_CATEGORIES, getTypesForCategory, getGroupsForCategory } from "@/config/documentTypes";
import DocumentPreview from "@/components/DocumentPreview";

const CATEGORY_META = {
  medical:        { label: "Medical",       icon: Heart,          color: "text-red-600 bg-red-100 dark:bg-red-900/30" },
  certification:  { label: "Certification", icon: Shield,         color: "text-green-600 bg-green-100 dark:bg-green-900/30" },
  identification: { label: "Identification",icon: CreditCard,     color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" },
  license:        { label: "License",       icon: FileText,       color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30" },
  compliance:     { label: "Compliance",    icon: ClipboardCheck, color: "text-amber-600 bg-amber-100 dark:bg-amber-900/30" },
};

const VERIFICATION_BADGE = {
  pending:    { label: "Pending",    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  verified:   { label: "Verified",   className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  rejected:   { label: "Rejected",   className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  unverified: { label: "Unverified", className: "bg-muted text-muted-foreground" },
};

const VaultPage = () => {
  const { user } = useAuth();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [previewDoc, setPreviewDoc] = useState(null);

  // Upload state
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStep, setUploadStep] = useState("category");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [typeSearch, setTypeSearch] = useState("");
  const [form, setForm] = useState({
    issuing_authority: "", document_number: "",
    issue_date: "", expiration_date: "", state: "",
  });

  const fetchData = useCallback(async () => {
    try {
      const docsRes = await axios.get(`${API}/vault/documents`);
      setDocs(docsRes.data);
    } catch {
      toast.error("Failed to load vault");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetUpload = () => {
    setUploadStep("category");
    setSelectedCategory("");
    setSelectedTypes([]);
    setTypeSearch("");
    setSelectedFile(null);
    setUploadProgress(0);
    setForm({ issuing_authority: "", document_number: "", issue_date: "", expiration_date: "", state: "" });
  };

  const openUpload = () => { resetUpload(); setShowUpload(true); };

  const toggleType = (type) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleUpload = async () => {
    if (!selectedCategory || selectedTypes.length === 0) {
      toast.error("Please select a category and document type");
      return;
    }
    if (!selectedFile) {
      toast.error("Please select a file to upload");
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      // Upload once per selected type (sharing the same file)
      const primaryType = selectedTypes[0];
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("category", selectedCategory);
      formData.append("subtype", primaryType);
      if (form.issuing_authority) formData.append("issuing_authority", form.issuing_authority);
      if (form.document_number) formData.append("document_number", form.document_number);
      if (form.issue_date) formData.append("issue_date", form.issue_date);
      if (form.expiration_date) formData.append("expiration_date", form.expiration_date);
      if (form.state) formData.append("state", form.state);

      const res = await axios.post(`${API}/vault/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        },
      });

      // If multi-tagged, create additional vault records for the same file
      if (selectedTypes.length > 1) {
        for (let i = 1; i < selectedTypes.length; i++) {
          await axios.post(`${API}/vault/documents`, {
            category: selectedCategory,
            subtype: selectedTypes[i],
            issuing_authority: form.issuing_authority || null,
            document_number: form.document_number || null,
            issue_date: form.issue_date || null,
            expiration_date: form.expiration_date || null,
            state: form.state || null,
            file_url: res.data.file_url,
            file_name: selectedFile.name,
          });
        }
      }

      toast.success(`${selectedTypes.length} document type${selectedTypes.length > 1 ? "s" : ""} uploaded to vault`);
      setShowUpload(false);
      resetUpload();
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
  const expiredCount = docs.filter((d) => d.expiration_date && new Date(d.expiration_date) < new Date()).length;

  // For type selection
  const allTypes = getTypesForCategory(selectedCategory);
  const groups = getGroupsForCategory(selectedCategory);
  const searchLower = typeSearch.toLowerCase();

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
          <Button data-testid="add-vault-doc-btn" onClick={openUpload} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-1.5" /> Add Document
          </Button>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2">
          <button
            data-testid="filter-all"
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === "all" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-foreground"
            }`}
          >
            All ({docs.length})
          </button>
          {Object.entries(CATEGORY_META).map(([key, meta]) => {
            const count = docs.filter((d) => d.category === key).length;
            if (count === 0) return null;
            return (
              <button
                key={key}
                data-testid={`filter-${key}`}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
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
              <Button variant="outline" onClick={openUpload}>
                <Upload className="w-4 h-4 mr-1.5" /> Upload Your First Document
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((doc) => {
              const meta = CATEGORY_META[doc.category] || CATEGORY_META.compliance;
              const Icon = meta.icon;
              const vBadge = VERIFICATION_BADGE[doc.verification_status] || VERIFICATION_BADGE.unverified;
              const isExpired = doc.expiration_date && new Date(doc.expiration_date) < new Date();
              return (
                <Card key={doc.id} data-testid={`vault-doc-${doc.id}`} className={`transition-colors cursor-pointer hover:border-primary/30 ${isExpired ? "border-amber-300 dark:border-amber-700" : ""}`} onClick={() => setPreviewDoc(doc)}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{doc.subtype || doc.file_name || doc.category}</p>
                        <p className="text-xs text-muted-foreground">
                          {meta.label}
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
                            <span className="text-[10px] text-primary flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" /> Preview</span>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}>
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

      {/* ── Upload Dialog ─────────────────────────────────── */}
      <Dialog open={showUpload} onOpenChange={(open) => { if (!open) resetUpload(); setShowUpload(open); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {uploadStep !== "category" && (
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 -ml-1 shrink-0"
                  data-testid="vault-upload-back-btn"
                  onClick={() => {
                    if (uploadStep === "details") setUploadStep("type");
                    else if (uploadStep === "type") { setSelectedCategory(""); setSelectedTypes([]); setTypeSearch(""); setUploadStep("category"); }
                  }}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              )}
              Upload to Vault
            </DialogTitle>
          </DialogHeader>

          {/* Step 1: Category */}
          {uploadStep === "category" && (
            <div data-testid="vault-step-category" className="grid grid-cols-2 gap-2 py-2">
              {Object.entries(CATEGORY_META).map(([key, meta]) => {
                const Icon = meta.icon;
                return (
                  <button
                    key={key}
                    data-testid={`vault-cat-${key}`}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
                    onClick={() => { setSelectedCategory(key); setUploadStep("type"); }}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-medium text-sm text-foreground">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 2: Type Selection */}
          {uploadStep === "type" && (
            <div data-testid="vault-step-type" className="space-y-3 py-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  data-testid="vault-type-search"
                  placeholder="Search types..."
                  value={typeSearch}
                  onChange={(e) => setTypeSearch(e.target.value)}
                  className="pl-9 h-9"
                  autoFocus
                />
              </div>

              <div className="max-h-[280px] overflow-y-auto space-y-1 -mx-1 px-1">
                {groups ? (
                  Object.entries(groups).map(([gKey, group]) => {
                    const filtered_types = group.types.filter((t) => t.toLowerCase().includes(searchLower));
                    if (filtered_types.length === 0) return null;
                    return (
                      <div key={gKey} className="mb-2">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1">{group.label}</p>
                        {filtered_types.map((type) => (
                          <label
                            key={type}
                            data-testid={`vault-type-${type.replace(/[^a-zA-Z0-9]/g, "-")}`}
                            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                              selectedTypes.includes(type) ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50 border border-transparent"
                            }`}
                          >
                            <Checkbox checked={selectedTypes.includes(type)} onCheckedChange={() => toggleType(type)} className="shrink-0" />
                            <span className="text-sm text-foreground">{type}</span>
                          </label>
                        ))}
                      </div>
                    );
                  })
                ) : (
                  allTypes.filter((t) => t.toLowerCase().includes(searchLower)).map((type) => (
                    <label
                      key={type}
                      data-testid={`vault-type-${type.replace(/[^a-zA-Z0-9]/g, "-")}`}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                        selectedTypes.includes(type) ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50 border border-transparent"
                      }`}
                    >
                      <Checkbox checked={selectedTypes.includes(type)} onCheckedChange={() => toggleType(type)} className="shrink-0" />
                      <span className="text-sm text-foreground">{type}</span>
                    </label>
                  ))
                )}
              </div>

              {selectedTypes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1 border-t">
                  {selectedTypes.map((t) => (
                    <Badge key={t} variant="secondary" className="text-xs gap-1 pr-1">
                      {t}
                      <button onClick={() => toggleType(t)} className="ml-0.5 hover:text-destructive"><X className="w-3 h-3" /></button>
                    </Badge>
                  ))}
                </div>
              )}

              <Button
                data-testid="vault-type-next-btn"
                className="w-full"
                disabled={selectedTypes.length === 0}
                onClick={() => setUploadStep("details")}
              >
                Continue with {selectedTypes.length} type{selectedTypes.length !== 1 ? "s" : ""}
              </Button>
            </div>
          )}

          {/* Step 3: File + Details */}
          {uploadStep === "details" && (
            <div data-testid="vault-step-details" className="space-y-3 py-2">
              <div className="flex flex-wrap gap-1.5">
                {selectedTypes.map((t) => (
                  <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                ))}
              </div>

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
                    className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                  >
                    <Upload className="w-7 h-7 text-muted-foreground mb-1.5" />
                    <p className="text-sm font-medium text-foreground">Click to select a file</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">PDF, JPG, PNG, DOCX — Max 10 MB</p>
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx"
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
                  <Label>Expiration Date</Label>
                  <Input type="date" data-testid="vault-expiration-input" value={form.expiration_date} onChange={(e) => setForm((p) => ({ ...p, expiration_date: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>State</Label>
                  <Input value={form.state} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))} placeholder="e.g., CA" />
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

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button>
                <Button data-testid="vault-submit-btn" onClick={handleUpload} disabled={uploading || !selectedFile || selectedTypes.length === 0}>
                  {uploading ? `Uploading ${uploadProgress}%...` : "Upload to Vault"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Document Preview */}
      <DocumentPreview doc={previewDoc} open={!!previewDoc} onClose={() => setPreviewDoc(null)} />
    </DashboardLayout>
  );
};

export default VaultPage;
