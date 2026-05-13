/* ============================================================
   🐝 BeeSearch — Hermes (LLM) Proxy API Route
   
   服务端代理 LLM 调用，避免 API Key 暴露在浏览器端。
   ============================================================ */

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, tools, temperature, max_tokens } = body as {
      messages: { role: string; content: string }[];
      tools?: unknown[];
      temperature?: number;
      max_tokens?: number;
    };

    const baseUrl = process.env.NEXT_PUBLIC_HERMES_BASE_URL || "http://localhost:11434/v1";
    const apiKey = process.env.NEXT_PUBLIC_HERMES_API_KEY || "ollama";
    const model = process.env.NEXT_PUBLIC_HERMES_MODEL || "deepseek-chat";

    const payload: Record<string, unknown> = {
      model,
      messages,
      temperature: temperature ?? 0.7,
      max_tokens: max_tokens ?? 8192,
      stream: false,
    };

    if (tools && tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = "auto";
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json(
        { error: `LLM API error: ${response.status} — ${err}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Hermes proxy error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
