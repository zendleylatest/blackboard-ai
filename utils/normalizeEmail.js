const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/**
 * The email exactly as the user entered it / Google returned it, only
 * trimmed and lower-cased (email addresses are case-insensitive in practice).
 *
 * This is what gets STORED and displayed. Dots and "+suffix" parts are kept
 * as-is: "s.hamzaali2000@gmail.com" must not become
 * "shamzaali2000@gmail.com".
 */
export const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

/**
 * Gmail treats "s.ham@gmail.com", "sham@gmail.com" and "sham+x@gmail.com" as
 * the same mailbox. This canonical form is used ONLY to detect that two
 * differently-typed addresses are the same Gmail mailbox (so one mailbox
 * can't end up with two accounts); it is never stored or displayed.
 */
export const canonicalEmail = (value) => {
    const trimmed = normalizeEmail(value);
    const atIndex = trimmed.lastIndexOf("@");
    if (atIndex <= 0) return trimmed;

    const local = trimmed.slice(0, atIndex);
    const domain = trimmed.slice(atIndex + 1);

    if (!GMAIL_DOMAINS.has(domain)) return trimmed;

    const withoutSubaddress = local.split("+")[0];
    const withoutDots = withoutSubaddress.replaceAll(".", "");

    return `${withoutDots}@gmail.com`;
};

export const isGmailAddress = (value) => {
    const trimmed = normalizeEmail(value);
    const atIndex = trimmed.lastIndexOf("@");
    return atIndex > 0 && GMAIL_DOMAINS.has(trimmed.slice(atIndex + 1));
};

/**
 * SQL that computes the canonical form of a stored `email` column, matching
 * canonicalEmail() above. Only meaningful for Gmail rows (see the domain
 * guard in the callers).
 */
export const CANONICAL_EMAIL_SQL = `CONCAT(
    REPLACE(SUBSTRING_INDEX(SUBSTRING_INDEX(LOWER(email), '@', 1), '+', 1), '.', ''),
    '@gmail.com'
)`;

export const GMAIL_DOMAIN_SQL =
    "SUBSTRING_INDEX(LOWER(email), '@', -1) IN ('gmail.com', 'googlemail.com')";

export default normalizeEmail;
