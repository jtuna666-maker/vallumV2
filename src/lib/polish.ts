/**
 * Editorial polish for memoir text.
 *
 * If an LLM key is configured (ANTHROPIC_API_KEY or OPENAI_API_KEY) we ask
 * the model for a restrained copyedit that strictly preserves the author's
 * voice. Otherwise we fall back to a deterministic transcript cleanup that
 * fixes the artifacts of spoken dictation without touching word choice.
 */

const COPYEDIT_PROMPT = `You are a warm, restrained copyeditor working on a personal memoir.
Lightly polish the following memoir excerpt:
- fix obvious grammar and punctuation issues
- remove speech fillers (um, uh, you know) and false starts
- smooth run-on sentences where they impede readability
Strictly preserve the author's voice, rhythm, word choice, humor, and every fact.
Do not add details, do not summarize, do not make it sound generic or literary
beyond what is already there. Keep paragraph breaks. Return only the polished text.`;

export async function polishText(text: string): Promise<string> {
  const anthropc = process.env.ANTHROPIC_API_KEY;
  const openai = process.env.OPENAI_API_KEY;

  if (anthropc) {
    const viaAnthropic = await polishViaAnthropic(text, anthropc);
    if (viaAnthropic) return viaAnthropic;
  }
  if (openai) {
    const viaOpenAI = await polishViaOpenAI(text, openai);
    if (viaOpenAI) return viaOpenAI;
  }
  return localPolish(text);
}

async function polishViaAnthropic(text: string, key: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.POLISH_MODEL ?? "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [{ role: "user", content: `${COPYEDIT_PROMPT}\n\n${text}` }],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const out = data.content?.find((b) => b.type === "text")?.text?.trim();
    return out || null;
  } catch {
    return null;
  }
}

async function polishViaOpenAI(text: string, key: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.POLISH_MODEL ?? "gpt-4o-mini",
        messages: [
          { role: "system", content: COPYEDIT_PROMPT },
          { role: "user", content: text },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

/** Deterministic spoken-word cleanup; conservative on purpose. */
export function localPolish(input: string): string {
  let t = input.replace(/\r\n/g, "\n");

  // speech fillers and verbal tics
  t = t.replace(/\b(um+|uh+|erm+|er+|ah+|hm+|mm+)\b,\s*/gi, "");
  t = t.replace(/\b(um+|uh+|erm+|er+|ah+|hm+|mm+)\b\s*/gi, "");
  t = t.replace(/,?\s+you know,?\s+/gi, " ");

  // whitespace & punctuation hygiene
  t = t
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n");
  t = t.replace(/ +([,.!?;:])/g, "$1");
  t = t.replace(/([,.!?])(?=[A-Za-z])/g, "$1 ");
  t = t.replace(/\bi\b/g, "I");
  t = t.replace(/\bi'm\b/gi, (m) => (m[0] === "i" ? "I'm" : m));

  // capitalize sentence and paragraph starts
  t = t.replace(/(^|[.!?…]["')\]]?\s+|\n+)(["'(\[]?[a-z])/g, (_m, a: string, b: string) => {
    return a + b.toUpperCase();
  });

  // collapse excessive blank lines
  t = t.replace(/\n{3,}/g, "\n\n");

  // ensure each paragraph ends with terminal punctuation
  t = t
    .split("\n\n")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (/[.!?…)"']$/.test(p) ? p : `${p}.`))
    .join("\n\n");

  return t;
}
