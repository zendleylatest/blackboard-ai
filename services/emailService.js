import nodemailer from "nodemailer";

const maskEmail = (email = "") => {
    const [name, domain] = String(email).split("@");
    if (!domain) return "<invalid-email>";
    return `${name.slice(0, 2)}***@${domain}`;
};

const escapeHtml = (value = "") =>
    String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

const buildOtpEmailHtml = ({
    username,
    otpCode,
}) => {
    const safeUsername = escapeHtml(username || "there");
    const safeOtpCode = escapeHtml(otpCode);

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>Blackboard AI verification code</title>
</head>
<body style="margin:0; padding:0; background:#eef4ff; font-family:Arial, Helvetica, sans-serif; color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%; background:#eef4ff; margin:0; padding:28px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%; max-width:560px; border-collapse:collapse;">
                    <tr>
                        <td style="padding:0;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#2f7df0; border-radius:28px 28px 0 0; overflow:hidden;">
                                <tr>
                                    <td style="padding:34px 30px 46px; text-align:center;">
                                        <div style="display:inline-block; width:70px; height:70px; background:#ffffff; border-radius:22px; line-height:70px; text-align:center; color:#2f7df0; font-size:34px; font-weight:800;">B</div>
                                        <div style="margin-top:14px; color:#ffffff; font-size:26px; line-height:32px; font-weight:800;">Blackboard AI</div>
                                        <div style="margin-top:8px; color:#dce9ff; font-size:15px; line-height:22px;">Your study companion for O &amp; A Level success</div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="background:#ffffff; border-radius:0 0 28px 28px; padding:34px 30px 32px; box-shadow:0 18px 45px rgba(17, 24, 39, 0.10);">
                            <h1 style="margin:0; color:#111827; font-size:26px; line-height:32px; font-weight:800; text-align:center;">Verify your email</h1>
                            <p style="margin:18px 0 0; color:#4b5563; font-size:16px; line-height:24px; text-align:center;">Hi ${safeUsername}, use this one-time code to continue with Blackboard AI.</p>

                            <div style="margin:28px auto 8px; max-width:320px; background:#f3f7ff; border:1px solid #cfe0ff; border-radius:18px; padding:22px 18px; text-align:center;">
                                <div style="color:#64748b; font-size:12px; line-height:16px; letter-spacing:1.6px; text-transform:uppercase; font-weight:700;">Verification code</div>
                                <div style="margin-top:10px; color:#2563eb; font-size:38px; line-height:44px; letter-spacing:8px; font-weight:800;">${safeOtpCode}</div>
                            </div>

                            <p style="margin:20px 0 0; color:#4b5563; font-size:15px; line-height:23px; text-align:center;">This code expires in <strong style="color:#111827;">10 minutes</strong>. If you did not request it, you can safely ignore this email.</p>

                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:30px; border-top:1px solid #e5e7eb;">
                                <tr>
                                    <td style="padding-top:20px; color:#6b7280; font-size:13px; line-height:20px; text-align:center;">
                                        Sent by Blackboard AI<br>
                                        Please do not share this code with anyone.
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
};

const getTransporter = () =>
    nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD,
        },
    });

export const sendEmail = async ({
    to,
    subject,
    text,
    html = null,
}) => {
    try {
        console.log(`[EMAIL] Sending "${subject}" to ${maskEmail(to)}`);

        const info = await getTransporter().sendMail({
            from: `"Blackboard AI" <${process.env.GMAIL_USER}>`,
            to,
            subject,
            text,
            html,
        });

        console.log(
            `[EMAIL] Sent "${subject}" to ${maskEmail(to)} messageId=${info.messageId || "n/a"}`
        );

        return true;
    } catch (error) {
        console.error(
            `[EMAIL] Failed "${subject}" to ${maskEmail(to)}: ${error?.code || ""} ${error?.message || error}`
        );

        return false;
    }
};

export const sendOtpEmail = async ({
    email,
    username,
    otpCode,
}) => {
    if (process.env.NODE_ENV !== "production") {
        console.log(`[OTP][DEV] Generated OTP for ${maskEmail(email)}: ${otpCode}`);
    }

    const subject = "Blackboard AI - Email Verification Code";
    const displayName = username || "there";
    const text = `
Hi ${displayName},

Welcome to Blackboard AI!

Your verification code is:

${otpCode}

This code will expire in 10 minutes.

If you didn't request this code, please ignore this email.

Best regards,

The Blackboard AI Team
`;

    return await sendEmail({
        to: email,
        subject,
        text,
        html: buildOtpEmailHtml({
            username: displayName,
            otpCode,
        }),
    });
};
