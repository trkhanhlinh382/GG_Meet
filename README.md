# GG Meet

Meeting Management and Collaboration Platform built with:
- ReactJS + Vite + Ant Design
- NodeJS + ExpressJS + Socket.IO
- MongoDB + Mongoose

## 1) Run locally

### Prerequisites
- Node.js 20+
- Docker (optional, for MongoDB)

### Start MongoDB
```bash
docker compose up -d mongodb
```

### Configure server env
```bash
cp server/.env.example server/.env
```

### Configure client env
```bash
cp client/.env.example client/.env
```

### Install dependencies
```bash
npm install
```

### Run frontend + backend
```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:4000/api
- Health check: http://localhost:4000/api/health

Google OAuth2 setup:
- Create OAuth Client ID (Web application) in Google Cloud Console.
- Add Authorized JavaScript origins: http://localhost:5173
- Put the same client id into both files:
	- server/.env => GOOGLE_CLIENT_ID
	- client/.env => VITE_GOOGLE_CLIENT_ID

## 2) API endpoints (SRS baseline)

Authentication
- POST /api/auth/google

Dashboard
- GET /api/dashboard

Meetings
- POST /api/meetings
- GET /api/meetings/:id
- POST /api/meetings/:id/join
- POST /api/meetings/:id/invite

Invitations
- POST /api/invitations/:id/accept
- POST /api/invitations/:id/reject
- POST /api/invitations/:id/maybe

Tasks
- POST /api/tasks

## 3) Implemented modules

- Google OAuth2 real login (Google ID token verified at backend)
- Personal dashboard layout (upcoming meetings, notifications, tasks)
- Meeting scheduling with conflict detection
- Invitation workflow (accept/reject/maybe)
- Task creation after meeting
- Calendar module with day/week/month views and conflict markers
- Reminder scheduler jobs (1 day, 1 hour, 15 minutes, at start) writing to notification center
- Realtime meeting module with:
	- WebRTC signaling (offer/answer/ICE via Socket.IO)
	- Waiting room approval/reject flow
	- Host controls: lock/unlock room, remove participant, assign co-host, end meeting
	- Realtime chat + participant mic/camera state sync + screen sharing track switch

## 4) Current architecture

client/
- React app with routes: Login, Dashboard, Meeting Room
- Ant Design-based UI and API integration with Axios

server/
- Express API with modular routes
- MongoDB models: User, Meeting, Invitation, Notification, Task
- JWT auth middleware
- Socket.IO for realtime room and chat events

## 5) Next phases to reach full SRS

- Real Google OAuth2 flow (replace dev mock form)
- Calendar month/week/day and reminder workers
- Recording pipeline + cloud storage playback
- Organization workspace with RBAC by department/team
- Enterprise security options (MFA, SSO, SAML, LDAP, IP restriction)
- AI modules (transcript, summary, semantic search, scheduling assistant)
