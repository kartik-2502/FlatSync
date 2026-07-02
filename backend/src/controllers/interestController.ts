import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { sendInterestEmailToOwner, sendInterestResponseToTenant } from '../services/emailService';

const prisma = new PrismaClient();

// Express interest in a listing (Tenant only)
export async function expressInterest(req: Request, res: Response) {
  try {
    const tenantId = (req as any).user.id;
    const tenantName = (req as any).user.name;
    const { listingId } = req.body;

    if (!listingId) {
      return res.status(400).json({ error: 'listingId is required' });
    }

    const parsedListingId = parseInt(listingId);

    // Fetch listing and owner details
    const listing = await prisma.roomListing.findUnique({
      where: { id: parsedListingId },
      include: {
        owner: { select: { name: true, email: true } }
      }
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.isFilled) {
      return res.status(400).json({ error: 'This listing has already been filled' });
    }

    // Check if interest already exists
    const existingInterest = await prisma.interestRequest.findUnique({
      where: {
        tenantId_listingId: {
          tenantId,
          listingId: parsedListingId
        }
      }
    });

    if (existingInterest) {
      return res.status(400).json({ error: 'You have already expressed interest in this listing' });
    }

    // Create interest request
    const interest = await prisma.interestRequest.create({
      data: {
        tenantId,
        listingId: parsedListingId,
        status: 'PENDING'
      }
    });

    // Fetch compatibility score
    const tenantProfile = await prisma.tenantProfile.findUnique({
      where: { tenantId }
    });

    let compatibilityScore = 0;
    let explanation = 'No tenant profile completed.';

    if (tenantProfile) {
      const comp = await prisma.compatibilityScore.findUnique({
        where: {
          tenantProfileId_listingId: {
            tenantProfileId: tenantProfile.id,
            listingId: parsedListingId
          }
        }
      });
      if (comp) {
        compatibilityScore = comp.score;
        explanation = comp.explanation;
      }
    }

    // Trigger email alert to owner if score is high (>= 80)
    if (compatibilityScore >= 80) {
      console.log(`Interest Controller: High compatibility match (${compatibilityScore} >= 80) - sending email to owner`);
      // Run email asynchronously
      sendInterestEmailToOwner(
        listing.owner.email,
        listing.owner.name,
        tenantName,
        compatibilityScore,
        explanation,
        listing.location
      ).catch(err => console.error('Error sending interest email to owner:', err));
    }

    res.status(201).json({
      message: 'Interest expressed successfully',
      interest,
      compatibilityScore
    });
  } catch (error: any) {
    console.error('Express interest error:', error);
    res.status(500).json({ error: 'Internal server error while expressing interest' });
  }
}

// Accept or Decline interest request (Owner only)
export async function respondToInterest(req: Request, res: Response) {
  try {
    const ownerId = (req as any).user.id;
    const ownerName = (req as any).user.name;
    const { interestId, status } = req.body;

    if (!interestId || !status) {
      return res.status(400).json({ error: 'interestId and status (ACCEPTED/DECLINED) are required' });
    }

    if (status !== 'ACCEPTED' && status !== 'DECLINED') {
      return res.status(400).json({ error: 'Status must be ACCEPTED or DECLINED' });
    }

    const parsedInterestId = parseInt(interestId);

    // Fetch interest details
    const interest = await prisma.interestRequest.findUnique({
      where: { id: parsedInterestId },
      include: {
        listing: true,
        tenant: { select: { name: true, email: true } }
      }
    });

    if (!interest) {
      return res.status(404).json({ error: 'Interest request not found' });
    }

    // Verify owner permissions
    if (interest.listing.ownerId !== ownerId) {
      return res.status(403).json({ error: 'Access denied: You do not own the listing associated with this interest request' });
    }

    // Update status
    const updatedInterest = await prisma.interestRequest.update({
      where: { id: parsedInterestId },
      data: { status }
    });

    // Send email notification to tenant
    console.log(`Interest Controller: Sending interest response email to tenant: ${interest.tenant.email} (Status: ${status})`);
    sendInterestResponseToTenant(
      interest.tenant.email,
      interest.tenant.name,
      ownerName,
      interest.listing.location,
      status
    ).catch(err => console.error('Error sending interest response email to tenant:', err));

    res.json({
      message: `Interest request status updated to ${status}`,
      interest: updatedInterest
    });
  } catch (error: any) {
    console.error('Respond to interest error:', error);
    res.status(500).json({ error: 'Internal server error while responding to interest' });
  }
}

// Get interest requests for current logged-in user
export async function getMyInterests(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    if (userRole === 'TENANT') {
      // Return interests this tenant has sent
      const interests = await prisma.interestRequest.findMany({
        where: { tenantId: userId },
        include: {
          listing: {
            include: {
              owner: { select: { id: true, name: true, email: true } }
            }
          }
        }
      });

      // Inject compatibility score
      const tenantProfile = await prisma.tenantProfile.findUnique({
        where: { tenantId: userId }
      });

      const formatted = await Promise.all(
        interests.map(async (interest) => {
          let score = 0;
          let explanation = '';
          if (tenantProfile) {
            const comp = await prisma.compatibilityScore.findUnique({
              where: {
                tenantProfileId_listingId: {
                  tenantProfileId: tenantProfile.id,
                  listingId: interest.listingId
                }
              }
            });
            if (comp) {
              score = comp.score;
              explanation = comp.explanation;
            }
          }
          return {
            ...interest,
            compatibility: { score, explanation }
          };
        })
      );

      return res.json(formatted);
    } else if (userRole === 'OWNER') {
      // Return interests received for listings owned by this owner
      const interests = await prisma.interestRequest.findMany({
        where: {
          listing: { ownerId: userId }
        },
        include: {
          listing: true,
          tenant: {
            select: {
              id: true,
              name: true,
              email: true,
              tenantProfile: true
            }
          }
        }
      });

      const formatted = await Promise.all(
        interests.map(async (interest) => {
          let score = 0;
          let explanation = '';
          if (interest.tenant.tenantProfile) {
            const comp = await prisma.compatibilityScore.findUnique({
              where: {
                tenantProfileId_listingId: {
                  tenantProfileId: interest.tenant.tenantProfile.id,
                  listingId: interest.listingId
                }
              }
            });
            if (comp) {
              score = comp.score;
              explanation = comp.explanation;
            }
          }
          return {
            ...interest,
            compatibility: { score, explanation }
          };
        })
      );

      return res.json(formatted);
    }

    res.json([]);
  } catch (error: any) {
    console.error('Get my interests error:', error);
    res.status(500).json({ error: 'Internal server error while fetching interests' });
  }
}
