import { executeQuery } from "../../utils/databaseHelper.js";


/*
|--------------------------------------------------------------------------
| SELECT QUERIES
|--------------------------------------------------------------------------
*/

export const findUserSubjects = async (
    userId,
    connection = null
) => {

    const sql = `
        SELECT
            us.id,
            us.user_id,
            us.subject_id,
            us.created_at,
            s.name,
            s.code,
            s.level,
            s.exam_board
        FROM api_usersubject us
        INNER JOIN api_subject s
            ON us.subject_id = s.id
        WHERE us.user_id = ?
        ORDER BY s.name ASC
    `;

    return await executeQuery(
        sql,
        [userId],
        connection
    );

};

export const findUserSubject = async (
    userId,
    subjectId,
    connection = null
) => {

    const sql = `
        SELECT *
        FROM api_usersubject
        WHERE user_id = ?
        AND subject_id = ?
        LIMIT 1
    `;

    const rows = await executeQuery(
        sql,
        [userId, subjectId],
        connection
    );

    return rows[0] || null;

};

/*
|--------------------------------------------------------------------------
| INSERT QUERIES
|--------------------------------------------------------------------------
*/

export const createUserSubject = async (
    userId,
    subjectId,
    connection = null
) => {

    const sql = `
        INSERT INTO api_usersubject
        (
            user_id,
            subject_id,
            created_at
        )
        VALUES
        (
            ?, ?, NOW(6)
        )
    `;

    const result = await executeQuery(
        sql,
        [
            userId,
            subjectId,
        ],
        connection
    );

    return result.insertId;

};

export const bulkCreateUserSubjects = async (
    userId,
    subjectIds = [],
    connection = null
) => {

    if (!subjectIds.length) {
        return;
    }

    for (const subjectId of subjectIds) {

        await createUserSubject(
            userId,
            subjectId,
            connection
        );

    }

};

/*
|--------------------------------------------------------------------------
| DELETE QUERIES
|--------------------------------------------------------------------------
*/

export const deleteUserSubject = async (
    userId,
    subjectId,
    connection = null
) => {

    const sql = `
        DELETE FROM api_usersubject
        WHERE user_id = ?
        AND subject_id = ?
    `;

    await executeQuery(
        sql,
        [
            userId,
            subjectId,
        ],
        connection
    );

};

export const deleteAllUserSubjects = async (
    userId,
    connection = null
) => {

    const sql = `
        DELETE FROM api_usersubject
        WHERE user_id = ?
    `;

    await executeQuery(
        sql,
        [userId],
        connection
    );

};
