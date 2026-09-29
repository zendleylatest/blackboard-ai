import { executeQuery } from "../../utils/databaseHelper.js";
import {
    normalizeEmail,
    canonicalEmail,
    isGmailAddress,
    CANONICAL_EMAIL_SQL,
    GMAIL_DOMAIN_SQL,
} from "../../utils/normalizeEmail.js";


/*
|--------------------------------------------------------------------------
| SELECT QUERIES
|--------------------------------------------------------------------------
*/

export const findPendingUserById = async (id) => {
    const sql = `
        SELECT *
        FROM api_pendinguser
        WHERE id = ?
        LIMIT 1
    `;

    const rows = await executeQuery(sql, [id]);

    return rows[0] || null;
};

export const findPendingUserByEmail = async (email) => {
    const exactRows = await executeQuery(
        `
        SELECT *
        FROM api_pendinguser
        WHERE LOWER(email) = ?
        LIMIT 1
        `,
        [normalizeEmail(email)]
    );

    if (exactRows[0] || !isGmailAddress(email)) {
        return exactRows[0] || null;
    }

    const canonicalRows = await executeQuery(
        `
        SELECT *
        FROM api_pendinguser
        WHERE ${GMAIL_DOMAIN_SQL}
          AND ${CANONICAL_EMAIL_SQL} = ?
        LIMIT 1
        `,
        [canonicalEmail(email)]
    );

    return canonicalRows[0] || null;
};

export const findPendingUserByUsername = async (username) => {
    const sql = `
        SELECT *
        FROM api_pendinguser
        WHERE LOWER(username) = LOWER(?)
        LIMIT 1
    `;

    const rows = await executeQuery(sql, [username]);

    return rows[0] || null;
};

/*
|--------------------------------------------------------------------------
| INSERT QUERIES
|--------------------------------------------------------------------------
*/

export const createPendingUser = async (
    pendingUser,
    connection = null
) => {

    const sql = `
        INSERT INTO api_pendinguser
        (
            email,
            username,
            password,
            full_name,
            age,
            class_level,
            exam_board,
            subject_ids,
            otp_code,
            otp_expiry,
            created_at
        )
        VALUES
        (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW()
        )
    `;

    const result = await executeQuery(
        sql,
        [
            normalizeEmail(pendingUser.email),
            pendingUser.username,
            pendingUser.password,
            pendingUser.fullName,
            pendingUser.age ?? null,
            pendingUser.classLevel,
            pendingUser.examBoard,
            JSON.stringify(pendingUser.subjectIds),
            pendingUser.otpCode,
            pendingUser.otpExpiry,
        ],
        connection
    );

    return result.insertId;

};

/*
|--------------------------------------------------------------------------
| UPDATE QUERIES
|--------------------------------------------------------------------------
*/

export const updatePendingUserOtp = async (
    id,
    otpCode,
    otpExpiry,
    connection = null
) => {

    const sql = `
        UPDATE api_pendinguser
        SET
            otp_code = ?,
            otp_expiry = ?
        WHERE id = ?
    `;

    await executeQuery(
        sql,
        [
            otpCode,
            otpExpiry,
            id,
        ],
        connection
    );

};

/*
|--------------------------------------------------------------------------
| DELETE QUERIES
|--------------------------------------------------------------------------
*/

export const deletePendingUser = async (
    id,
    connection = null
) => {

    const sql = `
        DELETE FROM api_pendinguser
        WHERE id = ?
    `;

    await executeQuery(
        sql,
        [id],
        connection
    );

};

export const deletePendingUserByEmail = async (
    email,
    connection = null
) => {

    // Also clears the same Gmail mailbox typed with different dots / +suffix.
    const sql = `
        DELETE FROM api_pendinguser
        WHERE LOWER(email) = ?
           OR (${GMAIL_DOMAIN_SQL} AND ${CANONICAL_EMAIL_SQL} = ?)
    `;

    await executeQuery(
        sql,
        [normalizeEmail(email), canonicalEmail(email)],
        connection
    );

};

export const deleteExpiredPendingUserByUsername = async (
    username,
    connection = null
) => {
    const sql = `
        DELETE FROM api_pendinguser
        WHERE LOWER(username) = LOWER(?)
          AND otp_expiry <= NOW()
    `;

    await executeQuery(
        sql,
        [username],
        connection
    );
};
