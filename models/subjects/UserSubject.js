import { executeQuery } from "../../utils/databaseHelper.js";


/*
|--------------------------------------------------------------------------
| SELECT QUERIES
|--------------------------------------------------------------------------
*/

export const findSubjectById = async (
    subjectId,
    connection = null
) => {

    const sql = `
        SELECT
            id,
            name,
            code,
            level,
            exam_board,
            description,
            is_active
        FROM api_subject
        WHERE id = ?
        LIMIT 1
    `;

    const rows = await executeQuery(
        sql,
        [subjectId],
        connection
    );

    return rows[0] || null;
};

export const findUserSubject = async (
    userId,
    subjectId,
    connection = null
) => {

    const sql = `
        SELECT
            id,
            user_id,
            subject_id,
            created_at
        FROM api_usersubject
        WHERE user_id = ?
        AND subject_id = ?
        LIMIT 1
    `;

    const rows = await executeQuery(
        sql,
        [
            userId,
            subjectId,
        ],
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

    const result = await executeQuery(
        sql,
        [
            userId,
            subjectId,
        ],
        connection
    );

    return result.affectedRows;
};
