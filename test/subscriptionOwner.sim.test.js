import test from "node:test";
import assert from "node:assert/strict";
import pool from "../config/database.js";

// In-memory stand-in for the three tables the ownership logic touches.
const users = new Map();
const owners = new Map();
pool.execute = async (sql, p = []) => {
    const q = sql.replace(/\s+/g, " ").trim();
    if (/^CREATE TABLE|^ALTER TABLE/i.test(q)) return [[]];
    if (/FROM api_user WHERE id/.test(q)) {
        const u = users.get(Number(p[0]));
        return [u ? [{ ...u }] : (q.startsWith("SELECT 1") ? [] : [])];
    }
    if (/FROM api_subscriptionowner WHERE fingerprint/.test(q)) {
        const o = owners.get(p[0]);
        return [o ? [{ ...o }] : []];
    }
    if (/^INSERT INTO api_subscriptionowner/.test(q)) {
        const [fingerprint, user_id, expires_at, owner_email, owner_apple_id] = p;
        owners.set(fingerprint, { fingerprint, user_id, expires_at, owner_email, owner_apple_id });
        return [{}];
    }
    if (/^UPDATE api_subscriptionowner/.test(q)) {
        const [exp, fp] = p;
        const o = owners.get(fp);
        if (o) o.expires_at = exp;
        return [{}];
    }
    throw new Error("unexpected sql: " + q);
};

const { resolveSubscriptionOwner, ORPHANED_OWNER } =
    await import("../services/subscriptionService.js");

const FP = "pro_monthly|1700000000000";
const future = new Date(Date.now() + 4 * 86400000);
const reset = () => { users.clear(); owners.clear(); };

test("same account restore (not deleted) keeps ownership", async () => {
    reset();
    users.set(1, { email: "a@x.com", apple_user_id: "apple1" });
    assert.equal(await resolveSubscriptionOwner(1, FP, future), 1);
    assert.equal(await resolveSubscriptionOwner(1, FP, future), 1);
});

test("deleted + recreated same Apple ID reclaims (even if cancelled, 4 days left)", async () => {
    reset();
    users.set(1, { email: "a@x.com", apple_user_id: "apple1" });
    await resolveSubscriptionOwner(1, FP, future);
    users.delete(1);
    users.set(2, { email: "a@x.com", apple_user_id: "apple1" });
    assert.equal(await resolveSubscriptionOwner(2, FP, future), 2);
});

test("recreated with same email but new apple id reclaims", async () => {
    reset();
    users.set(1, { email: "A@x.com", apple_user_id: "apple1" });
    await resolveSubscriptionOwner(1, FP, future);
    users.delete(1);
    users.set(2, { email: "a@x.com", apple_user_id: null });
    assert.equal(await resolveSubscriptionOwner(2, FP, future), 2);
});

test("different person after deletion is refused", async () => {
    reset();
    users.set(1, { email: "a@x.com", apple_user_id: "apple1" });
    await resolveSubscriptionOwner(1, FP, future);
    users.delete(1);
    users.set(3, { email: "other@x.com", apple_user_id: "apple9" });
    assert.equal(await resolveSubscriptionOwner(3, FP, future), ORPHANED_OWNER);
});

test("live other account still blocks", async () => {
    reset();
    users.set(1, { email: "a@x.com", apple_user_id: "apple1" });
    users.set(4, { email: "b@x.com", apple_user_id: "apple4" });
    await resolveSubscriptionOwner(1, FP, future);
    assert.equal(await resolveSubscriptionOwner(4, FP, future), 1);
});
