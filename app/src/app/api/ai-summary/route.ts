import { NextResponse } from "next/server";
import OpenAI from "openai";

const ai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.NEXT_PUBLIC_OPENROUTER_KEY!,
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "CareChain Medical Summary",
  },
});

// ----------------------------
// SYSTEM PROMPT — controls final format
// ----------------------------
const SYSTEM_PROMPT = `
You are a medical summarization engine. Always output a structured clinical abstract with the following sections:

Overview:
- Brief clinical interpretation (no speculation, no emotion)
- Mention presence or absence of allergies, chronic disease, patterns

Provider:
- Provider name if present, otherwise "Not documented"

Clinical Findings:
- Symptoms, findings, visit patterns, chronological relevance
- Only use available facts

Medications Administered:
- Chronological list with dose, ingredients, combination labels

Assessment:
- Clinical interpretation based strictly on provided data

Notes:
- Missing information, data quality, follow-up suggestions
`;

export async function POST(req: Request) {
  console.log("SUMMARY API ROUTE EXECUTED");

  try {
    const raw = await req.text();
    console.log("RAW BODY:", raw);

    const body = JSON.parse(raw);

    if (!body.records) {
      return NextResponse.json({ error: "Missing records" }, { status: 400 });
    }

    // ----------------------------
    // 1. FIRST CALL — summary + reasoning
    // ----------------------------
    const firstCall = await ai.chat.completions.create({
      model: "x-ai/grok-4.1-fast",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `Summarize this medical record:\n\n${JSON.stringify(
            body.records,
            null,
            2
          )}`,
        },
      ],
      reasoning: { enabled: true },
    });

    type ORChatMessage = (typeof firstCall)["choices"][number]["message"] & {
      reasoning_details?: unknown;
    };

    const firstMessage = firstCall.choices[0].message as ORChatMessage;

    const assistantAnswer = firstMessage.content;
    const reasoningDetails = firstMessage.reasoning_details ?? null;

    // ----------------------------
    // Messages for second call — with preserved reasoning
    // ----------------------------
    const messages = [
      {
        role: "system" as const,
        content: SYSTEM_PROMPT,
      },
      {
        role: "user" as const,
        content: `Summarize this medical record:\n\n${JSON.stringify(
          body.records,
          null,
          2
        )}`,
      },
      {
        role: "assistant" as const,
        content: assistantAnswer,
        reasoning_details: reasoningDetails,
      },
      {
        role: "user" as const,
        content:
          "Refine the summary using the same structured clinical format.",
      },
    ];

    // ----------------------------
    // 2. SECOND CALL — refinement
    // ----------------------------
    const finalCall = await ai.chat.completions.create({
      model: "x-ai/grok-4.1-fast",
      messages,
    });

    const refinedSummary =
      finalCall.choices?.[0]?.message?.content ?? "No response";

    return NextResponse.json({
      summary: refinedSummary,
      raw_first_summary: assistantAnswer,
      reasoning_details: reasoningDetails,
    });
  } catch (err: any) {
    console.error("AI SUMMARY ERROR:", err);
    return NextResponse.json(
      { error: err.message ?? "AI Summary failed" },
      { status: 500 }
    );
  }
}
