# Bharat Kumbh Backend API

Backend API server for Bharat Kumbh App built with Node.js, Express, and MongoDB.

## Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control
- **User Management**: Support for multiple user roles (Pilgrim, Volunteer, Medical, Admin)
- **SOS System**: Emergency alert system with real-time notifications via Socket.IO
- **Lost & Found**: Report and match lost/found items
- **Medical Cases**: Medical case management for medical staff
- **Real-time Communication**: Socket.IO integration for live updates
- **RESTful API**: Well-structured REST endpoints

## Tech Stack

- **Node.js**: Runtime environment
- **Express.js**: Web framework
- **MongoDB**: Database with Mongoose ODM
- **Socket.IO**: Real-time communication
- **JWT**: Authentication tokens
- **bcryptjs**: Password hashing
- **express-validator**: Input validation

## Prerequisites

- Node.js (v18 or higher)
- MongoDB (local installation or MongoDB Atlas account)
- npm or yarn

## Installation

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```

4. **Edit `.env` file with your configuration:**
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/bharatkumbh
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   JWT_EXPIRE=7d
   CORS_ORIGIN=http://localhost:3000
   ```

## Running the Server

### Development Mode (with auto-reload):
```bash
npm run dev
```

### Production Mode:
```bash
npm start
```

The server will start on `http://localhost:5000` (or the port specified in `.env`).

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (Protected)
- `PUT /api/auth/update-location` - Update user location (Protected)

### Users
- `GET /api/users` - Get all users (Admin only)
- `GET /api/users/:id` - Get user by ID (Protected)

### SOS
- `POST /api/sos` - Create SOS alert (Protected)
- `GET /api/sos` - Get all SOS alerts (Volunteer/Admin/Medical)
- `GET /api/sos/my-sos` - Get user's own SOS alerts (Protected)
- `PUT /api/sos/:id/acknowledge` - Acknowledge SOS (Volunteer/Admin/Medical)
- `PUT /api/sos/:id/resolve` - Resolve SOS (Volunteer/Admin/Medical)

### Lost & Found
- `POST /api/lost-found` - Report lost/found item (Protected)
- `GET /api/lost-found` - Get all lost/found items (Protected)
- `GET /api/lost-found/my-reports` - Get user's reports (Protected)
- `PUT /api/lost-found/:id/match` - Match lost with found item (Protected)

### Medical
- `POST /api/medical/cases` - Create medical case (Protected)
- `GET /api/medical/cases` - Get all medical cases (Medical/Admin)
- `GET /api/medical/cases/my-cases` - Get user's medical cases (Protected)
- `PUT /api/medical/cases/:id/assign` - Assign case to staff (Medical/Admin)
- `PUT /api/medical/cases/:id/add-note` - Add note to case (Medical/Admin)
- `PUT /api/medical/cases/:id/resolve` - Resolve case (Medical/Admin)

### Volunteer
- `GET /api/volunteer/dashboard` - Get volunteer dashboard (Volunteer/Admin/Medical)
- `GET /api/volunteer/assigned-tasks` - Get assigned tasks (Volunteer/Admin/Medical)

### Admin
- `GET /api/admin/dashboard` - Get admin dashboard statistics (Admin)
- `PUT /api/admin/users/:id/activate` - Activate user (Admin)
- `PUT /api/admin/users/:id/deactivate` - Deactivate user (Admin)

### Health Check
- `GET /api/health` - Server health check
- `GET /` - API information

## User Roles

- **pilgrim**: Regular user (default)
- **volunteer**: Volunteer staff
- **medical**: Medical staff
- **admin**: Administrator

## Authentication

All protected routes require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Database Models

### User
- User information, authentication, and role management
- Location tracking

### SOS
- Emergency alerts with location and status tracking

### LostFound
- Lost and found item reports with matching functionality

### MedicalCase
- Medical cases with notes and assignment tracking

## Socket.IO Events

### Client → Server
- `sos-alert`: Send SOS alert
- `emergency-notification`: Send emergency notification

### Server → Client
- `sos-alert`: Receive SOS alert
- `emergency-notification`: Receive emergency notification

## Development

### Project Structure
```
backend/
├── config/          # Configuration files
├── middleware/      # Custom middleware (auth, etc.)
├── models/          # MongoDB models
├── routes/          # API routes
├── utils/           # Utility functions
├── server.js        # Main server file
├── package.json     # Dependencies
└── .env            # Environment variables (not in git)
```

## MongoDB Setup

### Local MongoDB
1. Install MongoDB locally
2. Start MongoDB service
3. Use connection string: `mongodb://localhost:27017/bharatkumbh`

### MongoDB Atlas (Cloud)
1. Create account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a cluster
3. Get connection string
4. Update `MONGODB_URI` in `.env`

## Security Notes

- Change `JWT_SECRET` to a strong random string in production
- Use HTTPS in production
- Implement rate limiting for production
- Validate and sanitize all inputs
- Keep dependencies updated

## Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running
- Check connection string in `.env`
- Verify network/firewall settings

### Port Already in Use
- Change `PORT` in `.env`
- Or kill the process using the port

## License

ISC

