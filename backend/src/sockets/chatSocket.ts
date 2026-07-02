import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

interface DecodedToken {
  id: number;
  email: string;
  role: string;
  name: string;
}

export function setupChatSockets(io: Server) {
  // Middleware to authenticate socket connections via JWT
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication error: Token is required'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
      socket.data.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const currentUser = socket.data.user as DecodedToken;
    console.log(`🔌 User connected to WebSocket: ${currentUser.email} (ID: ${currentUser.id})`);

    // Join a chat room for a specific listing and tenant
    socket.on('join_room', async ({ listingId, tenantId }: { listingId: number; tenantId: number }) => {
      try {
        const parsedListingId = Number(listingId);
        const parsedTenantId = Number(tenantId);

        // --- CHATBOT ROOM HANDLING (listingId === 999) ---
        if (parsedListingId === 999) {
          const roomName = `room_999_${currentUser.id}`;
          socket.join(roomName);
          console.log(`🤖 User ${currentUser.email} joined chatbot room: ${roomName}`);

          // Fetch bot message history
          const messages = await prisma.chatMessage.findMany({
            where: {
              listingId: 999,
              OR: [
                { senderId: currentUser.id, receiverId: 999 },
                { senderId: 999, receiverId: currentUser.id }
              ]
            },
            orderBy: {
              createdAt: 'asc'
            }
          });

          // Send welcome message if history is empty
          if (messages.length === 0) {
            const welcomeMsg = await prisma.chatMessage.create({
              data: {
                senderId: 999,
                receiverId: currentUser.id,
                listingId: 999,
                content: `Namaste ${currentUser.name}! 🙏 I am FlatSync AI Assistant. I can help you find rooms or matching flatmates in Indian cities (Mumbai, Bangalore, Delhi, Pune). Ask me anything!`
              }
            });
            socket.emit('message_history', [welcomeMsg]);
          } else {
            socket.emit('message_history', messages);
          }
          return;
        }

        // --- REGULAR CHAT ROOM HANDLING ---
        // Check if there is an accepted interest request between this tenant and listing
        const interest = await prisma.interestRequest.findUnique({
          where: {
            tenantId_listingId: {
              tenantId: parsedTenantId,
              listingId: parsedListingId
            }
          },
          include: {
            listing: true
          }
        });

        if (!interest || interest.status !== 'ACCEPTED') {
          socket.emit('error_msg', { message: 'Access denied: Interest is not accepted yet' });
          return;
        }

        // Verify that the connected user is either the tenant or the owner of the listing
        const isTenant = currentUser.id === parsedTenantId;
        const isOwner = currentUser.id === interest.listing.ownerId;
        const isAdmin = currentUser.role === 'ADMIN';

        if (!isTenant && !isOwner && !isAdmin) {
          socket.emit('error_msg', { message: 'Access denied: You are not a participant in this conversation' });
          return;
        }

        const roomName = `room_${parsedListingId}_${parsedTenantId}`;
        socket.join(roomName);
        console.log(`👥 User ${currentUser.email} joined room: ${roomName}`);
        
        // Fetch message history
        const messages = await prisma.chatMessage.findMany({
          where: {
            listingId: parsedListingId,
            OR: [
              { senderId: parsedTenantId, receiverId: interest.listing.ownerId },
              { senderId: interest.listing.ownerId, receiverId: parsedTenantId }
            ]
          },
          orderBy: {
            createdAt: 'asc'
          }
        });

        socket.emit('message_history', messages);
      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('error_msg', { message: 'Internal server error while joining room' });
      }
    });

    // Handle incoming messages
    socket.on('send_message', async ({
      listingId,
      receiverId,
      content
    }: {
      listingId: number;
      receiverId: number;
      content: string;
    }) => {
      try {
        const parsedListingId = Number(listingId);
        const parsedReceiverId = Number(receiverId);

        if (!content || content.trim() === '') return;

        // --- CHATBOT MESSAGE HANDLING (listingId === 999 / receiverId === 999) ---
        if (parsedListingId === 999 || parsedReceiverId === 999) {
          // Save the user's message
          const userMsg = await prisma.chatMessage.create({
            data: {
              senderId: currentUser.id,
              receiverId: 999,
              listingId: 999,
              content: content.trim()
            }
          });

          const roomName = `room_999_${currentUser.id}`;
          // Echo message back to user instantly
          io.to(roomName).emit('new_message', userMsg);

          // Asynchronously generate and send AI bot response
          respondFromChatbot(io, currentUser.id, content.trim(), roomName);
          return;
        }

        // --- REGULAR CHAT MESSAGE HANDLING ---
        // Verify the interest request is accepted
        const interest = await prisma.interestRequest.findFirst({
          where: {
            listingId: parsedListingId,
            status: 'ACCEPTED',
            OR: [
              { tenantId: currentUser.id, listing: { ownerId: parsedReceiverId } },
              { tenantId: parsedReceiverId, listing: { ownerId: currentUser.id } }
            ]
          },
          include: {
            listing: true
          }
        });

        if (!interest) {
          socket.emit('error_msg', { message: 'Cannot send message: Interest is not accepted' });
          return;
        }

        // Save the chat message to database
        const chatMessage = await prisma.chatMessage.create({
          data: {
            senderId: currentUser.id,
            receiverId: parsedReceiverId,
            listingId: parsedListingId,
            content: content.trim()
          }
        });

        // Determine room name
        const tenantId = currentUser.role === 'TENANT' ? currentUser.id : parsedReceiverId;
        const roomName = `room_${parsedListingId}_${tenantId}`;

        // Broadcast message to everyone in the room (including sender)
        io.to(roomName).emit('new_message', chatMessage);
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error_msg', { message: 'Internal server error while sending message' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 User disconnected: ${currentUser.email}`);
    });
  });
}

