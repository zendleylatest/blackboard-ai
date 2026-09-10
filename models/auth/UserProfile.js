import { executeQuery } from "../../utils/databaseHelper.js";


/*
|--------------------------------------------------------------------------
| SELECT QUERIES
|--------------------------------------------------------------------------
*/

export const findUserProfileByUserId = async (
    userId,
    connection = null
) => {

    const sql = `
        SELECT *
        FROM api_userprofile
        WHERE user_id = ?
        LIMIT 1
    `;

    const rows = await executeQuery(
        sql,
        [userId],
        connection
    );

    return rows[0] || null;

};

/*
|--------------------------------------------------------------------------
| INSERT QUERIES
|--------------------------------------------------------------------------
*/

export const createUserProfile = async (
    profile,
    connection = null
) => {

    const sql = `
        INSERT INTO api_userprofile
        (
            user_id,
            full_name,
            age,
            class_level,
            exam_board,
            profile_pic_url
        )
        VALUES
        (
            ?, ?, ?, ?, ?, ?
        )
    `;

    const result = await executeQuery(
        sql,
        [
            profile.userId,
            profile.fullName,
            profile.age ?? null,
            profile.classLevel,
            profile.examBoard,
            profile.profilePicUrl ?? null,
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

export const updateUserProfile = async (
    profile,
    connection = null
) => {

    const sql = `
        UPDATE api_userprofile
        SET
            full_name = ?,
            age = ?,
            class_level = ?,
            exam_board = ?
        WHERE user_id = ?
    `;

    await executeQuery(
        sql,
        [
            profile.fullName,
            profile.age ?? null,
            profile.classLevel,
            profile.examBoard,
            profile.userId,
        ],
        connection
    );

};

export const updateProfileImage = async (
    userId,
    profilePicUrl,
    connection = null
) => {

    const sql = `
        UPDATE api_userprofile
        SET
            profile_pic_url = ?
        WHERE user_id = ?
    `;

    await executeQuery(
        sql,
        [
            profilePicUrl,
            userId,
        ],
        connection
    );

};

/*
|--------------------------------------------------------------------------
| DELETE QUERIES
|--------------------------------------------------------------------------
*/

export const deleteUserProfile = async (
    userId,
    connection = null
) => {

    const sql = `
        DELETE FROM api_userprofile
        WHERE user_id = ?
    `;

    await executeQuery(
        sql,
        [userId],
        connection
    );

};
