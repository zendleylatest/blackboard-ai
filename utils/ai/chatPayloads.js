const parseJson = (value) => {
    if (typeof value !== "string") return value;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
};

export const coerceChatAnswer = (raw) => {
    if (typeof raw === "string") return raw.trim();
    if (raw === null || raw === undefined) return "";

    if (Array.isArray(raw)) {
        return raw
            .map((item) => coerceChatAnswer(item))
            .filter(Boolean)
            .join("\n")
            .trim();
    }

    if (typeof raw === "object") {
        return Object.entries(raw)
            .map(([key, value]) => {
                const text = coerceChatAnswer(value);
                return text ? `${key}: ${text}`.trim() : "";
            })
            .filter(Boolean)
            .join("\n")
            .trim();
    }

    try {
        return String(raw).trim();
    } catch {
        return "";
    }
};

export const coerceChunkIds = (raw) => {
    const source = raw && typeof raw === "object" && !Array.isArray(raw)
        ? raw.chunk_ids
        : raw;
    if (!Array.isArray(source)) return [];

    const output = [];
    for (const item of source) {
        if (typeof item === "boolean") continue;

        if (typeof item === "number" && Number.isFinite(item)) {
            output.push(Math.trunc(item));
            continue;
        }

        if (typeof item === "string") {
            const value = Number(item.trim());
            if (Number.isFinite(value)) output.push(Math.trunc(value));
            continue;
        }

        if (item && typeof item === "object") {
            for (const key of ["chunk_id", "id", "source_id"]) {
                const value = item[key];
                if (typeof value === "boolean" || value === undefined) {
                    continue;
                }
                const numeric = Number(value);
                if (Number.isFinite(numeric)) {
                    output.push(Math.trunc(numeric));
                    break;
                }
            }
        }
    }

    return output;
};

export const coerceSources = (raw) => {
    const source = raw && typeof raw === "object" && !Array.isArray(raw)
        ? raw.sources
        : raw;
    if (!Array.isArray(source)) return [];

    return source.map((item) => {
        if (item && typeof item === "object") return item;
        if (typeof item === "string") {
            const parsed = parseJson(item);
            return parsed && typeof parsed === "object"
                ? parsed
                : { value: item };
        }
        return { value: String(item) };
    });
};