// Function to call Gemini or fallback to rule-based responses
async function respondFromChatbot(io: Server, userId: number, message: string, roomName: string) {
  let botReply = '';
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey.trim() !== '' && !apiKey.startsWith('YOUR_GEMINI_')) {
    try {
      const systemInstruction = `You are FlatSync AI Assistant, a helpful chatbot for FlatSync, a real-time room and flatmate matching platform.
You assist users in finding flatmates and room listings, especially in Indian cities like Mumbai, Delhi, Bangalore, Pune, Hyderabad, Chennai, Kolkata.
Keep your answers helpful, friendly, and concise (maximum 3 sentences). Refer to FlatSync features when appropriate.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemInstruction}\n\nUser message: ${message}` }] }]
        })
      });

      if (response.ok) {
        const data = (await response.json()) as any;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) botReply = text.trim();
      }
    } catch (err) {
      console.warn('Gemini chatbot call failed, using rule-based response:', err);
    }
  }

  // Fallback Rule-Based Bot Responses for Indian Cities
  if (!botReply) {
    const text = message.toLowerCase();
    if (text.includes('mumbai') || text.includes('bandra')) {
      botReply = "Mumbai is a vibrant city! In FlatSync, we have room listings in Bandra West (Bandra) starting from ₹42,000/month. Complete your profile and we'll calculate compatibility matching for it!";
    } else if (text.includes('bangalore') || text.includes('bengaluru') || text.includes('indiranagar')) {
      botReply = "Bengaluru (Bangalore) is India's tech hub! FlatSync has a prime room listing in Indiranagar for ₹28,000/month. It's a great match if your budget and move-in date line up!";
    } else if (text.includes('delhi') || text.includes('connaught')) {
      botReply = "Delhi's Connaught Place is a central, bustling landmark. We have room listings there for ₹35,000/month. You can express interest to start a real-time chat with the owner!";
    } else if (text.includes('pune') || text.includes('koregaon')) {
      botReply = "Pune is known for Koregaon Park's trendy vibe and cafes. We have a shared room listing there for ₹22,000/month. Check it out on the Browse tab.";
    } else if (text.includes('hello') || text.includes('hi') || text.includes('hey')) {
      botReply = "Namaste! I am your FlatSync AI Assistant. How can I help you find flatmates or room listings in India today?";
    } else if (text.includes('price') || text.includes('budget') || text.includes('rent')) {
      botReply = "FlatSync helps you match rent options. Our current listings in Indian cities range from ₹22,000 in Pune to ₹42,000 in Mumbai. Fill out your matching profile to filter what works for you.";
    } else {
      botReply = "I am here to help you navigate FlatSync. Feel free to ask about roommate matches, or room listings in cities like Mumbai, Delhi, Bangalore, and Pune!";
    }
  }

  try {
    // Save bot message to DB
    const botMsg = await prisma.chatMessage.create({
      data: {
        senderId: 999,
        receiverId: userId,
        listingId: 999,
        content: botReply
      }
    });

    // Broadcast bot reply to user room
    io.to(roomName).emit('new_message', botMsg);
  } catch (err) {
    console.error('Error saving chatbot response:', err);
  }
}
