/** Keep catalogue pages portable while large, lossless wheel solids use OARTS hosting. */
export function wheelGLBURL(entry) {
  const base = typeof location !== 'undefined' && location.hostname === 'majkpowa.github.io'
    ? 'https://oarts.cz/' : new URL('../', import.meta.url);
  const url = new URL(entry.glb, base);
  const revision = entry.glbRevision || entry.revision;
  if (revision) url.searchParams.set('v', revision);
  return url;
}
