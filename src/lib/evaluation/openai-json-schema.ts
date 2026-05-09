import type OpenAI from "openai";

type JsonSchema = Record<string, unknown>;

export async function chatJsonSchema<T>(
  openai: OpenAI,
  model: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  schemaName: string,
  schema: JsonSchema
): Promise<{ parsed: T; model: string; usage: OpenAI.Chat.Completions.ChatCompletion["usage"] }> {
  // `json_schema` strict mode — typings lag behind OpenAI API surface.
  const resp = (await openai.chat.completions.create({
    model,
    messages,
    temperature: 0,
    seed: 7,
    stream: false,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: schemaName,
        strict: true,
        schema,
      },
    },
  } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming)) as OpenAI.Chat.Completions.ChatCompletion;

  const text = resp.choices[0]?.message?.content;
  if (!text) throw new Error("Empty model response");
  return {
    parsed: JSON.parse(text) as T,
    model: resp.model,
    usage: resp.usage,
  };
}
