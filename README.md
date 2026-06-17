# Amethyst Inventory Tracking Application

## Architectural Thinking & Security Analysis

### Security Race Conditions & Double-Gate Access
The application implements a robust two-tier authentication system. The primary login issues a JWT containing the user's role (`owner` or `worker`). 
If a worker attempts to manipulate frontend JavaScript variables to access the Owner Dashboard, the backend protects the routes via the `authorizeOwner` middleware. This middleware strictly checks the JWT payload (which is cryptographically signed and cannot be tampered with by the client). 
Furthermore, the Owner Dashboard requires a secondary PIN verification (`/api/verify-pin`). Even if an attacker bypasses the frontend UI, they cannot access the inventory data or add products without a valid JWT and the secondary PIN, as the backend endpoints (`/api/inventory`) enforce these checks.

### Asynchronous Data Flow (Barcode Scan to SMS)
1. **Camera Stream:** The `Html5-QRCode` library captures the barcode via the device camera.
2. **Client Request:** The frontend JS sends a POST request to `/api/scan-checkout` with the barcode and the JWT.
3. **Express API:** The backend verifies the JWT.
4. **Database Execution:** SQLite queries the `inventory` table. If stock > 0, it decrements the quantity and logs the action in the `logs` table.
5. **Twilio Dispatch:** The backend asynchronously calls the Twilio API to send an SMS alert to the owner.
6. **Client Response:** The backend responds with success, and the frontend updates the UI to show the successful scan.

---

## Deployment & Twilio Configuration Guide

### Prerequisites
- Node.js (v14 or higher)
- A Twilio Account (for SMS notifications)

### Step-by-Step Setup

1. **Install Dependencies**
   Navigate to the project directory and run:
   ```bash
   npm install
   ```

2. **Environment Variables**
   Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```
   Fill in your Twilio credentials and a secure JWT secret in the `.env` file.

3. **Initialize the Database**
   Run the initialization script to create the SQLite database and seed the initial users:
   ```bash
   node init-db.js
   ```
   *Default Credentials:*
   - Owner: Username `admin`, Password `admin123`, PIN `1234`
   - Worker: Username `worker`, Password `worker123`

4. **Start the Server**
   Start the Express server:
   ```bash
   node server.js
   ```
   The application will be available at `http://localhost:3000`.

### Twilio Configuration
1. Sign up at [Twilio](https://www.twilio.com/).
2. Get your `ACCOUNT_SID` and `AUTH_TOKEN` from the Twilio Console.
3. Purchase or get a free Twilio phone number.
4. Update the `.env` file with these details and the owner's receiving phone number.
