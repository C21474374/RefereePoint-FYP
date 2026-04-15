# RefereePoint API Documentation

## 1. Overview
This document describes the current API surface of the RefereePoint backend.

- Framework: Django + Django REST Framework
- Auth: JWT (`rest_framework_simplejwt`)
- Base URL (local): `http://localhost:8000`
- API prefix: `/api/...`

## 2. Authentication
### 2.1 Token Endpoints
- `POST /api/token/`  
  Returns JWT access/refresh tokens for valid credentials.
- `POST /api/token/refresh/`  
  Refreshes access token.
- `POST /api/token/verify/`  
  Verifies token validity.

Important behavior:
- Non-admin accounts cannot log in until `doa_approved=True`.

### 2.2 Auth Header
For protected endpoints:

```http
Authorization: Bearer <access_token>
```

## 3. Response Conventions
- Success responses typically return JSON payloads.
- Validation/permission errors usually return:
  - `{"detail": "..."}`
  - or `{"error": "..."}`
- Common HTTP status codes:
  - `200 OK`
  - `201 Created`
  - `204 No Content`
  - `400 Bad Request`
  - `401 Unauthorized`
  - `403 Forbidden`
  - `404 Not Found`

## 4. Endpoint Reference

## 4.1 Users (`/api/users/`)
- `POST /api/users/register/`  
  Register new account.
- `GET /api/users/me/`  
  Get current user profile.
- `PATCH /api/users/me/`  
  Update current user details.
- `PATCH /api/users/me/home/`  
  Update home address/coordinates.
- `GET /api/users/me/appointed-availability/`  
  Get referee appointed availability (current + pending).
- `PUT /api/users/me/appointed-availability/`  
  Queue or apply appointed availability updates.
- `PATCH /api/users/me/testing-role/`  
  Debug-only role switch endpoint (DEBUG mode).
- `GET /api/users/referees/`  
  List referees.  
  Optional query: `game_date=YYYY-MM-DD&game_time=HH:MM`
- `GET /api/users/referees/{referee_id}/`  
  Referee details.
- `GET /api/users/approvals/pending/`  
  Pending account approvals (DOA/NL admin scope).
- `PATCH /api/users/approvals/{user_id}/`  
  Approve account.
- `DELETE /api/users/approvals/{user_id}/`  
  Disapprove account (removes pending registration record).
- `GET /api/users/`  
  User list endpoint (internal/admin usage).

## 4.2 Clubs & Configure (`/api/clubs/`)
Public/reference data:
- `GET /api/clubs/`
- `GET /api/clubs/{club_id}/`
- `GET /api/clubs/divisions/`  
  Optional query: `include_inactive=true|false`
- `GET /api/clubs/divisions/{division_id}/`
- `GET /api/clubs/teams/`  
  Optional query: `club_id`, `division_id`, `include_inactive`
- `GET /api/clubs/teams/{team_id}/`

Configure endpoints (DOA/NL admin scope):
- `GET /api/clubs/configure/bootstrap/`
- `POST /api/clubs/configure/divisions/`
- `PATCH /api/clubs/configure/divisions/{division_id}/`
- `POST /api/clubs/configure/teams/`
- `PATCH /api/clubs/configure/teams/{team_id}/`

## 4.3 Venues (`/api/venues/`)
Note: paths are currently namespaced twice by design in routing:

- `GET /api/venues/venues/`
- `GET /api/venues/venues/{venue_id}/`
- `GET /api/venues/venues/search/?name=<text>`
- `GET /api/venues/venues/nearby/?lat=<float>&lon=<float>&radius_km=<float>`
- `POST /api/venues/venues/create/`
- `PUT /api/venues/venues/{venue_id}/update/`
- `DELETE /api/venues/venues/{venue_id}/delete/`

## 4.4 Games (`/api/games/`)
Games and assignments:
- `GET /api/games/`  
  Optional filters: `game_type`, `division`, `date`, `venue`, `status`, `payment_type`
