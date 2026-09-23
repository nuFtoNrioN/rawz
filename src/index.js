export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Header CORS cho phép gọi API từ mọi domain
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 1. LẤY TOÀN BỘ DANH SÁCH FILE & FOLDER (GET /api/rawz)
    if (url.pathname === '/api/rawz' && request.method === 'GET') {
      try {
        const list = await env.PASTE_DB.list();
        const data = {};
        
        // Đọc nội dung của toàn bộ key trong KV
        await Promise.all(list.keys.map(async (k) => {
          const val = await env.PASTE_DB.get(k.name);
          data[k.name] = val;
        }));

        return new Response(JSON.stringify(data), {
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

    // 2. TẠO HOẶC CẬP NHẬT FILE / FOLDER (POST /api/rawz)
    if (url.pathname === '/api/rawz' && request.method === 'POST') {
      try {
        const { key, content, oldKey } = await request.json();

        if (!key) {
          return new Response(JSON.stringify({ error: 'Missing key' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Nếu đổi tên/đường dẫn thì xóa key cũ
        if (oldKey && oldKey !== key) {
          await env.PASTE_DB.delete(oldKey);
        }

        await env.PASTE_DB.put(key, content || '');

        return new Response(JSON.stringify({ 
          success: true, 
          rawUrl: `${url.origin}/${key}` 
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

    // 3. XÓA BATCH NHIỀU FILE HOẶC FOLDER (POST /api/rawz/batch-delete)
    if (url.pathname === '/api/rawz/batch-delete' && request.method === 'POST') {
      try {
        const { keys } = await request.json();

        if (!Array.isArray(keys) || keys.length === 0) {
          return new Response(JSON.stringify({ error: 'Missing keys array' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        await Promise.all(keys.map(k => env.PASTE_DB.delete(k)));

        return new Response(JSON.stringify({ success: true }), {
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

    // 4. TRẢ VỀ RAW CONTENT CHO BẤT KỲ ĐƯỜNG DẪN NÀO (GET /folder1/folder2/script.lua)
    const rawPath = decodeURIComponent(url.pathname.slice(1));
    
    if (rawPath && !rawPath.startsWith('api/')) {
      const rawContent = await env.PASTE_DB.get(rawPath);

      if (rawContent === null) {
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
