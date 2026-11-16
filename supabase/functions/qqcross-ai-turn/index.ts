import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Метод не поддерживается." });
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openAIKey = Deno.env.get("OPENAI_API_KEY");
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) return json(500, { error: "Сервер не настроен." });
  if (!openAIKey) return json(503, { error: "Для ChatGPT ещё не подключён серверный API-ключ. Обычные режимы игры работают независимо." });
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json(401, { error: "Нужна авторизация." });
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user) return json(401, { error: "Не удалось подтвердить игровую сессию." });
  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "Некорректный запрос." }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json(400, { error: "Некорректный запрос." });
  if (body.mode === "ask") {
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (question.length < 2 || question.length > 500) return json(400, { error: "Вопрос должен содержать от 2 до 500 символов." });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: allowed, error: limitError } = await adminClient.rpc("consume_qqcross_ai_turn_limit", { p_user_id: userData.user.id });
    if (limitError) {
      console.error("AI question rate-limit check failed:", limitError.message);
      return json(500, { error: "Не удалось проверить лимит запросов. Попробуй позже." });
    }
    if (allowed !== true) return json(429, { error: "Лимит вопросов к ИИ на этот час исчерпан. Попробуй позже." });
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": "Bearer " + openAIKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4.1-mini", temperature: 0.35, max_tokens: 500,
          messages: [
            { role: "system", content: "Ты — помощник в образовательной игре QQCross. Отвечай по-русски, понятно и доброжелательно для подростковой аудитории. Объясняй сложные темы простыми словами, не выдумывай факты и честно говори, если не уверен. Не давай инструкций, которые могут привести к травмам, опасным действиям, употреблению вредных веществ или нарушению закона. Не создавай сексуальный контент и не описывай самоповреждение. Не проси личные данные. Обычно отвечай кратко, структурно и по существу." },
            { role: "user", content: question }
          ]
        }),
      });
      if (!response.ok) {
        const detail = await response.text();
        console.error("OpenAI question request failed:", response.status, detail.slice(0, 400));
        if (response.status === 429) return json(503, { error: "У ИИ временно закончился лимит запросов. Попробуй позже." });
        return json(502, { error: "Не удалось получить ответ от ИИ. Попробуй ещё раз." });
      }
      const result = await response.json();
      const answer = result.choices?.[0]?.message?.content;
      if (typeof answer !== "string" || !answer.trim()) return json(502, { error: "ИИ вернул пустой ответ." });
      return json(200, { answer: answer.trim() });
    } catch (error) {
      console.error("QQCross AI question error:", error);
      return json(502, { error: "Ошибка связи с ИИ. Попробуй ещё раз." });
    }
  }
  const rack = Array.isArray(body.rack) ? body.rack : [];
  const words = Array.isArray(body.words) ? body.words : [];
  const completed = Array.isArray(body.completed) ? body.completed : [];
  if (rack.length > 12 || rack.some((x: unknown) => typeof x !== "string" || !/^[А-ЯЁ]$/i.test(x))) return json(400, { error: "Некорректный набор букв." });
  if (!words.length || words.length > 120 || words.some((w: any) => !w || typeof w.id !== "string" || typeof w.clue !== "string" || typeof w.length !== "number" || w.length < 1 || w.length > 24)) return json(400, { error: "Некорректный список вопросов." });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: allowed, error: limitError } = await adminClient.rpc("consume_qqcross_ai_turn_limit", { p_user_id: userData.user.id });
  if (limitError) {
    console.error("AI rate-limit check failed:", limitError.message);
    return json(500, { error: "Не удалось проверить лимит ходов. Попробуй позже." });
  }
  if (allowed !== true) return json(429, { error: "Лимит ходов ChatGPT на этот час исчерпан. Попробуй позже." });
  const candidates = words.filter((w: any) => !completed.includes(w.id) && w.clue.trim() && w.clue !== "Что изображено на картинке?");
  if (!candidates.length) return json(200, { wordId: null, answer: null, reason: "no_candidates" });
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + openAIKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4.1-mini", temperature: 0.25, max_tokens: 180,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Ты играешь в русскоязычный сканворд против человека. Выбери ОДИН вопрос, на который можешь уверенно дать точный однословный ответ. Учитывай длину ответа и доступные буквы в наборе. Не выдумывай. Если не уверен ни в одном вопросе, верни JSON с wordId и answer равными null. Иначе верни JSON с wordId и answer. Ответ — русскими заглавными буквами без пробелов." },
          { role: "user", content: JSON.stringify({ rack, questions: candidates.map((w: any) => ({ id: w.id, clue: w.clue, answerLength: w.length })) }) },
        ],
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error("OpenAI request failed:", response.status, detail.slice(0, 400));
      if (response.status === 429) return json(503, { error: "У ChatGPT временно закончился лимит запросов. Попробуй немного позже." });
      return json(502, { error: "Не удалось получить ответ от ChatGPT. Попробуй ещё раз." });
    }
    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    if (typeof content !== "string") return json(502, { error: "ChatGPT вернул пустой ответ." });
    let choice: any;
    try { choice = JSON.parse(content); } catch { return json(502, { error: "Не удалось разобрать ход ChatGPT." }); }
    if (choice.wordId === null || choice.answer === null) return json(200, { wordId: null, answer: null });
    const selected = candidates.find((w: any) => w.id === choice.wordId);
    const answer = typeof choice.answer === "string" ? choice.answer.toUpperCase().replace(/Ё/g, "Е").replace(/[^А-Я]/g, "") : "";
    if (!selected || !answer || answer.length !== selected.length) return json(200, { wordId: null, answer: null, reason: "invalid_choice" });
    return json(200, { wordId: selected.id, answer });
  } catch (error) {
    console.error("QQCross AI turn error:", error);
    return json(502, { error: "Ошибка связи с ChatGPT. Попробуй ещё раз." });
  }
});
