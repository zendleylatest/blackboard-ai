import { Pinecone } from "@pinecone-database/pinecone";
import {
    findRagChunksByIds,
    findLexicalRagChunks,
} from "../models/Rag.js";
import HttpError from "../utils/httpError.js";

const DEFAULT_DOCUMENT_TYPES = [
    "syllabus",
    "past_paper",
];
const DEFAULT_EMBEDDING_MODEL =
    "onnx-community/all-MiniLM-L6-v2-ONNX";

let embeddingPipelinePromise = null;
let pineconeClient = null;
const retrievalCache = new Map();
const RETRIEVAL_CACHE_TTL_MS = 5 * 60 * 1000;
const RETRIEVAL_CACHE_MAX_ITEMS = 100;

const readCachedRetrieval = (key) => {
    const cached = retrievalCache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.createdAt > RETRIEVAL_CACHE_TTL_MS) {
        retrievalCache.delete(key);
        return null;
    }
    return structuredClone(cached.value);
};

const cacheRetrieval = (key, value) => {
    if (retrievalCache.size >= RETRIEVAL_CACHE_MAX_ITEMS) {
        const oldestKey = retrievalCache.keys().next().value;
        retrievalCache.delete(oldestKey);
    }
    retrievalCache.set(key, {
        createdAt: Date.now(),
        value: structuredClone(value),
    });
};

const parseBoolean = (value, fallback) => {
    if (value === undefined || value === null) return fallback;
    if (typeof value === "boolean") return value;
    return String(value).toLowerCase() === "true";
};

const parseJson = (value, fallback = {}) => {
    if (value && typeof value === "object") return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
};

const normalizeTerms = (query) => (
    String(query || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((term) => term.length > 2)
        .slice(0, 10)
);

const normalizeDocumentTypes = (filters) => {
    const requested = Array.isArray(filters?.doctype)
        ? filters.doctype
        : DEFAULT_DOCUMENT_TYPES;
    const allowed = requested.filter((type) => (
        DEFAULT_DOCUMENT_TYPES.includes(type)
    ));
    return allowed.length > 0 ? allowed : DEFAULT_DOCUMENT_TYPES;
};

const makeSource = (row) => ({
    chunk_id: Number(row.chunk_id),
    kind: row.kind,
    text: row.text,
    page: row.page_start,
    qref: row.qref,
    pair_key: row.pair_key,
    doc: {
        id: Number(row.doc_id),
        subject_code: row.subject_code,
        year: row.year === null ? null : Number(row.year),
        series: row.series,
        document_type: row.document_type,
        paper: row.paper,
        variant: row.variant,
        name: row.doc_title,
    },
    distance: row.distance === undefined || row.distance === null
        ? null
        : Number(row.distance),
});

const getEmbeddingPipeline = async () => {
    if (!embeddingPipelinePromise) {
        // Transformers loads the platform-specific ONNX binary. Keep that
        // optional dependency behind the vector-retrieval fallback boundary
        // so an unavailable native binary cannot prevent the API from
        // starting or block lexical RAG retrieval.
        embeddingPipelinePromise = import("@huggingface/transformers")
            .then(({ pipeline }) => pipeline(
                "feature-extraction",
                process.env.RAG_EMBEDDING_MODEL ||
                    DEFAULT_EMBEDDING_MODEL
            ))
            .catch((error) => {
                embeddingPipelinePromise = null;
                throw error;
            });
    }
    return embeddingPipelinePromise;
};

const embedQuery = async (query) => {
    const extractor = await getEmbeddingPipeline();
    const output = await extractor(query, {
        pooling: "mean",
        normalize: true,
    });
    return Array.from(output.data || output.tolist?.()[0] || []);
};

const getPineconeClient = () => {
    if (!pineconeClient) {
        if (!process.env.PINECONE_API_KEY) {
            throw new Error("PINECONE_API_KEY is not configured.");
        }
        pineconeClient = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY,
        });
    }
    return pineconeClient;
};

const getPineconeIndex = async () => {
    const client = getPineconeClient();
    const indexName = process.env.PINECONE_TEXT_INDEX || "blackboard-text";
    const host = process.env.PINECONE_HOST;
    return host
        ? client.index({ host })
        : client.index({ name: indexName });
};

const buildPineconeFilter = (
    subjectCode,
    documentTypes,
    qrefHint
) => {
    const filter = {
        doctype: { $in: documentTypes },
    };
    if (subjectCode) filter.subject = subjectCode;
    if (qrefHint) filter.question = qrefHint;
    return filter;
};

