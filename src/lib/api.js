// Minimal client for OpenAI-compatible servers (vLLM, llama.cpp, Ollama, LM Studio, LiteLLM, TGI…)
//   GET  {base}/models
//   POST {base}/chat/completions   (streaming SSE or plain JSON)
// Token usage comes from the `usage` object the server returns.

function joinUrl(base, path) {
  return String(base || '').replace(/\/+$/, '') + path;
}

function buildHeaders(settings) {
  const headers = { 'Content-Type': 'application/json' };
  if (settings.apiKey) headers.Authorization = `Bearer ${settings.apiKey}`;
  return headers;
}

async function errorFromResponse(res) {
  let text = '';
  try {
    text = await res.text();
  } catch {
    /* ignore */
  }
  let detail = text;
  try {
    const j = JSON.parse(text);
    detail = j?.error?.message || j?.message || j?.detail || j?.error || text;
  } catch {
    /* not JSON */
  }
  if (typeof detail !== 'string') detail = JSON.stringify(detail);
  const err = new Error(
    `${res.status} ${res.statusText || 'Error'}${detail ? ` — ${detail.slice(0, 400)}` : ''}`,
  );
  err.status = res.status;
  return err;
}

export async function listModels(settings, signal) {
  const res = await fetch(joinUrl(settings.baseUrl, '/models'), {
    headers: buildHeaders(settings),
    signal,
  });
  if (!res.ok) throw await errorFromResponse(res);
  const json = await res.json();
  const list = Array.isArray(json) ? json : json.data || json.models || [];
  return list
    .map((m) =>
      typeof m === 'string'
        ? { id: m }
        : { id: m.id || m.name || m.model, ownedBy: m.owned_by, contextLength: m.max_model_len || m.context_length },
    )
    .filter((m) => m.id)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function buildBody(settings, model, messages) {
  const body = { model, messages };
  const t = parseFloat(settings.temperature);
  if (!Number.isNaN(t)) body.temperature = t;
  const mt = parseInt(settings.maxTokens, 10);
  if (!Number.isNaN(mt) && mt > 0) body.max_tokens = mt;
  return body;
}

function normalizeUsage(u) {
  if (!u) return null;
  const prompt = u.prompt_tokens ?? u.input_tokens ?? 0;
  const completion = u.completion_tokens ?? u.output_tokens ?? 0;
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: u.total_tokens ?? prompt + completion,
  };
}

/**
 * Send a chat completion. Streams deltas through onDelta({content, reasoning}).
 * Resolves with { content, reasoning, usage, finishReason, model }.
 */
export async function chatCompletion(settings, { model, messages, signal, onDelta }) {
  const url = joinUrl(settings.baseUrl, '/chat/completions');
  const headers = buildHeaders(settings);
  const base = buildBody(settings, model, messages);

  const post = (body) => fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal });

  // ---- Non-streaming ----
  if (!settings.stream) {
    const res = await post({ ...base, stream: false });
    if (!res.ok) throw await errorFromResponse(res);
    return parseJsonCompletion(await res.json(), onDelta);
  }

  // ---- Streaming (ask for usage in the final chunk) ----
  let res = await post({ ...base, stream: true, stream_options: { include_usage: true } });
  // Some servers reject stream_options; retry once without it.
  if (!res.ok && (res.status === 400 || res.status === 422)) {
    res = await post({ ...base, stream: true });
  }
  if (!res.ok) throw await errorFromResponse(res);

  const contentType = res.headers.get('content-type') || '';
  if (!res.body || contentType.includes('application/json')) {
    // Server ignored stream=true
    return parseJsonCompletion(await res.json(), onDelta);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let reasoning = '';
  let usage = null;
  let finishReason = null;
  let modelName = model;
  let done = false;

  while (!done) {
    const { value, done: streamDone } = await reader.read();
    if (streamDone) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';

    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data) continue;
      if (data === '[DONE]') {
        done = true;
        break;
      }
      let chunk;
      try {
        chunk = JSON.parse(data);
      } catch {
        continue;
      }
      if (chunk.error) {
        throw new Error(chunk.error.message || JSON.stringify(chunk.error));
      }
      if (chunk.model) modelName = chunk.model;
      if (chunk.usage) usage = normalizeUsage(chunk.usage);

      const choice = chunk.choices && chunk.choices[0];
      if (!choice) continue;
      const delta = choice.delta || {};
      const dContent = delta.content || '';
      const dReasoning = delta.reasoning_content || delta.reasoning || '';
      if (dContent || dReasoning) {
        content += dContent;
        reasoning += dReasoning;
        onDelta?.({ content: dContent, reasoning: dReasoning });
      }
      if (choice.finish_reason) finishReason = choice.finish_reason;
    }
  }

  try {
    reader.releaseLock();
  } catch {
    /* ignore */
  }

  return { content, reasoning, usage, finishReason, model: modelName };
}

function parseJsonCompletion(json, onDelta) {
  if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
  const choice = json.choices?.[0] || {};
  const msg = choice.message || {};
  const content = msg.content || choice.text || '';
  const reasoning = msg.reasoning_content || msg.reasoning || '';
  onDelta?.({ content, reasoning });
  return {
    content,
    reasoning,
    usage: normalizeUsage(json.usage),
    finishReason: choice.finish_reason || null,
    model: json.model,
  };
}
