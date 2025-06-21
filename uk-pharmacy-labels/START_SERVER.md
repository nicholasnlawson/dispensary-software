# Server Startup Guide

This guide provides step-by-step instructions for starting the UK Pharmacy Dispensing and Remote Ordering System server and accessing the test page.

## Prerequisites

- Node.js (v16 or newer)
- npm (Node Package Manager)
- Git (for cloning the repository if needed)

## Installation

1. Clone the repository (if you haven't already):
   ```
   git clone [repository-url]
   cd uk-pharmacy-labels
   ```

2. Install dependencies:
   ```
   npm install
   ```

   This will install all required packages defined in package.json, including:
   - bcrypt
   - crypto-js
   - dotenv
   - sqlite3
   - uuid
   - and development dependencies

## Starting the Server

1. Start the server using npm:
   ```
   npm start
   ```

   This command runs the `start-with-db.js` script, which:
   - Sets the database path to `server/db/sqlite/pharmacy_system.db`
   - Starts the server process with proper environment configuration

2. You should see output similar to:
   ```
   Starting server with database path: [path]/server/db/sqlite/pharmacy_system.db
   Server running on port 3000
   Security enhancements enabled: Helmet, Rate Limiting, Logging
   ```

3. The server is now running on port 3000 (default) with security features enabled.

## Accessing Test Pages

Once the server is running, you can access the following test pages:

1. **Login Page**: 
   - Open your browser and navigate to: http://localhost:3000/login.html
   - This is the default page that the server redirects to when accessing the root URL

2. **API Status**:
   - http://localhost:3000/api/status
   - This endpoint returns a simple JSON response confirming the API server is running

3. **Test Authentication**:
   - http://localhost:3000/test-auth.js
   - This page provides authentication testing functionality

4. **Profile Page** (requires authentication):
   - http://localhost:3000/profile.html

## Troubleshooting

- **Port Conflict**: If port 3000 is already in use, you can modify the `.env` file to change the PORT variable.
- **Database Issues**: Ensure the database file exists at the specified path in `start-with-db.js`.
- **Dependency Errors**: Run `npm install` again to ensure all dependencies are properly installed.
- **Authentication Errors**: Check the browser console for specific error messages related to authentication.

## Stopping the Server

To stop the server:
1. Press `Ctrl+C` in the terminal where the server is running.
2. The server handles termination signals gracefully via SIGTERM and SIGINT handlers.
