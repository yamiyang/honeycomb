/* ============================================================
   代理 Fetch — 浏览器端走 /api/search 代理，服务端直接请求
   ============================================================ */

const IS_BROWSER = typeof window !== "undefined";

/**
 * 跨域安全的 fetch：
 * - 在浏览器端通过 /api/search 代理请求
 * - 在服务端（SSR / API routes）直接请求
 */
export async function proxyFetch(
  url: string,
  options?: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  }
): Promise<Response> {
  if (!IS_BROWSER) {
    // 服务端直接请求
    const fetchOptions: RequestInit = {
      method: options?.method || "GET",
      headers: {
        "User-Agent": "Argus-Research-Bot/1.0",
        ...options?.headers,
      },
    };
    if (options?.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }
    return fetch(url, fetchOptions);
  }

  // 浏览器端走代理
  const proxyResponse = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      method: options?.method || "GET",
      headers: options?.headers || {},
      payload: options?.body,
    }),
  });

  return proxyResponse;
}
