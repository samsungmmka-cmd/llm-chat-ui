// Separates a model's "thinking" from its answer.
//
// Reasoning can arrive two ways:
//  1. In a separate `reasoning_content` field (vLLM/SGLang with a reasoning parser,
//     DeepSeek, etc.), already split out by the API client.
//  2. Inline in the content as <think>…</think> (Qwen3, DeepSeek-R1 and others when
//     the server has no reasoning parser). Some chat templates put the opening
//     <think> in the prompt, so the output starts mid-thought and only has </think>.

const OPEN = /<think(?:ing)?>/i;
const CLOSE = /<\/think(?:ing)?>/i;

/**
 * @param {string} content  raw assistant content (may contain think tags)
 * @param {string} reasoning separate reasoning text from the API, if any
 * @returns {{ thinking: string, answer: string, inProgress: boolean }}
 *   inProgress = thinking has started but the closing tag hasn't arrived yet
 */
export function splitThinking(content = '', reasoning = '') {
  let thinking = reasoning || '';
  let answer = content || '';
  let inProgress = false;

  const openMatch = OPEN.exec(answer);
  const closeMatch = CLOSE.exec(answer);

  if (openMatch && (!closeMatch || openMatch.index < closeMatch.index)) {
    const before = answer.slice(0, openMatch.index);
    const afterOpen = answer.slice(openMatch.index + openMatch[0].length);
    const close = CLOSE.exec(afterOpen);
    if (close) {
      thinking += afterOpen.slice(0, close.index);
      answer = before + afterOpen.slice(close.index + close[0].length);
    } else {
      // Still streaming the thought
      thinking += afterOpen;
      answer = before;
      inProgress = true;
    }
  } else if (closeMatch) {
    // Template opened <think> in the prompt: everything before </think> is thinking
    thinking += answer.slice(0, closeMatch.index);
    answer = answer.slice(closeMatch.index + closeMatch[0].length);
  }

  return { thinking: thinking.trim(), answer: answer.replace(/^\s+/, ''), inProgress };
}

/** Answer text only, for sending history back to the model and for "Copy". */
export function answerOnly(content = '') {
  return splitThinking(content).answer;
}
