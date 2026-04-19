# RefereePoint

RefereePoint is a final-year project that manages basketball referee operations across multiple roles (Referee, Club, School, College, DOA, NL).
It combines assignments, cover requests, events, reports, earnings, approvals, recommendations, notifications, and map-based opportunity discovery in one platform.

## Core Features
- Role-based authentication and route/API access control
- Opportunities feed for referees (games, cover requests, events)
- Cover request lifecycle (request, claim, admin approval)
- Event management with multi-referee participation
- Referee reporting window (7-day rule)
- Monthly earnings and expenses logic (DOA/NL separation)
- In-app notifications by role
- Recommendation engine for opportunity ranking
- Leaflet map plus venue grouping
- PWA support (installable app plus themed install prompt)

## Tech Stack
- Backend: Django 6, Django REST Framework, JWT (`simplejwt`)
- Frontend: React, TypeScript, Vite
- Database: PostgreSQL (PostGIS image used in local Docker)
- Static/prod middleware: WhiteNoise
- Deployment: Render (frontend static site, backend web service, managed Postgres)

## Project Structure
```text
.
|- refereepoint/             # Django project settings
|- users/ games/ events/... # Django apps
|- ReactFrontend/            # Vite React frontend
|- deploy/render/            # Render env templates plus deployment helpers
|- API_DOCUMENTATION.md
|- PROJECT_OVERVIEW.md
`- docker-compose.yml
```

## Local Setup
### 1. Backend (Django)
From repo root:

```powershell
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create `.env` (or copy from `.env.example`) and set local values.

### 2. Database (Docker)
```powershell
docker compose up -d
```

This starts local Postgres/PostGIS on `localhost:5433` using `docker-compose.yml`.

### 3. Run migrations and backend
```powershell
python manage.py migrate
python manage.py runserver
```

Backend runs at `http://localhost:8000`.

### 4. Frontend
In a new terminal:

```powershell
cd ReactFrontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

Use `ReactFrontend/.env.example` as reference for frontend env keys (`VITE_API_BASE_URL`, etc.).

## Deployment (Render)
Production is deployed with:
- `refereepoint-web` (static frontend)
- `refereepoint-api` (Django API)
- Render managed Postgres

Key deployment notes:
- Frontend publish directory: `dist`
- Backend start command:
  `python manage.py migrate && gunicorn refereepoint.wsgi:application --bind 0.0.0.0:$PORT`
- Add SPA rewrite rule on frontend service:
  `/* -> /index.html`
- Use templates in `deploy/render/`:
  - `api.env.template`
  - `web.env.template`

## Documentation
- Project overview: [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)
- API reference: [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
- Technical summary: [RefereePoint API - Technical Summary.md](RefereePoint%20API%20%E2%80%94%20Technical%20Summary.md)