const getVectorNeighbors = async ({
    subjectCode,
    query,
    documentTypes,
    qrefHint,
    kText,
}) => {
    const index = await getPineconeIndex();
    const vector = await embedQuery(query);
    const namespace = process.env.PINECONE_NAMESPACE;
    const target = namespace ? index.namespace(namespace) : index;
    const filter = buildPineconeFilter(
        subjectCode,
        documentTypes,
        qrefHint
    );

    let response = await target.query({
        vector,
        topK: kText,
        filter,
        includeMetadata: false,
    });
    let matches = response.matches || [];

    if (matches.length === 0) {
        response = await target.query({
            vector,
            topK: Math.max(kText, 30),
            filter: {
                doctype: {
                    $in: ["past_paper", "syllabus"],
                },
            },
            includeMetadata: false,
        });
        matches = response.matches || [];
    }

    return matches.map((match) => ({
        id: String(match.id || ""),
        distance: Math.max(0, 1 - Number(match.score || 0)),
    }));
};

const hydrateVectorResults = async (neighbors) => {
    const ids = neighbors
        .map((neighbor) => neighbor.id)
        .filter((id) => id.startsWith("text-"))
        .map((id) => Number(id.replace("text-", "")))
        .filter((id) => Number.isInteger(id));
    const rows = await findRagChunksByIds(ids);
    const byId = new Map(rows.map((row) => [Number(row.chunk_id), row]));

    return neighbors
        .map((neighbor) => {
            const id = Number(String(neighbor.id).replace("text-", ""));
            const row = byId.get(id);
            return row
                ? makeSource({ ...row, distance: neighbor.distance })
                : null;
        })
        .filter(Boolean);
};

const lexicalScore = (row, terms, subjectCode) => {
    const text = String(row.text || "").toLowerCase();
    const matched = terms.filter((term) => text.includes(term)).length;
    const overlap = terms.length > 0 ? matched / terms.length : 0;
    const subjectBonus = subjectCode &&
        String(row.subject_code).toLowerCase() === String(subjectCode).toLowerCase()
        ? 0.2
        : 0;
    const typeBonus = row.document_type === "past_paper"
        ? 0.1
        : row.document_type === "examiner_report"
            ? 0.075
            : 0;
    return overlap + subjectBonus + typeBonus;
};

const retrieveLexically = async ({
    subjectCode,
    documentTypes,
    query,
    kText,
    qrefHint,
}) => {
    const terms = normalizeTerms(query);
    let rows = await findLexicalRagChunks({
        subjectCode,
        documentTypes,
        terms,
        qrefHint,
        limit: Math.max(100, kText * 20),
    });

    if (rows.length === 0 && terms.length > 0) {
        rows = await findLexicalRagChunks({
            subjectCode,
            documentTypes,
            terms: [],
            qrefHint,
            limit: Math.max(100, kText * 20),
        });
    }

    const currentYear = new Date().getFullYear();
    return rows
        .map((row) => {
            const baseScore = lexicalScore(row, terms, subjectCode);
            const year = Number(row.year);
            const yearsAgo = Number.isFinite(year) ? currentYear - year : 99;
            const recencyFactor = yearsAgo <= 3
                ? 0.2
                : yearsAgo <= 5
                    ? 0.4
                    : yearsAgo <= 8
                        ? 0.6
                        : 0.85;
            return {
                ...makeSource({
                    ...row,
                    distance: Math.max(0, 1 - baseScore),
                }),
                _sort_distance: Math.max(0, 1 - baseScore) * recencyFactor,
            };
        })
        .sort((left, right) => (
            left._sort_distance - right._sort_distance
        ))
        .slice(0, Math.max(kText, 1))
        .map(({ _sort_distance, ...item }) => item);
};

const heuristicRerank = (items, query, subjectCode) => {
    const queryTerms = new Set(normalizeTerms(query));
    return [...items]
        .map((item) => {
            const textTerms = new Set(normalizeTerms(item.text));
            const overlap = [...queryTerms]
                .filter((term) => textTerms.has(term)).length;
            let score = overlap * 0.3;
            if (
                subjectCode &&
                String(item.doc?.subject_code).toLowerCase() ===
                    String(subjectCode).toLowerCase()
            ) {
                score += 0.4;
            }
            if (item.doc?.document_type === "past_paper") score += 0.2;
            if (item.doc?.document_type === "examiner_report") score += 0.15;
            return { item, score };
        })
        .sort((left, right) => (
            right.score - left.score ||
            Number(left.item.distance || 0) - Number(right.item.distance || 0)
        ))
        .map(({ item }) => item);
};

const applyTokenLimit = (items, maxContextTokens) => {
    let tokenCount = 0;
    const output = [];
    for (const item of items) {
        const estimate = String(item.text || "").split(/\s+/).length * 1.3;
        if (tokenCount + estimate > maxContextTokens) break;
        output.push(item);
        tokenCount += estimate;
    }
    return { output, tokenCount };
};

