import { json, guard, suno } from "./_suno.mjs";

const MODELS = ["V5", "V4_5PLUS", "V4_5", "V4", "V3_5"];

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const blocked = guard(req);
  if (blocked) return blocked;

  let input;
  try { input = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  const customMode = !!input.customMode;
  const instrumental = !!input.instrumental;
  const model = MODELS.includes(input.model) ? input.model : "V4_5";
  const prompt = String(input.prompt || "").trim();
  const style = String(input.style || "").trim();
  const title = String(input.title || "").trim();
  const negativeTags = String(input.negativeTags || "").trim();

  if (!customMode) {
    if (!prompt) return json({ error: "Please describe the song you want." }, 400);
    if (prompt.length > 500) return json({ error: "Description must be 500 characters or fewer in Simple mode." }, 400);
  } else {
    if (!style) return json({ error: "Style is required in Custom mode." }, 400);
    if (!title) return json({ error: "Title is required in Custom mode." }, 400);
    if (!instrumental && !prompt) return json({ error: "Lyrics are required unless Instrumental is on." }, 400);
  }

  const origin = process.env.URL || new URL(req.url).origin;
  const body = {
    customMode,
    instrumental,
    model,
    prompt,
    callBackUrl: `${origin}/.netlify/functions/callback`,
  };
  if (customMode) {
    body.style = style;
    body.title = title;
    if (negativeTags) body.negativeTags = negativeTags;
    if (instrumental && !prompt) delete body.prompt;
  }

  const r = await suno("/generate", { method: "POST", body: JSON.stringify(body) });
  const taskId = r.data?.data?.taskId;
  if (!r.ok || !taskId) {
    return json({ error: r.data?.msg || "Generation request failed.", upstream: r.data }, r.status >= 400 ? r.status : 502);
  }
  return json({ taskId });
};
