import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

// Import controllers and middlewares
import { register, login, getProfile, updateProfile } from './controllers/authController';
import { createListing, getListings, getOwnerListings, toggleListingFilled } from './controllers/listingController';
import { expressInterest, respondToInterest, getMyInterests } from './controllers/interestController';
import { getPlatformStats, getAllUsers, getAllListings, deleteUser, deleteListing } from './controllers/adminController';
import { authenticateToken, requireRole } from './middleware/authMiddleware';
import { setupChatSockets } from './sockets/chatSocket';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for development simplicity
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Public files / assets (e.g. static uploaded images)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Ensure uploads folder exists
import fs from 'fs';
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ---------------- API Routes ----------------

// Auth Routes
app.post('/api/auth/register', register);
app.post('/api/auth/login', login);
app.get('/api/auth/profile', authenticateToken as any, getProfile);
app.put('/api/auth/profile', authenticateToken as any, updateProfile);

// Room Listings Routes
app.post('/api/listings', authenticateToken as any, requireRole(['OWNER', 'ADMIN']), createListing);
app.get('/api/listings', authenticateToken as any, getListings);
app.get('/api/listings/owner', authenticateToken as any, requireRole(['OWNER']), getOwnerListings);
app.patch('/api/listings/:id/filled', authenticateToken as any, requireRole(['OWNER', 'ADMIN']), toggleListingFilled);

// Interest Requests Routes
app.post('/api/interests', authenticateToken as any, requireRole(['TENANT']), expressInterest);
app.post('/api/interests/respond', authenticateToken as any, requireRole(['OWNER']), respondToInterest);
app.get('/api/interests/my', authenticateToken as any, getMyInterests);

// Admin Routes
app.get('/api/admin/stats', authenticateToken as any, requireRole(['ADMIN']), getPlatformStats);
app.get('/api/admin/users', authenticateToken as any, requireRole(['ADMIN']), getAllUsers);
app.get('/api/admin/listings', authenticateToken as any, requireRole(['ADMIN']), getAllListings);
app.delete('/api/admin/users/:id', authenticateToken as any, requireRole(['ADMIN']), deleteUser);
app.delete('/api/admin/listings/:id', authenticateToken as any, requireRole(['ADMIN']), deleteListing);

// Basic health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Setup WebSocket Sockets
setupChatSockets(io);

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Rent & Flatmate Finder backend running on port ${PORT}`);
});
