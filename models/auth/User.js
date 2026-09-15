import { executeQuery } from "../../utils/databaseHelper.js";


/*
|--------------------------------------------------------------------------
| SELECT QUERIES
|--------------------------------------------------------------------------
*/

export const findUserById = async (id) => {
    const sql = `
        SELECT *
        FROM api_user
        WHERE id = ?
        LIMIT 1
    `;

    const rows = await executeQuery(sql, [id]);

    return rows[0] || null;
};

export const findUserByIdSafe = async (id, connection = null) => {
    const sql = `
        SELECT
            id,
            username,
            email,
            is_verified,
            is_active,
            is_staff,
            is_superuser,
            role,
            auth_provider,
            profile_completed,
            created_at,
            last_login
        FROM api_user
        WHERE id = ?
        LIMIT 1
    `;

    const rows = await executeQuery(sql, [id], connection);

    return rows[0] || null;
};

export const findUserByEmail = async (email) => {
    const sql = `
        SELECT *
        FROM api_user
        WHERE LOWER(email) = LOWER(?)
        LIMIT 1
    `;

    const rows = await executeQuery(sql, [email]);

    return rows[0] || null;
};

export const findUserByUsername = async (username) => {
    const sql = `
        SELECT *
        FROM api_user
        WHERE LOWER(username) = LOWER(?)
        LIMIT 1
    `;

    const rows = await executeQuery(sql, [username]);

    return rows[0] || null;
};

export const findUserByGoogleId = async (googleId) => {
    const sql = `
        SELECT *
        FROM api_user
        WHERE google_id = ?
        LIMIT 1
    `;

    const rows = await executeQuery(sql, [googleId]);

    return rows[0] || null;
};

export const findUserByAppleId = async (appleUserId) => {
    const sql = `
        SELECT *
        FROM api_user
        WHERE apple_user_id = ?
        LIMIT 1
    `;

    const rows = await executeQuery(sql, [appleUserId]);

    return rows[0] || null;
};

/*
|--------------------------------------------------------------------------
| INSERT QUERIES
|--------------------------------------------------------------------------
*/

export const createUser = async (
    user,
    connection = null
) => {
    const sql = `
        INSERT INTO api_user
        (
            password,
            is_superuser,
            username,
            first_name,
            last_name,
            is_staff,
            is_active,
            date_joined,
            email,
            is_verified,
            login_attempts,
            role,
            created_at,
            auth_provider,
            profile_completed
        )
        VALUES
        (
            ?, ?, ?, ?, ?, ?, ?, NOW(),
            ?, ?, ?, ?, NOW(), ?, ?
        )
    `;

    const result = await executeQuery(
        sql,
        [
            user.password,
            0,
            user.username,
            "",
            "",
            0,
            1,
            user.email,
            1,
            0,
            "student",
            "email",
            1,
        ],
        connection
    );

    return result.insertId;
};

export const createGoogleUser = async ({
    username,
    email,
    googleId,
    password,
    googlePictureUrl,
}) => {

    const sql = `
        INSERT INTO api_user
        (
            password,
            is_superuser,
            username,
            first_name,
            last_name,
            is_staff,
            is_active,
            date_joined,
            email,
            is_verified,
            login_attempts,
            role,
            created_at,
            auth_provider,
            google_id,
            profile_completed,
            google_picture_url
        )
        VALUES
        (
            ?, 0, ?, '', '', 0, 1, NOW(),
            ?, 1, 0, 'student', NOW(),
            'google', ?, 0, ?
        )
    `;

    const result = await executeQuery(
        sql,
        [
            password,
            username,
            email,
            googleId,
            googlePictureUrl ?? null,
        ]
    );

    return result.insertId;

};

export const updateGooglePictureUrl = async (
    userId,
    googlePictureUrl,
    connection = null
) => {

    const sql = `
        UPDATE api_user
        SET google_picture_url = ?
        WHERE id = ?
    `;

    await executeQuery(
        sql,
        [googlePictureUrl ?? null, userId],
        connection
    );

};

