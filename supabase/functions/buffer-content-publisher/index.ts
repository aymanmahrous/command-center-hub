// The legacy Buffer publisher is intentionally disabled in the current product phase.
// The owner-facing application has no supported route to this endpoint. Keep this
// explicit tombstone so an old URL cannot silently enqueue external social posts.
Deno.serve(() => {
  return new Response(
    JSON.stringify({ success: false, code: "BUFFER_PUBLISHING_DISABLED" }),
    {
      status: 410,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store, max-age=0",
      },
    },
  );
});
