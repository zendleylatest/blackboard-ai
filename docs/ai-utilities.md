# Shared AI Utilities

The Python `ai/openai_client.py`, `ai/utils/llm_helpers.py`, and
`ai/utils/chat_payloads.py` equivalents are now available under
`blackboardai/utils/ai/`.

- `openaiClient.js`: shared OpenAI SDK client, model selection, and vector-store
  API compatibility.
- `llmHelpers.js`: tool-call extraction, JSON repair, generation deadlines,
  RAG context compression, title sanitization, content hashing, source
  assignment, source metadata extraction, and prompt formatting.
- `chatPayloads.js`: safe conversion of chat answers, chunk IDs, and source
  metadata.

Feature services should import these helpers instead of implementing their own
OpenAI or source-processing logic.
