export interface SakuraConfig {
  apiKey: string;
  baseUrl: string;
  sttModel: string;
}

export interface SakuraChatConfig extends SakuraConfig {
  chatModel: string;
}

export function getSakuraConfig(): SakuraConfig | null {
  const apiKey = process.env.SAKURA_AI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return {
    apiKey,
    baseUrl: process.env.SAKURA_AI_BASE_URL ?? "https://api.ai.sakura.ad.jp/v1",
    sttModel: process.env.SAKURA_STT_MODEL ?? "whisper-large-v3-turbo"
  };
}

export function getSakuraChatConfig(): SakuraChatConfig | null {
  const base = getSakuraConfig();
  const chatModel = process.env.SAKURA_CHAT_MODEL;
  if (!base || !chatModel) {
    return null;
  }
  return {
    ...base,
    chatModel
  };
}

export async function sakuraFetch(
  path: string,
  config: SakuraConfig,
  init: RequestInit
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${config.apiKey}`);
  return fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers
  });
}
