import { executeQuery } from "../utils/databaseHelper.js";

const USAGE_LIMITS = {
    free: 3,
    plus: 15,
    pro: 999999,
};

const FEATURE_LIMITS = {
    flashcard_sets: {
        column: "flashcard_sets_created",
        label: "flashcard sets",
        limits: USAGE_LIMITS,
    },
    quizzes: {
        column: "quizzes_created",
        label: "quizzes",
        limits: USAGE_LIMITS,
    },
    chat_messages: {
        column: "chat_messages_sent",
        label: "chat messages",
        limits: { free: 15, plus: 100, pro: 999999 },
    },
    ai_checker: {
        column: "ai_checker_uses",
        label: "AI checker uses",
        limits: { free: 5, plus: 30, pro: 999999 },
    },
    past_paper_questions: {
        column: "past_paper_questions_used",
        label: "past paper questions",
        limits: { free: 5, plus: 30, pro: 999999 },
    },
    study_sessions: {
        column: "study_sessions_created",
        label: "study sessions",
        limits: { free: 2, plus: 10, pro: 999999 },
    },
    mcq_wrong_reviews: {
        column: "mcq_wrong_reviews_used",
        label: "wrong-answer reviews",
        limits: { free: 2, plus: 10, pro: 999999 },
    },
};

const PER_QUESTION_LIMITS = {
    answer_revisions: { free: 2, plus: 3, pro: 999999 },
    followup_messages: { free: 3, plus: 5, pro: 999999 },
};

export const WEEKLY_USAGE_COLUMNS = Object.freeze(
    Object.values(FEATURE_LIMITS).map((feature) => feature.column)
);

const formatDate = (date) => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
].join("-");
const normalizeDate = (value) => {
    if (!value) return "";
    if (value instanceof Date) return formatDate(value);
    return String(value).slice(0, 10);
};

export const nextFriday = (from = new Date()) => {
    const date = new Date(from);
    const day = date.getDay();
    let days = (5 - day + 7) % 7;
    // Friday starts a new seven-day allowance; the next reset is the
    // following Friday, never later the same day.
    if (days === 0) days = 7;
    date.setDate(date.getDate() + days);
    return formatDate(date);
};

export const limitsForTier = (tier) => ({
    flashcard_sets: FEATURE_LIMITS.flashcard_sets.limits[tier],
    quizzes: FEATURE_LIMITS.quizzes.limits[tier],
    ai_checker: FEATURE_LIMITS.ai_checker.limits[tier],
    past_paper_questions: FEATURE_LIMITS.past_paper_questions.limits[tier],
    study_sessions: FEATURE_LIMITS.study_sessions.limits[tier],
    chat_messages: FEATURE_LIMITS.chat_messages.limits[tier],
    mcq_wrong_reviews: FEATURE_LIMITS.mcq_wrong_reviews.limits[tier],
    answer_revisions_per_question: PER_QUESTION_LIMITS.answer_revisions[tier],
    followup_messages_per_question: PER_QUESTION_LIMITS.followup_messages[tier],
});

export const shouldResetUsage = (currentWeekEnd, from = new Date()) => (
    !currentWeekEnd || normalizeDate(currentWeekEnd) <= formatDate(from)
);

const getTier = async (userId) => {
    const rows = await executeQuery(
        `
        SELECT tier, is_active, expires_at
        FROM api_usersubscription
        WHERE user_id = ?
        LIMIT 1
        `,
        [userId]
    );
    const subscription = rows[0];
    if (
        !subscription ||
        !subscription.is_active ||
        String(subscription.tier || "free").toLowerCase() === "free"
    ) {
        return "free";
    }
    if (subscription.expires_at && new Date(subscription.expires_at) < new Date()) {
        return "free";
    }
    return ["plus", "pro"].includes(String(subscription.tier).toLowerCase())
        ? String(subscription.tier).toLowerCase()
        : "free";
};

const isIosUser = async (userId) => {
    const rows = await executeQuery(
        `
        SELECT 1
        FROM api_devicetoken
        WHERE user_id = ?
          AND platform = 'ios'
          AND is_active = 1
        LIMIT 1
        `,
        [userId]
    );
    return rows.length > 0;
};

const getOrCreateUsage = async (userId) => {
    let rows = await executeQuery(
        `
        SELECT *
        FROM api_userusagelimit
        WHERE user_id = ?
        LIMIT 1
        `,
        [userId]
    );
    if (rows.length === 0) {
        await executeQuery(
            `
            INSERT INTO api_userusagelimit
                (user_id, flashcard_sets_created, quizzes_created, ai_checker_uses,
                 past_paper_questions_used, study_sessions_created, chat_messages_sent,
                 mcq_wrong_reviews_used, current_week_end, created_at, updated_at)
            VALUES (?, 0, 0, 0, 0, 0, 0, 0, ?, NOW(), NOW())
            `,
            [userId, nextFriday()]
        );
        rows = await executeQuery(
            `
            SELECT *
            FROM api_userusagelimit
            WHERE user_id = ?
            LIMIT 1
            `,
            [userId]
        );
    }

    const usage = rows[0];
    if (shouldResetUsage(usage.current_week_end)) {
        const newWeekEnd = nextFriday();
        await executeQuery(
            `
            UPDATE api_userusagelimit
            SET ${WEEKLY_USAGE_COLUMNS.map((column) => `${column} = 0`).join(",\n                ")},
                current_week_end = ?,
                updated_at = NOW()
            WHERE user_id = ?
            `,
            [newWeekEnd, userId]
        );
        for (const column of WEEKLY_USAGE_COLUMNS) {
            usage[column] = 0;
        }
        usage.current_week_end = newWeekEnd;
    }
    return usage;
};

