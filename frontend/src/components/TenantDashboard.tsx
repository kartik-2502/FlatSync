import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Search, User, Home, MessageSquare, Heart, Calendar, 
  MapPin, IndianRupee, RefreshCw, Send, CheckCircle, Clock, XCircle 
} from 'lucide-react';
import CityInput from './CityInput';

interface TenantDashboardProps {
  token: string;
  user: any;
  onProfileUpdate: (updatedUser: any) => void;
}

export default function TenantDashboard({ token, user, onProfileUpdate }: TenantDashboardProps) {
  const [activeSubTab, setActiveSubTab] = useState<'listings' | 'interests' | 'chat' | 'profile'>('listings');
  
  // Profile state
  const [prefLocation, setPrefLocation] = useState(user.tenantProfile?.preferredLocation || '');
  const [budgetMin, setBudgetMin] = useState(user.tenantProfile?.budgetMin || 500);
  const [budgetMax, setBudgetMax] = useState(user.tenantProfile?.budgetMax || 2000);
  const [moveInDate, setMoveInDate] = useState(user.tenantProfile?.moveInDate || '');
  const [profileMsg, setProfileMsg] = useState('');

  // Listings state
  const [listings, setListings] = useState<any[]>([]);
  const [searchLoc, setSearchLoc] = useState('');
  const [maxRent, setMaxRent] = useState<number | ''>('');
  const [selectedListing, setSelectedListing] = useState<any | null>(null);
  const [interestLoading, setInterestLoading] = useState(false);

  // Sent Interests state
  const [myInterests, setMyInterests] = useState<any[]>([]);

  // Chat state
  const [chatRooms, setChatRooms] = useState<any[]>([]);
  const [activeRoom, setActiveRoom] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch listings
  const fetchListings = async () => {
    try {
      const query = new URLSearchParams();
      if (searchLoc) query.append('location', searchLoc);
      if (maxRent) query.append('maxRent', maxRent.toString());
      
      const res = await fetch(`/api/listings?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setListings(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch tenant's expressed interests
  const fetchInterests = async () => {
    try {
      const res = await fetch('/api/interests/my', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setMyInterests(data);
        
        // Filter those which are accepted to build the Chat Rooms list
        const accepted = data.filter((i: any) => i.status === 'ACCEPTED');
        const botRoom = {
          id: 'bot_room_static',
          listingId: 999,
          tenantId: user.id,
          status: 'ACCEPTED',
          listing: {
            id: 999,
            location: 'FlatSync AI Support',
            ownerId: 999,
            owner: {
              id: 999,
              name: 'FlatSync AI Assistant',
              email: 'bot@flatsync.com'
            }
          }
        };
        setChatRooms([botRoom, ...accepted]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Trigger fetches on tab change
  useEffect(() => {
    if (activeSubTab === 'listings') {
      fetchListings();
    } else if (activeSubTab === 'interests') {
      fetchInterests();
    } else if (activeSubTab === 'chat') {
      fetchInterests();
    }
  }, [activeSubTab]);

  // Init fetch
  useEffect(() => {
    fetchListings();
  }, []);

  // Socket Connection for Chat
  useEffect(() => {
    if (activeSubTab === 'chat' && token) {
      // Connect socket
      const socketUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:5000' 
        : (import.meta.env.VITE_BACKEND_URL || 'https://flatsync-backend.onrender.com');
      const socket = io(socketUrl, {
        auth: { token }
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('Socket.io connected');
      });

      socket.on('message_history', (history: any[]) => {
        setMessages(history);
      });

      socket.on('new_message', (msg: any) => {
        setMessages((prev) => [...prev, msg]);
      });

      socket.on('error_msg', (err: any) => {
        alert(err.message);
      });

      return () => {
        socket.disconnect();
        socketRef.current = null;
      };
    }
  }, [activeSubTab, token]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Join chat room
  const joinChatRoom = (room: any) => {
    if (!socketRef.current) return;
    setActiveRoom(room);
    setMessages([]);
    socketRef.current.emit('join_room', {
      listingId: room.listingId,
      tenantId: user.id
    });
  };

  // Send message
  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socketRef.current || !activeRoom || !messageInput.trim()) return;

    socketRef.current.emit('send_message', {
      listingId: activeRoom.listingId,
      receiverId: activeRoom.listing.ownerId,
      content: messageInput
    });
    setMessageInput('');
  };

  // Update tenant profile
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg('');
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: user.name,
          preferredLocation: prefLocation,
          budgetMin,
          budgetMax,
          moveInDate
        })
      });
      const data = await res.json();
      if (res.ok) {
        setProfileMsg('Profile updated and compatibility scores recalculated successfully!');
        onProfileUpdate(data);
      } else {
        setProfileMsg(data.error || 'Failed to update profile.');
      }
    } catch (err) {
      console.error(err);
      setProfileMsg('Failed to update profile.');
    }
  };

  // Send interest request to owner
  const handleExpressInterest = async (listingId: number) => {
    if (!user.tenantProfile) {
      alert('Please complete your search profile first before expressing interest!');
      setActiveSubTab('profile');
      setSelectedListing(null);
      return;
    }
    setInterestLoading(true);
    try {
      const res = await fetch('/api/interests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ listingId })
      });
      const data = await res.json();
      setInterestLoading(false);
      if (res.ok) {
        alert('Interest request sent successfully!');
        setSelectedListing(null);
        setActiveSubTab('interests');
      } else {
        alert(data.error || 'Failed to express interest.');
      }
    } catch (err) {
      setInterestLoading(false);
      console.error(err);
      alert('Failed to express interest.');
    }
  };

  const getScoreClass = (score: number | null) => {
    if (score === null) return 'score-low';
    if (score >= 80) return 'score-high';
    if (score >= 50) return 'score-mid';
    return 'score-low';
  };

  return (
    <div className="dashboard-grid">
      <div className="sidebar">
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 18, color: 'white' }}>Tenant Dashboard</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Welcome, {user.name}</p>
        </div>
        <div className={`sidebar-tab ${activeSubTab === 'listings' ? 'active' : ''}`} onClick={() => setActiveSubTab('listings')}>
          <Home size={18} /> Browse Rooms
        </div>
        <div className={`sidebar-tab ${activeSubTab === 'interests' ? 'active' : ''}`} onClick={() => setActiveSubTab('interests')}>
          <Heart size={18} /> My Interest Requests
        </div>
        <div className={`sidebar-tab ${activeSubTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveSubTab('chat')}>
          <MessageSquare size={18} /> Real-Time Chat
        </div>
        <div className={`sidebar-tab ${activeSubTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveSubTab('profile')}>
          <User size={18} /> Matching Profile
        </div>
      </div>

      <div className="main-content">
        {/* BROWSE ROOMS TAB */}
        {activeSubTab === 'listings' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h2>Find Your Match</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Rooms ranked by AI compatibility score matching your budget and location.</p>
              </div>
              <button className="btn btn-secondary" onClick={fetchListings}>
                <RefreshCw size={14} /> Refresh
              </button>
            </div>

            {/* Filter bar */}
            <div className="glass-card" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: 16, marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
                <Search size={16} color="var(--text-secondary)" />
                <CityInput
                  placeholder="Filter by city (e.g. Mumbai, Maharashtra)..."
                  value={searchLoc}
                  onChange={setSearchLoc}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 220 }}>
                <IndianRupee size={16} color="var(--text-secondary)" />
                <input
                  type="number"
                  placeholder="Max Rent (₹)"
                  className="form-input"
                  value={maxRent}
                  onChange={(e) => setMaxRent(e.target.value === '' ? '' : parseInt(e.target.value))}
                  style={{ border: 'none', background: 'transparent', padding: '6px 0' }}
                />
              </div>
              <button className="btn btn-primary" onClick={fetchListings}>Filter</button>
            </div>

            {/* Listings Grid */}
            {listings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                No active room listings match your search criteria.
              </div>
            ) : (
              <div className="listings-grid">
                {listings.map((listing) => {
                  const hasScore = listing.compatibility !== null;
                  const score = hasScore ? listing.compatibility.score : null;
                  
                  return (
                    <div key={listing.id} className="glass-card listing-card">
                      <div className="listing-image-container">
                        <img 
                          src={JSON.parse(listing.photos)[0]} 
                          alt={listing.location} 
                          className="listing-image"
                        />
                        <div className="listing-rent-tag">₹{listing.rent}/mo</div>
                        {user.tenantProfile && (
                          <div className="listing-compat-badge">
                            <div className={`score-ring ${getScoreClass(score)}`}>
                              {score !== null ? `${score}%` : 'N/A'}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="listing-details">
                        <h3 style={{ fontSize: 16, color: 'white', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <MapPin size={16} color="var(--accent-primary)" /> {listing.location}
                        </h3>
                        
                        <div className="listing-tags">
                          <span className="tag">{listing.roomType}</span>
                          <span className="tag">{listing.furnishingStatus}</span>
                          <span className="tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Calendar size={12} /> Available: {listing.availableFrom}
                          </span>
                        </div>

                        {listing.compatibility && (
                          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineBreak: 'anywhere', margin: '8px 0', fontStyle: 'italic' }}>
                            "{listing.compatibility.explanation.slice(0, 100)}..."
                          </p>
                        )}

                        <div style={{ marginTop: 'auto', paddingTop: 12 }}>
                          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setSelectedListing(listing)}>
                            View Listing & AI Fit
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* DETAILS MODAL */}
        {selectedListing && (
          <div className="modal-overlay" onClick={() => setSelectedListing(null)}>
            <div className="glass-card modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 650 }}>
              <div className="modal-header">
                <h2>Room in {selectedListing.location}</h2>
                <button className="btn btn-secondary btn-icon" onClick={() => setSelectedListing(null)} style={{ padding: 6 }}>
                  &times;
                </button>
              </div>

              <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                <img 
                  src={JSON.parse(selectedListing.photos)[0]} 
                  alt="Room" 
                  style={{ width: '100%', height: 220, objectFit: 'cover', borderRadius: 8 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Monthly Rent</p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>₹{selectedListing.rent}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Room Type</p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>{selectedListing.roomType}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Furnishing Status</p>
                  <p style={{ fontSize: 16, fontWeight: 600 }}>{selectedListing.furnishingStatus}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Available Date</p>
                  <p style={{ fontSize: 16, fontWeight: 600 }}>{selectedListing.availableFrom}</p>
                </div>
              </div>

              {selectedListing.compatibility ? (
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--glass-border)', padding: 16, borderRadius: 8, marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <div className={`score-ring ${getScoreClass(selectedListing.compatibility.score)}`} style={{ width: 44, height: 44, fontSize: 12 }}>
                      {selectedListing.compatibility.score}%
                    </div>
                    <div>
                      <h4 style={{ color: 'white' }}>Compatibility Score</h4>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Computed via AI ({selectedListing.compatibility.method})</p>
                    </div>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {selectedListing.compatibility.explanation}
                  </p>
                </div>
              ) : (
                <div style={{ padding: 12, background: 'rgba(255, 255, 255, 0.02)', borderRadius: 6, marginBottom: 20 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Complete your search profile to view AI compatibility analysis for this listing.</p>
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setSelectedListing(null)}>Cancel</button>
                <button 
                  className="btn btn-primary" 
                  disabled={interestLoading}
                  onClick={() => handleExpressInterest(selectedListing.id)}
                >
                  {interestLoading ? 'Sending...' : 'Express Interest'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MY INTERESTS TAB */}
        {activeSubTab === 'interests' && (
          <div>
            <h2>My Interest Requests</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Tracks owners' responses to room listings you applied to.</p>

            {myInterests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                You have not expressed interest in any rooms yet.
              </div>
            ) : (
              <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Room Location</th>
                      <th>Rent</th>
                      <th>Match Score</th>
                      <th>Owner</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myInterests.map((interest) => (
                      <tr key={interest.id}>
                        <td style={{ fontWeight: 600, color: 'white' }}>{interest.listing.location}</td>
                        <td>₹{interest.listing.rent}/mo</td>
                        <td>
                          <span style={{ 
                            color: interest.compatibility.score >= 80 ? 'var(--success)' : interest.compatibility.score >= 50 ? 'var(--warning)' : 'var(--danger)',
                            fontWeight: 700 
                          }}>
                            {interest.compatibility.score}%
                          </span>
                        </td>
                        <td>{interest.listing.owner.name}</td>
                        <td>
                          {interest.status === 'PENDING' && (
                            <span style={{ color: 'var(--warning)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                              <Clock size={14} /> Pending
                            </span>
                          )}
                          {interest.status === 'ACCEPTED' && (
                            <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                              <CheckCircle size={14} /> Accepted
                            </span>
                          )}
                          {interest.status === 'DECLINED' && (
                            <span style={{ color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                              <XCircle size={14} /> Declined
                            </span>
                          )}
                        </td>
                        <td>
                          {interest.status === 'ACCEPTED' && (
                            <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => {
                              setActiveSubTab('chat');
                              setTimeout(() => joinChatRoom(interest), 100);
                            }}>
                              Chat with Owner
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* REAL-TIME CHAT TAB */}
        {activeSubTab === 'chat' && (
          <div>
            <h2>Real-Time Messenger</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>Chat with flatmate/room owners after interest requests are accepted.</p>

            {chatRooms.length === 0 ? (
              <div className="glass-card" style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
                <MessageSquare size={36} style={{ marginBottom: 12, color: 'var(--text-muted)' }} />
                <p>No active chats. Real-time chat is enabled once an owner accepts your interest request.</p>
              </div>
            ) : (
              <div className="chat-container">
                <div className="chat-inbox">
                  <div className="inbox-header">Conversations</div>
                  {chatRooms.map((room) => (
                    <div 
                      key={room.id} 
                      className={`inbox-item ${activeRoom?.id === room.id ? 'active' : ''}`}
                      onClick={() => joinChatRoom(room)}
                    >
                      <div className="inbox-avatar">
                        {room.listing.owner.name[0].toUpperCase()}
                      </div>
                      <div className="inbox-info">
                        <div className="inbox-name">{room.listing.owner.name}</div>
                        <div className="inbox-lastmsg">{room.listing.location}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="chat-pane">
                  {activeRoom ? (
                    <>
                      <div className="chat-header">
                        <div>
                          <div style={{ fontWeight: 700, color: 'white' }}>{activeRoom.listing.owner.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Listing: {activeRoom.listing.location}</div>
                        </div>
                      </div>

                      <div className="chat-messages">
                        {messages.length === 0 ? (
                          <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--text-muted)', fontSize: 13 }}>
                            No messages yet. Send a message to start chatting!
                          </div>
                        ) : (
                          messages.map((msg) => (
                            <div 
                              key={msg.id} 
                              className={`msg-bubble ${msg.senderId === user.id ? 'msg-sent' : 'msg-received'}`}
                            >
                              <div>{msg.content}</div>
                              <div style={{ fontSize: 9, opacity: 0.7, marginTop: 4, textAlign: 'right' }}>
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          ))
                        )}
                        <div ref={chatEndRef} />
                      </div>

                      <form className="chat-input-area" onSubmit={sendMessage}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Type your message..."
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                        />
                        <button type="submit" className="btn btn-primary" style={{ padding: '0 24px' }}>
                          <Send size={16} />
                        </button>
                      </form>
                    </>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                      <MessageSquare size={48} style={{ marginBottom: 12 }} />
                      <p>Select a conversation to start chat.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PROFILE TAB */}
        {activeSubTab === 'profile' && (
          <div style={{ maxWidth: 600 }}>
            <h2>Matching Profile</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Set your roommate expectations to match listings instantly using AI scoring.</p>

            <form onSubmit={handleUpdateProfile} className="glass-card">
              <div className="form-group">
                <label className="form-label">Preferred Location</label>
                <CityInput
                  placeholder="e.g. Mumbai, Maharashtra"
                  value={prefLocation}
                  required={true}
                  onChange={setPrefLocation}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Min Monthly Budget (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={budgetMin}
                    required
                    onChange={(e) => setBudgetMin(parseInt(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Max Monthly Budget (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={budgetMax}
                    required
                    onChange={(e) => setBudgetMax(parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Move-In Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={moveInDate}
                  required
                  onChange={(e) => setMoveInDate(e.target.value)}
                />
              </div>

              {profileMsg && (
                <div style={{ 
                  padding: 12, 
                  background: profileMsg.includes('success') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                  border: `1px solid ${profileMsg.includes('success') ? 'var(--success)' : 'var(--danger)'}`,
                  color: profileMsg.includes('success') ? 'var(--success)' : 'var(--danger)',
                  borderRadius: 6,
                  fontSize: 13,
                  marginBottom: 16
                }}>
                  {profileMsg}
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Save Profile & Score Matches
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
