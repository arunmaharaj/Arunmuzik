import { json, guard, suno } from "./_suno.mjs";

// Streams a generated track back from this site with Content-Disposition: attachment,
// so browsers save the file instead of opening it in a new tab.
// Looks the track up by taskId + track id (never takes a raw URL), so it can't be used as an open proxy.
export default async (req) => {
  const blocked = guard(req);
  if (blocked) return blocked;

  const params = new URL(req.url).searchParams;
  const taskId = params.get("taskId") || "";
  const id = params.get("id") || "";
  if (!/^[\w-]+$/.test(taskId) || !/^[\w-]+$/.test(id)) return json({ error: "Invalid taskId or id" }, 400);

  const r = await suno(`/generate/record-info?taskId=${encodeURIComponent(taskId)}`);
  if (!r.ok) return json({ error: r.data?.msg || "Could not look up the song." }, 502);
  const tracks = r.data?.data?.response?.sunoData || [];
  const track = tracks.find((t) => t.id === id);
  const audioUrl = track && (track.audioUrl || track.sourceAudioUrl);
  if (!audioUrl || !/^https:\/\//i.test(audioUrl)) return json({ error: "Song file is not ready yet." }, 404);

  const upstream = await fetch(audioUrl);
  if (!upstream.ok || !upstream.body) return json({ error: `Could not fetch the song file (${upstream.status}).` }, 502);

  const base = String(track.title || "song").replace(/[^\w\- ]+/g, "").trim().slice(0, 80) || "song";
  const headers = {
    "content-type": upstream.headers.get("content-type") || "audio/mpeg",
    "content-disposition": `attachment; filename="${base}.mp3"`,
    "cache-control": "no-store",
  };
  const len = upstream.headers.get("content-length");
  if (len) headers["content-length"] = len;
  return new Response(upstream.body, { headers });
};
