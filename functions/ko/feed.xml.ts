export async function onRequest(context: { request: Request }): Promise<Response> {
  const url = new URL(context.request.url);
  const location = `${url.origin}/ko/rss.xml`;
  return Response.redirect(location, 301);
}
