import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { calculateCompatibility } from '../services/aiService';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

export async function register(req: Request, res: Response) {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'All fields (email, password, name, role) are required' });
    }

    if (role !== 'TENANT' && role !== 'OWNER' && role !== 'ADMIN') {
      return res.status(400).json({ error: 'Invalid role. Must be TENANT, OWNER, or ADMIN' });
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role
      }
    });

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error during registration' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { tenantProfile: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantProfile: user.tenantProfile
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
}

export async function getProfile(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { tenantProfile: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantProfile: user.tenantProfile
    });
  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error fetching profile' });
  }
}

export async function updateProfile(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;
    const { name, preferredLocation, budgetMin, budgetMax, moveInDate } = req.body;

    // Update user name
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { name },
      include: { tenantProfile: true }
    });

    // If tenant, create/update tenant profile
    if (userRole === 'TENANT') {
      if (!preferredLocation || budgetMin === undefined || budgetMax === undefined || !moveInDate) {
        return res.status(400).json({ error: 'Tenant profile fields (preferredLocation, budgetMin, budgetMax, moveInDate) are required' });
      }

      const tenantProfile = await prisma.tenantProfile.upsert({
        where: { tenantId: userId },
        update: {
          preferredLocation,
          budgetMin: parseFloat(budgetMin),
          budgetMax: parseFloat(budgetMax),
          moveInDate
        },
        create: {
          tenantId: userId,
          preferredLocation,
          budgetMin: parseFloat(budgetMin),
          budgetMax: parseFloat(budgetMax),
          moveInDate
        }
      });

      // Async: Recalculate compatibility scores for all active rooms for this tenant profile
      // This is run in the background to avoid blocking the profile response
      recalculateScoresForTenant(tenantProfile);

      return res.json({
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        tenantProfile
      });
    }

    res.json({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error updating profile' });
  }
}

async function recalculateScoresForTenant(tenantProfile: any) {
  try {
    const listings = await prisma.roomListing.findMany({
      where: { isFilled: false }
    });

    console.log(`Recalculating compatibility for tenant ${tenantProfile.tenantId} across ${listings.length} active listings...`);

    for (const listing of listings) {
      const result = await calculateCompatibility(tenantProfile, listing);
      
      await prisma.compatibilityScore.upsert({
        where: {
          tenantProfileId_listingId: {
            tenantProfileId: tenantProfile.id,
            listingId: listing.id
          }
        },
        update: {
          score: result.score,
          explanation: result.explanation,
          method: result.method
        },
        create: {
          tenantProfileId: tenantProfile.id,
          listingId: listing.id,
          score: result.score,
          explanation: result.explanation,
          method: result.method
        }
      });
    }
    console.log(`Successfully updated compatibility scores for tenant ${tenantProfile.tenantId}.`);
  } catch (err) {
    console.error('Failed to recalculate scores for tenant:', err);
  }
}
