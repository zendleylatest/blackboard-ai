import bcrypt from "bcrypt";
import HttpError from "../utils/httpError.js";
import {
    ensureAdminProfile,
    findAllActiveSubjects,
    findEnrolledSubjects,
    findProgressSummary,
    findRecentDashboardDocuments,
    findRecentDashboardQuizzes,
    findUserDashboardProfile,
    findUserStats,
    upsertAdminUser,
} from "../models/System.js";

const serializeSubject = (subject) => ({
    id: subject.id,
    name: subject.name,
    code: subject.code,
    level: subject.level,
    exam_board: subject.exam_board,
    description: subject.description,
    is_active: Boolean(subject.is_active),
});

export const bootstrapAdmin = async ({
    headerToken,
    bodyToken,
    email,
    password,
    fullName = "Admin",
    age = 18,
    classLevel = "A",
    examBoard = "cambridge",
    isSuperuser = false,
}) => {
    const expectedToken = process.env.ADMIN_BOOTSTRAP_TOKEN || "";
    if (!expectedToken) {
        throw new HttpError(403, "Admin bootstrap is disabled.");
    }
    if ((headerToken || bodyToken || "") !== expectedToken) {
        throw new HttpError(403, "Invalid bootstrap token.");
    }
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail || !password) {
        throw new HttpError(400, "email and password are required.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await upsertAdminUser({
        email: normalizedEmail,
        password: hashedPassword,
        isSuperuser,
    });
    await ensureAdminProfile({
        userId: user.id,
        fullName: String(fullName || "Admin").trim() || "Admin",
        age,
        classLevel: String(classLevel || "A").trim() || "A",
        examBoard: String(examBoard || "cambridge").trim() || "cambridge",
    });

    return {
        email: user.email,
    };
};

export const getStats = async (userId) => {
    const stats = await findUserStats(userId);
    const total = Number(stats.attempts.total_sum || 0);

    return {
        quizzes_taken: Number(stats.attempts.quizzes_taken || 0),
        avg_score_percentage: total > 0
            ? Math.round((Number(stats.attempts.score_sum || 0) / total) * 100)
            : 0,
        flashcards_studied: Number(stats.reviews.unique_cards || 0),
        flashcard_reviews_total: Number(stats.reviews.reviews || 0),
        flashcard_sessions_completed: Number(stats.sessions.completed || 0),
    };
};

export const getDashboard = async (userId) => {
    const [
        user,
        subjects,
        recentDocuments,
        recentQuizzes,
        progressRows,
    ] = await Promise.all([
        findUserDashboardProfile(userId),
        findEnrolledSubjects(userId),
        findRecentDashboardDocuments(userId),
        findRecentDashboardQuizzes(userId),
        findProgressSummary(userId),
    ]);

    const progressSummary = Object.fromEntries(
        progressRows.map((row) => [
            row.subject_name,
            {
                total_time_spent: Number(row.total_time_spent || 0),
                documents_viewed: Number(row.documents_viewed || 0),
                quizzes_completed: Number(row.quizzes_completed || 0),
                last_activity: row.last_activity
                    ? new Date(row.last_activity).toISOString()
                    : null,
            },
        ])
    );

    return {
        user,
        subjects: subjects.map(serializeSubject),
        recent_documents: recentDocuments,
        recent_quizzes: recentQuizzes,
        progress_summary: progressSummary,
    };
};

export const listMysqlSubjects = async () => {
    const subjects = await findAllActiveSubjects();
    return subjects.map(serializeSubject);
};
