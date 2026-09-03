# Test Cases Document (D1)
This document outlines the core test scenarios designed to validate the robust functioning of the backend APIs.

## 1. POST `/api/enquiry/` - Valid Request
- **Objective:** Verify that the backend successfully processes a valid JSON payload and creates a new Enquiry record.
- **Input:** Valid JSON containing `name`, `phone_no`, `vehicle_name`, `enquiry_status`.
- **Expected Output:** `201 Created` with the JSON representation of the created record.

## 2. POST `/api/enquiry/` - Missing Required Fields
- **Objective:** Ensure the API properly validates and rejects requests missing mandatory primary/identifying fields (like `name` which acts as primary key).
- **Input:** Valid JSON but omitting the `name` field.
- **Expected Output:** `400 Bad Request` with an error message indicating the missing field.

## 3. POST `/api/enquiry/` - Invalid Field Format (Constraints Check)
- **Objective:** Verify that the API strictly enforces field constraints (e.g., maximum length of phone number).
- **Input:** JSON payload where `phone_no` is an excessively long string (e.g., 20+ characters where the max is 10).
- **Expected Output:** `400 Bad Request` citing a maximum length validation error.

## 4. POST `/api/enquiry/` - Empty Request Body
- **Objective:** Verify server stability; an empty payload should not crash the server but trigger a clean validation error.
- **Input:** `{}`
- **Expected Output:** `400 Bad Request`.

## 5. POST `/api/enquiry/` - Wrong Data Types
- **Objective:** Ensure numeric fields (like decimal fields `down_payment`) reject string or unrelated data types.
- **Input:** JSON where `down_payment` = "Not A Number".
- **Expected Output:** `400 Bad Request`.

## 6. GET `/api/enquiry/` - When No Data Exists
- **Objective:** Test dataset extraction when the database is empty.
- **Input:** GET request to `/api/enquiry/` on an empty DB.
- **Expected Output:** `200 OK` with an empty array `[]`.

## 7. GET `/api/enquiry/` - After Multiple Inserts
- **Objective:** Verify data consistency and retrieval structure after insertions.
- **Pre-condition:** Create 2 records using POST or ORM.
- **Input:** GET request to `/api/enquiry/`
- **Expected Output:** `200 OK` with JSON array length matching the inserted records.

*(Repeated edge case structure logic applies to `/api/customer/`, `/api/appointment/`, and `/api/feedback/` endpoints.)*
