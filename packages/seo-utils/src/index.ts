export function normalizeSiteUrl(value: string) {
  return value.replace(/\/$/, "");
}

export function buildCanonicalUrl(siteUrl: string, pathname: string) {
  return `${normalizeSiteUrl(siteUrl)}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

export function buildHreflangLinks(
  siteUrl: string,
  entries: Array<{ lang: string; pathname: string }>,
) {
  return entries.map((entry) => ({
    lang: entry.lang,
    href: buildCanonicalUrl(siteUrl, entry.pathname),
  }));
}
