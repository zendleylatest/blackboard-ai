import jwt from "jsonwebtoken";

const ACCESS_TOKEN_EXPIRY =
    process.env.ACCESS_TOKEN_EXPIRY || "1h";

const REFRESH_TOKEN_EXPIRY =
    process.env.REFRESH_TOKEN_EXPIRY || "30d";

export const generateAccessToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            role: user.role,
        },
        process.env.JWT_SECRET,
        {
            expiresIn: ACCESS_TOKEN_EXPIRY,
        }
    );
};

export const generateRefreshToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
        },
        process.env.JWT_REFRESH_SECRET,
        {
            expiresIn: REFRESH_TOKEN_EXPIRY,
        }
    );
};

export const verifyAccessToken = (token) => {
    return jwt.verify(
        token,
        process.env.JWT_SECRET
    );
};

export const verifyRefreshToken = (token) => {
    return jwt.verify(
        token,
        process.env.JWT_REFRESH_SECRET
    );
};