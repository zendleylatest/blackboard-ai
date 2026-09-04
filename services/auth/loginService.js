import bcrypt from "bcrypt";

import HttpError from "../../utils/httpError.js";

import {
    generateAccessToken,
    generateRefreshToken,
} from "../../utils/jwt.js";

import {
    findUserByEmail,
    findUserByIdSafe,
    updateLastLogin,
    resetLoginAttempts,
    incrementLoginAttempts,
} from "../../models/auth/User.js";

export const loginService = async ({
    email,
    password,
}) => {

    const user = await findUserByEmail(email);

if (!user) {

    throw new HttpError(
        "Invalid email or password.",
        401
    );

}

if (!user.is_verified) {

    throw new HttpError(
        "Please verify your email before logging in.",
        403
    );

}

const passwordMatched = await bcrypt.compare(
    password,
    user.password
);

if (!passwordMatched) {

    await incrementLoginAttempts(user.id);

    throw new HttpError(
        "Invalid email or password.",
        401
    );

}

await resetLoginAttempts(user.id);

await updateLastLogin(user.id);

const safeUser = await findUserByIdSafe(user.id);
return {

    tokens: {

        access: generateAccessToken(safeUser),

        refresh: generateRefreshToken(safeUser),

    },

    user: safeUser,

};

};
