export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 1. API LIST (Lấy danh sách Item thuộc path hiện tại)
    if (url.pathname === '/api/list' && request.method === 'GET') {
      try {
        const prefix = url.searchParams.get('path') || '';
        const listed = await env.PASTE_DB.list({ prefix });
        
        const items = [];
        const processedFolders = new Set();

        for (const key of listed.keys) {
          const relativePath = key.name.substring(prefix.length);
          if (!relativePath) continue;

          const slashIndex = relativePath.indexOf('/');
          
          if (slashIndex === -1) {
            if (key.name !== prefix) { 
              items.push({ type: 'file', name: relativePath, fullPath: key.name });
            }
          } else {
            const folderName = relativePath.substring(0, slashIndex);
            if (!processedFolders.has(folderName)) {
              processedFolders.add(folderName);
              items.push({ type: 'folder', name: folderName, fullPath: prefix + folderName + '/' });
            }
          }
        }

        return new Response(JSON.stringify({ success: true, path: prefix, items }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // 2. API UPLOAD (Tạo/Sửa File hoặc Thư mục)
    if (url.pathname === '/api/upload' && request.method === 'POST') {
      try {
        const { path, content, isFolder } = await request.json();

        if (!path) {
          return new Response(JSON.stringify({ error: 'Missing path' }), { status: 400, headers: corsHeaders });
        }

        if (isFolder) {
          const folderPath = path.endsWith('/') ? path : path + '/';
          await env.PASTE_DB.put(folderPath, '__DIR__');
          return new Response(JSON.stringify({ success: true, type: 'folder', path: folderPath }), { status: 200, headers: corsHeaders });
        } else {
          await env.PASTE_DB.put(path, content || '');
          return new Response(JSON.stringify({ success: true, type: 'file', rawUrl: `${url.origin}/${path}` }), { status: 200, headers: corsHeaders });
        }
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // 3. API DELETE (Xóa File hoặc Thư mục đệ quy)
    if (url.pathname === '/api/delete' && request.method === 'DELETE') {
      try {
        const path = url.searchParams.get('path');
        if (!path) {
          return new Response(JSON.stringify({ error: 'Missing path' }), { status: 400, headers: corsHeaders });
        }

        if (path.endsWith('/')) {
          const listed = await env.PASTE_DB.list({ prefix: path });
          const deletePromises = listed.keys.map(key => env.PASTE_DB.delete(key.name));
          deletePromises.push(env.PASTE_DB.delete(path));
          await Promise.all(deletePromises);
        } else {
          await env.PASTE_DB.delete(path);
        }

        return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // 4. TRẢ VỀ RAW CONTENT (Dành cho Roblox Exec)
    const path = decodeURIComponent(url.pathname.slice(1)); 
    
    if (path && !path.startsWith('api/')) {
      if (path.endsWith('/')) {
         return new Response('Access Denied: This is a directory', { status: 403, headers: corsHeaders });
      }

      const rawContent = await env.PASTE_DB.get(path);

      if (rawContent === null || rawContent === '__DIR__') {
        return new Response('404 Not Found', { status: 404, headers: corsHeaders });
      }

      return new Response(rawContent, {
        status: 200,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache'
        }
      });
    }

    return new Response('RawZ API Engine V2 Active', { status: 200, headers: corsHeaders });
  }
};
