import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { calculateCompatibility } from './services/aiService';

const prisma = new PrismaClient();

// List of cities from all states and UTs of India
const SEED_CITIES = [
  'Visakhapatnam, Andhra Pradesh', 'Vijayawada, Andhra Pradesh', 'Amaravati, Andhra Pradesh', 'Tirupati, Andhra Pradesh',
  'Itanagar, Arunachal Pradesh',
  'Guwahati, Assam', 'Dispur, Assam', 'Dibrugarh, Assam',
  'Patna, Bihar', 'Gaya, Bihar', 'Muzaffarpur, Bihar',
  'Raipur, Chhattisgarh', 'Bhilai, Chhattisgarh',
  'Panaji, Goa', 'Margao, Goa',
  'Ahmedabad, Gujarat', 'Surat, Gujarat', 'Vadodara, Gujarat', 'Gandhinagar, Gujarat',
  'Gurugram, Haryana', 'Faridabad, Haryana', 'Panipat, Haryana',
  'Shimla, Himachal Pradesh', 'Dharamshala, Himachal Pradesh',
  'Ranchi, Jharkhand', 'Jamshedpur, Jharkhand', 'Dhanbad, Jharkhand',
  'Bengaluru, Karnataka', 'Mysuru, Karnataka', 'Hubli, Karnataka', 'Mangaluru, Karnataka',
  'Kochi, Kerala', 'Thiruvananthapuram, Kerala', 'Kozhikode, Kerala',
  'Indore, Madhya Pradesh', 'Bhopal, Madhya Pradesh', 'Gwalior, Madhya Pradesh', 'Jabalpur, Madhya Pradesh',
  'Mumbai, Maharashtra', 'Pune, Maharashtra', 'Nagpur, Maharashtra', 'Thane, Maharashtra', 'Nashik, Maharashtra',
  'Imphal, Manipur',
  'Shillong, Meghalaya',
  'Aizawl, Mizoram',
  'Kohima, Nagaland', 'Dimapur, Nagaland',
  'Bhubaneswar, Odisha', 'Cuttack, Odisha', 'Rourkela, Odisha',
  'Ludhiana, Punjab', 'Amritsar, Punjab', 'Jalandhar, Punjab', 'Patiala, Punjab',
  'Jaipur, Rajasthan', 'Jodhpur, Rajasthan', 'Udaipur, Rajasthan', 'Kota, Rajasthan',
  'Gangtok, Sikkim',
  'Chennai, Tamil Nadu', 'Coimbatore, Tamil Nadu', 'Madurai, Tamil Nadu', 'Salem, Tamil Nadu',
  'Hyderabad, Telangana', 'Warangal, Telangana', 'Nizamabad, Telangana',
  'Agartala, Tripura',
  'Lucknow, Uttar Pradesh', 'Noida, Uttar Pradesh', 'Kanpur, Uttar Pradesh', 'Varanasi, Uttar Pradesh', 'Ghaziabad, Uttar Pradesh', 'Agra, Uttar Pradesh',
  'Dehradun, Uttarakhand', 'Haridwar, Uttarakhand', 'Nainital, Uttarakhand',
  'Kolkata, West Bengal', 'Siliguri, West Bengal', 'Darjeeling, West Bengal', 'Howrah, West Bengal',
  'Delhi, Delhi UT', 'Srinagar, Jammu & Kashmir', 'Jammu, Jammu & Kashmir', 'Puducherry, Puducherry UT', 'Chandigarh, Chandigarh UT'
];

const ROOM_PHOTOS = [
  'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1560185127-6a2806647f81?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1527030280862-64139fbe04ca?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1502672023488-70e25813eb80?auto=format&fit=crop&w=800&q=80'
];

const ROOM_TYPES = ['Studio', 'Single', 'Shared', 'Apartment'];
const FURNISHING_STATUSES = ['Furnished', 'Semi-Furnished', 'Unfurnished'];

async function main() {
  console.log('🌱 Starting comprehensive database seeding...');

  // Clean old data in correct order
  await prisma.chatMessage.deleteMany({});
  await prisma.interestRequest.deleteMany({});
  await prisma.compatibilityScore.deleteMany({});
  await prisma.tenantProfile.deleteMany({});
  await prisma.roomListing.deleteMany({});
  await prisma.user.deleteMany({});

  const passwordHash = await bcrypt.hash('password123', 10);
  const adminPasswordHash = await bcrypt.hash('AdminPassword123!', 10);

  // Create Admins & Chatbot
  await prisma.user.create({
    data: {
      email: 'admin@rentfinder.com',
      password: adminPasswordHash,
      name: 'System Admin',
      role: 'ADMIN'
    }
  });

  const chatbot = await prisma.user.create({
    data: {
      id: 999,
      email: 'bot@flatsync.com',
      password: passwordHash,
      name: 'FlatSync AI Assistant',
      role: 'ADMIN'
    }
  });

  // Create Owners
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

  // Create Tenants
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

  // Create Chatbot dummy RoomListing (ID 999)
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

  // Create Tenant Profiles
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

  console.log('✅ Tenant profiles created.');

  // Generate 2 listings for every single city in India list (160+ total listings)
  console.log(`📦 Generating room listings for ${SEED_CITIES.length} Indian cities (2 flats per city)...`);
  
  const listings: any[] = [];
  let listingIdCounter = 1;

  for (const city of SEED_CITIES) {
    // Flat 1 (assigned to Alice)
    const rent1 = 12000 + Math.floor(Math.random() * 38000); // 12,000 to 50,000
    const type1 = ROOM_TYPES[Math.floor(Math.random() * ROOM_TYPES.length)];
    const furn1 = FURNISHING_STATUSES[Math.floor(Math.random() * FURNISHING_STATUSES.length)];
    const photo1 = ROOM_PHOTOS[(listingIdCounter) % ROOM_PHOTOS.length];
    
    const l1 = await prisma.roomListing.create({
      data: {
        id: listingIdCounter++,
        ownerId: alice.id,
        location: city,
        rent: rent1,
        availableFrom: '2026-08-01',
        roomType: type1,
        furnishingStatus: furn1,
        photos: JSON.stringify([photo1])
      }
    });
    listings.push(l1);

    // Flat 2 (assigned to Bob)
    const rent2 = 15000 + Math.floor(Math.random() * 55000); // 15,000 to 70,000
    const type2 = ROOM_TYPES[Math.floor(Math.random() * ROOM_TYPES.length)];
    const furn2 = FURNISHING_STATUSES[Math.floor(Math.random() * FURNISHING_STATUSES.length)];
    const photo2 = ROOM_PHOTOS[(listingIdCounter) % ROOM_PHOTOS.length];

    const l2 = await prisma.roomListing.create({
      data: {
        id: listingIdCounter++,
        ownerId: bob.id,
        location: city,
        rent: rent2,
        availableFrom: '2026-08-15',
        roomType: type2,
        furnishingStatus: furn2,
        photos: JSON.stringify([photo2])
      }
    });
    listings.push(l2);
  }

  console.log(`✅ ${listings.length} Room listings created.`);

  // Compute and seed compatibility scores
  const profiles = [profileCharlie, profileDavid];
  
  console.log('🧠 Precomputing compatibility scores (rule-based fallback mode to prevent API timeouts)...');
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
