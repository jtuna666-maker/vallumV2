/**
 * Interview-question generation.
 *
 * With ANTHROPIC_API_KEY or OPENAI_API_KEY set, a model writes one fresh,
 * warm follow-up question tailored to the chapter. Without keys, we draw
 * from a curated per-era pool, skipping anything already asked.
 */

const PROMPT = (era: string, title: string, subtitle: string, asked: string[]) =>
  `You are VELLUM's memoir interviewer — warm, precise, a little literary.
Write ONE new interview question for the chapter "${title}" (era: "${era}", theme: ${subtitle}).
Rules: second person, one sentence or two short ones, sensory and specific, no yes/no questions,
never mention politics, and never repeat or paraphrase a question already asked.
Already asked:
${asked.map((q) => `- ${q}`).join("\n")}
Return ONLY the question text, no quotation marks, no preamble.`;

async function callLLM(prompt: string): Promise<string | null> {
  const anthropic = process.env.ANTHROPIC_API_KEY;
  const openai = process.env.OPENAI_API_KEY;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);

  try {
    if (anthropic) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "x-api-key": anthropic,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.POLISH_MODEL ?? "claude-haiku-4-5-20251001",
          max_tokens: 120,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          content?: Array<{ type: string; text?: string }>;
        };
        const out = data.content?.find((b) => b.type === "text")?.text?.trim();
        if (out) return out.split("\n")[0].replace(/^["'\u201c\s]+|["'\u201d\s]+$/g, "");
      }
    }
    if (openai) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          authorization: `Bearer ${openai}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.POLISH_MODEL ?? "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 120,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const out = data.choices?.[0]?.message?.content?.trim();
        if (out) return out.split("\n")[0].replace(/^["'\u201c\s]+|["'\u201d\s]+$/g, "");
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const POOL: Record<string, string[]> = {
  Roots: [
    "What did your childhood bedroom look like — and what did you hide in it?",
    "Who was the most unusual person in your neighborhood, and why do you remember them?",
    "What did school feel like for you — the building, the pecking order, one teacher who mattered?",
    "What counted as 'rich' or 'poor' where you grew up, and where did your family land?",
    "Describe a childhood scare or injury and how the adults around you handled it.",
    "What games did you play outside until somebody called you in?",
    "What did you want to be at ten years old — and where did that idea come from?",
    "Describe a holiday at its chaotic best in your family.",
    "What possession from childhood do you still own, and where does it live now?",
    "What meal did your family repeat so often it became a legend?",
  ],
  Becoming: [
    "Describe your first apartment or room of your own — the rent, the furniture, the view.",
    "What is the most reckless thing you did between sixteen and twenty-five?",
    "Who was your mentor — official or accidental — and what did they hand down to you?",
    "Describe a trip or a move that felt like the true beginning of your adult life.",
    "When did you first feel like an adult? One specific moment, not a phase.",
    "What music was playing during your best year?",
    "Who did you almost marry, or almost become?",
    "What did you learn about money the hard way?",
    "Which friend's house felt more like home than your own, and why?",
    "What did you believe about ambition then that you no longer believe?",
  ],
  "Turning Points": [
    "What phone call divided your life into before and after?",
    "Describe a door you closed on purpose — and what you heard on the other side.",
    "What failure turned out to be a gift in disguise?",
    "When did you surprise yourself by being brave?",
    "What did you have to forgive — and did you?",
    "Describe the moment you knew a chapter of your life was over.",
    "What risk did everyone advise against that you took anyway?",
    "Who came back into your life at exactly the right time?",
    "What did you lose that you still miss in a specific, physical way?",
    "When did you change your mind about something fundamental?",
  ],
  Legacy: [
    "What do you do with your mornings now, and why does it matter?",
    "What would you tell the sixteen-year-old you — in one honest paragraph?",
    "What ordinary thing do you hope outlives you?",
    "Describe the room where you feel most at peace today.",
    "What did you get right as a parent, friend, or partner that nobody applauded?",
    "What grudge did you finally set down, and what did it weigh?",
    "What tradition do you hope continues without you?",
    "What still surprises you about being alive?",
    "If this book had one final line, what should it be?",
    "What do you want clarified, while you're here to clarify it?",
  ],
};

const GENERIC: string[] = [
  "What photograph would you want printed beside this chapter, and what is happening just outside its frame?",
  "Who else was there that day — and what would they say you've forgotten?",
  "What did that season smell like?",
  "What would the weather report have said about that day?",
  "What did you almost say, and to whom?",
  "What small object witnessed all of this?",
  "What did you learn from it that no advice could have taught you?",
  "If you could stand in that scene once more for sixty seconds, where would you look first?",
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function pickFromPool(era: string, asked: string[]): string {
  const askedNorm = new Set(asked.map(normalize));
  const eraPool = (POOL[era] ?? []).filter((q) => !askedNorm.has(normalize(q)));
  if (eraPool.length > 0) {
    return eraPool[Math.floor(Math.random() * eraPool.length)];
  }
  const any = GENERIC.filter((q) => !askedNorm.has(normalize(q)));
  return (
    any[Math.floor(Math.random() * any.length)] ??
    GENERIC[GENERIC.length - 1]
  );
}

export async function generateFollowup(
  era: string,
  chapterTitle: string,
  subtitle: string,
  alreadyAsked: string[]
): Promise<string> {
  const viaLLM = await callLLM(PROMPT(era, chapterTitle, subtitle, alreadyAsked));
  if (
    viaLLM &&
    viaLLM.length > 12 &&
    viaLLM.length < 400 &&
    !alreadyAsked.some((q) => normalize(q) === normalize(viaLLM))
  ) {
    return viaLLM;
  }
  return pickFromPool(era, alreadyAsked);
}
