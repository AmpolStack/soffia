// Proxy same-origin de Cloudflare Pages hacia la API .NET 9.
// El frontend llama a /api/* y la cookie de sesión queda en el dominio de Pages.
// Configura SOFFIA_API_ORIGIN en Pages > Settings > Environment variables.
export async function onRequest(context) {
  const origin = context.env.SOFFIA_API_ORIGIN;
  if (!origin) {
    return new Response(
      JSON.stringify({
        error: 'Falta SOFFIA_API_ORIGIN en las variables de entorno de Cloudflare Pages.',
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      },
    );
  }

  const requestUrl = new URL(context.request.url);
  const targetOrigin = new URL(origin);
  const target = new URL(requestUrl.pathname + requestUrl.search, targetOrigin);

  const headers = new Headers(context.request.headers);
  headers.delete('host');
  headers.delete('x-forwarded-for');
  headers.delete('x-forwarded-host');
  headers.delete('x-forwarded-proto');
  headers.set('x-forwarded-host', requestUrl.host);
  headers.set('x-forwarded-proto', requestUrl.protocol.replace(':', ''));
  const clientIp = context.request.headers.get('cf-connecting-ip');
  if (clientIp) headers.set('x-forwarded-for', clientIp);

  const init = {
    method: context.request.method,
    headers,
    redirect: 'manual',
  };
  if (!['GET', 'HEAD'].includes(context.request.method)) {
    init.body = context.request.body;
  }

  let response;
  try {
    response = await fetch(target.toString(), init);
  } catch (error) {
    return new Response(
      JSON.stringify({ error: `No se pudo contactar con la API: ${error.message}` }),
      {
        status: 502,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      },
    );
  }

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete('content-length');
  responseHeaders.delete('transfer-encoding');

  // La cookie debe pertenecer al dominio de Pages, no al de Render.
  const cookies = response.headers.getSetCookie?.() ?? [];
  if (cookies.length > 0) {
    responseHeaders.delete('set-cookie');
    for (const cookie of cookies) {
      responseHeaders.append(
        'set-cookie',
        cookie.replace(/;\s*Domain=[^;]*/gi, ''),
      );
    }
  }

  const location = response.headers.get('location');
  if (location?.startsWith(targetOrigin.origin)) {
    responseHeaders.set(
      'location',
      requestUrl.origin + location.slice(targetOrigin.origin.length),
    );
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
