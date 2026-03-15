/**
 * Shared CORS configuration for all edge functions.
 * SECURITY: Fails closed — if ALLOWED_ORIGIN env var is not set,
 * defaults to the production domain rather than wildcard '*'.
 */

const PRODUCTION_ORIGIN = "https://aion-vision-hub.lovable.app";

export function getAllowedOrigin(): string {
  const origin = Deno.env.get("ALLOWED_ORIGIN");
  if (!origin || origin === "*") return PRODUCTION_ORIGIN;
  return origin;
}

export function getCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": getAllowedOrigin(),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  };
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(), "Content-Type": "application/json" },
  });
}

export function optionsResponse(): Response {
  return new Response(null, { headers: getCorsHeaders() });
}
