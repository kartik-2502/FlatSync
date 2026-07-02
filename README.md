# FlatSync

FlatSync is a premium, real-time matching platform for room rentals and flatmate searching. It matches owners who list rooms with tenants looking for rooms. It computes compatibility scores based on budget and location criteria using the Gemini AI API, fallback rule-based calculations, real-time chat via WebSockets (Socket.io), and Nodemailer alerts.

## 🚀 Features

- **Role-Based Authentication**: Custom dashboards and controls for **Tenants**, **Room Owners**, and **Administrators**.
- **AI Compatibility Engine**: Analyzes and ranks room matches using the `gemini-2.5-flash` model.
- **Graceful Fallback**: If the Gemini API is unavailable or no key is provided, the engine transparently switches to a rule-based algorithm.
- **Real-Time Messaging**: Real-time websocket chat between matched parties with persistent chat histories.
- **Event-Driven Notifications**: Automated email alerts for interest requests and status approvals (e.g. notifications for high-compatibility matches).
- **Admin Control Center**: Metrics overview, user moderation, and room listing controls.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, Socket.io, SQLite, Prisma ORM, Nodemailer, TypeScript.
- **Frontend**: React (Vite), Lucide Icons, Vanilla CSS (Variables, Glassmorphism, Animations), TypeScript.
- **AI API**: Google Gemini (`gemini-2.5-flash`).

---

## 📋 Database Schema (SQLite via Prisma)

```
+------------------+           +----------------------+
|       User       |           |    TenantProfile     |
+------------------+           +----------------------+
| id (PK)          |           | id (PK)              |
| email (Unique)   |1       1  | tenantId (FK to User)|
| password         |-----------| preferredLocation    |
| name             |           | budgetMin            |
| role             |           | budgetMax            |
| createdAt        |           | moveInDate           |
+------------------+           +----------------------+
      | 1                            | 1
      |                              |
      | 1:N                          | 1:N
+------------------+           +----------------------+
|   RoomListing    |           |  CompatibilityScore  |
+------------------+           +----------------------+
| id (PK)          |           | id (PK)              |
| ownerId (FK)     |1       N  | tenantProfileId (FK) |
| location         |-----------| listingId (FK)       |
| rent             |           | score                |
| availableFrom    |           | explanation          |
| roomType         |           | method               |
| furnishingStatus |           +----------------------+
| photos (JSON)    |
| isFilled         |
+------------------+
```

---

## ⚙️ Setup and Installation

### Prerequisites
- Node.js (v18+ recommended, tested on v22)
- NPM

### Step 1: Clone or extract the project files

Open the project directory:
```bash
cd rent-flatmate-finder
```

### Step 2: Backend Setup
1. Open the backend folder and copy the environment file:
   ```bash
   cd backend
   cp .env.example .env
   ```
2. Configure `.env` variables:
   - To enable **AI scoring**, add your `GEMINI_API_KEY`. If left empty, the engine falls back to local rule-based calculations.
   - To send **real emails**, fill in the `EMAIL_` host and SMTP credentials. If left empty, Nodemailer automatically creates a temporary test inbox (Ethereal Email) and prints the viewable email URL in the terminal!
3. Install dependencies:
   ```bash
   npm install
   ```
4. Push database schema and seed mock records:
   ```bash
   npx prisma db push
   npm run db:seed
   ```
5. Start development backend:
   ```bash
   npm run dev
   ```
   The backend server runs on `http://localhost:5000`.

### Step 3: Frontend Setup
1. Open a new terminal window to the frontend folder:
   ```bash
   cd rent-flatmate-finder/frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start frontend dev server:
   ```bash
   npm run dev
   ```
   The frontend runs on `http://localhost:5173`. Open this URL in your web browser.

---

## 🔑 Seeding / Demo Credentials

The database is pre-seeded with the following accounts (all default passwords are `password123` unless noted):

1. **System Administrator**
   - Email: `admin@rentfinder.com`
   - Password: `AdminPassword123!`
