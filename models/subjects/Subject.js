import { executeQuery } from "../../utils/databaseHelper.js";


/*
|--------------------------------------------------------------------------
| SUBJECT QUERIES
|--------------------------------------------------------------------------
*/

export const findActiveSubjects = async (
    filters = {},
    connection = null
) => {
    const conditions = [
        "s.is_active = 1",
    ];

    const params = [];

    if (filters.userId) {
        conditions.push(`
            EXISTS (
                SELECT 1
                FROM api_usersubject us
                WHERE us.subject_id = s.id
                AND us.user_id = ?
            )
        `);

        params.push(filters.userId);
    }

    if (filters.level) {
        conditions.push("s.level = ?");
        params.push(filters.level);
    }

    if (filters.examBoard) {
        conditions.push("s.exam_board = ?");
        params.push(filters.examBoard);
    }

    const sql = `
        SELECT
            s.id,
            s.name,
            s.code,
            s.level,
            s.exam_board,
            s.description,
            s.is_active
        FROM api_subject s
        WHERE ${conditions.join(" AND ")}
        ORDER BY s.name ASC
    `;

    return executeQuery(
        sql,
        params,
        connection
    );
};

export const findActiveSubjectById = async (
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
        AND is_active = 1
        LIMIT 1
    `;

    const rows = await executeQuery(
        sql,
        [subjectId],
        connection
    );

    return rows[0] || null;
};

/*
|--------------------------------------------------------------------------
| USER SUBJECT QUERIES
|--------------------------------------------------------------------------
*/

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
            ?,
            ?,
            NOW(6)
        )
    `;

    return executeQuery(
        sql,
        [
            userId,
            subjectId,
        ],
        connection
    );
};

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

    return executeQuery(
        sql,
        [
            userId,
            subjectId,
        ],
        connection
    );
};

export const findActiveSubjectsPage = async (
    filters = {},
    { limit, offset },
    connection = null
) => {
    const conditions = ["s.is_active = 1"];
    const params = [];

    if (filters.userId) {
        conditions.push(`
            EXISTS (
                SELECT 1 FROM api_usersubject us
                WHERE us.subject_id = s.id AND us.user_id = ?
            )
        `);
        params.push(filters.userId);
    }
    if (filters.level) {
        conditions.push("s.level = ?");
        params.push(filters.level);
    }
    if (filters.examBoard) {
        conditions.push("s.exam_board = ?");
        params.push(filters.examBoard);
    }

    const where = conditions.join(" AND ");
    const countRows = await executeQuery(
        `SELECT COUNT(*) AS count FROM api_subject s WHERE ${where}`,
        params,
        connection
    );
    const rows = await executeQuery(
        `
            SELECT s.id, s.name, s.code, s.level, s.exam_board,
                   s.description, s.is_active
            FROM api_subject s
            WHERE ${where}
            ORDER BY s.name ASC
            LIMIT ${Number(limit)} OFFSET ${Number(offset)}
        `,
        params,
        connection
    );

    return { count: Number(countRows[0]?.count || 0), rows };
};
