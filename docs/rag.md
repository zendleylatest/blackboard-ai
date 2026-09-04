# RAG API

These endpoints preserve the Python RAG contract and are mounted under
`/api`. Retrieval intentionally returns the raw `{ fused, debug }` object
because it is consumed by AI services.

## Health check

- Method: `GET`
- Endpoint: `/api/rag/test/`
- Authentication: none

## Retrieve context

- Method: `POST`
- Endpoint: `/api/rag/retrieve/`
- Authentication: none, matching the Python service
- Body:

```json
{
  "subject_code": "9702",
  "query": "moments of force",
  "modes": ["text"],
  "filters": {
    "doctype": ["syllabus", "past_paper"]
  },
  "k_text": 12,
  "max_context_tokens": 2400,
  "recency_boost": true,
  "recent_first": true
}
```

The vector path uses Pinecone and the MiniLM embedding model when
`PINECONE_API_KEY` is configured. Without vector configuration, Node uses a
ranked MySQL `api_ragchunk` fallback so local development and AI service
integration remain available.