2. **Room Owners**
   - Email: `owner1@rentfinder.com` (Alice - owns Manhattan and Williamsburg rooms)
   - Email: `owner2@rentfinder.com` (Bob - owns Astoria and Harlem rooms)
3. **Tenants**
   - Email: `tenant1@rentfinder.com` (Charlie - looking in New York, budget $1000-$2000)
   - Email: `tenant2@rentfinder.com` (David - looking in Brooklyn, budget $800-$1500)

---

## 🧠 AI Compatibility Scoring Engine

### Model & Prompt Design
We utilize Google Gemini `gemini-2.5-flash` model with `responseMimeType: "application/json"` to ensure structured JSON output.

**Prompt**:
```
Given this room listing:
Location: [Room Location]
Rent: $[Room Rent]/month
Room Type: [Room Type]
Furnishing: [Furnishing Status]

and this tenant profile:
Preferred Location: [Preferred Location]
Budget Range: $[Min Budget] - $[Max Budget]/month
Move-in Date: [Move-in Date]

compute a compatibility score from 0 to 100 based on budget and location match. Return JSON: { score: number, explanation: string }
```

### Example Input/Output

**Input Listing**:
```json
{
  "location": "Brooklyn, Williamsburg",
  "rent": 1400,
  "roomType": "Single",
  "furnishingStatus": "Semi-Furnished"
}
```

**Input Tenant Profile**:
```json
{
  "preferredLocation": "Brooklyn",
  "budgetMin": 800,
  "budgetMax": 1500,
  "moveInDate": "2026-09-01"
}
```

**Output JSON Response**:
```json
{
  "score": 92,
  "explanation": "Excellent match! The listing location of Williamsburg, Brooklyn perfectly matches the tenant's preferred location (Brooklyn). Additionally, the monthly rent of $1400 lies comfortably within the tenant's budget range of $800 to $1500."
}
```

---

## 🔌 API Documentation

### Auth Endpoints
- `POST /api/auth/register` - Create user. Request body: `{ email, password, name, role }`
- `POST /api/auth/login` - Authenticate user. Request body: `{ email, password }`
- `GET /api/auth/profile` - Fetch profile details. (Requires Bearer Token)
- `PUT /api/auth/profile` - Create or update tenant matching profile. (Requires Bearer Token)

### Room Listings Endpoints
- `POST /api/listings` - Post room listing (Owners only). Request body: `{ location, rent, availableFrom, roomType, furnishingStatus }`
- `GET /api/listings` - Browse listings. Supports query params: `?location=Brooklyn&maxRent=1600` (Tenants get results ranked by AI compatibility)
- `GET /api/listings/owner` - Get rooms posted by current owner.
- `PATCH /api/listings/:id/filled` - Toggle filled/active status of listing (Owners/Admin only).

### Interest Endpoints
- `POST /api/interests` - Express interest in a listing (Tenants only). Request body: `{ listingId }`
- `POST /api/interests/respond` - Accept/Decline interest (Owners only). Request body: `{ interestId, status }` (status: `ACCEPTED` | `DECLINED`)
- `GET /api/interests/my` - Fetch sent/received interest requests.

### Admin Endpoints
- `GET /api/admin/stats` - Platform stats & charts summary.
- `GET /api/admin/users` - Fetch list of registered users.
- `GET /api/admin/listings` - Fetch list of room listings.
- `DELETE /api/admin/users/:id` - Delete user account recursively.
- `DELETE /api/admin/listings/:id` - Delete listing post.

### WebSocket (Socket.io) Events
- `join_room` (inbound) - Emitted when opening a chat window. Payload: `{ listingId, tenantId }`. Verifies authentication and ACCEPTED match status before joining room.
- `message_history` (outbound) - Emitted by backend on join, sending previous message transcripts list.
- `send_message` (inbound) - Client sends message to recipient. Payload: `{ listingId, receiverId, content }`. Persists message and broadcasts.
- `new_message` (outbound) - Sent by backend to all room subscribers when a new message is received.
