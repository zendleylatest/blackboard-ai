import HttpError from "../utils/httpError.js";
import {
    countTopUsers,
    findActiveUserDays,
    findAnalyticsSubjects,
    findConversionFunnel,
    findFeatureCounts,
    findVerifiedSignups,
    hasUserActivity,
    findTopUsers,
} from "../models/Analytics.js";

const FEATURE_KEYS = [
    "ai_quizzes_generated",
    "ai_flashcards_generated",
    "chat_assistant_messages",
    "ai_checker_evaluations",
    "ai_checker_general",
    "ai_checker_past_paper",
    "mcq_wrong_review",
    "study_sessions_created",
    "flashcard_study_sessions",
    "quiz_attempts",
    "flashcard_reviews",
];

const formatDate = (date) => date.toISOString().slice(0, 10);

const parseDate = (value, fallback) => {
    if (!value) return fallback;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new HttpError(400, "Invalid date format. Use YYYY-MM-DD.");
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || formatDate(date) !== value) {
        throw new HttpError(400, "Invalid date format. Use YYYY-MM-DD.");
    }
    return date;
};

const getRange = ({ startDate, endDate }) => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const defaultStart = new Date(today);
    defaultStart.setUTCDate(defaultStart.getUTCDate() - 30);
    const start = parseDate(startDate, defaultStart);
    const end = parseDate(endDate, today);
    if (start > end) {
        throw new HttpError(400, "start_date must be before end_date.");
    }
    const exclusiveEnd = new Date(end);
    exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
    const days = [];
    const cursor = new Date(start);
    while (cursor <= end) {
        days.push(formatDate(cursor));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return {
        start,
        end,
        exclusiveEnd,
        days,
    };
};

const normalizeCountRows = (rows) => rows.map((row) => ({
    day: row.day instanceof Date
        ? formatDate(row.day)
        : String(row.day).slice(0, 10),
    subject_id: row.subject_id === null ? null : Number(row.subject_id),
    count: Number(row.count || 0),
}));

const getRetention = async (startDate, endDate) => {
    const signups = await findVerifiedSignups(startDate, endDate);
    if (signups.length === 0) {
        return { d1: null, d7: null, d30: null };
    }
    const counts = { d1: 0, d7: 0, d30: 0 };
    for (const signup of signups) {
        const signupDate = signup.signup_day instanceof Date
            ? signup.signup_day
            : new Date(`${String(signup.signup_day).slice(0, 10)}T00:00:00.000Z`);
        for (const [key, offset] of [["d1", 1], ["d7", 7], ["d30", 30]]) {
            const dayStart = new Date(signupDate);
            dayStart.setUTCDate(dayStart.getUTCDate() + offset);
            const dayEnd = new Date(dayStart);
            dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
            if (await hasUserActivity(signup.id, dayStart, dayEnd)) {
                counts[key] += 1;
            }
        }
    }
    return {
        d1: counts.d1 / signups.length,
        d7: counts.d7 / signups.length,
        d30: counts.d30 / signups.length,
    };
};

