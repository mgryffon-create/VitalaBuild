import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { buildProfileBio } from "@/lib/profileBio";
import { ROLE_LABELS } from "@/config/canonicalRoles";

const GuidedBioBuilder = ({ profile, updateField, answers, setAnswers }) => {
  const [mode, setMode] = useState("guided");
  const draft = buildProfileBio(profile, answers, ROLE_LABELS[profile.normalized_role_category] || profile.normalized_role_category || "");
  return <div className="space-y-6">
    <div className="flex flex-wrap gap-2" aria-label="Bio writing options">
      <Button type="button" variant={mode === "guided" ? "default" : "outline"} aria-pressed={mode === "guided"} onClick={() => setMode("guided")}>Help me put it into words</Button>
      <Button type="button" variant={mode === "own" ? "default" : "outline"} aria-pressed={mode === "own"} onClick={() => setMode("own")}>I’ll write my own</Button>
    </div>
    {mode === "guided" && <>
      <p className="text-sm text-muted-foreground">We’ll use your role, specialty, and skills from earlier steps. Add anything else you want employers to know. Every question is optional.</p>
      {[
        ["settings", "Where have you worked?", "For example: long-term care, hospitals, or home health"],
        ["approach", "What matters to you in your work?", "For example: clear communication and helping people feel comfortable"],
        ["goal", "What would you like to do next?", "For example: local PRN shifts or a travel assignment"],
      ].map(([key, label, placeholder]) => <div className="space-y-2" key={key}><Label htmlFor={`bio-${key}`}>{label}</Label><Input id={`bio-${key}`} value={answers[key]} placeholder={placeholder} maxLength={250} onChange={e => setAnswers(prev => ({ ...prev, [key]: e.target.value }))} /></div>)}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-3">
        <h3 className="font-semibold">Your draft</h3>
        <p className="text-sm leading-relaxed" aria-live="polite">{draft || "Choose a role in the experience step, or answer a question above, to start your draft."}</p>
        <Button type="button" data-testid="use-bio-draft" disabled={!draft} onClick={() => updateField("bio", draft)}>{profile.bio ? "Replace my bio with this draft" : "Use this draft"}</Button>
        <p className="text-xs text-muted-foreground">This is a template, not AI. Your current bio changes only when you choose to use the draft.</p>
      </div>
    </>}
    <div className="space-y-2"><Label htmlFor="bio">Your bio — edit it to sound like you</Label><Textarea data-testid="bio-input" id="bio" value={profile.bio || ""} onChange={e => updateField("bio", e.target.value)} rows={6} placeholder="Tell employers what you do, what you bring, and what you’re looking for." /><p className="text-xs text-muted-foreground">You can leave this blank and come back later.</p></div>
  </div>;
};
export default GuidedBioBuilder;
