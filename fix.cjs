const fs = require('fs');
const file = '/Users/odl-mac/Desktop/wasif/flutter/blackboard-ai-project/backend_nodejs/services/subjects/userSubjectService.js';
let content = fs.readFileSync(file, 'utf8');

// I saw double imports of getConnection earlier, let's clean that up
content = content.replace(/import \{ getConnection \} from "\.\.\/\.\.\/config\/database\.js";\nimport \{ deleteDependentRows \} from "\.\.\/\.\.\/utils\/cascadeDelete\.js";\nimport \{ getConnection \} from "\.\.\/\.\.\/config\/database\.js";\nimport \{ deleteDependentRows \} from "\.\.\/\.\.\/utils\/cascadeDelete\.js";/g, 'import { getConnection } from "../../config/database.js";\nimport { deleteDependentRows } from "../../utils/cascadeDelete.js";');

const regex = /export const unenrollUserFromSubject = async \([\s\S]*?^};/m;
const replacement = `export const unenrollUserFromSubject = async (userId, subjectId) => {
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

    const connection = await getConnection();
    try {
        await connection.beginTransaction();
        const dbName = process.env.DB_NAME;

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
        
        // Finally, delete UserSubject enrollment
        const [result] = await connection.execute(
            "DELETE FROM api_usersubject WHERE user_id = ? AND subject_id = ?",
            [userId, subjectId]
        );
        
        await connection.commit();

        return {
            message: \`Successfully removed from \${subject.name}\`,
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
};`;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content);
console.log('Replaced.');
