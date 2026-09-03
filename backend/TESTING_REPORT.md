# Testing Report

Date: 2026-05-26

## Scope

- Django API unit and integration tests with `pytest`.
- Postman collection automation with Newman.
- Chatbot API accessibility and response contract.
- Chatbot-to-CRM workflow using a record created during the same Postman run.
- CRM create/list endpoints for enquiries, appointments, and feedback.
- Director chatbot UI compatibility through API response fields: `answer`, `intent`, and `elapsed`.

## Changes Made For Testability

- Added Newman as a local backend dev dependency.
- Added `npm run test:postman` for repeatable Postman collection runs.
- Added Postman assertions for status codes, auth tokens, chatbot response shape, list endpoints, and create endpoint IDs.
- Added a Postman workflow assertion that creates an enquiry and verifies the chatbot can answer with that generated enquiry data.
- Added generated Postman IDs so collection runs can be repeated without duplicate ID collisions.
- Added chatbot cache reset after enquiry, appointment, or feedback creation so the chatbot rebuilds from current CRM data.
- Made LLM rephrasing opt-in with `ENABLE_LLM_REPHRASING=true`; default API testing uses fast structured RAG responses.
- Added a regression test proving the chatbot sees an enquiry created after chatbot initialization.

## Verification Results

### Pytest

Command:

```bash
cd backend
python -m pytest -q
```

Result:

```text
14 passed
```

### Postman / Newman

Commands:

```bash
cd backend
python manage.py migrate --noinput
python create_test_users.py
python manage.py runserver 127.0.0.1:8000
npm run test:postman
```

Result:

```text
requests: 13 executed, 0 failed
assertions: 40 executed, 0 failed
total run duration: 3.3s
average response time: 173ms
```

## Covered Endpoints

- `POST /api/token/`
- `POST /api/token/refresh/`
- `GET /api/health/`
- `GET /api/suggestions/`
- `POST /api/reset/`
- `POST /api/chat/`
- `GET /api/enquiry/`
- `POST /api/enquiry/create/`
- `GET /api/appointment/`
- `POST /api/appointment/create/`
- `GET /api/feedback/`
- `POST /api/feedback/create/`
- `POST /api/chat/` final CRM-created-record workflow check

## Notes

- `postman-results.json` is generated locally by Newman and ignored by git.
- Browser UI automation is not added; UI compatibility is verified through the director page API contract and chatbot render fields.
