import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get overall platform analytics
export async function getPlatformStats(req: Request, res: Response) {
  try {
    const totalUsers = await prisma.user.count();
    const tenants = await prisma.user.count({ where: { role: 'TENANT' } });
    const owners = await prisma.user.count({ where: { role: 'OWNER' } });
    const admins = await prisma.user.count({ where: { role: 'ADMIN' } });

    const totalListings = await prisma.roomListing.count();
    const activeListings = await prisma.roomListing.count({ where: { isFilled: false } });
    const filledListings = await prisma.roomListing.count({ where: { isFilled: true } });

    const totalInterests = await prisma.interestRequest.count();
    const pendingInterests = await prisma.interestRequest.count({ where: { status: 'PENDING' } });
    const acceptedInterests = await prisma.interestRequest.count({ where: { status: 'ACCEPTED' } });
    const declinedInterests = await prisma.interestRequest.count({ where: { status: 'DECLINED' } });

    const totalMessages = await prisma.chatMessage.count();

    res.json({
      users: { total: totalUsers, tenants, owners, admins },
      listings: { total: totalListings, active: activeListings, filled: filledListings },
      interests: { total: totalInterests, pending: pendingInterests, accepted: acceptedInterests, declined: declinedInterests },
      messages: { total: totalMessages }
    });
  } catch (error: any) {
    console.error('Get platform stats error:', error);
    res.status(500).json({ error: 'Internal server error fetching platform stats' });
  }
}

// Get all users in the system (Admin only)
export async function getAllUsers(req: Request, res: Response) {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        tenantProfile: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (error: any) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Internal server error fetching users' });
  }
}

// Get all listings (Admin only)
export async function getAllListings(req: Request, res: Response) {
  try {
    const listings = await prisma.roomListing.findMany({
      include: {
        owner: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(listings);
  } catch (error: any) {
    console.error('Get all listings error:', error);
    res.status(500).json({ error: 'Internal server error fetching listings' });
  }
}

// Delete user (Admin only)
export async function deleteUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = parseInt(id);

    // Prevent deleting self
    const currentAdminId = (req as any).user.id;
    if (userId === currentAdminId) {
      return res.status(400).json({ error: 'Cannot delete your own admin account' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await prisma.user.delete({ where: { id: userId } });
    res.json({ message: 'User and all associated data deleted successfully' });
  } catch (error: any) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error deleting user' });
  }
}

// Delete listing (Admin only)
export async function deleteListing(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const listingId = parseInt(id);

    const listing = await prisma.roomListing.findUnique({ where: { id: listingId } });
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    await prisma.roomListing.delete({ where: { id: listingId } });
    res.json({ message: 'Room listing and all associated data deleted successfully' });
  } catch (error: any) {
    console.error('Delete listing error:', error);
    res.status(500).json({ error: 'Internal server error deleting listing' });
  }
}
