import { useState } from "react";
import axios from "axios";
import { API } from "@/App";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getTypesForCategory } from "@/config/documentTypes";

export default function CredentialSubmission({ doc, onSaved }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const start = (e) => {
    e.stopPropagation();
    setForm({ subtype: doc.subtype || "", expiration_date: doc.expiration_date?.slice(0, 10) || "", issue_date: doc.issue_date?.slice(0, 10) || "", document_date: doc.document_date?.slice(0, 10) || "", issuing_authority: doc.issuing_authority || "", document_number: doc.document_number || "", state: doc.state || "", confirmed: false });
    setOpen(true);
  };
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await axios.post(`${API}/vault/documents/${doc.id}/submit-unverified`, { ...form, expiration_date: form.expiration_date || null, issue_date: form.issue_date || null, document_date: form.document_date || null });
      toast.success("Submitted as unverified. Matching can proceed when required uploads are complete.");
      window.dispatchEvent(new Event("credentials-updated")); setOpen(false); onSaved();
    } catch (err) { toast.error(err.response?.data?.detail || "Could not submit this credential"); }
    finally { setBusy(false); }
  };
  return <div onClick={e => e.stopPropagation()}>
    <Button variant="link" size="sm" className="px-0 h-auto mt-2" onClick={start}>Review details & submit unverified</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Review your upload</DialogTitle><DialogDescription>Correct the details and submit this upload as unverified. This does not verify the credential or share the file with employers. Clearly unrelated or expired documents must be replaced.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={save}>
        <label className="block text-sm">Document type<select className="w-full border rounded-md p-2 mt-1 bg-background" required value={form.subtype} onChange={e => setForm({ ...form, subtype: e.target.value })}>
          {[...new Set([form.subtype, ...getTypesForCategory(doc.category)])].filter(Boolean).map(t => <option key={t}>{t}</option>)}
        </select></label>
        {[['expiration_date', 'Expiration date', 'date'], ['issue_date', 'Issue date', 'date'], ['document_date', 'Document / test date', 'date'], ['issuing_authority', 'Issuing organization', 'text'], ['document_number', 'Credential number', 'text'], ['state', 'State / jurisdiction', 'text']].map(([key, label, type]) => <label key={key} className="block text-sm">{label}<Input className="mt-1" type={type} required={key === "expiration_date" && ["license", "certification", "identification"].includes(doc.category)} value={form[key] || ""} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}
        <label className="flex gap-2 text-sm"><input type="checkbox" required checked={!!form.confirmed} onChange={e => setForm({ ...form, confirmed: e.target.checked })} />This is my credential, and I confirm these details are accurate. I understand it will remain unverified.</label>
        <Button type="submit" disabled={busy || !form.confirmed}>{busy ? "Submitting…" : "Submit as unverified"}</Button>
      </form>
    </DialogContent></Dialog>
  </div>;
}
