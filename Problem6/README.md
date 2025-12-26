### Problem 6


# Live Scoreboard API Module

Live Scoreboard API module for maintaining and serving a top-10 user score leaderboard with near real-time updates, built on Node.js + Express, Sequelize (PostgreSQL), and Redis.

This module is intended to be used by:

- The **frontend web application**, to:
  - Report completion of score-increasing user actions.
  - Fetch and display the top 10 leaderboard.
  - Subscribe to live leaderboard updates (via Server-Sent Events or polling).

- The **backend engineering team**, to:
  - Implement a secure, scalable scoreboard service.
  - Integrate with existing authentication and deployment infrastructure.



## 1. Goals and Non-Goals

### 1.1 Goals

- Maintain a **global leaderboard** of users, showing at least the **top 10 scores**.
- Provide **live updates** of the leaderboard to connected clients with low latency.
- Allow the frontend to **submit “score actions”** that increase a user’s score.
- Prevent **malicious users** from:
  - Arbitrarily increasing their score.
  - Faking or replaying score actions.
  - Bypassing authentication to modify scores.

### 1.2 Non-Goals

- We do **not** define what the “action” is (game, quiz, purchase, etc.).
- We do **not** define UI/UX details for the web front-end.
- We do **not** cover multi-game or multi-mode leaderboards in v1 (but we will design with extension in mind).

---

## 2. High-Level Architecture

### 2.1 Logical Components

- **API Service**
  - Node.js + Express.
  - Uses Sequelize ORM to access PostgreSQL.
  - Exposes REST endpoints and optionally a GraphQL API for flexible data fetching.

- **Database (PostgreSQL / Aurora)**
  - Stores **canonical user data** and **score action history**.
  - Ensures durability and auditability of score changes.

- **Redis**
  - Stores the **current leaderboard** using **sorted sets** for fast ranking.
  - Acts as a **cache** and a **Pub/Sub bus** for score updates.
  - Provides low-latency reads for the top 10 leaderboard.

- **Authentication Provider**
  - For example, Cognito User Pools or any JWT-based auth.
  - Provides access tokens to authenticate API requests.

- **Frontend Web App**
  - Calls the API when a user completes a scoring action.
  - Displays leaderboard and listens for updates (SSE/polling).

### 2.2 Deployment Options (Cloud Architectures)

The module is cloud-agnostic; below are suggested topologies mapping to your ideas.

#### 2.2.1 Simple Deployment

- **Compute**: Node.js + Express (single or small number of instances).
- **Reverse Proxy / LB**: Nginx as reverse proxy and load balancer.
- **Database**: PostgreSQL (single instance).
- **Cache / Leaderboard**: Redis (standalone or primary+replica).
- **Pub/Sub**: Redis Pub/Sub for propagating score updates.

#### 2.2.2 Advanced Deployment (AWS Example)

- **Compute**: Node.js + Express on EC2 instances.
- **Edge / CDN**: CloudFront.
- **Load Balancing & Auto Scaling**:
  - Application Load Balancer (ALB).
  - Auto Scaling Group (ASG) for EC2 instances.
- **Database**: Amazon RDS (PostgreSQL) or Aurora.
- **Caching & Leaderboard**:
  - ElastiCache for Redis.
- **Pub/Sub (Optional)**:
  - Kafka (e.g., MSK) for score events (topic: `leaderboard.score-events`).
  - A separate consumer service updates Redis leaderboard and DB from Kafka.

#### 2.2.3 Serverless Deployment

- **API Layer**:
  - AWS Lambda (Node.js) functions for API handlers.
  - API Gateway as HTTP interface.
- **Auth**:
  - Cognito User Pools for JWT tokens.
- **Data Stores**:
  - DynamoDB for user scores and score actions.
  - Redis or DynamoDB Global Secondary Indexes for leaderboard queries (Redis is still recommended for low latency).
- **Pub/Sub**:
  - Kafka (MSK) or Amazon Kinesis for event streaming if needed for other consumers.


---

## 3. Security and Anti-Abuse Strategy

Preventing malicious score inflation is a core requirement. The design uses a combination of **authentication**, **server-side authority**, **idempotency**, and **rate limiting**.

### 3.1 Authentication

- All score-modifying and score-viewing endpoints require **JWT authentication** (e.g., from Cognito).
- The API extracts `userId` from the validated JWT and **never** trusts user-supplied user IDs for score updates.

