export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. API TẠO HOẶC LƯU FILE RAW (POST /api/upload)
    if (url.pathname === '/api/upload' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { filename, content } = body;

        if (!filename || !content) {
          return new Response(JSON.stringify({ error: 'Thiếu tên file hoặc nội dung!' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Lưu trực tiếp vào KV với key = filename
        await env.PASTE_DB.put(filename, content);

        return new Response(JSON.stringify({ 
          success: true, 
          rawUrl: `${url.origin}/raw/${filename}` 
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // 2. API XÓA FILE (DELETE /api/delete?file=filename)
    if (url.pathname === '/api/delete' && request.method === 'DELETE') {
      try {
        const filename = url.searchParams.get('file');
        if (!filename) {
          return new Response(JSON.stringify({ error: 'Thiếu tên file!' }), { status: 400 });
        }

        await env.PASTE_DB.delete(filename);
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // 3. XEM NỘI DUNG RAW (GET /raw/filename)
    if (url.pathname.startsWith('/raw/')) {
      const filename = url.pathname.replace('/raw/', '');

      // Lấy nội dung từ KV Database
      const rawContent = await env.PASTE_DB.get(filename);

      if (!rawContent) {
        return new Response('404 File Not Found', { status: 404 });
      }

      // Trả về text thô cho bất cứ trình duyệt/tool nào gọi
      return new Response(rawContent, {
        status: 200,
        headers: { 
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 4. MẶC ĐỊNH: Phục vụ giao diện Manager Web tĩnh trong /public
    return env.ASSETS.fetch(request);
  }
};