export const getAnalyticsSummary = async ({
    startDate,
    endDate,
    subjectId,
}) => {
    const range = getRange({ startDate, endDate });
    const normalizedSubjectId = subjectId === undefined || subjectId === null || subjectId === ""
        ? null
        : Number(subjectId);
    if (
        normalizedSubjectId !== null &&
        (!Number.isInteger(normalizedSubjectId) || normalizedSubjectId < 1)
    ) {
        throw new HttpError(400, "Invalid integer parameter.");
    }

    const subjects = await findAnalyticsSubjects();
    if (
        normalizedSubjectId !== null &&
        !subjects.some((subject) => Number(subject.id) === normalizedSubjectId)
    ) {
        throw new HttpError(404, "Subject not found.");
    }

    const featureRows = {};
    await Promise.all(FEATURE_KEYS.map(async (feature) => {
        featureRows[feature] = normalizeCountRows(
            await findFeatureCounts(
                feature,
                range.start,
                range.exclusiveEnd,
                normalizedSubjectId
            )
        );
    }));
    const totals = {};
    const timeseries = {};
    const subjectMap = new Map(subjects.map((subject) => [
        Number(subject.id),
        subject,
    ]));
    const bySubject = new Map();

    for (const feature of FEATURE_KEYS) {
        const rows = featureRows[feature];
        totals[feature] = rows.reduce((sum, row) => sum + row.count, 0);
        const dayCounts = new Map();
        for (const row of rows) {
            dayCounts.set(row.day, (dayCounts.get(row.day) || 0) + row.count);
            const key = row.subject_id ?? "general";
            if (!bySubject.has(key)) {
                const subject = subjectMap.get(row.subject_id) || {};
                bySubject.set(key, {
                    subject_id: row.subject_id,
                    subject_code: subject.code || null,
                    subject_name: subject.name || "General",
                    totals: {},
                });
            }
            const entry = bySubject.get(key);
            entry.totals[feature] = (entry.totals[feature] || 0) + row.count;
        }
        timeseries[feature] = range.days.map((day) => ({
            date: day,
            count: dayCounts.get(day) || 0,
        }));
    }
    for (const entry of bySubject.values()) {
        for (const feature of FEATURE_KEYS) {
            entry.totals[feature] ||= 0;
        }
    }

    const activityRows = await findActiveUserDays(
        range.start,
        range.exclusiveEnd,
        normalizedSubjectId
    );
    const usersByDay = new Map(range.days.map((day) => [day, new Set()]));
    for (const row of activityRows) {
        const day = row.day instanceof Date
            ? formatDate(row.day)
            : String(row.day).slice(0, 10);
        if (usersByDay.has(day)) usersByDay.get(day).add(Number(row.user_id));
    }
    const rolling = (windowDays) => range.days.map((day, index) => {
        const users = new Set();
        for (
            let cursor = Math.max(0, index - windowDays + 1);
            cursor <= index;
            cursor++
        ) {
            for (const userId of usersByDay.get(range.days[cursor]) || []) {
                users.add(userId);
            }
        }
        return { date: day, count: users.size };
    });
    const [topUsers, topUsersTotal, conversionFunnel, retention] = await Promise.all([
        findTopUsers(range.start, range.exclusiveEnd, 10, 0),
        countTopUsers(range.start, range.exclusiveEnd),
        findConversionFunnel(range.start, range.exclusiveEnd),
        getRetention(range.start, range.exclusiveEnd),
    ]);
    const subjectEngagement = [...bySubject.values()]
        .map((entry) => ({
            subject_id: entry.subject_id,
            name: entry.subject_name,
            code: entry.subject_code,
            total_usage:
                (entry.totals.ai_quizzes_generated || 0) +
                (entry.totals.ai_flashcards_generated || 0) +
                (entry.totals.study_sessions_created || 0),
            unique_users: null,
            quizzes: entry.totals.ai_quizzes_generated || 0,
            flashcards: entry.totals.ai_flashcards_generated || 0,
            sessions: entry.totals.study_sessions_created || 0,
        }))
        .sort((left, right) => right.total_usage - left.total_usage)
        .slice(0, 10);
    const durations = {};
    if (totals.ai_quizzes_generated) durations.quiz_generation = 180;
    if (totals.ai_flashcards_generated) durations.flashcard_generation = 150;
    if (totals.study_sessions_created) durations.study_session = 600;
    if (totals.ai_checker_evaluations) durations.ai_checker = 120;
    if (totals.mcq_wrong_review) durations.mcq_review = 90;

    return {
        range: {
            start: formatDate(range.start),
            end: formatDate(range.end),
        },
        filters: { subject_id: normalizedSubjectId },
        subjects,
        totals,
        timeseries,
        by_subject: [...bySubject.values()].sort(
            (left, right) => left.subject_name.localeCompare(right.subject_name)
        ),
        active_users: {
            dau: rolling(1),
            wau: rolling(7),
            mau: rolling(30),
        },
        retention,
        top_users: topUsers.map((user) => ({
            ...user,
            user_id: Number(user.user_id),
            total_actions: Number(user.total_actions),
            sessions: Number(user.sessions),
            quizzes: Number(user.quizzes),
            flashcards: Number(user.flashcards),
            chats: Number(user.chats),
        })),
        top_users_total: topUsersTotal,
        top_subjects: subjectEngagement,
        conversion_funnel: {
            signups: Number(conversionFunnel.signups || 0),
            first_chat: Number(conversionFunnel.first_chat || 0),
            quiz_generated: Number(conversionFunnel.quiz_generated || 0),
            quiz_completed: Number(conversionFunnel.quiz_completed || 0),
            retained_7d: 0,
        },
        session_durations: durations,
    };
};

export const getAnalyticsTopUsers = async ({
    startDate,
    endDate,
    page = 1,
    pageSize = 40,
}) => {
    const range = getRange({ startDate, endDate });
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 40));
    const totalCount = await countTopUsers(range.start, range.exclusiveEnd);
    const users = await findTopUsers(
        range.start,
        range.exclusiveEnd,
        safePageSize,
        (safePage - 1) * safePageSize
    );
    const totalPages = totalCount > 0
        ? Math.ceil(totalCount / safePageSize)
        : 1;

    return {
        users: users.map((user) => ({
            ...user,
            user_id: Number(user.user_id),
            total_actions: Number(user.total_actions),
            sessions: Number(user.sessions),
            quizzes: Number(user.quizzes),
            flashcards: Number(user.flashcards),
            chats: Number(user.chats),
        })),
        pagination: {
            page: safePage,
            page_size: safePageSize,
            total_count: totalCount,
            total_pages: totalPages,
            has_next: safePage < totalPages,
            has_prev: safePage > 1,
        },
    };
};
