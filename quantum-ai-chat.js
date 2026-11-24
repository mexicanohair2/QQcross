(() => {
  "use strict";

  const API = "https://quantum-ai-chat-api.qq-ai-cloud.workers.dev";
  const STORE_PREFIX = "qqcross.quantum-ai.chat.v1.";
  const MAX_HISTORY = 80;
  const MAX_IMAGE_CHARS = 1_400_000;
  const REQUEST_TIMEOUT_MS = 90_000;

  const state = {
    userId: "",
    token: "",
    supabase: null,
    messages: [],
    quota: null,
    imageDataUrl: "",
    imageName: "",
    busy: false,
    ready: false,
    error: ""
  };

  const byId = (id) => document.getElementById(id);
  let connectSequence = 0;

  function escapeText(value) {
    return String(value ?? "");
  }


  function appendSafeInline(parent, input) {
    const value = String(input || "");
    const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
    let cursor = 0;
    let match;
    while ((match = pattern.exec(value)) !== null) {
      if (match.index > cursor) parent.append(document.createTextNode(value.slice(cursor, match.index)));
      const token = match[0];
      if (token.startsWith("**")) {
        const node = document.createElement("strong");
        node.textContent = token.slice(2, -2);
        parent.append(node);
      } else if (token.startsWith("*")) {
        const node = document.createElement("em");
        node.textContent = token.slice(1, -1);
        parent.append(node);
      } else {
        const parsed = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(token);
        if (parsed) {
          let url = "";
          try {
            const candidate = new URL(parsed[2]);
            if (candidate.protocol === "https:" || candidate.protocol === "http:") url = candidate.href;
          } catch {}
          if (url) {
            const link = document.createElement("a");
            link.href = url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = parsed[1];
            parent.append(link);
          } else parent.append(document.createTextNode(token));
        }
      }
      cursor = pattern.lastIndex;
    }
    if (cursor < value.length) parent.append(document.createTextNode(value.slice(cursor)));
  }

  function appendMarkdown(parent, input) {
    const lines = String(input || "").replace(/\r\n?/g, "\n").split("\n");
    let index = 0;
    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) { index += 1; continue; }
      if (line.trim().startsWith("```")) {
        index += 1;
        const codeLines = [];
        while (index < lines.length && !lines[index].trim().startsWith("```")) {
          codeLines.push(lines[index]);
          index += 1;
        }
        if (index < lines.length) index += 1;
        const pre = document.createElement("pre");
        pre.className = "qq-quantum-code-block";
        const code = document.createElement("code");
        code.textContent = codeLines.join("\n");
        pre.append(code);
        parent.append(pre);
        continue;
      }
      const heading = /^(#{1,3})\s+(.+)$/.exec(line);
      if (heading) {
        const node = document.createElement("h4");
        node.className = "qq-quantum-markdown-heading";
        appendSafeInline(node, heading[2]);
        parent.append(node);
        index += 1;
        continue;
      }
      if (/^>\s?/.test(line)) {
        const quote = document.createElement("blockquote");
        quote.className = "qq-quantum-markdown-quote";
        const quoteLines = [];
        while (index < lines.length && /^>\s?/.test(lines[index])) {
          quoteLines.push(lines[index].replace(/^>\s?/, ""));
          index += 1;
        }
        appendSafeInline(quote, quoteLines.join(" "));
        parent.append(quote);
        continue;
      }
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const unordered = /^\s*[-*+]\s+/.test(line);
      if (ordered || unordered) {
        const list = document.createElement(ordered ? "ol" : "ul");
        list.className = "qq-quantum-markdown-list";
        const itemPattern = ordered ? /^\s*\d+[.)]\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/;
        while (index < lines.length && itemPattern.test(lines[index])) {
          const itemMatch = itemPattern.exec(lines[index]);
          const item = document.createElement("li");
          appendSafeInline(item, itemMatch[1]);
          list.append(item);
          index += 1;
        }
        parent.append(list);
        continue;
      }
      const paragraphLines = [];
      while (index < lines.length && lines[index].trim() &&
        !/^(#{1,3})\s+/.test(lines[index]) &&
        !/^>\s?/.test(lines[index]) &&
        !/^\s*[-*+]\s+/.test(lines[index]) &&
        !/^\s*\d+[.)]\s+/.test(lines[index]) &&
        !lines[index].trim().startsWith("```")) {
        paragraphLines.push(lines[index].trim());
        index += 1;
      }
      if (paragraphLines.length) {
        const paragraph = document.createElement("p");
        paragraph.className = "qq-quantum-markdown-paragraph";
        for (let i = 0; i < paragraphLines.length; i += 1) {
          if (i) paragraph.append(document.createElement("br"));
          appendSafeInline(paragraph, paragraphLines[i]);
        }
        parent.append(paragraph);
      }
    }
  }

  function markup() {
    return `
      <section class="qq-quantum-ai" aria-label="Quantum-AI">
        <header class="qq-quantum-head">
          <div>
            <h2>Quantum-AI</h2>
            <p>Помощник QQCross · знания, учёба, тексты и поиск</p>
          </div>
          <span class="qq-quantum-status" id="qqQuantumStatus" role="status">Проверяем подключение…</span>
        </header>
        <div class="qq-quantum-quota" id="qqQuantumQuota">Личный баланс: проверяем…</div>
        <p class="qq-quantum-quota-note">Во время генерации нейроны временно резервируются. При ошибке или тайм-ауте резерв возвращается.</p>
        <div class="qq-quantum-messages" id="qqQuantumMessages" aria-live="polite">
          <div class="qq-quantum-welcome">
            <div class="qq-quantum-mark">Q</div>
            <b>Привет! Я Quantum-AI.</b>
            <span>Можешь задавать вопросы, обсуждать идеи, просить объяснить тему или прикрепить фотографию.</span>
          </div>
        </div>
        <div class="qq-quantum-error" id="qqQuantumError" role="alert" hidden></div>
        <form class="qq-quantum-composer" id="qqQuantumForm">
          <div class="qq-quantum-attachment" id="qqQuantumAttachment" hidden></div>
          <textarea id="qqQuantumPrompt" rows="2" maxlength="1800" placeholder="Напиши сообщение…" aria-label="Сообщение Quantum-AI" disabled></textarea>
          <div class="qq-quantum-composer-actions">
            <label class="qq-quantum-photo" for="qqQuantumFile">＋ Фото</label>
            <input id="qqQuantumFile" type="file" accept="image/jpeg,image/png,image/webp" hidden disabled>
            <span class="qq-quantum-hint">Enter — отправить · Shift + Enter — новая строка</span>
            <button class="btn primary" id="qqQuantumSend" type="submit" disabled>Отправить</button>
          </div>
        </form>
      </section>`;
  }

  function setStatus(text, kind = "") {
    const node = byId("qqQuantumStatus");
    if (!node) return;
    node.textContent = text;
    node.dataset.state = kind;
  }

  function setError(message) {
    state.error = String(message || "");
    const node = byId("qqQuantumError");
    if (!node) return;
    node.textContent = state.error;
    node.hidden = !state.error;
  }

  function setComposerEnabled(enabled) {
    const prompt = byId("qqQuantumPrompt");
    const file = byId("qqQuantumFile");
    const send = byId("qqQuantumSend");
    if (prompt) prompt.disabled = !enabled || state.busy;
    if (file) file.disabled = !enabled || state.busy;
    if (send) send.disabled = !enabled || state.busy || (!prompt?.value.trim() && !state.imageDataUrl);
  }

  function formatReset(value) {
    if (!value) return "00:00 UTC";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "00:00 UTC";
    return date.toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  function renderQuota() {
    const node = byId("qqQuantumQuota");
    if (!node) return;
    if (!state.quota) {
      node.textContent = "Личный баланс: ожидает подключения";
      return;
    }
    const remaining = Math.max(0, Number(state.quota.remaining) || 0);
    const limit = Math.max(1, Number(state.quota.limit) || 10000);
    const percent = Math.max(0, Math.min(100, remaining / limit * 100));
    node.innerHTML = `
      <div class="qq-quantum-quota-copy"><b>${remaining.toLocaleString("ru-RU")} / ${limit.toLocaleString("ru-RU")} нейронов</b><span>Сброс: ${formatReset(state.quota.resetsAt)}</span></div>
      <span class="qq-quantum-quota-track"><i style="width:${percent}%"></i></span>`;
  }

  function renderMessages() {
    const host = byId("qqQuantumMessages");
    if (!host) return;
    host.replaceChildren();
    if (!state.messages.length) {
      const welcome = document.createElement("div");
      welcome.className = "qq-quantum-welcome";
      const mark = document.createElement("div");
      mark.className = "qq-quantum-mark";
      mark.textContent = "Q";
      const title = document.createElement("b");
      title.textContent = "Привет! Я Quantum-AI.";
      const description = document.createElement("span");
      description.textContent = "Задай вопрос, обсуди идею или прикрепи изображение.";
      welcome.append(mark, title, description);
      host.append(welcome);
      return;
    }
    for (const message of state.messages) {
      const row = document.createElement("article");
      row.className = "qq-quantum-message " + (message.role === "user" ? "is-user" : "is-assistant");
      const label = document.createElement("span");
      label.className = "qq-quantum-message-label";
      label.textContent = message.role === "user" ? "Ты" : "Quantum-AI";
      const body = document.createElement("div");
      body.className = "qq-quantum-message-body";
      if (message.role === "assistant") appendMarkdown(body, message.content);
      else body.textContent = escapeText(message.content);
      row.append(label);
      if (message.imagePreviewDataUrl) {
        const preview = document.createElement("img");
        preview.className = "qq-quantum-message-image";
        preview.src = message.imagePreviewDataUrl;
        preview.alt = "Отправленное изображение";
        preview.loading = "lazy";
        row.append(preview);
      }
      row.append(body);
      if (message.hasImage && !message.imagePreviewDataUrl) {
        const attachment = document.createElement("small");
        attachment.className = "qq-quantum-image-note";
        attachment.textContent = "Прикреплено изображение";
        row.append(attachment);
      }
      if (Array.isArray(message.sources) && message.sources.length) {
        const sources = document.createElement("div");
        sources.className = "qq-quantum-sources";
        for (const source of message.sources.slice(0, 6)) {
          if (!source || !/^https?:\/\//i.test(source.url || "")) continue;
          const link = document.createElement("a");
          link.href = source.url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = source.title || source.url;
          sources.append(link);
        }
        row.append(sources);
      }
      host.append(row);
    }
    host.scrollTop = host.scrollHeight;
  }

  function storageKey() {
    return STORE_PREFIX + state.userId;
  }

  function loadMessages() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey()) || "[]");
      state.messages = Array.isArray(parsed)
        ? parsed.filter((item) => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string")
            .slice(-MAX_HISTORY).map((item) => ({
              role: item.role,
              content: item.content.slice(0, 6000),
              sources: Array.isArray(item.sources) ? item.sources.slice(0, 6) : [],
              hasImage: item.hasImage === true
            }))
        : [];
    } catch {
      state.messages = [];
    }
  }

  function saveMessages() {
    try {
      const safeMessages = state.messages.slice(-MAX_HISTORY).map((message) => ({
        role: message.role,
        content: message.content,
        sources: Array.isArray(message.sources) ? message.sources.slice(0, 6) : [],
        hasImage: message.hasImage === true
      }));
      localStorage.setItem(storageKey(), JSON.stringify(safeMessages));
    } catch (error) {
      console.warn("Quantum-AI chat history could not be saved:", error);
    }
  }

  async function apiRequest(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (state.supabase && state.userId) {
      const sessionResult = await state.supabase.auth.getSession();
      if (sessionResult.error) throw new Error("Не удалось обновить сессию QQCross. Войди снова.");
      const session = sessionResult.data?.session;
      if (!session?.access_token || session.user?.id !== state.userId) {
        throw new Error("Сессия QQCross завершилась. Войди снова.");
      }
      state.token = session.access_token;
    }
    if (state.token) headers.Authorization = "Bearer " + state.token;
    if (options.body) headers["Content-Type"] = "application/json";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(API + path, {
        ...options,
        headers,
        signal: controller.signal,
        cache: "no-store"
      });
      let data = {};
      try { data = await response.json(); } catch {}
      if (!response.ok) throw new Error(data.error || "Quantum-AI временно недоступна.");
      return data;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("Сервер не ответил за 90 секунд. Запрос остановлен; проверь баланс перед повторной отправкой.");
      }
      if (error instanceof TypeError) throw new Error("Нет соединения с сервером. Проверь интернет и повтори запрос.");
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function refreshQuota() {
    const data = await apiRequest("/api/balance");
    state.quota = data.quota || null;
    renderQuota();
  }

  async function connect(context) {
    const sequence = ++connectSequence;
    const nextUserId = String(context.userId || "");
    if (state.userId !== nextUserId) {
      state.messages = [];
      state.imageDataUrl = "";
      state.imageName = "";
      state.busy = false;
      renderMessages();
      renderAttachment();
    }
    state.supabase = context.supabase;
    state.userId = nextUserId;
    state.ready = false;
    state.quota = null;
    state.token = "";
    renderQuota();

    if (!state.supabase || !state.userId || state.userId.startsWith("local-")) {
      state.messages = [];
      renderMessages();
      setStatus("Нужен аккаунт", "warning");
      setError("Quantum-AI доступна только после входа в QQCross по подтверждённой электронной почте.");
      renderQuota();
      setComposerEnabled(false);
      return;
    }

    let session;
    try {
      const result = await state.supabase.auth.getSession();
      if (sequence !== connectSequence) return;
      if (result.error) throw result.error;
      session = result.data?.session;
    } catch {
      if (sequence !== connectSequence) return;
      state.messages = [];
      renderMessages();
      setStatus("Нет авторизации", "warning");
      setError("Не удалось проверить вход в QQCross. Войди в аккаунт и попробуй снова.");
      setComposerEnabled(false);
      return;
    }

    if (sequence !== connectSequence) return;
    const user = session?.user;
    if (!session?.access_token || !user?.id || user.id !== state.userId ||
        user.is_anonymous === true || !(user.email_confirmed_at || user.confirmed_at)) {
      state.messages = [];
      renderMessages();
      setStatus("Подтверди почту", "warning");
      setError("Для Quantum-AI нужен подтверждённый аккаунт QQCross. Гостевой вход не подходит.");
      setComposerEnabled(false);
      return;
    }

    state.token = session.access_token;
    loadMessages();
    renderMessages();
    setError("");

    try {
      const health = await fetch(API + "/health", { cache: "no-store" });
      if (sequence !== connectSequence) return;
      if (!health.ok) throw new Error("Worker unavailable");
      await refreshQuota();
      if (sequence !== connectSequence) return;
      state.ready = true;
      setStatus("В сети", "ready");
      setError("");
      renderMessages();
      setComposerEnabled(true);
    } catch {
      if (sequence !== connectSequence) return;
      state.ready = false;
      setStatus("Сервер не запущен", "warning");
      setError("Интерфейс уже подключён, но сервер Quantum-AI ещё не опубликован. Пока ответы не генерируются.");
      setComposerEnabled(false);
    }
  }

  async function compressImage(file) {
    if (!file || !/^image\/(?:jpeg|png|webp)$/i.test(file.type)) {
      throw new Error("Выбери изображение JPG, PNG или WebP.");
    }
    if (typeof createImageBitmap !== "function") {
      throw new Error("Этот браузер не поддерживает обработку изображений. Обнови браузер.");
    }
    const bitmap = await createImageBitmap(file);
    const maxSide = 1280;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Не удалось обработать изображение.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    let dataUrl = "";
    for (const quality of [0.82, 0.72, 0.62, 0.52]) {
      dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrl.length <= MAX_IMAGE_CHARS) break;
    }
    if (dataUrl.length > MAX_IMAGE_CHARS) throw new Error("Изображение слишком большое. Попробуй фотографию меньшего размера.");
    return dataUrl;
  }

  function renderAttachment() {
    const host = byId("qqQuantumAttachment");
    if (!host) return;
    host.replaceChildren();
    host.hidden = !state.imageDataUrl;
    if (!state.imageDataUrl) return;
    const image = document.createElement("img");
    image.src = state.imageDataUrl;
    image.alt = "Предпросмотр прикреплённого изображения";
    const name = document.createElement("span");
    name.textContent = state.imageName || "Изображение";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "qq-quantum-remove-image";
    remove.textContent = "Убрать";
    remove.addEventListener("click", () => {
      state.imageDataUrl = "";
      state.imageName = "";
      renderAttachment();
      setComposerEnabled(state.ready);
    });
    host.append(image, name, remove);
  }

  async function sendMessage() {
    const prompt = byId("qqQuantumPrompt");
    const text = prompt?.value.trim() || "";
    if ((!text && !state.imageDataUrl) || !state.ready || state.busy) return;

    const requestUserId = state.userId;
    state.busy = true;
    setError("");
    const userMessage = {
      role: "user",
      content: text || "Проанализируй прикреплённое изображение.",
      hasImage: !!state.imageDataUrl,
      ...(state.imageDataUrl ? { imagePreviewDataUrl: state.imageDataUrl } : {})
    };
    state.messages.push(userMessage);
    state.messages = state.messages.slice(-MAX_HISTORY);
    renderMessages();
    if (prompt) prompt.value = "";
    setComposerEnabled(false);
    const imageDataUrl = state.imageDataUrl;
    setStatus("Генерируем ответ…", "loading");

    try {
      const data = await apiRequest("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: state.messages.slice(-8).map(({ role, content }) => ({ role, content })),
          ...(imageDataUrl ? { imageDataUrl } : {})
        })
      });
      if (requestUserId !== state.userId) return;
      state.messages.push({
        role: "assistant",
        content: String(data.reply || "Ответ не получен."),
        sources: Array.isArray(data.sources) ? data.sources : []
      });
      state.messages = state.messages.slice(-MAX_HISTORY);
      state.quota = data.quota || state.quota;
      saveMessages();
      renderMessages();
      renderQuota();
      setStatus("В сети", "ready");
      state.imageDataUrl = "";
      state.imageName = "";
      renderAttachment();
    } catch (error) {
      if (requestUserId !== state.userId) return;
      state.messages.pop();
      renderMessages();
      if (prompt) prompt.value = text;
      setError(error?.message || "Не удалось получить ответ. Попробуй ещё раз.");

      // A failed turn must not leave a stale reserved balance visible.
      let quotaUpdated = false;
      try {
        await refreshQuota();
        quotaUpdated = true;
      } catch {}
      if (requestUserId !== state.userId) return;
      setStatus(quotaUpdated ? "В сети" : "Баланс не обновлён", quotaUpdated ? "ready" : "warning");
    } finally {
      if (requestUserId === state.userId) {
        state.busy = false;
        setComposerEnabled(state.ready);
      }
    }
  }

  function bind(context) {
    const root = document.querySelector(".qq-quantum-ai");
    if (!root) return;
    const form = byId("qqQuantumForm");
    const prompt = byId("qqQuantumPrompt");
    const file = byId("qqQuantumFile");
    if (form) form.onsubmit = (event) => { event.preventDefault(); sendMessage(); };
    if (prompt) {
      prompt.oninput = () => setComposerEnabled(state.ready);
      prompt.onkeydown = (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          sendMessage();
        }
      };
    }
    if (file) file.onchange = async () => {
      const selected = file.files?.[0];
      if (!selected) return;
      setError("");
      try {
        state.imageDataUrl = await compressImage(selected);
        state.imageName = selected.name || "Изображение";
        renderAttachment();
        setComposerEnabled(state.ready);
      } catch (error) {
        setError(error?.message || "Не удалось прикрепить изображение.");
      } finally {
        file.value = "";
      }
    };
    connect(context);
  }

  function prefill(value) {
    const prompt = byId("qqQuantumPrompt");
    if (!prompt) return;
    prompt.value = String(value || "").slice(0, 1800);
    prompt.focus();
    setComposerEnabled(state.ready);
  }

  window.QQQuantumAI = { markup, bind, prefill };
})();