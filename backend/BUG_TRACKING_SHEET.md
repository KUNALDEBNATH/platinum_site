# Bug Tracking & QA Execution Log (D1/D2)

The execution of automated API tests yielded safe results across the board. The Django REST Framework properly handled invalid payloads by returning safe HTTP 400 errors instead of crashing the server (HTTP 500).

| Test Case ID | API Endpoint | Input Data | Expected Output | Actual Output | Status | Severity | Remarks |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-01 | `POST /api/enquiry/` | `{ "name": "ENQ-API-001", "phone_no": "9999999999", "vehicle_name": "R15" }` | 201 Created | 201 Created | ✅ Pass | None | Valid data processed safely. |
| TC-02 | `POST /api/enquiry/` | `{ "phone_no": "9999999999", "vehicle_name": "Yamaha" }` (Missing Primary Key) | 400 Bad Request | 400 Bad Request | ✅ Pass | None | DRF appropriately rejected missing `name` field. |
| TC-03 | `POST /api/enquiry/` | `{ "name": "ENQ-API-002", "phone_no": "12345678901234567890" }` | 400 Bad Request (Validation Error) | 400 Bad Request | ✅ Pass | None | Strict max-length enforcement passed. |
| TC-04 | `POST /api/enquiry/` | `{}` (Empty JSON) | 400 Bad Request | 400 Bad Request | ✅ Pass | None | Application survived blank input. |
| TC-05 | `POST /api/enquiry/` | `{ "name": "ENQ-API-003", "down_payment": "Not a Number" }` | 400 Bad Request | 400 Bad Request | ✅ Pass | None | Model safely blocked string in a decimal field. |
| TC-06 | `GET /api/enquiry/` | None (Empty DB Fetch) | `200 OK`, `[]` | `200 OK`, `[]` | ✅ Pass | None | Array format confirmed on empty DB. |
| TC-07 | `GET /api/enquiry/` | Inserted 2 rows manually | `200 OK`, length = 2 | `200 OK`, length = 2 | ✅ Pass | None | Fetch reflects latest database records accurately. |

> **Conclusion**: The backend is highly stable against Edge Cases and Invalid API inputs. Zero critical failure points (Server 500 errors) discovered during API testing sweep. Backend is robust and Ready for Frontend Integration.