### 3.2 Server-Side Authority for Score Changes

- The client **does not** specify the numeric amount to increase the score by.
- The request includes an `actionType` or `actionCode`; the server maps that to a **pre-configured score value**.

  ```text
  Example mapping:
  - COMPLETE_LEVEL          -> +10 points
  - WIN_MATCH               -> +20 points
  - DAILY_LOGIN_BONUS       -> +5 points
  - REFER_FRIEND_COMPLETED  -> +50 points
  ```

- The server validates:
  - The `actionType` is recognized.
  - The action is allowed for that user at that time (e.g., daily limits).

### 3.3 Idempotency and Replay Protection

- Each client request must include a **client-generated action ID** (e.g., UUID): `clientActionId`.
- The backend maintains a **ScoreAction** table with a unique constraint on `(userId, clientActionId)`:
  - First insertion for `(userId, clientActionId)` succeeds and updates the score.
  - Subsequent requests with the same `(userId, clientActionId)` are treated as **idempotent** (no additional score granted).

### 3.4 Rate Limiting and Throttling

- At **API Gateway / Nginx / ALB**:
  - Implement IP-based and/or user-based **rate limiting** for `POST /scores/actions`.
- At the **application level**:
  - Optional per-user quotas, e.g., max N `WIN_MATCH` actions per hour.

### 3.5 Audit Trail

- All score changes are recorded in `ScoreAction` with:
  - userId, actionType, delta, previousScore, newScore, timestamps, and request metadata.
- This supports:
  - Debugging.
  - Forensic analysis if abnormal score patterns appear.
  - Potential rollback or manual corrections.

> **Comment for improvement:**  
> Consider a separate **“Fraud Detection”** or **“Abuse Monitoring”** job that periodically scans `ScoreAction` for suspicious patterns (e.g., extremely high-frequency updates, abnormal score jumps) and auto-flags or freezes accounts.

---

## 4. Data Model

### 4.1 Relational (PostgreSQL) – Sequelize Models

#### 4.1.1 `User`

- **Table**: `users`
- **Fields** (simplified):
  - `id` (PK, UUID or bigint)
  - `externalAuthId` (string, e.g., Cognito sub)
  - `displayName` (string)
  - `createdAt`, `updatedAt`

> Actual user identity might be managed elsewhere. This module assumes a `users` table is available or that user info is fetched from an external user service.

#### 4.1.2 `ScoreAction`

- **Table**: `score_actions`
- **Purpose**: Immutable record of each score-increasing event.
- **Fields**:
  - `id` (PK)
  - `userId` (FK → `users.id`)
  - `actionType` (enum/string)
  - `clientActionId` (string, unique together with `userId`)
  - `delta` (integer, positive or negative; computed server-side)
  - `previousScore` (integer)
  - `newScore` (integer)
  - `metadata` (JSONB, optional; e.g., device info, IP, game/session ID)
  - `createdAt`

- **Indexes / Constraints**:
  - Unique index on `(userId, clientActionId)` for idempotency.
  - Index on `userId` for querying a user’s history.

#### 4.1.3 `UserScore` (Optional Materialized Table)

- **Table**: `user_scores`
- **Purpose**: Maintains canonical persisted score per user (for backup and cross-checking Redis).
- **Fields**:
  - `userId` (PK, FK → `users.id`)
  - `score` (integer)
  - `updatedAt`

> This can be derived from `ScoreAction` but having a dedicated `user_scores` table makes reads cheap and recovery from Redis failures faster.

### 4.2 Redis Data Structures

Use Redis primarily for **fast leaderboard queries**.

- **Sorted Set**: `leaderboard:global`
  - **Members**: `userId` (string/int).
  - **Score**: `score` (numeric, integer).
  - Operations:
    - Increment score: `ZINCRBY leaderboard:global <delta> <userId>`
    - Top N: `ZREVRANGE leaderboard:global 0 9 WITHSCORES`
    - Rank: `ZREVRANK leaderboard:global <userId>` (0-based rank).

- **Hash (Optional)**: `user:profile:<userId>`
  - Fields: `displayName`, `avatarUrl`, etc., for quick display in leaderboard.

- **Pub/Sub Channel**: `leaderboard:updates`
  - Payload: JSON messages on score changes:
    ```json
    {
      "userId": "123",
      "newScore": 1500,
      "rank": 3,
      "timestamp": "2025-01-01T12:34:56Z"
    }
    ```

