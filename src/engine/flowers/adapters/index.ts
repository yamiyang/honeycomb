/* ============================================================
   🌸 花田适配器注册
   
   将所有信息源适配器注册到花田系统。
   ============================================================ */

import { flowerField } from "../index";
import { googleAdapter } from "./google";
import { twitterAdapter } from "./twitter";
import { githubAdapter } from "./github";
import { arxivAdapter } from "./arxiv";
import { scholarAdapter } from "./scholar";
import { hackernewsAdapter } from "./hackernews";
import { redditAdapter } from "./reddit";
import { webAdapter } from "./web";
import { wikipediaAdapter } from "./wikipedia";
import { stackoverflowAdapter } from "./stackoverflow";
import { youtubeAdapter } from "./youtube";
import { duckduckgoAdapter } from "./duckduckgo";
import { bilibiliAdapter } from "./bilibili";
import { rssAdapter } from "./rss";
import { searxAdapter } from "./searx";
import { braveAdapter } from "./brave";

/**
 * 注册所有内置适配器
 */
export function registerAllAdapters() {
  flowerField.registerAdapter(googleAdapter);
  flowerField.registerAdapter(twitterAdapter);
  flowerField.registerAdapter(githubAdapter);
  flowerField.registerAdapter(arxivAdapter);
  flowerField.registerAdapter(scholarAdapter);
  flowerField.registerAdapter(hackernewsAdapter);
  flowerField.registerAdapter(redditAdapter);
  flowerField.registerAdapter(webAdapter);
  flowerField.registerAdapter(wikipediaAdapter);
  flowerField.registerAdapter(stackoverflowAdapter);
  flowerField.registerAdapter(youtubeAdapter);
  flowerField.registerAdapter(duckduckgoAdapter);
  flowerField.registerAdapter(bilibiliAdapter);
  flowerField.registerAdapter(rssAdapter);
  flowerField.registerAdapter(searxAdapter);
  flowerField.registerAdapter(braveAdapter);
}

export {
  googleAdapter,
  twitterAdapter,
  githubAdapter,
  arxivAdapter,
  scholarAdapter,
  hackernewsAdapter,
  redditAdapter,
  webAdapter,
  wikipediaAdapter,
  stackoverflowAdapter,
  youtubeAdapter,
  duckduckgoAdapter,
  bilibiliAdapter,
  rssAdapter,
  searxAdapter,
  braveAdapter,
};
