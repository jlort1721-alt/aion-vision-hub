// ============================================================
// AION — HTTP Client with timeout support
// [HIGH-ARCH-003] Prevent hanging requests to external services
// ============================================================

const DEFAULT_TIMEOUT = 10_000; // 10 seconds

export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}