> **Comment for improvement:**  
> For very large user bases, consider **sharded leaderboards** (by region, game mode, or season), e.g., `leaderboard:global:2025-season1`, and store metadata in DB to manage active seasons.

---

## 5. API Design

### 5.1 Authentication & Common Concerns

- All endpoints except basic health checks require:
  - `Authorization: Bearer <JWT>` header.
- Error responses follow a consistent JSON schema:
  ```json
  {
    "error": {
      "code": "RATE_LIMIT_EXCEEDED",
      "message": "Too many requests. Please try again later."
    }
  }
  ```

### 5.2 REST Endpoints

#### 5.2.1 `POST /api/v1/scores/actions`

Records a completed score-increasing action for the authenticated user.

- **Auth**: Required (JWT).
- **Request Body**:
  ```json
  {
    "actionType": "COMPLETE_LEVEL",
    "clientActionId": "b6540bb6-d29a-43ca-a9cf-0f14800a3a0d",
    "metadata": {
      "levelId": "level_5",
      "device": "web",
      "ip": "203.0.113.42"
    }
  }
  ```

- **Behavior**:
  1. Validate JWT, resolve `userId`.
  2. Validate `actionType` against server configuration.
  3. Compute `delta` from server-side action rules.
  4. Enforce idempotency on `(userId, clientActionId)`.
  5. In a transaction:
     - Read existing `UserScore` (or default 0).
     - Insert `ScoreAction`.
     - Update `UserScore`.
  6. Update Redis:
     - `ZINCRBY leaderboard:global delta userId`.
  7. Publish event to Redis Pub/Sub (`leaderboard:updates`).

- **Response (Success)**:
  ```json
  {
    "userId": "123",
    "newScore": 1500,
    "delta": 10,
    "rank": 3,
    "leaderboardUpdatedAt": "2025-01-01T12:34:56Z"
  }
  ```

- **Response (Idempotent Replay)**:
  - 200 with `delta: 0` and the previously known score, or:
  - 409 with `code: "ACTION_ALREADY_PROCESSED"` (implementation choice).

#### 5.2.2 `GET /api/v1/leaderboard`

Fetches the top N leaderboard entries.

- **Auth**: Optional (for publicly visible leaderboard) or Required (if leaderboard is private).
- **Query Params**:
  - `limit` (optional, default 10, max 100)

- **Response**:
  ```json
  {
    "entries": [
      {
        "userId": "123",
        "displayName": "Alice",
        "score": 1500,
        "rank": 1
      },
      {
        "userId": "456",
        "displayName": "Bob",
        "score": 1490,
        "rank": 2
      }
    ],
    "generatedAt": "2025-01-01T12:34:56Z"
  }
  ```

- **Implementation**:
  - Use `ZREVRANGE leaderboard:global` to fetch user IDs and scores.
  - Optionally hydrate display names from:
    - Redis hash (`user:profile:<userId>`) or
    - DB cache.

#### 5.2.3 `GET /api/v1/users/me/score`

Returns the authenticated user’s current score and rank.

- **Auth**: Required.
- **Response**:
  ```json
  {
    "userId": "123",
    "score": 1500,
    "rank": 3
  }
  ```

- **Implementation**:
  - Score: read from Redis via `ZSCORE` or from `UserScore`.
  - Rank: `ZREVRANK` on `leaderboard:global`.

#### 5.2.4 `GET /api/v1/leaderboard/stream` (Live Updates via SSE)

Provides **Server-Sent Events (SSE)** stream of leaderboard updates.

- **Auth**: Optional or Required (depending on privacy).
- **Protocol**:
  - Client opens a long-lived HTTP connection with:
    ```http
    GET /api/v1/leaderboard/stream
    Accept: text/event-stream
    ```

  - Server subscribes to Redis Pub/Sub (`leaderboard:updates`) and writes SSE messages:
    ```text
    event: leaderboardUpdate
    data: {"userId":"123","newScore":1500,"rank":3,"timestamp":"2025-01-01T12:34:56Z"}

    ```

- **Client Behavior**:
  - On receiving event, the client can:
    - Re-fetch the top 10 via `GET /leaderboard`, or
    - Directly patch in the updated user if already in view.

> **Comment for improvement:**  
> SSE is simpler than WebSockets or Socket.IO and works well behind proxies and CDNs. For extremely high-frequency updates or bidirectional communication, WebSockets may be reconsidered later.

---

