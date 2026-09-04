import {
    retrieveContext,
    getRagHealth,
} from "../services/ragService.js";

export const ragTestController = (req, res) => (
    res.status(200).json(getRagHealth())
);

export const ragRetrieveController = async (req, res, next) => {
    try {
        const data = await retrieveContext({
            subjectCode: req.body.subject_code,
            query: req.body.query,
            modes: req.body.modes,
            filters: req.body.filters,
            kText: req.body.k_text,
            kClipText: req.body.k_clip_text,
            kImage: req.body.k_image,
            maxContextTokens: req.body.max_context_tokens,
            qrefHint: req.body.qref_hint,
            recencyBoost: req.body.recency_boost,
            recencyYears: req.body.recency_years,
            recentFirst: req.body.recent_first,
            heuristicRerankEnabled: req.body.heuristic_rerank,
            useCache: req.body.use_cache,
        });
        return res.status(200).json(data);
    } catch (error) {
        next(error);
    }
};
