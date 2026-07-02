import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { calculateCompatibility } from './services/aiService';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding with Indian city data & chatbot listing...');

  // Clean old data in correct order
  await prisma.chatMessage.deleteMany({});
  await prisma.interestRequest.deleteMany({});
  await prisma.compatibilityScore.deleteMany({});
  await prisma.tenantProfile.deleteMany({});
  await prisma.roomListing.deleteMany({});
  await prisma.user.deleteMany({});

  const passwordHash = await bcrypt.hash('password123', 10);
  const adminPasswordHash = await bcrypt.hash('AdminPassword123!', 10);

  // 1. Create Users
  const admin = await prisma.user.create({
    data: {
      email: 'admin@rentfinder.com',
      password: adminPasswordHash,
      name: 'System Admin',
      role: 'ADMIN'
    }
  });

  // Seed the chatbot user (ID 999)
  const chatbot = await prisma.user.create({
    data: {
      id: 999,
      email: 'bot@flatsync.com',
      password: passwordHash,
      name: 'FlatSync AI Assistant',
      role: 'ADMIN'
    }
  });

  const alice = await prisma.user.create({
    data: {
      email: 'owner1@rentfinder.com',
      password: passwordHash,
      name: 'Alice Johnson',
      role: 'OWNER'
    }
  });

  const bob = await prisma.user.create({
    data: {
      email: 'owner2@rentfinder.com',
      password: passwordHash,
      name: 'Bob Smith',
      role: 'OWNER'
    }
  });

  const charlie = await prisma.user.create({
    data: {
      email: 'tenant1@rentfinder.com',
      password: passwordHash,
      name: 'Charlie Brown',
      role: 'TENANT'
    }
  });

  const david = await prisma.user.create({
    data: {
      email: 'tenant2@rentfinder.com',
      password: passwordHash,
      name: 'David Miller',
      role: 'TENANT'
    }
  });

  console.log('✅ Users & Bot created.');

  // 2. Create Chatbot dummy RoomListing (ID 999) to satisfy foreign key constraints
  await prisma.roomListing.create({
    data: {
      id: 999,
      ownerId: chatbot.id,
      location: 'FlatSync AI Support',
      rent: 0,
      availableFrom: '2026-07-02',
      roomType: 'Support',
      furnishingStatus: 'N/A',
      photos: JSON.stringify([])
    }
  });
  console.log('✅ Chatbot support listing created.');

  // 3. Create Tenant Profiles (Indian state format)
  const profileCharlie = await prisma.tenantProfile.create({
    data: {
      tenantId: charlie.id,
      preferredLocation: 'Mumbai, Maharashtra',
      budgetMin: 20000,
      budgetMax: 50000,
      moveInDate: '2026-08-01'
    }
  });

  const profileDavid = await prisma.tenantProfile.create({
    data: {
      tenantId: david.id,
      preferredLocation: 'Bengaluru, Karnataka',
      budgetMin: 15000,
      budgetMax: 35000,
      moveInDate: '2026-09-01'
    }
  });

  console.log('✅ Tenant profiles created (Mumbai, Bengaluru).');

  // 4. Create Listings (Indian state format)
  const listingsData = [
    {
      ownerId: alice.id,
      location: 'Mumbai, Maharashtra',
      rent: 42000,
      availableFrom: '2026-07-15',
      roomType: 'Studio',
      furnishingStatus: 'Furnished',
      photos: JSON.stringify([
        'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80'
      ])
    },
    {
      ownerId: alice.id,
      location: 'Bengaluru, Karnataka',
      rent: 28000,
      availableFrom: '2026-08-01',
      roomType: 'Single',
      furnishingStatus: 'Semi-Furnished',
      photos: JSON.stringify([
        'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=800&q=80'
      ])
    },
    {
      ownerId: bob.id,
      location: 'Pune, Maharashtra',
      rent: 22000,
      availableFrom: '2026-08-10',
      roomType: 'Shared',
      furnishingStatus: 'Unfurnished',
      photos: JSON.stringify([
        'https://images.unsplash.com/photo-1560185127-6a2806647f81?auto=format&fit=crop&w=800&q=80'
      ])
    },
    {
      ownerId: bob.id,
      location: 'Delhi, Delhi UT',
      rent: 35000,
      availableFrom: '2026-07-20',
      roomType: 'Apartment',
      furnishingStatus: 'Furnished',
      photos: JSON.stringify([
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80'
      ])
    }
  ];

  const listings = [];
  for (const data of listingsData) {
    const listing = await prisma.roomListing.create({ data });
    listings.push(listing);
  }

  console.log('✅ Room listings created.');

  // 5. Compute and seed compatibility scores
  const profiles = [profileCharlie, profileDavid];
  
  console.log('🧠 Precomputing and saving compatibility scores...');
  for (const profile of profiles) {
    for (const listing of listings) {
      const result = await calculateCompatibility(profile, listing);
      await prisma.compatibilityScore.create({
        data: {
          tenantProfileId: profile.id,
          listingId: listing.id,
          score: result.score,
          explanation: result.explanation,
          method: result.method
        }
      });
    }
  }

  console.log('✅ Compatibility scores precomputed and seeded.');
  console.log('🎉 Seeding successfully completed!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
