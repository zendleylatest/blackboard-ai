# Flashcard API

All endpoints require `Authorization: Bearer <access-token>`. Successful
responses use:

```json
{
  "success": true,
  "message": "Operation completed successfully.",
  "data": {}
}
```

Validation failures return HTTP 400 with `success: false` and an `errors`
array. Other errors use the appropriate 4xx/5xx status and a `message`.

## Sets

### List a subject's sets

- Method: `GET`
- Endpoint: `/api/subjects/:subjectId/flashcard-sets/`
- Alias: `/api/subjects/:subjectId/flashcards/sets/`
- Rules: `subjectId` must be a positive integer; the user must be enrolled.

### Create a manual set

- Method: `POST`
- Endpoint: `/api/flashcard-sets/`
- Body:

```json
{
  "subject_id": 158,
  "title": "Mechanics",
  "topic": "Moments",
  "difficulty": "medium",
  "cards": [
    {
      "front": "What is a moment?",
      "back": "Force multiplied by perpendicular distance.",
      "difficulty": "medium"
    }
  ]
}
```

- Rules: `subject_id` is required; `cards` must be an array; difficulty is
  `easy`, `medium`, or `hard`.

### Get set details

- Method: `GET`
- Endpoint: `/api/flashcard-sets/:setId/`
- Alias: `/api/flashcards/sets/:setId/`
- Rules: `setId` must be a UUID and the set must belong to the user.

### Delete a set

- Method: `DELETE`
- Endpoint: `/api/flashcard-sets/:setId/delete/`
- Alias: `/api/flashcards/sets/:setId/delete/`

## AI generation

- Method: `POST`
- Endpoint: `/api/ai/flashcards/`
- Body:

```json
{
  "subject_id": 158,
  "topic": "Electricity",
  "prompt": "Focus on circuit calculations",
  "count": 10,
  "difficulty": "hard"
}
```

- Rules: `count` is 1–30; `OPENAI_API_KEY` must be configured.

## Study sessions

### Start

- Method: `POST`
- Endpoint: `/api/flashcard-sets/:setId/study/start/`
- Alias: `/api/flashcards/sets/:setId/study/start/`

### Record a review

- Method: `POST`
- Endpoint: `/api/flashcard-sets/:setId/study/review/`
- Alias: `/api/flashcards/sets/:setId/study/review/`
- Body:

```json
{
  "session_id": 12,
  "card_id": 45,
  "result": "easy"
}
```

### Complete

- Method: `POST`
- Endpoint: `/api/flashcard-sets/:setId/study/complete/`
- Alias: `/api/flashcards/sets/:setId/study/complete/`
- Body:

```json
{
  "session_id": 12,
  "duration_sec": 95
}
```

## Performance

### History

- Method: `GET`
- Endpoint: `/api/flashcard-sets/:setId/performance-history/`

### Wrong cards from a session

- Method: `GET`
- Endpoint:
  `/api/flashcard-sets/:setId/sessions/:sessionId/wrong-cards/`
