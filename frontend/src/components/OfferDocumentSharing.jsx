import { useState } from "react";
import axios from "axios";
import { API } from "@/App";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import DocumentPreview from "@/components/DocumentPreview";
import CredentialBadges from "@/components/CredentialBadges";

const typeLabel = (type) => ({ LICENSE: "Professional license", ID: "Government ID", TB: "TB screening", VACCINES: "Vaccination records", BACKGROUND: "Background check", DRUG: "Drug screen" }[type] || type);

export default function OfferDocumentSharing({ offerId }) {
  const [open, setOpen] = useState(false), [data, setData] = useState(null), [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState([]), [autoTypes, setAutoTypes] = useState([]), [preview, setPreview] = useState(null);
  const [review, setReview] = useState(null), [method, setMethod] = useState("document_review"), [notes, setNotes] = useState(""), [confirmed, setConfirmed] = useState(false);
  const fetchData = async () => {
    const r = await axios.get(`${API}/hiring/offers/${offerId}/documents`);
    setData(r.data); setSelected(r.data.documents.filter(d => d.shared).map(d => d.id)); setAutoTypes(r.data.auto_types || []);
    return r.data;
  };
  const start = async () => {
    setOpen(true); setBusy(true);
    try { await fetchData(); } catch (err) { toast.error(err.response?.data?.detail || "Could not load document sharing"); setOpen(false); }
    finally { setBusy(false); }
  };
  const toggle = (list, value) => list.includes(value) ? list.filter(x => x !== value) : [...list, value];
  const save = async () => {
    setBusy(true);
    try {
      await axios.put(`${API}/hiring/offers/${offerId}/documents`, { document_ids: selected, auto_types: autoTypes });
      await fetchData(); toast.success("Document sharing choices saved");
    } catch (err) { toast.error(err.response?.data?.detail || "Could not save choices"); }
    finally { setBusy(false); }
  };
  const verify = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await axios.post(`${API}/hiring/offers/${offerId}/documents/${review.id}/verify`, { method, notes, confirmed });
      setReview(null); await fetchData(); window.dispatchEvent(new Event("credentials-updated")); toast.success("Employer verification saved to the seeker’s credential badge");
    } catch (err) { toast.error(err.response?.data?.detail || "Could not record verification"); }
    finally { setBusy(false); }
  };
  return <div className="mt-4">
    <Button variant="outline" size="sm" onClick={start}>Document sharing & verification</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{data?.is_seeker ? "Choose what this employer receives" : "Candidate-approved credentials"}</DialogTitle><DialogDescription>{data?.is_seeker ? "Your vault is private. Approve only the documents you want to send for this offer, and change or revoke access here at any time." : "Only documents approved by the candidate for this conditional offer appear here."}</DialogDescription></DialogHeader>
      {!data ? <p>Loading…</p> : <div className="space-y-4">
        {data.is_seeker && <><p className="text-sm">Necessary for this job: {data.necessary_types.map(typeLabel).join(", ")}. Other uploads are optional.</p>
          <Button size="sm" variant="outline" disabled={!data.active} onClick={() => {
            const byType = new Map(); data.documents.filter(d => d.necessary && d.current).forEach(d => { if (!byType.has(d.type)) byType.set(d.type, d.id); }); setSelected([...byType.values()]);
          }}>Suggest necessary documents only</Button></>}
        {!data.active && <p className="text-sm text-amber-800">This offer is closed. New sharing and verification are unavailable; you can still revoke consent.</p>}
        {data.documents.length === 0 && <p className="text-sm">{data.is_seeker ? "Upload credentials to your document vault, then return to approve sharing." : "The candidate has not shared any current documents for this offer."}</p>}
        {data.documents.map(doc => <div key={doc.id} className="border rounded-xl p-3 space-y-2">
          <div className="flex gap-2 items-start">
            {data.is_seeker && <input aria-label={`Share ${doc.subtype || doc.file_name}`} className="mt-1" type="checkbox" disabled={!doc.current || !data.active} checked={selected.includes(doc.id)} onChange={() => setSelected(toggle(selected, doc.id))} />}
            <div className="flex-1"><p className="font-medium">{doc.subtype || doc.file_name}</p><p className="text-xs text-muted-foreground">{doc.necessary ? "Necessary credential" : "Optional — share only if you choose"} · {doc.shared ? "Shared" : "Private"}{!doc.current && " · Expired or replaced"}</p></div>
            <Button size="sm" variant="ghost" onClick={() => setPreview(doc)}>View</Button>
          </div>
          <CredentialBadges items={doc.badge ? [doc.badge] : []} />
          {!data.is_seeker && data.active && <Button size="sm" variant="outline" onClick={() => { setReview(doc); setNotes(""); setConfirmed(false); setMethod("document_review"); }}>Record employer verification</Button>}
        </div>)}
        {data.is_seeker && <>
          <details className="border rounded-lg p-3 text-sm"><summary className="cursor-pointer">Optional automatic sharing for this offer</summary><p className="text-xs text-muted-foreground my-2">Off by default. If enabled for a type below, current and future matching uploads you submit will be shared automatically with this employer for this offer. Turn it off to stop future access.</p>
            {data.necessary_types.map(kind => <label key={kind} className="flex gap-2 my-2"><input type="checkbox" disabled={!data.active} checked={autoTypes.includes(kind)} onChange={() => setAutoTypes(toggle(autoTypes, kind))} />{typeLabel(kind)}</label>)}
          </details>
          <div className="flex gap-2"><Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Approve & save sharing choices"}</Button><Button variant="outline" disabled={busy} onClick={() => { setSelected([]); setAutoTypes([]); }}>Clear selection / revoke all</Button></div>
          <p className="text-xs text-muted-foreground">Click Save after changing or clearing your choices. Previously downloaded copies cannot be recalled.</p>
        </>}
        <p className="text-xs text-muted-foreground">{data.disclaimer}</p>
      </div>}
    </DialogContent></Dialog>
    <DocumentPreview doc={preview} open={!!preview} onClose={() => setPreview(null)} />
    <Dialog open={!!review} onOpenChange={() => setReview(null)}><DialogContent><DialogHeader><DialogTitle>Record your verification method</DialogTitle><DialogDescription>This employer attestation stays on the seeker’s badge for this document version. It does not represent independent VitalaMatch verification.</DialogDescription></DialogHeader>
      <form onSubmit={verify} className="space-y-4">
        <label className="block text-sm">Method<select className="block w-full border rounded-md p-2 mt-1 bg-background" value={method} onChange={e => setMethod(e.target.value)}><option value="document_review">Document review only</option><option value="issuer_portal">Issuer portal</option><option value="licensing_board">Licensing board check</option><option value="issuer_contact">Direct issuer contact</option></select></label>
        <label className="block text-sm">Check performed and source<textarea className="w-full border rounded-md p-2 mt-1 bg-background" required minLength={10} maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Describe the check you actually performed and the source used." /></label>
        <label className="flex gap-2 text-sm"><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I performed this check and confirm that my recorded method is accurate.</label>
        <Button disabled={busy || !confirmed} type="submit">Save employer verification</Button>
      </form>
    </DialogContent></Dialog>
  </div>;
}