export const checkUsageLimit = async (userId, featureName) => {
    const feature = FEATURE_LIMITS[featureName];
    if (!feature) {
        return { allowed: true, message: null };
    }
    const tier = await getTier(userId);
    if (tier === "pro") return { allowed: true, message: null, tier };
    const ios = await isIosUser(userId);
    const limitTier = tier === "free" && ios ? "plus" : tier;
    const limit = feature.limits[limitTier] || feature.limits.free;
    const usage = await getOrCreateUsage(userId);
    const current = Number(usage[feature.column] || 0);
    if (current >= limit) {
        const normalizedResetDate = normalizeDate(usage.current_week_end);
        const resetDate = new Date(`${normalizedResetDate}T00:00:00`);
        const resetLabel = Number.isNaN(resetDate.getTime())
            ? "the next billing week"
            : resetDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "2-digit",
            });
        const upgrade = ios
            ? ""
            : tier === "free"
                ? " Upgrade to Plus or Pro for higher limits."
                : " Upgrade to Pro for unlimited access.";
        return {
            allowed: false,
            tier,
            message: `You've reached your weekly limit of ${limit} ${feature.label}. Your limit resets on ${resetLabel}.${upgrade}`,
        };
    }
    return { allowed: true, tier };
};

export const incrementUsage = async (userId, featureName, count = 1) => {
    const feature = FEATURE_LIMITS[featureName];
    if (!feature) return;
    await getOrCreateUsage(userId);
    await executeQuery(
        `
        UPDATE api_userusagelimit
        SET ${feature.column} = ${feature.column} + ?,
            updated_at = NOW()
        WHERE user_id = ?
        `,
        [Math.max(1, Number(count) || 1), userId]
    );
};

export const checkSessionQuestionLimit = async (
    userId,
    questionId,
    featureName
) => {
    const limits = PER_QUESTION_LIMITS[featureName];
    if (!limits) return { allowed: true };
    const tier = await getTier(userId);
    const ios = await isIosUser(userId);
    const limitTier = tier === "free" && ios ? "plus" : tier;
    const limit = limits[limitTier] || limits.free;
    if (tier === "pro") return { allowed: true, tier };
    const rows = await executeQuery(
        `
        SELECT answer_revisions, followup_messages
        FROM api_sessionquestionusage
        WHERE session_question_id = ?
        LIMIT 1
        `,
        [String(questionId || "").replace(/-/g, "").toLowerCase()]
    );
    const current = Number(rows[0]?.[
        featureName === "answer_revisions"
            ? "answer_revisions"
            : "followup_messages"
    ] || 0);
    if (current >= limit) {
        return {
            allowed: false,
            message: `You've reached the limit of ${limit} ${featureName.replace("_", " ")} for this question.`,
            tier,
        };
    }
    return { allowed: true, tier };
};

export const incrementSessionQuestionUsage = async (
    questionId,
    featureName
) => {
    const column = featureName === "answer_revisions"
        ? "answer_revisions"
        : featureName === "followup_messages"
            ? "followup_messages"
            : null;
    if (!column) return;
    const normalizedId = String(questionId || "").replace(/-/g, "").toLowerCase();
    await executeQuery(
        `
        INSERT INTO api_sessionquestionusage
            (answer_revisions, followup_messages, created_at, updated_at, session_question_id)
        VALUES (?, ?, NOW(), NOW(), ?)
        ON DUPLICATE KEY UPDATE
            ${column} = ${column} + 1,
            updated_at = NOW()
        `,
        [
            column === "answer_revisions" ? 1 : 0,
            column === "followup_messages" ? 1 : 0,
            normalizedId,
        ]
    );
};

export const getUsageLimitSnapshot = async (userId) => {
    const tier = await getTier(userId);
    const ios = await isIosUser(userId);
    const usage = await getOrCreateUsage(userId);
    const limitTier = tier === "free" && ios ? "plus" : tier;
    const serverNow = new Date();
    const weekEndDate = normalizeDate(usage.current_week_end);
    const resetAt = new Date(`${weekEndDate}T00:00:00`);
    return {
        flashcard_sets_created: Number(usage.flashcard_sets_created || 0),
        quizzes_created: Number(usage.quizzes_created || 0),
        ai_checker_uses: Number(usage.ai_checker_uses || 0),
        past_paper_questions_used: Number(usage.past_paper_questions_used || 0),
        study_sessions_created: Number(usage.study_sessions_created || 0),
        chat_messages_sent: Number(usage.chat_messages_sent || 0),
        mcq_wrong_reviews_used: Number(usage.mcq_wrong_reviews_used || 0),
        week_end_date: weekEndDate,
        reset_at: Number.isNaN(resetAt.getTime()) ? null : resetAt.toISOString(),
        server_time: serverNow.toISOString(),
        reset_period: "weekly",
        tier,
        effective_tier: limitTier,
        limits: limitsForTier(limitTier),
        plan_limits: {
            free: limitsForTier("free"),
            plus: limitsForTier("plus"),
            pro: limitsForTier("pro"),
        },
    };
};

export const getSessionQuestionUsage = async (questionId) => {
    const rows = await executeQuery(
        `
        SELECT answer_revisions, followup_messages, created_at, updated_at
        FROM api_sessionquestionusage
        WHERE session_question_id = ?
        LIMIT 1
        `,
        [String(questionId || "").replace(/-/g, "").toLowerCase()]
    );
    return {
        answer_revisions: Number(rows[0]?.answer_revisions || 0),
        followup_messages: Number(rows[0]?.followup_messages || 0),
        created_at: rows[0]?.created_at ? new Date(rows[0].created_at).toISOString() : null,
        updated_at: rows[0]?.updated_at ? new Date(rows[0].updated_at).toISOString() : null,
    };
};
