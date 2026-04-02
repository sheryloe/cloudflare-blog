const LEGACY_CATEGORY_REDIRECTS: Record<string, string> = {
  "유용한-기술": "삶을-유용하게",
  "유용한-정보": "삶을-유용하게",
  "미스터리와-전설": "미스테리아-스토리",
  "역사와-문화": "미스테리아-스토리",
  "이슈와-해설": "동그리의-생각",
  "축제와-시즌": "축제와-현장",
  "행사와-현장": "축제와-현장",
};

type CategoryContext = {
  params: {
    slug?: string;
  };
  request: Request;
  next: () => Promise<Response>;
};

export async function onRequest(context: CategoryContext): Promise<Response> {
  const slugParam = context.params.slug ?? "";
  const slug = decodeURIComponent(slugParam);
  const redirectSlug = LEGACY_CATEGORY_REDIRECTS[slug];

  if (!redirectSlug) {
    return context.next();
  }

  const url = new URL(context.request.url);
  url.pathname = `/ko/category/${encodeURIComponent(redirectSlug)}`;
  return Response.redirect(url.toString(), 301);
}
