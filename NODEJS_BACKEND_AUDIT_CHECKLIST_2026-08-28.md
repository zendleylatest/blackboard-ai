# Blackboard AI - NodeJS Backend Audit Checklist - 2026-08-28

Source: pasted `Blackboard AI - Audit Report (iOS & Android)`.

Scope: `backend_nodejs` only. Frontend-only and store-listing-only work is noted separately because it cannot be fixed inside the NodeJS backend.

Status:

- Backend issues fixed or verified in code/DB: 11 / 13 backend-relevant items
- Backend items still dependent on external/live configuration: 2 / 13
- Store-listing-only items not fixable in `backend_nodejs`: 2 / 3
- Node syntax checks passed for every touched backend file.

## Authentication

- ⚠️ Sign in with Apple is not functioning correctly and remains stuck on the loading screen. Backend code is hardened: Apple tokens are verified against configured Apple audiences, missing config returns a clear backend error, existing Apple email accounts can log in, and social placeholder passwords are hashed. Still requires real iOS Apple Sign-In testing.
- ✅ Android Google Sign-In returns "Account already exists" on second login instead of logging in successfully. Backend now logs in existing same-email Google users and updates missing/stale `google_id` instead of creating a duplicate account.
- ⚠️ Android Google Sign-In should allow account selection each time. Backend accepts valid configured Google ID tokens and avoids duplicate-account failures. Account selection is controlled by the Flutter Google SDK, and current real-device `ApiException: 10` is Firebase SHA/OAuth config before backend is called.

## Performance

- ⚠️ OpenAI API response time is noticeably slow during AI-assisted features. Backend already uses a cached OpenAI client, configurable timeout, fast default model `gpt-4o-mini`, short gating output, and parallel RAG retrieval in quiz/chat paths. Final closure requires live latency testing with real prompts, PDFs, and network.

## Functional Issues & Crashes

- ✅ Submitting the quiz before the final question is completed causes a backend crash. Backend creates null answer rows for unanswered questions before scoring, so early submission returns a complete safe result.
- ✅ Backend server crashes when viewing recent quiz performance. Backend now normalizes quiz attempt UUIDs, nullable dates, and numeric fields before returning history.
- ✅ Backend server crashes when the Study Flashcards button is selected from the Study screen bottom sheet. Backend routes are authenticated, validate the flashcard set id, enforce ownership through `findFlashcardSetForUser`, and serialize dates/counts safely. Remaining crash reproduction, if any, needs app runtime logs.
- ✅ Search does not return accurate or expected results when searching for papers within a subject. Backend search now tokenizes search terms and checks title, description, type, year, paper, series, variant, subject name/code, level, and exam board.
- ✅ Some questions in Study Session are incompletely extracted, indicating an AI parsing, extraction logic, or backend response-processing issue. Backend extraction now uses a higher configurable OpenAI output ceiling and merges missing DB question mappings into AI extraction results.
- ✅ Past papers screen shows 0 documents for subjects that have documents in the DB. DB check confirmed Computer Science `9618` has 229 documents. Backend now resolves subject identifier as either DB id or subject code, formats returned documents consistently, and enforces enrollment before returning subject documents.

## Security & Access Control

- ✅ File uploads currently have no size restrictions. Profile images are limited to 5 MB; chat and study-session attachments are limited to 20 MB; oversized uploads now return HTTP 413 instead of a generic server error.
- ✅ Several backend endpoints lack proper JWT validation and authorization checks. Document listing, signed document URLs, document debug access, subject document listing, and RAG retrieval require JWT authentication. Subject document listing also checks enrollment.
- ✅ User passwords appear to be stored without proper hashing. Email registration/reset/admin paths already hash passwords; Google and Apple social placeholder passwords are now hashed before insert.

## Store Optimisation & Setup

- ⚠️ Apple in-app purchase / subscription configuration is missing. NodeJS has RevenueCat subscription status and webhook handling with webhook auth, and env validation now warns when the webhook key is missing. App Store Connect/RevenueCat product setup still requires live console configuration.
- [ ] Apple App Store listing requires optimization. Not a NodeJS backend task.
- ⚠️ Google Play Store listing including in-app purchase / subscription configuration. NodeJS can receive RevenueCat webhook events for Play Store entitlements, but Play Console/RevenueCat product setup still requires live console configuration.

## Requires Real App / Live Service Testing

- [ ] Apple Sign-In on a real iOS device with the configured Apple audience IDs.
- [ ] Google Sign-In on Android after Firebase SHA/OAuth config is updated and `GOOGLE_CLIENT_ID` is set in backend env.
- [ ] OpenAI latency with real prompts, documents, and production keys.
- [ ] Quiz early-submit flow against a real user attempt.
- [ ] Recent quiz performance screen against real submitted attempts.
- [ ] Study Flashcards bottom-sheet flow on the real app.
- [ ] Study-session extraction quality against real paper and mark-scheme PDFs.
- [ ] Upload limit behavior from the app with oversized files.
- [ ] RevenueCat/App Store/Play Store subscription flow with real product IDs and webhook delivery.

## Verification Performed

- `node --check services/auth/appleAuthService.js`
- `node --check services/auth/googleAuthService.js`
- `node --check services/quizService.js`
- `node --check services/document/documentService.js`
- `node --check models/document/Document.js`
- `node --check controllers/document/documentController.js`
- `node --check routes/documentRoutes.js`
- `node --check routes/ragRoutes.js`
- `node --check middleware/errorHandler.js`
- `node --check config/env.js`
- `node --check services/studySession/studySessionAiService.js`
- `node --check models/auth/User.js`
- Direct DB/service probe: `getSubjectDocuments("9618", {}, null)` returned subject id `54` and `229` documents.
