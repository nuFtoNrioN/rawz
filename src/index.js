export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Bật CORS để Web Manager từ Repo khác có thể gọi API vào
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 1. API LƯU FILE (POST /api/upload)
    if (url.pathname === '/api/upload' && request.method === 'POST') {
      try {
        const { filename, content } = await request.json();

        if (!filename || !content) {
          return new Response(JSON.stringify({ error: 'Missing filename or content' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        await env.PASTE_DB.put(filename, content);

        return new Response(JSON.stringify({ 
          success: true, 
          rawUrl: `${url.origin}/${filename}` 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { 
          status: 500, 
          headers: corsHeaders 
        });
      }
    }

    // 2. API XÓA FILE (DELETE /api/delete?file=filename)
    if (url.pathname === '/api/delete' && request.method === 'DELETE') {
      try {
        const filename = url.searchParams.get('file');
        if (!filename) {
          return new Response(JSON.stringify({ error: 'Missing filename' }), { 
            status: 400, 
            headers: corsHeaders 
          });
        }

        await env.PASTE_DB.delete(filename);
        return new Response(JSON.stringify({ success: true }), { 
          status: 200, 
          headers: corsHeaders 
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { 
          status: 500, 
          headers: corsHeaders 
        });
      }
    }

    // 3. TRẢ VỀ RAW FILE (GET /:filename)
    // Ví dụ: https://rawz.noirnotfun.workers.dev/my-script
    const filename = url.pathname.slice(1); // Lấy tên file bỏ dấu /
    
    if (filename) {
      const rawContent = await env.PASTE_DB.get(filename);

      if (!rawContent) {
        return new Response('404 Not Found', { status: 404, headers: corsHeaders });
      }

      return new Response(rawContent, {
        status: 200,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'text/plain; charset=utf-8' 
        }
      });
    }

    return new Response('RawZ API Engine Active', { status: 200, headers: corsHeaders });
  }
};
