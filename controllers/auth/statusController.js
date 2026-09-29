export const checkAuthStatusController = async (req, res, next) => {
    // If the request makes it here, the authenticate middleware has passed.
    // That means the user exists and user.is_active is true.
    // Banned users are intercepted by authMiddleware which throws a 403 error.
    return res.status(200).json({
        success: true,
        message: "User account is active.",
    });
};
