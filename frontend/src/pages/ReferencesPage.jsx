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
  UserPlus, Users, ArrowLeft, Plus, CheckCircle, Clock, Shield,
  Mail, Phone, Building, Trash2, Edit, Send, Star, AlertCircle
} from "lucide-react";

const VERIFICATION_META = {
  unverified: { label: "Unverified", cls: "bg-muted text-muted-foreground", icon: AlertCircle },
  pending: { label: "Pending", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: Clock },
  verified: { label: "Verified", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle },
};

const RELATIONSHIPS = [
  "supervisor", "charge_nurse", "manager", "director", "coworker", "physician", "educator", "mentor", "other",
];

const ReferencesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [refs, setRefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editRef, setEditRef] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "", title: "", facility_name: "", relationship: "", email: "", phone: "",
  });

  const fetchRefs = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/references`);
      setRefs(res.data);
    } catch {
      toast.error("Failed to load references");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRefs(); }, [fetchRefs]);

  const resetForm = () => setForm({ full_name: "", title: "", facility_name: "", relationship: "", email: "", phone: "" });

  const handleSave = async () => {
    if (!form.full_name || !form.relationship) { toast.error("Name and relationship are required"); return; }
    setSaving(true);
    try {
      if (editRef) {
        await axios.put(`${API}/references/${editRef.id}`, form);
        toast.success("Reference updated");
      } else {
        await axios.post(`${API}/references`, form);
        toast.success("Reference added");
      }
      setShowAdd(false);
      setEditRef(null);
      resetForm();
      fetchRefs();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API}/references/${id}`);
      setRefs((prev) => prev.filter((r) => r.id !== id));
      toast.success("Reference removed");
    } catch { toast.error("Failed to delete"); }
  };

  const handleRequestVerification = async (ref) => {
    if (!ref.email) { toast.error("Reference needs an email address for verification"); return; }
    try {
      await axios.post(`${API}/references/${ref.id}/request-verification`);
      toast.success("Verification request sent");
      fetchRefs();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to send");
    }
  };

  const openEdit = (ref) => {
    setEditRef(ref);
    setForm({
      full_name: ref.full_name, title: ref.title || "", facility_name: ref.facility_name || "",
      relationship: ref.relationship, email: ref.email || "", phone: ref.phone || "",
    });
    setShowAdd(true);
  };

  const verified = refs.filter((r) => r.verification_status === "verified").length;

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div data-testid="references-page" className="space-y-5 max-w-4xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/seeker")} className="shrink-0 -ml-1">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Professional References</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {refs.length} reference{refs.length !== 1 ? "s" : ""}{verified > 0 ? ` (${verified} verified)` : ""}
              </p>
            </div>
          </div>
          <Button data-testid="add-reference-btn" onClick={() => { resetForm(); setEditRef(null); setShowAdd(true); }} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-1.5" /> Add Reference
          </Button>
        </div>

        {refs.length === 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-5 text-center">
              <Users className="w-10 h-10 mx-auto mb-3 text-primary/60" />
              <h3 className="font-semibold text-foreground mb-1">Add references once. Use them everywhere.</h3>
              <p className="text-sm text-muted-foreground mb-4">
                References are optional but can improve your chances. Add them here and they'll be included in all your applications.
              </p>
              <Button onClick={() => setShowAdd(true)} data-testid="first-reference-btn">
                <UserPlus className="w-4 h-4 mr-1.5" /> Add Your First Reference
              </Button>
            </CardContent>
          </Card>
        )}

        {refs.length > 0 && (
          <div className="space-y-3">
            {refs.map((ref) => {
              const vm = VERIFICATION_META[ref.verification_status] || VERIFICATION_META.unverified;
              const VIcon = vm.icon;
              return (
                <Card key={ref.id} data-testid={`reference-card-${ref.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-semibold text-primary">
                        {ref.full_name?.charAt(0) || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-foreground text-sm">{ref.full_name}</p>
                          <Badge variant="outline" className={`text-[9px] ${vm.cls}`}>
                            <VIcon className="w-2.5 h-2.5 mr-0.5" /> {vm.label}
                          </Badge>
                          {ref.rating && (
                            <span className="flex items-center gap-0.5 text-[10px] text-amber-600">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {ref.rating}/5
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {ref.title && `${ref.title} — `}{ref.relationship?.replace(/_/g, " ")}
                        </p>
                        {ref.facility_name && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Building className="w-3 h-3" /> {ref.facility_name}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground flex-wrap">
                          {ref.email && <span className="flex items-center gap-0.5"><Mail className="w-3 h-3" /> {ref.email}</span>}
                          {ref.phone && <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" /> {ref.phone}</span>}
                        </div>
                        {ref.feedback && (
                          <p className="text-xs text-foreground/80 mt-2 italic border-l-2 border-primary/30 pl-2">"{ref.feedback}"</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        {ref.verification_status === "unverified" && ref.email && (
                          <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => handleRequestVerification(ref)} data-testid={`verify-${ref.id}`}>
                            <Send className="w-3 h-3 mr-0.5" /> Verify
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(ref)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(ref.id)}>
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

      <Dialog open={showAdd} onOpenChange={(o) => { if (!o) { setShowAdd(false); setEditRef(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editRef ? "Edit Reference" : "Add Reference"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input data-testid="ref-name-input" value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} placeholder="e.g., Sarah Johnson, RN" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Title/Role</Label>
                <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="e.g., Charge Nurse" />
              </div>
              <div className="space-y-1.5">
                <Label>Relationship *</Label>
                <Select value={form.relationship} onValueChange={(v) => setForm((p) => ({ ...p, relationship: v }))}>
                  <SelectTrigger data-testid="ref-relationship-select"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIPS.map((r) => (<SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Facility Name</Label>
              <Input value={form.facility_name} onChange={(e) => setForm((p) => ({ ...p, facility_name: e.target.value }))} placeholder="e.g., Memorial Hospital" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" data-testid="ref-email-input" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="email@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="(555) 123-4567" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); setEditRef(null); }}>Cancel</Button>
            <Button data-testid="ref-save-btn" onClick={handleSave} disabled={saving || !form.full_name || !form.relationship}>
              {saving ? "Saving..." : editRef ? "Update" : "Add Reference"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default ReferencesPage;
