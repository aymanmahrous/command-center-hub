export type CanvaCopy = {
  headline: string;
  body: string;
  cta: string;
};

export type AutofillField = { type?: string };
export type AutofillDataset = Record<string, AutofillField>;

const DEFAULT_LIMITS = { headline: 72, body: 220, cta: 64 } as const;
const PRODUCTION_LINE = /^(?:\s*(?:\d{1,2}\s*[–-]\s*\d{1,2}\s*s|\d{1,2}\s*s\s*[–-]\s*\d{1,2}\s*s)\b|\s*(?:format|story brief|video brief|canva|capcut|scene|visual|shot|on-screen text|text overlay|voiceover|voice-over|تعليق صوتي|مشهد|لقطة|النص الظاهر)\s*[:：])/i;
const CONTACT_OR_METADATA = /(?:https?:\/\/\S+|www\.\S+|wa\.me\/\S+|\b(?:utm_[\w-]+|hashtags?|format|story brief|video brief|canva|capcut)\b|(?:\+?971|0)?\s*5\d[\s-]*\d{3}[\s-]*\d{4}|واتساب|رقم الهاتف|هاتف الإدارة|للحجز|للاستفسار)/i;
const INCOMPLETE_TIMED_FRAGMENT = /\b(?:child|learner|kid|طفل|طفلة)\s*[a-z]?\d+\s*[–-]\s*\d+\s*s\b/i;

function normalizeWhitespace(value: string): string {
  return value.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
}

function withoutMetadata(value: string): string[] {
  return normalizeWhitespace(value)
    .replace(/https?:\/\/\S+|www\.\S+/gi, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•]\s*)?/, "").trim())
    .filter((line) => line && !PRODUCTION_LINE.test(line) && !INCOMPLETE_TIMED_FRAGMENT.test(line) && !CONTACT_OR_METADATA.test(line));
}

function completeUnits(value: string): string[] {
  return withoutMetadata(value)
    .join(" ")
    .split(/(?<=[.!؟。])\s+|\s*[|•]\s*/)
    .map((unit) => normalizeWhitespace(unit).replace(/^["“”'«»]+|["“”'«»]+$/g, "").trim())
    .filter((unit) => unit.length >= 8 && !CONTACT_OR_METADATA.test(unit) && !INCOMPLETE_TIMED_FRAGMENT.test(unit));
}

function fitCompleteUnits(units: string[], limit: number, maxUnits: number): string {
  const selected: string[] = [];
  let length = 0;
  for (const unit of units) {
    const nextLength = length + unit.length + (selected.length ? 1 : 0);
    if (nextLength > limit) break;
    selected.push(unit);
    length = nextLength;
    if (selected.length >= maxUnits) break;
  }
  return selected.join(" ").trim();
}

function firstCompletePhrase(value: string, limit: number): string {
  const units = completeUnits(value);
  if (units[0] && units[0].length <= limit) return units[0];
  const words = normalizeWhitespace(withoutMetadata(value).join(" ")).split(" ");
  let result = "";
  for (const word of words) {
    const candidate = result ? `${result} ${word}` : word;
    if (candidate.length > limit) break;
    result = candidate;
  }
  return result.trim();
}

function extractQuestionAnswer(value: string): string[] {
  const lines = normalizeWhitespace(value).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const question: string[] = [];
  const answer: string[] = [];
  let target = answer;
  for (const line of lines) {
    if (PRODUCTION_LINE.test(line) || CONTACT_OR_METADATA.test(line) || INCOMPLETE_TIMED_FRAGMENT.test(line)) continue;
    const questionMatch = line.match(/^(?:q|question|سؤال|السؤال)\s*[:：-]\s*(.+)$/i);
    const answerMatch = line.match(/^(?:a|answer|إجابة|الجواب|الإجابة)\s*[:：-]\s*(.+)$/i);
    if (questionMatch) { target = question; target.push(questionMatch[1]); continue; }
    if (answerMatch) { target = answer; target.push(answerMatch[1]); continue; }
    target.push(line);
  }
  if (question.length && answer.length) return [`سؤال: ${firstCompletePhrase(question.join(" "), 100)}`, `إجابة: ${firstCompletePhrase(answer.join(" "), 110)}`];
  return [];
}

export function prepareCanvaCopy(input: { hook?: string; caption?: string; cta?: string }, limits = DEFAULT_LIMITS): CanvaCopy {
  const headline = firstCompletePhrase(input.hook ?? "", limits.headline) || firstCompletePhrase(input.caption ?? "", limits.headline);
  const qa = extractQuestionAnswer(input.caption ?? "");
  const bodyUnits = qa.length ? qa : completeUnits(input.caption ?? "");
  const qaText = qa.join("\n");
  const body = qa.length && qaText.length <= limits.body ? qaText : fitCompleteUnits(bodyUnits, limits.body, 2);
  const cta = firstCompletePhrase(input.cta ?? "", limits.cta);
  return { headline, body, cta };
}

export function buildStrictAutofillData(
  dataset: AutofillDataset,
  copy: CanvaCopy,
  imageAssetId?: string,
): { data: Record<string, unknown>; error?: "TEMPLATE_FIELDS_INVALID" } {
  const textFields = Object.entries(dataset).filter(([, field]) => field?.type === "text").map(([name]) => name);
  const imageFields = Object.entries(dataset).filter(([, field]) => field?.type === "image").map(([name]) => name);
  const required = ["hook", "caption", "cta"];
  if (!required.every((field) => textFields.includes(field)) || imageFields.length === 0) return { data: {}, error: "TEMPLATE_FIELDS_INVALID" };
  if (new Set(required).size !== required.length) return { data: {}, error: "TEMPLATE_FIELDS_INVALID" };
  const data: Record<string, unknown> = {
    hook: { type: "text", text: copy.headline },
    caption: { type: "text", text: copy.body },
    cta: { type: "text", text: copy.cta },
  };
  if (imageAssetId) data[imageFields[0]] = { type: "image", asset_id: imageAssetId };
  return { data };
}
