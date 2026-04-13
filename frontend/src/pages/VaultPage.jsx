import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth, API } from "@/App";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Shield, Plus, FileText, AlertTriangle, Clock,
  Trash2, Upload, CreditCard, Heart, ClipboardCheck, X, Eye,
  ArrowLeft, Search, Check, RefreshCw, Archive
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
  archived:   { label: "Archived",   className: "bg-muted text-muted-foreground/60" },
};

// Compute days until expiration
function daysUntilExp(expDate) {
  if (!expDate) return null;
  const exp = new Date(expDate);
  const now = new Date();
  return Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
}

function expirationLabel(expDate) {
  const days = daysUntilExp(expDate);
  if (days === null) return null;
  if (days <= 0) return { text: "Expired", className: "bg-destructive text-destructive-foreground", urgent: true };
  if (days <= 30) return { text: `${days}d left`, className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", urgent: true };
  if (days <= 60) return { text: `${days}d left`, className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", urgent: false };
  return { text: "Active", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", urgent: false };
}

// Sort: expired first, then expiring soon, then active, then no expiration
function sortByExpiration(a, b) {
  const dA = daysUntilExp(a.expiration_date);
  const dB = daysUntilExp(b.expiration_date);
  // Archived go last
  if (a.verification_status === "archived" && b.verification_status !== "archived") return 1;
  if (b.verification_status === "archived" && a.verification_status !== "archived") return -1;
  // Both have expiration
  if (dA !== null && dB !== null) return dA - dB;
  // One has, one doesn't
  if (dA !== null) return -1;
  if (dB !== null) return 1;
  return 0;
}

const VaultPage = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [fromContext, setFromContext] = useState(null);

  // Upload state
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStep, setUploadStep] = useState("category");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [typeSearch, setTypeSearch] = useState("");
  const [replacingDocId, setReplacingDocId] = useState(null); // doc being replaced
  const [form, setForm] = useState({
    issuing_authority: "", document_number: "",
    issue_date: "", expiration_date: "", state: "",
  });

  // Post-upload medical tagging
  const [showMedicalTag, setShowMedicalTag] = useState(false);
  const [additionalTags, setAdditionalTags] = useState([]);
  const [lastUploadRes, setLastUploadRes] = useState(null);
  const [lastUploadedType, setLastUploadedType] = useState("");

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

  // Handle deep-link from profile completion or profile tabs
  useEffect(() => {
    const category = searchParams.get("category");
    const type = searchParams.get("type");
    const from = searchParams.get("from");
    if (category) {
      setFromContext(from);
      setSelectedCategory(category);
      if (type) {
        setSelectedType(type);
        setUploadStep("details");
      } else {
        setUploadStep("type");
      }
      setShowUpload(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const resetUpload = () => {
    setUploadStep("category");
    setSelectedCategory("");
    setSelectedType("");
    setTypeSearch("");
    setSelectedFile(null);
    setUploadProgress(0);
    setReplacingDocId(null);
    setForm({ issuing_authority: "", document_number: "", issue_date: "", expiration_date: "", state: "" });
  };

  const openUpload = () => { resetUpload(); setShowUpload(true); };

  // Replace flow: preselect category + type, mark old doc for archiving
  const startReplace = (doc) => {
    resetUpload();
    setReplacingDocId(doc.id);
    setSelectedCategory(doc.category || "");
    setSelectedType(doc.subtype || "");
    // Prefill metadata from old doc
    setForm({
      issuing_authority: doc.issuing_authority || "",
      document_number: doc.document_number || "",
      issue_date: doc.issue_date || "",
      expiration_date: "",
      state: doc.state || "",
    });
    setUploadStep("details");
    setShowUpload(true);
  };

  const handleUpload = async () => {
    if (!selectedCategory || !selectedType) {
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
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("category", selectedCategory);
      formData.append("subtype", selectedType);
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

      // If replacing, archive the old document
      if (replacingDocId) {
        try {
          await axios.put(`${API}/vault/documents/${replacingDocId}`, {
            verification_status: "archived",
          });
        } catch { /* old doc archive is best-effort */ }
        toast.success(`${selectedType} replaced — previous version archived`);
      } else {
        toast.success(`${selectedType} added to your vault`);
      }

      setShowUpload(false);

      // Medical post-upload tagging
      if (selectedCategory === "medical" && !replacingDocId) {
        setLastUploadRes(res.data);
        setLastUploadedType(selectedType);
        setAdditionalTags([]);
        setShowMedicalTag(true);
      }

      resetUpload();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveMedicalTags = async () => {
    if (additionalTags.length === 0 || !lastUploadRes) {
      setShowMedicalTag(false);
      return;
    }
    try {
      for (const tag of additionalTags) {
        await axios.post(`${API}/vault/documents`, {
          category: "medical", subtype: tag,
          issuing_authority: form.issuing_authority || null,
          document_number: form.document_number || null,
          issue_date: form.issue_date || null,
          expiration_date: form.expiration_date || null,
          state: form.state || null,
          file_url: lastUploadRes.file_url,
          file_name: lastUploadRes.file_name || "uploaded_file",
        });
      }
      toast.success(`${additionalTags.length} additional type${additionalTags.length > 1 ? "s" : ""} tagged`);
      fetchData();
    } catch {
      toast.error("Failed to save additional tags");
    }
    setShowMedicalTag(false);
  };

  const toggleAdditionalTag = (type) => {
    setAdditionalTags((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const getRelatedMedicalTypes = () => {
    const medGroups = getGroupsForCategory("medical");
    if (!medGroups) return [];
    for (const group of Object.values(medGroups)) {
      if (group.types.includes(lastUploadedType)) {
        return group.types.filter((t) => t !== lastUploadedType);
      }
    }
    return [];
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

  // Derived data
  const activeDocs = docs.filter((d) => d.verification_status !== "archived");
  const archivedDocs = docs.filter((d) => d.verification_status === "archived");
  const visibleDocs = showArchived ? docs : activeDocs;
  const filteredDocs = (filter === "all" ? visibleDocs : visibleDocs.filter((d) => d.category === filter)).sort(sortByExpiration);
  const expiredCount = activeDocs.filter((d) => daysUntilExp(d.expiration_date) !== null && daysUntilExp(d.expiration_date) <= 0).length;
  const expiringSoonCount = activeDocs.filter((d) => { const days = daysUntilExp(d.expiration_date); return days !== null && days > 0 && days <= 30; }).length;
  const needsAttentionCount = expiredCount + expiringSoonCount;

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
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Your Documents</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {activeDocs.length} document{activeDocs.length !== 1 ? "s" : ""}
              {archivedDocs.length > 0 && <span className="text-muted-foreground/60 ml-1">({archivedDocs.length} archived)</span>}
            </p>
          </div>
          <Button data-testid="add-vault-doc-btn" onClick={openUpload} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-1.5" /> Add Document
          </Button>
        </div>

        {/* Guidance banner */}
        {fromContext && (
          <div data-testid="vault-guidance-banner" className="flex items-center gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5">
            <Shield className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {fromContext === "completion"
                  ? "You're almost done — upload the required document to complete your profile"
                  : "Upload your document here. It'll be stored securely and shared only when you apply."}
              </p>
            </div>
            <button onClick={() => setFromContext(null)} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Attention banner — documents need action */}
        {needsAttentionCount > 0 && !fromContext && (
          <div data-testid="vault-attention-banner" className="flex items-center gap-3 p-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/10">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {needsAttentionCount} document{needsAttentionCount > 1 ? "s" : ""} need{needsAttentionCount === 1 ? "s" : ""} attention
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {expiredCount > 0 && `${expiredCount} expired`}
                {expiredCount > 0 && expiringSoonCount > 0 && " · "}
                {expiringSoonCount > 0 && `${expiringSoonCount} expiring within 30 days`}
              </p>
            </div>
          </div>
        )}

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <button
            data-testid="filter-all"
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === "all" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-foreground"
            }`}
          >
            All ({activeDocs.length})
          </button>
          {Object.entries(CATEGORY_META).map(([key, meta]) => {
            const count = activeDocs.filter((d) => d.category === key).length;
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
          {archivedDocs.length > 0 && (
            <button
              data-testid="toggle-archived"
              onClick={() => setShowArchived(!showArchived)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-all flex items-center gap-1"
            >
              <Archive className="w-3 h-3" />
              {showArchived ? "Hide archived" : `Show archived (${archivedDocs.length})`}
            </button>
          )}
        </div>

        {/* Documents Grid */}
        {filteredDocs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Shield className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
              <h3 className="font-semibold text-foreground mb-1">
                {filter === "all" ? "No documents yet" : `No ${CATEGORY_META[filter]?.label || filter} documents`}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">Your documents are stored securely and shared only when you choose.</p>
              <Button variant="outline" onClick={openUpload}>
                <Upload className="w-4 h-4 mr-1.5" /> Upload Your First Document
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredDocs.map((doc) => {
              const meta = CATEGORY_META[doc.category] || CATEGORY_META.compliance;
              const Icon = meta.icon;
              const isArchived = doc.verification_status === "archived";
              const vBadge = VERIFICATION_BADGE[doc.verification_status] || VERIFICATION_BADGE.unverified;
              const expLabel = expirationLabel(doc.expiration_date);
              return (
                <Card key={doc.id} data-testid={`vault-doc-${doc.id}`} className={`transition-colors cursor-pointer hover:border-primary/30 ${isArchived ? "opacity-50" : ""} ${expLabel?.urgent ? "border-amber-300 dark:border-amber-700" : ""}`} onClick={() => setPreviewDoc(doc)}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{doc.subtype || doc.file_name || doc.category}</p>
                        <p className="text-xs text-muted-foreground">
                          {meta.label}
                          {doc.file_size ? ` · ${(doc.file_size / 1024).toFixed(0)} KB` : ""}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {isArchived ? (
                            <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground/60">Archived</Badge>
                          ) : (
                            <Badge variant="outline" className={`text-[10px] ${vBadge.className}`}>{vBadge.label}</Badge>
                          )}
                          {expLabel && !isArchived && (
                            <Badge variant="outline" className={`text-[10px] ${expLabel.className}`}>
                              {expLabel.urgent && <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />}
                              {expLabel.text}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5 shrink-0">
                        {!isArchived && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" data-testid={`replace-doc-${doc.id}`} onClick={(e) => { e.stopPropagation(); startReplace(doc); }} title="Replace with newer version">
                            <RefreshCw className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
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
                    else if (uploadStep === "type") { setSelectedCategory(""); setSelectedType(""); setTypeSearch(""); setUploadStep("category"); }
                  }}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              )}
              {replacingDocId ? "Replace Document" : "Add Document"}
            </DialogTitle>
            {replacingDocId && (
              <DialogDescription>Upload a newer version. The previous file will be archived.</DialogDescription>
            )}
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
              <div className="max-h-[300px] overflow-y-auto space-y-1 -mx-1 px-1">
                {groups ? (
                  Object.entries(groups).map(([gKey, group]) => {
                    const filteredTypes = group.types.filter((t) => t.toLowerCase().includes(searchLower));
                    if (filteredTypes.length === 0) return null;
                    return (
                      <div key={gKey} className="mb-2">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1">{group.label}</p>
                        {filteredTypes.map((type) => (
                          <button
                            key={type}
                            data-testid={`vault-type-${type.replace(/[^a-zA-Z0-9]/g, "-")}`}
                            className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg cursor-pointer transition-colors text-left hover:bg-muted/50 border border-transparent"
                            onClick={() => { setSelectedType(type); setUploadStep("details"); }}
                          >
                            <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center shrink-0" />
                            <span className="text-sm text-foreground">{type}</span>
                          </button>
                        ))}
                      </div>
                    );
                  })
                ) : (
                  allTypes.filter((t) => t.toLowerCase().includes(searchLower)).map((type) => (
                    <button
                      key={type}
                      data-testid={`vault-type-${type.replace(/[^a-zA-Z0-9]/g, "-")}`}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg cursor-pointer transition-colors text-left hover:bg-muted/50 border border-transparent"
                      onClick={() => { setSelectedType(type); setUploadStep("details"); }}
                    >
                      <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center shrink-0" />
                      <span className="text-sm text-foreground">{type}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Step 3: File + Details */}
          {uploadStep === "details" && (
            <div data-testid="vault-step-details" className="space-y-3 py-2">
              <Badge variant="outline" className="text-xs">{selectedType}</Badge>

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
                  <Input value={form.issuing_authority} onChange={(e) => setForm((p) => ({ ...p, issuing_authority: e.target.value }))} placeholder="e.g., AHA" />
                </div>
                <div className="space-y-1.5">
                  <Label>Document Number</Label>
                  <Input value={form.document_number} onChange={(e) => setForm((p) => ({ ...p, document_number: e.target.value }))} placeholder="Optional" />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button>
                <Button data-testid="vault-submit-btn" onClick={handleUpload} disabled={uploading || !selectedFile || !selectedType}>
                  {uploading ? `Uploading ${uploadProgress}%...` : replacingDocId ? "Replace Document" : "Save to Vault"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Post-Upload: Medical Tagging ─────── */}
      <Dialog open={showMedicalTag} onOpenChange={setShowMedicalTag}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Does this file cover other records?</DialogTitle>
            <DialogDescription>
              Your <strong>{lastUploadedType}</strong> was saved. If this file also contains other related records, select them below.
            </DialogDescription>
          </DialogHeader>
          <div data-testid="medical-tag-dialog" className="space-y-1 py-2 max-h-[240px] overflow-y-auto">
            {getRelatedMedicalTypes().map((type) => (
              <label
                key={type}
                data-testid={`medical-tag-${type.replace(/[^a-zA-Z0-9]/g, "-")}`}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                  additionalTags.includes(type) ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50 border border-transparent"
                }`}
              >
                <Checkbox checked={additionalTags.includes(type)} onCheckedChange={() => toggleAdditionalTag(type)} className="shrink-0" />
                <span className="text-sm text-foreground">{type}</span>
              </label>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowMedicalTag(false)} data-testid="medical-tag-skip">No, just this one</Button>
            <Button onClick={handleSaveMedicalTags} disabled={additionalTags.length === 0} data-testid="medical-tag-save">
              Tag {additionalTags.length} additional
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Preview */}
      <DocumentPreview doc={previewDoc} open={!!previewDoc} onClose={() => setPreviewDoc(null)} />
    </DashboardLayout>
  );
};

export default VaultPage;
