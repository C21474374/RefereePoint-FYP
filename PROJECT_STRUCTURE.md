# Project Structure Guide

This project uses a Django backend with a React frontend.

## Backend (Django)

- `refereepoint/`
  - Django project configuration (`settings.py`, `urls.py`, `wsgi.py`, `asgi.py`).
- Domain apps:
  - `users/` authentication, profiles, role access, availability.
  - `games/` game models, uploads, opportunities, assignments.
  - `cover_requests/` cover request lifecycle.
  - `events/` tournament-style events.
  - `reports/` referee report workflows.
  - `expenses/` earnings and monthly snapshots.
  - `notifications/` in-app notifications.
  - `recommendations/` opportunity scoring and recommendation logic.
  - `clubs/`, `schools/`, `college/`, `venues/` reference/config data.

## Frontend (React + Vite)

- `Django+ReactFrontend/src/`
  - `pages/` route-level screens with co-located page CSS.
  - `components/` reusable UI components.
  - `context/` app-wide providers (auth, theme, toast).
  - `services/` API clients by domain.
  - `utils/` route/access helpers.

## Frontend Organization Conventions

- Keep route files in `pages/`.
- Keep page styles next to the page file (e.g., `pages/Games.tsx` + `pages/Games.css`).
- Keep reusable component styles next to component files.
- Keep API calls in `services/`, not inside components/pages.
- Add concise comments only for non-obvious logic (avoid redundant comments).

## Notes

- Testing role switch can be enabled by:
  - `.env` flag: `VITE_ENABLE_TESTING_ROLE_SWITCH=true`, or
  - Account Settings > Developer Controls (browser-local toggle).

