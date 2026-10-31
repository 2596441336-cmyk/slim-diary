/* 备用方案：如果手机浏览器不能直接连接 DeepSeek，可以把这段代码部署成一个免费的 Cloudflare Worker，
   再把应用设置里的「接口地址」改成 Worker 的网址（例如 https://slim-relay.你的名字.workers.dev）。
   它只做一件事：把请求原样转发给 DeepSeek，并加上浏览器需要的跨域许可。
   它不保存任何内容，也不保存密钥，密钥仍然由你的手机在每次请求时带上。 */
const UPSTREAM = 'https://api.deepseek.com';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400'
};
export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    if (request.method !== 'POST' || !url.pathname.endsWith('/chat/completions')) return new Response('Not found', { status: 404, headers: CORS });
    const upstream = await fetch(UPSTREAM + '/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': request.headers.get('Authorization') || '', 'Content-Type': 'application/json' },
      body: request.body
    });
    const headers = new Headers(upstream.headers);
    Object.entries(CORS).forEach(([k, v]) => headers.set(k, v));
    return new Response(upstream.body, { status: upstream.status, headers });
  }
};
