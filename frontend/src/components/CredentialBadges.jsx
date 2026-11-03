import { useEffect, useState } from "react";
import axios from "axios";
import { API } from "@/App";

export const verificationMethod = (value) => ({ document_review: "document review", issuer_portal: "issuer portal", licensing_board: "licensing board check", issuer_contact: "direct issuer contact" }[value] || value);

export default function CredentialBadges({ items, own = false, compact = false }) {
  const [selfItems, setSelfItems] = useState([]);
  useEffect(() => {
    if (!own) return;
    const refresh = () => axios.get(`${API}/vault/credential-badges`).then(r => setSelfItems(r.data)).catch(() => setSelfItems([]));
    refresh(); window.addEventListener("credentials-updated", refresh);
    return () => window.removeEventListener("credentials-updated", refresh);
  }, [own]);
  const rows = items || selfItems;
  if (!rows.length) return null;
  const content = <div className="flex flex-wrap gap-2 mt-2" aria-label="Credential verification status" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
    {rows.map((item, i) => <details key={`${item.credential}-${i}`} className={`rounded-lg border px-2 py-1 text-xs ${item.status === "unverified" ? "bg-amber-50 text-amber-900 border-amber-200" : "bg-primary/5 text-primary border-primary/20"}`}>
      <summary className="cursor-pointer">{item.credential}: {item.label}</summary>
      <p className="mt-2 max-w-sm">{item.disclaimer}</p>
      {item.employer && <p className="mt-1">{item.employer} · {verificationMethod(item.method)} · {new Date(item.verified_at).toLocaleDateString()}</p>}
    </details>)}
  </div>;
  return compact ? <details className="mb-3 text-xs"><summary className="cursor-pointer">Credentials · {rows.filter(r => r.status === "unverified").length} unverified</summary>{content}</details> : content;
}
