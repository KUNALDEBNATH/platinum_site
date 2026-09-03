# API Documentation

This file documents the available endpoints for the Salesforce application. 

## Endpoints

Once the server is running, the core API base URL is:
- `http://127.0.0.1:8000/api/`

Check `sales/urls.py` for exact endpoint definitions, which generally include:
- `/api/enquiry/` - For handling Customer Inquiries.
- `/api/appointment/` - For handling Appointment Bookings.
- `/api/feedback/` - For recording User Feedback.

*(Note: Once the frontend connects to the backend, these endpoints are what the JavaScript `fetch()` calls will hit.)*
