// Fallback estimate (~4 characters per token) used only when the server
// doesn't return a `usage` object. Marked as "est." in the UI.
export function estimateTokens(text = '') {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

export function estimateMessages(messages = []) {
  // ~4 tokens of chat-template overhead per message, +2 to prime the reply
  return messages.reduce((sum, m) => sum + estimateTokens(m.content) + 4, 2);
}

const nf = new Intl.NumberFormat();
export function fmt(n) {
  return nf.format(Math.round(n || 0));
}

export function fmtCompact(n) {
  n = n || 0;
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, '') + 'k';
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
}

export function sumUsage(messages = []) {
  return messages.reduce(
    (acc, m) => {
      if (m.role === 'assistant' && m.usage) {
        acc.prompt += m.usage.prompt_tokens || 0;
        acc.completion += m.usage.completion_tokens || 0;
        acc.total += m.usage.total_tokens || 0;
        acc.replies += 1;
        if (m.estimated) acc.estimated = true;
      }
      return acc;
    },
    { prompt: 0, completion: 0, total: 0, replies: 0, estimated: false },
  );
}
