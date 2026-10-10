// Cloudflare Worker: lets the TaskBoard website read your Schoology calendar feed.
//
// Why: browsers block a website from reading another site's calendar feed directly.
// This small worker fetches the feed for you and adds the permission header the browser needs.
// It only forwards Schoology calendar links, and only for the websites listed below.
//
// Setup (free): see docs/schoology-proxy.md

const ALLOWED_ORIGINS = ['https://snorps37.github.io', 'http://localhost:5173'];

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') ?? '';
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      Vary: 'Origin'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { ...cors, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '86400' } });
    }

    let target;
    try {
      target = new URL(new URL(request.url).searchParams.get('url'));
    } catch {
      return new Response('Missing or invalid url', { status: 400, headers: cors });
    }

    const isSchoology = target.hostname === 'schoology.com' || target.hostname.endsWith('.schoology.com');
    if (target.protocol !== 'https:' || !isSchoology || !target.pathname.startsWith('/calendar/feed/ical/')) {
      return new Response('Only Schoology calendar feed links are allowed', { status: 403, headers: cors });
    }

    const upstream = await fetch(target.toString());
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...cors, 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }
};
