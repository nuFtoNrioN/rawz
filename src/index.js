export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;
        const userAgent = request.headers.get('User-Agent') || '';

        // Phân biệt Browser truy cập
        const isBrowser = userAgent.includes('Mozilla') || userAgent.includes('Chrome') || userAgent.includes('Safari');

        // 1. API: UPLOAD / EDIT FILE
        if (path === '/api/upload' && request.method === 'POST') {
            try {
                const { id, content } = await request.json();
                if (!id || !content) {
                    return new Response(JSON.stringify({ error: 'Thiếu thông tin ID hoặc Nội dung code' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                // Lưu vào KV Store hoặc D1 Database của Cloudflare
                await env.PASTE_DB.put(id, content);

                return new Response(JSON.stringify({ success: true, id }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (err) {
                return new Response(JSON.stringify({ error: err.message }), { status: 500 });
            }
        }

        // 2. API: DELETE FILE
        if (path === '/api/delete' && request.method === 'POST') {
            try {
                const { id } = await request.json();
                if (id) {
                    await env.PASTE_DB.delete(id);
                }
                return new Response(JSON.stringify({ success: true }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (err) {
                return new Response(JSON.stringify({ error: err.message }), { status: 500 });
            }
        }

        // 3. ROUTE: GET RAW SCRIPT (/raw/:id)
        if (path.startsWith('/raw/')) {
            const id = path.replace('/raw/', '').trim();
            const rawContent = await env.PASTE_DB.get(id);

            // Nếu không tìm thấy file
            if (!rawContent) {
                return new Response('Error 404: Script/File Not Found', { status: 404 });
            }

            // Nếu mở bằng Trình duyệt (Chrome/Safari...) -> TRẢ VỀ TRANG 403 ACCESS DENIED
            if (isBrowser) {
                return new Response(`
                    <!DOCTYPE html>
                    <html lang="vi">
                    <head>
                        <meta charset="UTF-8">
                        <title>NOIRHUB // ACCESS_DENIED</title>
                        <style>
                            body { background: #030303; color: #ff2a2a; font-family: monospace; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                            .box { border: 2px solid #ff2a2a; padding: 30px; background: #0a0a0c; box-shadow: 6px 6px 0px #ff2a2a; text-align: center; }
                            h1 { font-size: 20px; margin-bottom: 8px; }
                            p { color: #888; font-size: 12px; }
                        </style>
                    </head>
                    <body>
                        <div class="box">
                            <h1>403 - ACCESS DENIED</h1>
                            <p>Không thể mở mã nguồn trực tiếp bằng trình duyệt Web.</p>
                            <p>Hãy dán đường dẫn này vào Executor Roblox để thực thi.</p>
                        </div>
                    </body>
                    </html>
                `, {
                    status: 403,
                    headers: { 'Content-Type': 'text/html; charset=utf-8' }
                });
            }

            // Nếu mở bằng Executor (HTTP Request từ Roblox) -> TRẢ VỀ LUA SCRIPT THÔ
            return new Response(rawContent, {
                status: 200,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
        }

        // 4. Mặc định trả về Asset Static (Trang UI public/index.html)
        return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not Found', { status: 404 });
    }
};
