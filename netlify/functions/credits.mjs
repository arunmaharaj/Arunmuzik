import { json, guard, suno } from "./_suno.mjs";

export default async (req) => {
  const blocked = guard(req);
  if (blocked) return blocked;
  const r = await suno("/generate/credit");
  if (!r.ok) return json({ error: r.data?.msg || "Could not fetch credits." }, r.status >= 400 ? r.status : 502);
  return json({ credits: r.data?.data ?? null });
};
