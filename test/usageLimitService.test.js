import test from "node:test";
import assert from "node:assert/strict";

import {
    limitsForTier,
    nextFriday,
    shouldResetUsage,
    WEEKLY_USAGE_COLUMNS,
} from "../services/usageLimitService.js";

test("all enforced plan limits match the published backend policy", () => {
    assert.deepEqual(limitsForTier("free"), {
        flashcard_sets: 3,
        quizzes: 3,
        ai_checker: 5,
        past_paper_questions: 5,
        study_sessions: 2,
        chat_messages: 15,
        mcq_wrong_reviews: 2,
        answer_revisions_per_question: 2,
        followup_messages_per_question: 3,
    });
    assert.deepEqual(limitsForTier("plus"), {
        flashcard_sets: 15,
        quizzes: 15,
        ai_checker: 30,
        past_paper_questions: 30,
        study_sessions: 10,
        chat_messages: 100,
        mcq_wrong_reviews: 10,
        answer_revisions_per_question: 3,
        followup_messages_per_question: 5,
    });
    assert.ok(
        Object.values(limitsForTier("pro")).every((limit) => limit === 999999)
    );
});

test("weekly reset boundary is the next Friday", () => {
    assert.equal(nextFriday(new Date(2026, 8, 3)), "2026-09-04");
    assert.equal(nextFriday(new Date(2026, 8, 4)), "2026-09-11");
    assert.equal(nextFriday(new Date(2026, 8, 5)), "2026-09-11");
});

test("usage resets at the Friday boundary and not before it", () => {
    const friday = new Date(2026, 8, 4, 12);
    assert.equal(shouldResetUsage("2026-09-04", friday), true);
    assert.equal(shouldResetUsage("2026-09-11", friday), false);
    assert.equal(shouldResetUsage(null, friday), true);
});

test("every weekly usage counter participates in the reset", () => {
    assert.deepEqual([...WEEKLY_USAGE_COLUMNS].sort(), [
        "ai_checker_uses",
        "chat_messages_sent",
        "flashcard_sets_created",
        "mcq_wrong_reviews_used",
        "past_paper_questions_used",
        "quizzes_created",
        "study_sessions_created",
    ]);
});