export const createAppleUser = async ({
    username,
    email,
    appleUserId,
    password,
}) => {

    const sql = `
        INSERT INTO api_user
        (
            password,
            is_superuser,
            username,
            first_name,
            last_name,
            is_staff,
            is_active,
            date_joined,
            email,
            is_verified,
            login_attempts,
            role,
            created_at,
            auth_provider,
            apple_user_id,
            profile_completed
        )
        VALUES
        (
            ?, 0, ?, '', '', 0, 1, NOW(),
            ?, 1, 0, 'student', NOW(),
            'apple', ?, 0
        )
    `;

    const result = await executeQuery(
        sql,
        [
            password,
            username,
            email,
            appleUserId,
        ]
    );

    return result.insertId;

};

/*
|--------------------------------------------------------------------------
| UPDATE QUERIES
|--------------------------------------------------------------------------
*/

export const verifyUser = async (
    id,
    connection = null
) => {
    const sql = `
        UPDATE api_user
        SET
            is_verified = 1,
            otp_code = NULL,
            otp_expiry = NULL,
            profile_completed = 1
        WHERE id = ?
    `;

    await executeQuery(
        sql,
        [id],
        connection
    );
};

export const updateUserOtp = async (
    id,
    otpCode,
    otpExpiry,
    connection = null
) => {

    const sql = `
        UPDATE api_user
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


export const incrementLoginAttempts = async (
    id,
    connection = null
) => {

    const sql = `
        UPDATE api_user
        SET
            login_attempts = login_attempts + 1
        WHERE id = ?
    `;

    await executeQuery(
        sql,
        [id],
        connection
    );

};

export const resetLoginAttempts = async (
    id,
    connection = null
) => {

    const sql = `
        UPDATE api_user
        SET
            login_attempts = 0
        WHERE id = ?
    `;

    await executeQuery(
        sql,
        [id],
        connection
    );

};

export const updateLastLogin = async (
    id,
    connection = null
) => {

    const sql = `
        UPDATE api_user
        SET
            last_login = NOW()
        WHERE id = ?
    `;

    await executeQuery(
        sql,
        [id],
        connection
    );

};

export const updateGoogleId = async (
    id,
    googleId,
    connection = null
) => {

    const sql = `
        UPDATE api_user
        SET
            google_id = ?
        WHERE id = ?
    `;

    await executeQuery(
        sql,
        [
            googleId,
            id,
        ],
        connection
    );

};

export const updateAppleId = async (
    id,
    appleUserId,
    connection = null
) => {

    const sql = `
        UPDATE api_user
        SET
            apple_user_id = ?
        WHERE id = ?
        AND auth_provider = 'apple'
    `;

    await executeQuery(
        sql,
        [
            appleUserId,
            id,
        ],
        connection
    );

};

export const updateUserPassword = async (
    id,
    password,
    connection = null
) => {

    const sql = `
        UPDATE api_user
        SET
            password = ?
        WHERE id = ?
    `;

    await executeQuery(
        sql,
        [
            password,
            id,
        ],
        connection
    );

};

export const clearUserOtp = async (
    id,
    connection = null
) => {

    const sql = `
        UPDATE api_user
        SET
            otp_code = NULL,
            otp_expiry = NULL
        WHERE id = ?
    `;

    await executeQuery(
        sql,
        [id],
        connection
    );

};

export const markProfileCompleted = async (
    id,
    connection = null
) => {

    await executeQuery(
        `
        UPDATE api_user
        SET
            profile_completed = 1
        WHERE id = ?
        `,
        [id],
        connection
    );

};

// ======================================================
// DELETE QUERIES
// ======================================================

export const deleteUserById = async (
    id,
    connection = null
) => {

    const result = await executeQuery(
        `
        DELETE FROM api_user
        WHERE id = ?
        `,
        [id],
        connection
    );

    return result.affectedRows > 0;

};
