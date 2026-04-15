# RefereePoint Project Overview

## 1. Purpose
RefereePoint is a basketball operations platform built as a Final Year Project.  
Its goal is to centralize referee workflows and organiser workflows in one system, so match assignments, cover requests, event coordination, reports, and earnings are easier to manage.

In practical terms, the project reduces manual communication and fragmented spreadsheets by giving each user role the right tools in one place.

## 2. Who The System Serves
RefereePoint supports multiple account types:

- Referee
- Club
- School
- College
- DOA (Dublin Officials Association)
- NL (National League)

Each role sees different pages and actions based on permissions.  
For example, referees focus on opportunities, cover requests, reports, and earnings, while organiser/admin roles focus on uploading games/events, approvals, and operational management.

## 3. Core Functional Areas
### Opportunity Management
- Referees can view available opportunities (non-appointed games, cover requests, and events).
- Referees can claim opportunities, with business-rule checks applied.
- A recommendation feed ranks opportunities and explains why they are suggested.

### Cover Request Workflow
- Assigned referees can request cover for appointed games.
- Other referees can claim open requests.
- DOA/NL admin roles can approve claimed cover requests.
- Status lifecycle supports pending, claimed, approved, and rejected outcomes.

### Game and Event Operations
- Organiser/admin roles can upload and manage games/events with role-based constraints.
- DOA/NL workflows include spreadsheet-style management for bulk assignment operations.
- Events support multiple referees joining/leaving.

### Reports
- Referees can submit post-game reports for games they officiated.
- Submission is limited to a 7-day window after game date.
- Admin roles can review report queues and status.

### Earnings and Expenses
- Appointed-game claims are calculated monthly.
- DOA and NL earnings are tracked separately.
- Travel logic includes mileage/public transport rules and back-to-back same-venue handling.
- Monthly snapshots are stored for later review.

### Notifications
- In-app notification model supports role-specific operational alerts:
  - cover request status updates
  - assignment activity
  - account approval actions
  - reminders and admin workflow signals

## 4. Technical Architecture
### Backend
- Django + Django REST Framework
- JWT authentication (`rest_framework_simplejwt`)
- PostgreSQL as primary data store
- Role-aware API access and workflow validation

Main Django apps currently include:
- `users`, `games`, `cover_requests`, `events`, `reports`, `expenses`
- `notifications`, `recommendations`
- `clubs`, `schools`, `college`, `venues`

### Frontend
- React + TypeScript + Vite
- Role-based navigation and protected page access
- Shared UI system for cards, modals, sections, and action patterns
- Map-based venue context and game detail modals for quick decisions

## 5. Security and Access Design
The project uses both backend and frontend controls:

- Authentication via JWT
- Role-based navigation and route restrictions
- API-side permission and business-rule checks (source of truth)
- Account approval gating before upload permissions are enabled

This dual-layer approach improves UX and also prevents unauthorised actions server-side.

## 6. Business Rules Implemented
Examples of rules currently enforced:

- Intro referees cannot be assigned or claim Crew Chief where restricted
- Cover requests cannot remain active for past games
- Report submission allowed only for refereed games within 7 days
- Upload game/event types are constrained by account role and approval status
- Appointed-game availability is treated separately from open opportunities

## 7. Project Positioning
This system is built to demonstrate:

- multi-role product design
- real workflow modelling
- role-based security implementation
- practical full-stack delivery under real constraints

It is designed as a strong academic prototype with production-style architecture patterns.

## 8. Next Development Opportunities
Recommended extension areas:

- deeper notification channels (email/push/websocket)
- advanced scheduling constraints for DOA/NL assignment tooling
- richer analytics dashboards by role
- deployment hardening and observability for production readiness

