// Deterministic copy built only from the worker's own answers.
export const buildProfileBio = (profile, answers = {}, roleLabel = "") => {
  const clean = (value) => typeof value === "string" ? value.trim().replace(/[.!?]+$/, "") : "";
  const skills = (profile.skills || []).map(s => clean(typeof s === "string" ? s : s?.name)).filter(Boolean).slice(0, 3);
  const sentences = [];
  const role = clean(roleLabel);
  const years = Number(profile.years_experience);
  if (role) sentences.push(`My role is ${role}${Number.isFinite(years) && years > 0 ? ` with ${years} ${years === 1 ? "year" : "years"} of experience` : ""}.`);
  if (clean(profile.specialty)) sentences.push(`My focus is ${clean(profile.specialty)}.`);
  if (clean(answers.settings)) sentences.push(`My experience includes ${clean(answers.settings)}.`);
  if (skills.length) sentences.push(`My skills include ${skills.join(", ")}.`);
  if (clean(answers.approach)) sentences.push(`I value ${clean(answers.approach)} in my work.`);
  if (clean(answers.goal)) sentences.push(`I am looking for ${clean(answers.goal)}.`);
  return sentences.join(" ");
};
