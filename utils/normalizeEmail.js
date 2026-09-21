const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/**
 * Canonicalizes an email address the same way Gmail treats mailbox
 * addresses internally: dots in the local part and anything after a "+"
 * are insignificant to Gmail's delivery, so "flutter.dev1.odl@gmail.com"
 * and "flutterdev1odl@gmail.com" are the same inbox to the user even
 * though they're different strings.
 *
 * Without this, a user who signs up (or signs in with Google) using one
 * dotted/undotted variant and later types a different variant at login
 * gets a false "no account exists" - two different-looking rows would
 * otherwise need to exist for what is really one mailbox. Applying this
 * at every point an email is stored or looked up keeps a single Gmail
 * mailbox mapped to exactly one account regardless of which variant was
 * typed.
 */
export const normalizeEmail = (value) => {
    const trimmed = String(value || "").trim().toLowerCase();
    const atIndex = trimmed.lastIndexOf("@");
    if (atIndex <= 0) return trimmed;

    const local = trimmed.slice(0, atIndex);
    const domain = trimmed.slice(atIndex + 1);

    if (!GMAIL_DOMAINS.has(domain)) return trimmed;

    const withoutSubaddress = local.split("+")[0];
    const withoutDots = withoutSubaddress.replaceAll(".", "");

    return `${withoutDots}@${domain}`;
};

export default normalizeEmail;
