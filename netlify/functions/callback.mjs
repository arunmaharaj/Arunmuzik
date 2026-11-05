// SunoAPI.org requires a callBackUrl. The app polls for status instead,
// so this endpoint simply acknowledges the callback.
export default async () =>
  new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
