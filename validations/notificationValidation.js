import { body } from "express-validator";

export const registerDeviceTokenValidation = [
    body("token").isString().trim().notEmpty().isLength({ max: 512 }),
    body("platform").isIn(["android", "ios"]),
];

export const unregisterDeviceTokenValidation = [
    body("token").isString().trim().notEmpty().isLength({ max: 512 }),
];

export const broadcastNotificationValidation = [
    body("title").isString().trim().notEmpty(),
    body("body").isString().trim().notEmpty(),
    body("tier").optional({ nullable: true }).isIn(["free", "plus", "pro"]),
];
