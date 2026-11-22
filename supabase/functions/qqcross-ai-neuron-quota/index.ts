import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const ALLOWED_ORIGIN = "https://mexicanohair2.github.io";
const DAILY_LIMIT = 10000;

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin"
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

function quotaView(row: Record<string, unknown> | null) {
  return {
    used: Number(row?.neurons_used ?? 0),
    reserved: Number(row?.neurons_reserved ?? 0),
    remaining: Number(row?.neurons_remaining ?? DAILY_LIMIT),
    limit: Number(row?.daily_limit ?? DAILY_LIMIT),
    resetsAt: row?.resets_at ?? null
  };
}

function firstRow(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) return (data[0] as Record<string, unknown>) || null;
  if (data && typeof data === "object") return data as Record<string, unknown>;
  return null;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (origin !== ALLOWED_ORIGIN) return new Response("Forbidden", { status: 403, headers: corsHeaders });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Метод не поддерживается." });

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json(401, { error: "Нужна авторизация QQCross." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(503, { error: "Сервис квоты пока не настроен." });
  }

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 4096) return json(413, { error: "Запрос слишком большой." });
    body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid body");
  } catch {
    return json(400, { error: "Некорректный запрос." });
  }

  const token = authorization.slice(7);
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user?.id) return json(401, { error: "Сессия QQCross недействительна." });
  if (user.is_anonymous === true || !(user.email_confirmed_at || user.confirmed_at)) {
    return json(403, { error: "Для Quantum-AI нужен подтверждённый аккаунт QQCross с почтой." });
  }

  const action = body.action;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  try {
    if (action === "balance") {
      const { data, error } = await admin.rpc("get_qqcross_ai_neuron_balance", { p_user_id: user.id });
      if (error) throw error;
      return json(200, { quota: quotaView(firstRow(data)) });
    }

    if (action === "reserve") {
      const neurons = Number(body.neurons);
      if (!Number.isInteger(neurons) || neurons < 1 || neurons > DAILY_LIMIT) {
        return json(400, { error: "Некорректный резерв нейронов." });
      }
      const { data, error } = await admin.rpc("reserve_qqcross_ai_neurons", {
        p_user_id: user.id,
        p_neurons: neurons
      });
      if (error) throw error;
      const row = firstRow(data);
      const quota = quotaView(row);
      if (!row?.allowed || !row?.reservation_id) {
        return json(429, {
          error: "На сегодня личный лимит ИИ исчерпан. Он обновится в 00:00 UTC.",
          quota
        });
      }
      return json(200, { allowed: true, reservationId: row.reservation_id, quota });
    }

    if (action === "settle") {
      const reservationId = String(body.reservationId || "");
      const actualNeurons = Number(body.actualNeurons);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reservationId) ||
          !Number.isInteger(actualNeurons) || actualNeurons < 0 || actualNeurons > DAILY_LIMIT) {
        return json(400, { error: "Некорректное завершение резерва." });
      }
      const { data, error } = await admin.rpc("settle_qqcross_ai_neurons", {
        p_user_id: user.id,
        p_reservation_id: reservationId,
        p_actual_neurons: actualNeurons
      });
      if (error) throw error;
      const row = firstRow(data);
      if (!row?.settled) throw new Error("Quota settlement did not complete");
      return json(200, {
        settled: true,
        chargedNeurons: Number(row.charged_neurons || 0),
        quota: quotaView(row)
      });
    }

    return json(400, { error: "Неизвестное действие квоты." });
  } catch (error) {
    console.error("QQCross AI quota operation failed:", error instanceof Error ? error.message : "unknown error");
    return json(503, { error: "Не удалось обновить личный баланс нейронов. Попробуй позже." });
  }
});