export const retrieveContext = async ({
    subjectCode = "",
    query,
    modes = ["text"],
    filters = {},
    kText = 12,
    kClipText = 8,
    kImage = 4,
    maxContextTokens = 2400,
    qrefHint = null,
    recencyBoost = true,
    recencyYears = Number(process.env.RAG_RECENCY_YEARS || 5),
    recentFirst = parseBoolean(process.env.RAG_RECENT_FIRST, true),
    heuristicRerankEnabled = true,
    useCache = true,
}) => {
    const normalizedQuery = String(query || "").trim();
    if (!normalizedQuery) {
        throw new HttpError(400, "Query is required.");
    }

    const safeKText = Math.min(50, Math.max(1, Number(kText) || 12));
    const documentTypes = normalizeDocumentTypes(parseJson(filters, {}));
    const cacheKey = JSON.stringify({
        subjectCode,
        query: normalizedQuery,
        modes,
        documentTypes,
        kText: safeKText,
        maxContextTokens,
        qrefHint,
        recencyBoost,
        recencyYears,
        recentFirst,
        heuristicRerankEnabled,
    });
    const cached = useCache ? readCachedRetrieval(cacheKey) : null;
    if (cached) {
        cached.debug.cache_hit = true;
        return cached;
    }

    let results = [];
    let retrievalMode = "lexical";
    const debug = {
        query: normalizedQuery,
        modes,
        filters,
        retrievals: {},
    };

    if (modes.includes("text") && process.env.PINECONE_API_KEY) {
        try {
            const neighbors = await getVectorNeighbors({
                subjectCode,
                query: normalizedQuery,
                documentTypes: documentTypes.length > 0
                    ? documentTypes
                    : ["past_paper", "syllabus"],
                qrefHint,
                kText: safeKText,
            });
            results = await hydrateVectorResults(neighbors);
            retrievalMode = "pinecone";
            debug.retrievals.text = {
                neighbors_found: neighbors.length,
                filters: buildPineconeFilter(
                    subjectCode,
                    documentTypes.length > 0
                        ? documentTypes
                        : ["past_paper", "syllabus"],
                    qrefHint
                ),
            };
        } catch (error) {
            debug.retrievals.text = {
                error: error.message,
                fallback: "lexical",
            };
        }
    }

    if (results.length === 0 && modes.includes("text")) {
        results = await retrieveLexically({
            subjectCode,
            documentTypes,
            query: normalizedQuery,
            kText: safeKText,
            qrefHint,
        });
        debug.retrievals.text = {
            ...(debug.retrievals.text || {}),
            mode: "lexical",
            neighbors_found: results.length,
        };
    }

    if (recencyBoost && results.length > 0) {
        const currentYear = new Date().getFullYear();
        results = results.map((item) => {
            const year = Number(item.doc?.year);
            const yearsAgo = Number.isFinite(year)
                ? currentYear - year
                : 99;
            const recencyFactor = yearsAgo <= 3
                ? 0.2
                : yearsAgo <= Math.max(5, recencyYears)
                    ? 0.4
                    : yearsAgo <= 8
                        ? 0.6
                        : 0.85;
            return {
                ...item,
                boosted_distance: Number(item.distance || 0) * recencyFactor,
                recency_factor: recencyFactor,
            };
        }).sort((left, right) => (
            left.boosted_distance - right.boosted_distance
        ));
        if (heuristicRerankEnabled) {
            results = heuristicRerank(
                results,
                normalizedQuery,
                subjectCode
            );
        }
    }

    if (recentFirst) {
        const cutoff = new Date().getFullYear() - recencyYears;
        const recent = results.filter((item) => Number(item.doc?.year) >= cutoff);
        const older = results.filter((item) => !recent.includes(item));
        results = [...recent, ...older];
    }

    const { output, tokenCount } = applyTokenLimit(
        results,
        Math.max(100, Number(maxContextTokens) || 2400)
    );
    debug.total_found = results.length;
    debug.returned = output.length;
    debug.estimated_tokens = tokenCount;
    debug.retrieval_mode = retrievalMode;

    const response = {
        fused: output,
        debug,
    };
    if (useCache) cacheRetrieval(cacheKey, response);
    return response;
};

export const getRagHealth = () => ({
    status: "ok",
    message: "RAG service is running",
    vector_backend: process.env.VECTOR_DB_TYPE || "pinecone",
    pinecone_configured: Boolean(process.env.PINECONE_API_KEY),
    embedding_model:
        process.env.RAG_EMBEDDING_MODEL ||
        DEFAULT_EMBEDDING_MODEL,
    vertex_text_endpoint: process.env.VERTEX_TEXT_ENDPOINT || "NOT SET",
});
