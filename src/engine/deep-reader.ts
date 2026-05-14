/* ============================================================
   🔍 HoneyComb — Deep Reader
   
   蜜蜂的"深度阅读"能力。
   当 AI 判断某条搜索结果值得深入了解时，
   通过 Jina Reader 抓取网页全文，替换原来的摘要片段。
   
   策略：
   1. arXiv 论文 → 优先走 ar5iv.labs.arxiv.org（HTML 版）
   2. 其他网页 → 走 Jina Reader（r.jina.ai）
   3. 全文截断到 maxChars（默认 6000）防止 token 爆炸
   ============================================================ */

import { proxyFetch } from "./flowers/proxy-fetch";
import { flowerField } from "./flowers";

export interface DeepReadResult {
  success: boolean;
  content: string;       // 全文内容（纯文本或 markdown）
  charCount: number;     // 原始全文字符数
  truncated: boolean;    // 是否被截断
}

/**
 * 深度阅读一个 URL，返回全文内容
 * 优先级：适配器原生 getDetail → Jina Reader
 */
export async function deepRead(
  url: string,
  maxChars: number = 6000,
  sourceId?: string
): Promise<DeepReadResult> {
  try {
    // 1. 优先尝试花田适配器的原生 getDetail
    if (sourceId) {
      const detail = await flowerField.getDetail(sourceId, url);
      if (detail && detail.length > 200) {
        const truncated = detail.length > maxChars;
        return {
          success: true,
          content: truncated ? detail.slice(0, maxChars) + `\n\n[... 原文共 ${detail.length} 字符 ...]` : detail,
          charCount: detail.length,
          truncated,
        };
      }
    }

    // 2. arXiv 论文：优先用 ar5iv HTML 版
    const arxivMatch = url.match(/arxiv\.org\/abs\/(.+)/);
    if (arxivMatch) {
      const arxivId = arxivMatch[1];
      const result = await fetchViaJina(`https://ar5iv.labs.arxiv.org/html/${arxivId}`, maxChars);
      if (result.success) return result;
      // ar5iv 失败，降级到 Jina 读原始页面
    }

    // 通用：通过 Jina Reader 抓取
    return await fetchViaJina(url, maxChars);
  } catch (err) {
    console.warn(`[DeepReader] Failed to deep-read ${url}:`, err);
    return { success: false, content: "", charCount: 0, truncated: false };
  }
}

/**
 * 通过 Jina Reader (r.jina.ai) 抓取网页全文
 * Jina Reader 免费额度足够，无需 API Key 也可使用（有速率限制）
 */
async function fetchViaJina(url: string, maxChars: number): Promise<DeepReadResult> {
  const jinaUrl = `https://r.jina.ai/${url}`;
  
  const response = await proxyFetch(jinaUrl, {
    headers: {
      "Accept": "text/plain",
      // 如果有 Jina API Key 可以提速
      ...(process.env.JINA_API_KEY ? { "Authorization": `Bearer ${process.env.JINA_API_KEY}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Jina Reader error: ${response.status}`);
  }

  const fullText = await response.text();
  
  if (!fullText || fullText.length < 100) {
    return { success: false, content: "", charCount: 0, truncated: false };
  }

  const truncated = fullText.length > maxChars;
  const content = truncated ? fullText.slice(0, maxChars) + "\n\n[... 内容已截断，原文共 " + fullText.length + " 字符 ...]" : fullText;

  return {
    success: true,
    content,
    charCount: fullText.length,
    truncated,
  };
}
