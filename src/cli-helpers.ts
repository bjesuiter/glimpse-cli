export function escapeHtmlAttribute(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function iframeForUrl(rawUrl: string) {
  return `<iframe src="${escapeHtmlAttribute(new URL(rawUrl).href)}" style="border:0;width:100vw;height:100vh"></iframe>`;
}