## 6. Optional GraphQL API

To enable flexible data fetching patterns, we can provide a GraphQL endpoint (e.g., `/graphql`) using Apollo Server with Express.

### 6.1 Schema (Draft)

```graphql
type User {
  id: ID!
  displayName: String!
  score: Int!
  rank: Int
}

type LeaderboardEntry {
  user: User!
  score: Int!
  rank: Int!
}

type Query {
  leaderboard(limit: Int = 10): [LeaderboardEntry!]!
  me: User!
}

input ScoreActionInput {
  actionType: String!
  clientActionId: ID!
  metadata: JSON
}

type ScoreActionResult {
  user: User!
  delta: Int!
}

type Mutation {
  submitScoreAction(input: ScoreActionInput!): ScoreActionResult!
}
```

> **Comment for improvement:**  
> If GraphQL is adopted, consider **schema-first design** and auto-generated TypeScript types for safety across frontend and backend.

---

## 7. Execution Flow (Diagram)

### 7.1 Sequence: User Completes a Score Action

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant FE as Frontend Web App
    participant API as API Service (Express)
    participant AUTH as Auth Service (Cognito/JWT)
    participant DB as Postgres
    participant REDIS as Redis (Leaderboard)
    participant PUB as Redis Pub/Sub

    U->>FE: Complete action
    FE->>API: POST /api/v1/scores/actions (JWT, actionType, clientActionId)
    API->>AUTH: Validate JWT
    AUTH-->>API: OK (userId)

    API->>DB: Begin transaction
    API->>DB: SELECT user_scores WHERE userId
    DB-->>API: currentScore
    API->>DB: INSERT score_actions (userId, actionType, clientActionId, delta, previousScore, newScore)
    API->>DB: UPSERT user_scores (userId, newScore)
    DB-->>API: Commit

    API->>REDIS: ZINCRBY leaderboard:global delta userId
    REDIS-->>API: newScoreInRedis
    API->>REDIS: ZREVRANK leaderboard:global userId
    REDIS-->>API: rank

    API->>PUB: PUBLISH leaderboard:updates {userId, newScore, rank}
    API-->>FE: 200 OK {newScore, rank}
    Note over FE: Client updates UI for this user

    PUB-->>FE: (via SSE endpoint) leaderboardUpdate event
    Note over FE: Client can refresh<br/>top 10 leaderboard
```

### 7.2 Sequence: Client Subscribes to Live Updates (SSE)

```mermaid
sequenceDiagram
    participant FE as Frontend Web App
    participant API as API Service
    participant REDIS as Redis Pub/Sub

    FE->>API: GET /api/v1/leaderboard/stream (Accept: text/event-stream)
    API->>REDIS: SUBSCRIBE leaderboard:updates
    REDIS-->>API: On score updates
    API-->>FE: SSE leaderboardUpdate events
    FE->>FE: Update displayed leaderboard
```

---

## 8. Project / Server Structure

Proposed Node.js (TypeScript optional) project layout:

```text
src/
  config/
    index.ts            # Configuration (env, Redis, DB URLs, feature flags)
    actionRules.ts      # Mapping actionType -> delta and constraints
  db/
    index.ts            # Sequelize initialization and connection
    migrations/         # DB migrations for users, score_actions, user_scores
    seeders/            # Optional seed data
  models/
    User.ts
    ScoreAction.ts
    UserScore.ts
  routes/
    scores.ts           # /api/v1/scores/actions
    leaderboard.ts      # /api/v1/leaderboard, /users/me/score, /leaderboard/stream
    health.ts           # /health
  services/
    authService.ts      # JWT validation, userId resolution
    scoreService.ts     # Core score update logic (transaction with DB & Redis)
    leaderboardService.ts # Reads from Redis, rank calculations
    pubsubService.ts    # Redis Pub/Sub wrapper
  graphql/
    schema.ts           # GraphQL schema definition (if enabled)
    resolvers.ts        # Resolvers for Query/Mutation
  middleware/
    authMiddleware.ts   # Express middleware to enforce JWT
    errorHandler.ts     # Central error handling
    rateLimiter.ts      # Rate limiting (if not handled at gateway)
  utils/
    logger.ts           # Structured logging
    httpErrors.ts       # Custom error classes
  app.ts                # Express app setup, routers, middleware
  server.ts             # HTTP server bootstrap (port, graceful shutdown)
