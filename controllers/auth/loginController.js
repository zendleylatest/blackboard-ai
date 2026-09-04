import { loginService } from "../../services/auth/loginService.js";

import { successResponse } from "../../utils/apiResponse.js";

export const loginController = async (
    req,
    res,
    next
) => {

    try {

        const data = await loginService(req.body);

        return successResponse(
            res,
            200,
            "Login successful.",
            data
        );

    } catch (error) {

        next(error);

    }

};
