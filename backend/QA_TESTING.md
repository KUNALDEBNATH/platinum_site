# Quality Assurance & Testing

This document tracks the tasks and guidelines for QA Testing (B4 Requirements).

## Testing Strategy
1. **Automated API & Unit Testing (Pytest)**: We use `pytest` and `pytest-django` to automatically validate Edge Cases and Database logic. Run `pytest -v` inside the `backend` directory to execute all tests in bulk. All code must pass before merging.
2. **Integration Testing**: APIs should be tested end-to-end linking via Frontend forms to ensure the database correctly records and updates models (Customer Inquiries, Appointments, Feedback).

## Bug Tracking Process
- Report all bugs in the project issue tracker (GitHub Issues or designated Bug Tracking Sheet).
- Required fields for bugs:
  - Steps to reproduce
  - Expected behavior vs Actual behavior
  - API response code and traceback logs (if any).
  
## D1 & D2 Tasks
- **D1 (Bug Tracking & Test Cases)**: Test cases must cover the creation, retrieval, and validation of all models. An external Bug Tracking Sheet will be used to log failures.
- **D2 (Environment & API Testing)**: Ensure local environment is booted properly. Perform manual testing on all exposed endpoints using valid and invalid payloads to record failure states. 
- **QA Sign-off**: QA must sign off on feature branches before deployment.
