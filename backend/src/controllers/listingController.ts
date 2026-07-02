import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { calculateCompatibility } from '../services/aiService';

const prisma = new PrismaClient();

// Post a room listing (Owner only)
export async function createListing(req: Request, res: Response) {
  try {
    const ownerId = (req as any).user.id;
    const { location, rent, availableFrom, roomType, furnishingStatus, photos } = req.body;

    if (!location || rent === undefined || !availableFrom || !roomType || !furnishingStatus) {
      return res.status(400).json({ error: 'All fields (location, rent, availableFrom, roomType, furnishingStatus) are required' });
    }

    // Default stock photos if none provided
    const defaultPhotos = [
      'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80'
    ];
    const photoList = photos ? JSON.stringify(photos) : JSON.stringify(defaultPhotos);

    const listing = await prisma.roomListing.create({
      data: {
        ownerId,
        location,
        rent: parseFloat(rent),
        availableFrom,
        roomType,
        furnishingStatus,
        photos: photoList,
        isFilled: false
      }
    });

    // Async: Precompute compatibility scores for all existing tenant profiles
    precomputeScoresForListing(listing);

    res.status(201).json({
      message: 'Listing created successfully',
      listing
    });
  } catch (error: any) {
    console.error('Create listing error:', error);
    res.status(500).json({ error: 'Internal server error while creating listing' });
  }
}

// Browse and filter room listings
export async function getListings(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { location, maxRent } = req.query;

    // Filter building
    const whereClause: any = { isFilled: false };
    
    if (location && typeof location === 'string' && location.trim() !== '') {
      whereClause.location = { contains: location.trim() };
    }

    if (maxRent) {
      whereClause.rent = { lte: parseFloat(maxRent as string) };
    }

    // Fetch listings
    const listings = await prisma.roomListing.findMany({
      where: whereClause,
      include: {
        owner: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // If user is a tenant, inject compatibility scores and rank
    if (user.role === 'TENANT') {
      const tenantProfile = await prisma.tenantProfile.findUnique({
        where: { tenantId: user.id }
      });

      if (!tenantProfile) {
        // Return without scores if tenant hasn't completed their profile yet
        return res.json(listings.map(l => ({ ...l, compatibility: null })));
      }

      // Fetch or compute scores for each listing
      const rankedListings = await Promise.all(
        listings.map(async (listing) => {
          let comp = await prisma.compatibilityScore.findUnique({
            where: {
              tenantProfileId_listingId: {
                tenantProfileId: tenantProfile.id,
                listingId: listing.id
              }
            }
          });

          // Fallback: If not precomputed (e.g. race condition or direct db edits), compute now
          if (!comp) {
            const calculated = await calculateCompatibility(tenantProfile, listing);
            comp = await prisma.compatibilityScore.create({
              data: {
                tenantProfileId: tenantProfile.id,
                listingId: listing.id,
                score: calculated.score,
                explanation: calculated.explanation,
                method: calculated.method
              }
            });
          }

          return {
            ...listing,
            compatibility: {
              score: comp.score,
              explanation: comp.explanation,
              method: comp.method
            }
          };
        })
      );

      // Sort by compatibility score descending
      rankedListings.sort((a, b) => (b.compatibility?.score || 0) - (a.compatibility?.score || 0));
      return res.json(rankedListings);
    }

    // Owner browsing or admin browsing - no score sorting by default
    res.json(listings.map(l => ({ ...l, compatibility: null })));
  } catch (error: any) {
    console.error('Get listings error:', error);
    res.status(500).json({ error: 'Internal server error while fetching listings' });
  }
}

// Get listings owned by current user (Owner only)
export async function getOwnerListings(req: Request, res: Response) {
  try {
    const ownerId = (req as any).user.id;
    const listings = await prisma.roomListing.findMany({
      where: { ownerId },
      include: {
        interests: {
          include: {
            tenant: {
              include: { tenantProfile: true }
            }
          }
        }
      }
    });

    res.json(listings);
  } catch (error: any) {
    console.error('Get owner listings error:', error);
    res.status(500).json({ error: 'Internal server error fetching owner listings' });
  }
}

// Mark a listing as filled or toggle status
export async function toggleListingFilled(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    const listingId = parseInt(id);
    const listing = await prisma.roomListing.findUnique({
      where: { id: listingId }
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Check if the user owns this listing or is admin
    if (listing.ownerId !== userId && userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied: You do not own this listing' });
    }

    const updatedListing = await prisma.roomListing.update({
      where: { id: listingId },
      data: { isFilled: !listing.isFilled }
    });

    res.json({
      message: `Listing marked as ${updatedListing.isFilled ? 'FILLED' : 'ACTIVE'}`,
      listing: updatedListing
    });
  } catch (error: any) {
    console.error('Toggle listing filled error:', error);
    res.status(500).json({ error: 'Internal server error updating listing status' });
  }
}

async function precomputeScoresForListing(listing: any) {
  try {
    const tenantProfiles = await prisma.tenantProfile.findMany();
    console.log(`Precomputing compatibility for listing ${listing.id} across ${tenantProfiles.length} tenant profiles...`);

    for (const tenantProfile of tenantProfiles) {
      const result = await calculateCompatibility(tenantProfile, listing);
      
      await prisma.compatibilityScore.create({
        data: {
          tenantProfileId: tenantProfile.id,
          listingId: listing.id,
          score: result.score,
          explanation: result.explanation,
          method: result.method
        }
      });
    }
    console.log(`Finished precomputing scores for listing ${listing.id}.`);
  } catch (error) {
    console.error('Failed to precompute scores for listing:', error);
  }
}
