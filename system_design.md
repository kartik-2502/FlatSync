# FlatSync: System Design Report

This document details the system design, architecture, and implementation strategies for the FlatSync platform. It covers AI compatibility scoring, LLM integration with fallback, WebSocket-based real-time chat, and notification dispatching.

---

## 1. AI Compatibility Scoring Design

Renting a room goes beyond budget and location; it involves aligning expectations. The scoring engine evaluates a tenant profile against a room listing and assigns a score (0 to 100) alongside a detailed text explanation of the match.

### Scoring Metrics
- **Location Compatibility (Weight 50%)**: Compares the tenant's `preferredLocation` to the listing's `location`.
- **Budget Compatibility (Weight 50%)**: Assesses the listing's `rent` relative to the tenant's budget range `[budgetMin, budgetMax]`.
- **Match Caching**: To prevent recomputing scores on every request (which would cause severe latencies and high API costs), scores are precomputed and cached in the `CompatibilityScore` table:
  - **On Room Creation**: When an owner posts a room, the backend precomputes scores for all existing tenants.
  - **On Tenant Profile Update**: When a tenant updates their location/budget requirements, the backend recalculates scores across all active rooms.
  - **On Demand Fallback**: If a score does not exist due to database synchronization or seed anomalies, it is computed on-the-fly and cached immediately.

---

## 2. LLM Integration and Fallback Strategy

### LLM Implementation
We use the Google Gemini `gemini-2.5-flash` model. The service leverages Gemini's structured output capabilities by requesting JSON formatting using `responseMimeType: "application/json"`.

**System Instruction Prompt**:
```
Given this room listing: and this tenant profile: , compute a compatibility score from 0 to 100 based on budget and location match. Return JSON: { score: number, explanation: string }
```

### Fallback Engine (Resilience Design)
If the Gemini API is offline, rate-limited, or if the `GEMINI_API_KEY` is missing, the backend catches the error gracefully and routes the request to a local **Rule-Based Fallback Engine**:
1. **Location Score**: Calculates similarity based on string containment and common keyword matches. If locations are exact, it awards 50 points. A partial match (e.g. "Manhattan, NY" vs "Manhattan") awards 45 points. Multi-word overlaps award 40 points, while zero-overlap defaults to a baseline similarity of 15 points (allowing room for other matches).
2. **Budget Score**: If rent is within the range, it awards 50 points. If rent is cheaper than the minimum budget, it subtracts a scaled penalty down to a minimum of 35. If rent is above the maximum budget, it subtracts a linear penalty that reaches 0 when rent is 30% over budget.
3. **Structured Explanation**: Formulates a text explanation explaining the matching and mismatching parameters.

This dual-path system guarantees high reliability and zero downtime.

---

## 3. Real-Time Chat Architecture

Real-time message exchange is built using a WebSocket layer powered by Socket.io, backed by SQLite persistence.

```
[Tenant Browser] <--- WebSocket ---> [Socket.io Node Server] ---> [SQLite Database]
[Owner Browser]  <--- WebSocket --->
```

### Connection and Room Lifecycle
1. **Authentication**: Handshake connections require a valid JWT token sent via `socket.handshake.auth.token`. The connection is rejected if the token is missing or invalid.
2. **Authorization & Room Isolation**: Tenants and owners communicate in private rooms scoped by Listing ID and Tenant ID: `room_{listingId}_{tenantId}`.
   - Upon a client request to join a room, the server checks the `InterestRequest` table to ensure that:
     - An interest request exists between this tenant and listing.
     - The interest request status is `ACCEPTED`.
     - The connected user is either the tenant, listing owner, or an administrator.
   - Users cannot join chat rooms unless an owner has officially accepted their interest.
3. **Message Persistence**: When a message is sent via `send_message`, the server writes the record (senderId, receiverId, listingId, content, timestamp) to the `ChatMessage` table, and then broadcasts it to the room. When a client joins the room, the server queries the database and pushes the historical transcript (`message_history`) to populate the chat window.

---

## 4. Event-Driven Notification Flow

To keep users informed of activity, the platform triggers transactional emails on key business events using Nodemailer.

```
[Tenant Action] ------> [Interest Controller]
                               |
                   (Compatibility >= 80)
                               v
                       [Email Service]
                               |
         +---------------------+---------------------+
         | (If SMTP configured)                      | (Fallback Developer Mode)
         v                                           v
[Send to Test Ethereal SMTP]               [Append to logs/emails.log]
```

### Core Workflows
1. **Express Interest Event (Tenant -> Owner)**:
   - When a tenant clicks "Express Interest", the database updates and the controller checks the precalculated compatibility score.
   - If the score is **80 or higher**, an email notification is immediately sent to the owner, detailing the match, score, and AI reasoning.
2. **Respond to Interest Event (Owner -> Tenant)**:
   - When an owner clicks "Accept" or "Decline" on their dashboard, the status is updated.
   - Nodemailer dispatches an email notification to the tenant informing them of the choice.
   - If accepted, the email includes a direct link to the real-time chat dashboard.

### Local Development Auditing
To ensure developer auditability, all outgoing emails are appended to `backend/logs/emails.log` and logged to the Node console. When no SMTP details are supplied in the `.env`, Nodemailer creates a mock test account on Ethereal.email dynamically and logs the preview URL in the console, enabling visual rendering of email templates during testing.
