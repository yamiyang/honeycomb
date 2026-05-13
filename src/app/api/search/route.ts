/* ============================================================
   🐝 Argus — Search Proxy API Route
   
   解决浏览器 CORS 限制。
   前端调用 /api/search，由服务端代理请求各信息源 API。
   ============================================================ */

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, method = "GET", headers = {}, payload } = body as {
      url: string;
      method?: string;
      headers?: Record<string, string>;
      payload?: unknown;
    };

    if (!url) {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    const fetchOptions: RequestInit = {
      method,
      headers: {
        "User-Agent": "Argus-Research-Bot/1.0",
        ...headers,
      },
    };

    if (payload && method === "POST") {
      fetchOptions.body = JSON.stringify(payload);
      (fetchOptions.headers as Record<string, string>)["Content-Type"] = "application/json";
    }

    const response = await fetch(url, fetchOptions);
    
    const contentType = response.headers.get("content-type") || "";
    
    if (contentType.includes("application/json")) {
      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    } else {
      // XML (arXiv) 或其他文本格式
      const text = await response.text();
      return new NextResponse(text, {
        status: response.status,
        headers: { "Content-Type": contentType },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Proxy error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
