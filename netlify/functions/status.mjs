import { json, guard, suno } from "./_suno.mjs";

export default async (req) => {
  const blocked = guard(req);
  if (blocked) return blocked;
  const taskId = new URL(req.url).searchParams.get("taskId");
  if (!taskId || !/^[\w-]+$/.test(taskId)) return json({ error: "Missing or invalid taskId" }, 400);

  const r = await suno(`/generate/record-info?taskId=${encodeURIComponent(taskId)}`);
  if (!r.ok) return json({ error: r.data?.msg || "Could not fetch status." }, r.status >= 400 ? r.status : 502);

  const d = r.data?.data || {};
  const raw = d.response?.sunoData || d.response?.data || [];
  const tracks = (Array.isArray(raw) ? raw : []).map((t) => ({
    id: t.id,
    title: t.title,
    tags: t.tags,
    duration: t.duration,
    imageUrl: t.imageUrl || t.sourceImageUrl || t.image_url,
    audioUrl: t.audioUrl || t.sourceAudioUrl || t.audio_url,
    streamUrl: t.streamAudioUrl || t.sourceStreamAudioUrl || t.stream_audio_url,
    lyrics: t.prompt,
    model: t.modelName,
  }));

  return json({
    taskId,
    status: d.status || "PENDING",
    error: d.errorMessage || null,
    tracks,
  });
};
