// Shared helpers for talking to SunoAPI.org. The API key never leaves the server.
export const SUNO_BASE = "https://api.sunoapi.org/api/v1";

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

// Returns a Response if the request should be rejected, otherwise null.
export function guard(req) {
  if (!process.env.SUNO_API_KEY) {
    return json({ error: "Server is missing SUNO_API_KEY. Add it in Netlify → Site configuration → Environment variables." }, 500);
  }
  const pass = process.env.APP_PASSWORD;
  if (pass && req.headers.get("x-app-password") !== pass) {
    return json({ error: "Invalid or missing passcode.", needPassword: true }, 401);
  }
  return null;
}

export async function suno(path, init = {}) {
  const res = await fetch(`${SUNO_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.SUNO_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers || {}),
    },
  });
  let data;
  try { data = await res.json(); } catch { data = { msg: `Upstream returned HTTP ${res.status}` }; }
  return { ok: res.ok && (data.code === undefined || data.code === 200), status: res.status, data };
}
