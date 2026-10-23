import {
    findSubjectById,
    findUserSubject,
    createUserSubject,
    deleteUserSubject,
} from "../../models/subjects/UserSubject.js";

import {
    deleteUserSubjectChatThreads,
} from "../chatThreadService.js";
import pool, { getConnection } from "../../config/database.js";
import { deleteDependentRows } from "../../utils/cascadeDelete.js";
import { archiveSubjectStats, ensureStatsArchiveTable } from "../../models/System.js";

/**
 * Enroll a user in an active subject.
 */
export const enrollUserInSubject = async (
    userId,
    subjectId
) => {
    const subject = await findSubjectById(
        subjectId
    );

    if (!subject) {
        const error = new Error(
            "Subject not found"
        );

        error.statusCode = 404;
        throw error;
    }

    // Each class level (O / A) keeps its own subjects and data, so a student
    // can only add subjects belonging to the level they have selected.
    const [profileRows] = await pool.execute(
        "SELECT class_level FROM api_userprofile WHERE user_id = ? LIMIT 1",
        [userId]
    );
    const userLevel = profileRows[0]?.class_level;
    if (userLevel && subject.level && userLevel !== subject.level) {
        const error = new Error(
            `This subject belongs to ${subject.level} Level. Switch your class level to add it.`
        );

        error.statusCode = 400;
        throw error;
    }

    const existingEnrollment =
        await findUserSubject(
            userId,
            subjectId
        );

    if (existingEnrollment) {
        const error = new Error(
            "Already enrolled in this subject"
        );

        error.statusCode = 400;
        throw error;
    }

    await createUserSubject(
        userId,
        subjectId
    );

    return {
        subject,
        message: `Successfully enrolled in ${subject.name}`,
    };
};

/**
 * Unenroll a user from an active subject.
 *
 * Also deletes all ChatThreads belonging to the
 * user and subject, matching the original Django behavior.
 */
export const unenrollUserFromSubject = async (userId, subjectId) => {
    const subject = await findSubjectById(subjectId);
    if (!subject) {
        const error = new Error("Subject not found");
        error.statusCode = 404;
        throw error;
    }

    const enrollment = await findUserSubject(userId, subjectId);
    if (!enrollment) {
        const error = new Error("Not enrolled in this subject");
        error.statusCode = 400;
        throw error;
    }

    await ensureStatsArchiveTable();
    const connection = await getConnection();
    try {
        await connection.beginTransaction();
        const dbName = process.env.DB_NAME;

        // Keep the user's lifetime stats (quizzes taken, flashcards studied,
        // average score) - they must not drop when a subject is removed.
        await archiveSubjectStats(connection, userId, subjectId, subject.level);

        // Cascade delete ChatThreads
        const [threads] = await connection.execute(
            "SELECT id FROM api_chatthread WHERE user_id = ? AND subject_id = ?",
            [userId, subjectId]
        );
        for (const { id } of threads) {
            await deleteDependentRows(connection, dbName, "api_chatthread", "id", id);
            await connection.execute("DELETE FROM api_chatthread WHERE id = ?", [id]);
        }

        // Cascade delete Quizzes
        const [quizzes] = await connection.execute(
            "SELECT id FROM api_quiz WHERE user_id = ? AND subject_id = ?",
            [userId, subjectId]
        );
        for (const { id } of quizzes) {
            await deleteDependentRows(connection, dbName, "api_quiz", "id", id);
            await connection.execute("DELETE FROM api_quiz WHERE id = ?", [id]);
        }

        // Cascade delete FlashcardSets
        const [flashcards] = await connection.execute(
            "SELECT id FROM api_flashcardset WHERE user_id = ? AND subject_id = ?",
            [userId, subjectId]
        );
        for (const { id } of flashcards) {
            await deleteDependentRows(connection, dbName, "api_flashcardset", "id", id);
            await connection.execute("DELETE FROM api_flashcardset WHERE id = ?", [id]);
        }

        // Cascade delete StudySessions
        const [sessions] = await connection.execute(
            "SELECT id FROM api_studysession WHERE user_id = ? AND subject_id = ?",
            [userId, subjectId]
        );
        for (const { id } of sessions) {
            await deleteDependentRows(connection, dbName, "api_studysession", "id", id);
            await connection.execute("DELETE FROM api_studysession WHERE id = ?", [id]);
        }
        
        // Per-subject progress rows (not covered by the tables above)
        try {
            await connection.execute(
                "DELETE FROM api_userprogress WHERE user_id = ? AND subject_id = ?",
                [userId, subjectId]
            );
        } catch (error) {
            if (error.code !== "ER_NO_SUCH_TABLE" && error.code !== "ER_ROW_IS_REFERENCED_2") throw error;
        }

        // Finally, delete UserSubject enrollment
        const [result] = await connection.execute(
            "DELETE FROM api_usersubject WHERE user_id = ? AND subject_id = ?",
            [userId, subjectId]
        );
        
        await connection.commit();

        return {
            message: `Successfully removed from ${subject.name}`,
            deleted_chat_threads: threads.length,
            deleted_quizzes: quizzes.length,
            deleted_flashcards: flashcards.length,
            deleted_study_sessions: sessions.length,
            deleted_enrollment: result.affectedRows,
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};