```

> **Comment for improvement:**  
> Adopt **TypeScript** with strict settings for better safety and IDE support. Also consider using a consistent logging framework (e.g., Pino or Winston) and a configuration library (e.g., `dotenv` + a typed config module).

---

## 9. Live Update Strategy

### 9.1 Preferred Approach: Server-Sent Events (SSE) + Redis Pub/Sub

- **Why SSE**:
  - Simple uni-directional server → client updates.
  - Works over HTTP/1.1, easier with load balancers and CDNs.
  - No additional JS library required in the browser (`EventSource` API).

- **Flow**:
  - API instances subscribe to Redis Pub/Sub channel on boot.
  - Each API instance:
    - Maintains SSE connections to clients.
    - For each Pub/Sub message, broadcasts to connected clients.

### 9.2 Alternative / Fallback: Periodic Polling

- For environments where SSE is not feasible:
  - Frontend can periodically call `GET /leaderboard` (e.g., every 3–5 seconds).
  - Use HTTP caching and ETag/Last-Modified headers to avoid unnecessary data transfer.

> **Comment for improvement:**  
> In the future, for higher scale or richer real-time features, consider a dedicated **“real-time gateway”** using WebSockets or Socket.IO, backed by Redis or Kafka for fan-out.

---

## 10. Observability, Monitoring, and Operations

### 10.1 Metrics

Track (via Prometheus / CloudWatch, etc.):

- Request count and latency for:
  - `POST /scores/actions`
  - `GET /leaderboard`
- Redis operation latencies.
- Error rates (4xx vs 5xx).
- Queue / stream lag (if Kafka/Kinesis is introduced).

### 10.2 Logging

- Use **structured JSON logging**:
  - Include `userId`, `actionType`, `clientActionId`, `requestId`.
- Redact sensitive data (no raw tokens, PII).

### 10.3 Health Checks

- `GET /health`:
  - Returns basic status for:
    - Application up.
    - DB connectivity.
    - Redis connectivity.

---

## 11. Local Development and Testing

### 11.1 Dependencies

- Node.js (LTS).
- PostgreSQL (local instance or Docker).
- Redis (local instance or Docker).

### 11.2 Environment Variables (Example)

```bash
PORT=3000
DATABASE_URL=postgres://user:pass@localhost:5432/leaderboard
REDIS_URL=redis://localhost:6379
JWT_ISSUER=https://your-auth-domain
JWT_AUDIENCE=your-api-audience
```

### 11.3 Test Strategy

- **Unit Tests**:
  - Score calculation logic.
  - Idempotency and anti-abuse rules.
- **Integration Tests**:
  - End-to-end flow: `POST /scores/actions` updates DB + Redis.
  - Leaderboard consistency under concurrent updates.
- **Load Tests** (later):
  - Validate Redis + API performance under high QPS for `POST /scores/actions` and `GET /leaderboard`.

> **Comment for improvement:**  
> Add CI pipelines (GitHub Actions, GitLab CI, etc.) to run tests and linting on every PR. Also define a small smoke test suite for deployment verification.

---

## 12. Future Enhancements & Recommendations

- **Multiple Leaderboards**:
  - Support leaderboards by region, game mode, or season.
  - Extend Redis keys to `leaderboard:<type>:<season>`.

- **Season Resets**:
  - Design processes to snapshot old leaderboard results and reset scores for new seasons.

- **Kafka Integration (Advanced/Serverless)**:
  - Emit all score actions as events to Kafka.
  - Other services (analytics, fraud detection, achievements) can consume independently.

- **GraphQL Subscriptions**:
  - For GraphQL-heavy clients, use subscriptions (backed by Redis Pub/Sub) instead of REST SSE.

- **GDPR / Privacy Considerations**:
  - Allow users to opt out of public leaderboard display or anonymize their display name.

- **Admin Tools**:
  - Admin APIs or UIs to:
    - Manually adjust scores (with audit log).
    - Ban or freeze users.
    - Inspect user action history.

---

## 13. Summary

This specification defines a **secure, scalable, and observable** Live Scoreboard API module with:

- Node.js + Express + Sequelize (PostgreSQL) for persistent and auditable score data.
- Redis for fast leaderboard queries and pub/sub.
- SSE (or polling) for live client updates without requiring WebSockets/Socket.IO.
- Strong security measures against malicious score inflation via:
  - JWT auth,
  - Server-side score computation,
  - Idempotent actions,
  - Rate limiting,
  - Audit logging.