- `GET /api/games/{id}/`
- `GET /api/games/assignments/`  
  Optional filters: `game_id`, `referee_id`, `role`

Non-appointed slots:
- `GET /api/games/non-appointed-slots/`  
  Optional filters: `game_id`, `venue`, `role`, `status`, `is_active`, `date`, `game_type`
- `GET /api/games/non-appointed-slots/{id}/`
- `POST /api/games/non-appointed-slots/{id}/claim/`
- `POST /api/games/non-appointed-slots/{id}/cancel-claim/`  
  Rule: cancellation allowed only more than 3 hours before game start.

Uploads and management:
- `POST /api/games/upload/`
- `GET /api/games/my-uploads/`
- `PATCH /api/games/my-uploads/{id}/update/`
- `DELETE /api/games/my-uploads/{id}/delete/`
- `GET /api/games/upload/check/`  
  Required query: `home_team`, `away_team`, `venue`, `date`, `time`, `game_type`

Opportunity and personal feeds:
- `GET /api/games/opportunities/`
- `GET /api/games/my-games/`

Utility:
- `GET /api/games/csrf/`

## 4.5 Cover Requests (`/api/cover-requests/`)
- `GET /api/cover-requests/`
- `GET /api/cover-requests/{id}/`
- `POST /api/cover-requests/create/`
- `DELETE /api/cover-requests/{id}/cancel/`
- `GET /api/cover-requests/my/`
- `GET /api/cover-requests/pending/`
- `POST /api/cover-requests/{id}/offer/`
- `POST /api/cover-requests/{id}/withdraw/`
- `POST /api/cover-requests/{id}/approve/`
- `GET /api/cover-requests/my-upcoming-assignments/`

## 4.6 Events (`/api/events/`)
- `GET /api/events/`  
  Optional query: `upcoming`, `venue`, `event_type`, `joined`
- `GET /api/events/{id}/`
- `POST /api/events/create/`
- `PATCH /api/events/{id}/update/`
- `PUT /api/events/{id}/update/`
- `DELETE /api/events/{id}/delete/`
- `POST /api/events/{id}/join/`
- `POST /api/events/{id}/leave/`

## 4.7 Reports (`/api/reports/`)
- `GET /api/reports/reportable-games/`
- `POST /api/reports/create/`
- `GET /api/reports/my/`
- `GET /api/reports/admin/`  
  Optional query: `status=PENDING|REVIEWED|RESOLVED`

## 4.8 Expenses / Earnings (`/api/expenses/`)
- `GET /api/expenses/earnings/`  
  Query:
  - `period=month` (required mode)
  - `game_type=DOA|NL`
  - `year=<YYYY>`
  - `month=<1-12>`

## 4.9 Recommendations (`/api/recommendations/`)
- `GET /api/recommendations/opportunities/`  
  Returns ranked opportunities with recommendation scores/reasons (referee accounts).

## 4.10 Notifications (`/api/notifications/`)
- `GET /api/notifications/`  
  Optional query: `limit`
- `GET /api/notifications/recent/`  
  Optional query: `limit`
- `POST /api/notifications/mark-all-read/`
- `POST /api/notifications/{id}/read/`

## 5. Example Requests

### 5.1 Login
```http
POST /api/token/
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your_password"
}
```

### 5.2 Get Current User
```http
GET /api/users/me/
Authorization: Bearer <access_token>
```

### 5.3 Referee Opportunities
```http
GET /api/recommendations/opportunities/
Authorization: Bearer <access_token>
```

### 5.4 Create Cover Request
```http
POST /api/cover-requests/create/
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "game": 123,
  "referee_slot": 456,
  "reason": "Unavailable due to work commitment"
}
```

## 6. Notes for Frontend Integration
- Use `/api/users/me/` after login to drive role-based UI rendering.
- Prefer recommendation feed endpoint for referee opportunities:
  - `/api/recommendations/opportunities/`
- Keep token refresh flow active using `/api/token/refresh/`.
- For debug role switching, only use `/api/users/me/testing-role/` in development.

