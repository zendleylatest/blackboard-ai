import { insertAiUsageLog } from "../../models/AiUsageLog.js";

// USD per 1,000,000 tokens. Source: published OpenAI API pricing for each
// model at the time this was written. These are approximate by nature —
// OpenAI's own pricing can change, and this doesn't account for cached-input
// discounts — so cost figures derived from this table are always estimates,
// never a billing-accurate source of truth.
const PRICING_PER_MILLION_TOKENS_USD = {
    "gpt-4o-mini": { input: 0.15, output: 0.60 },
    "gpt-4o": { input: 2.50, output: 10.00 },
    "gpt-4.1": { input: 2.00, output: 8.00 },
    "gpt-4.1-mini": { input: 0.40, output: 1.60 },
    "gpt-4.1-nano": { input: 0.10, output: 0.40 },
    "gpt-4-turbo": { input: 10.00, output: 30.00 },
    "gpt-3.5-turbo": { input: 0.50, output: 1.50 },
};

// Fallback used for any model not in the table above, so usage is still
// logged (with a clearly-approximate cost) instead of silently skipped.
const DEFAULT_PRICING = { input: 0.50, output: 1.50 };

const resolvePricing = (model) => {
    if (!model) return DEFAULT_PRICING;
    const normalized = String(model).toLowerCase();
    if (PRICING_PER_MILLION_TOKENS_USD[normalized]) {
        return PRICING_PER_MILLION_TOKENS_USD[normalized];
    }
    // Match by prefix, e.g. "gpt-4o-mini-2024-07-18" -> "gpt-4o-mini".
    const matchedKey = Object.keys(PRICING_PER_MILLION_TOKENS_USD).find(
        (key) => normalized.startsWith(key)
    );
    return matchedKey
        ? PRICING_PER_MILLION_TOKENS_USD[matchedKey]
        : DEFAULT_PRICING;
};

export const estimateCostUsd = ({ model, promptTokens, completionTokens }) => {
    const pricing = resolvePricing(model);
    const inputCost = ((promptTokens || 0) / 1_000_000) * pricing.input;
    const outputCost = ((completionTokens || 0) / 1_000_000) * pricing.output;
    return inputCost + outputCost;
};

// Extracts { promptTokens, completionTokens, totalTokens } from either the
// Chat Completions API's `usage` shape or the Responses API's `usage` shape.
export const extractUsage = (response) => {
    const usage = response?.usage;
    if (!usage) return null;

    const promptTokens =
        usage.prompt_tokens ??
        usage.input_tokens ??
        0;

    const completionTokens =
        usage.completion_tokens ??
        usage.output_tokens ??
        0;

    const totalTokens =
        usage.total_tokens ??
        (promptTokens + completionTokens);

    return { promptTokens, completionTokens, totalTokens };
};

// Fire-and-forget: logs AI usage for cost/analytics tracking without ever
// throwing or delaying the caller — a logging failure must never break an
// AI feature that otherwise succeeded.
export const logAiUsage = ({ userId, feature, model, response }) => {
    if (!userId || !response) return;

    const usage = extractUsage(response);
    if (!usage) return;

    const estimatedCostUsd = estimateCostUsd({
        model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
    });

    insertAiUsageLog({
        userId,
        feature,
        model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        estimatedCostUsd,
    }).catch((error) => {
        console.error(
            `AI usage logging failed (feature=${feature}, user=${userId}):`,
            error?.message || error
        );
    });
};
