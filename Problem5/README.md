### Problem 5 
### Express + TypeScript + Sequelize + Zod CRUD API (SQLite)

This project is a simple CRUD backend built with:
- ExpressJS (HTTP server)
- TypeScript
- Sequelize (ORM)
- SQLite (file-based persistence)
- Zod (runtime request validation)

#### Requirements
- Node.js 18+ (or 20+ recommended)
- npm

### Setup

1) Install dependencies:
npm install

2) Configure environment:
Copy `.env.example` to `.env` and adjust if needed.

.env example:
PORT=3000
DB_STORAGE=./data.sqlite
DB_LOGGING=false

### Run

Development (auto-reload):
npm run dev

Production:
npm run build
npm run start

Server runs at:
http://localhost:3000

### API

Base path: /resources

```
can access api using the .http file for easy use
```

#### 1) Create a resource
POST /resources
Content-Type: application/json

Body:
{
  "name": "My Resource",
  "description": "Optional",
  "status": "active" | "archived" (optional)
}

Example:
curl -X POST http://localhost:3000/resources \
  -H "Content-Type: application/json" \
  -d '{"name":"First","description":"hello","status":"active"}'

#### 2) List resources (basic filters)
GET /resources

Query params:
- status: active | archived
- q: substring match on name
- createdFrom: date/time string parseable by JS Date (recommended ISO)
- createdTo: date/time string parseable by JS Date (recommended ISO)
- limit: 1..200 (default 50)
- offset: 0.. (default 0)

Example:
curl "http://localhost:3000/resources?status=active&q=Fir&limit=10&offset=0"

Response:
{
  "data": [ ... ],
  "limit": 10,
  "offset": 0,
  "count": 1
}

#### 3) Get resource details
GET /resources/:id

Example:
curl http://localhost:3000/resources/1

#### 4) Update resource details (PATCH)
PATCH /resources/:id
Content-Type: application/json

Body (any subset):
{
  "name": "New Name",
  "description": null,
  "status": "archived"
}

Example:
curl -X PATCH http://localhost:3000/resources/1 \
  -H "Content-Type: application/json" \
  -d '{"status":"archived"}'

#### 5) Delete a resource
DELETE /resources/:id

Example:
curl -X DELETE http://localhost:3000/resources/1 -i

Expected:
HTTP/1.1 204 No Content

### Notes

- Persistence is via SQLite file at DB_STORAGE (default: ./data.sqlite).
- Tables are created automatically on startup via `sequelize.sync()`.
  For production, replace sync with proper migrations.
- Zod validates request bodies and query params at runtime, providing clear 400 errors.
- Sequelize also validates model constraints (e.g. status enum, allowNull).