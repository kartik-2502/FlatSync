import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Plus, MessageSquare, List, Heart, 
  MapPin, Send, Check, X, CheckSquare, RefreshCw 
} from 'lucide-react';
import CityInput from './CityInput';

interface OwnerDashboardProps {
  token: string;
  user: any;
}

export default function OwnerDashboard({ token, user }: OwnerDashboardProps) {
  const [activeSubTab, setActiveSubTab] = useState<'listings' | 'interests' | 'chat'>('listings');
  
  // Listings state
  const [myListings, setMyListings] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLoc, setNewLoc] = useState('');
  const [newRent, setNewRent] = useState(1000);
  const [newDate, setNewDate] = useState('');
  const [newType, setNewType] = useState('Single');
  const [newFurnish, setNewFurnish] = useState('Furnished');

  // Received Interests state
  const [myReceivedInterests, setMyReceivedInterests] = useState<any[]>([]);
  const [interestLoading, setInterestLoading] = useState(false);

  // Chat state
  const [chatRooms, setChatRooms] = useState<any[]>([]);
  const [activeRoom, setActiveRoom] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch owner's room listings
  const fetchMyListings = async () => {
    try {
      const res = await fetch('/api/listings/owner', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setMyListings(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch received interest requests
  const fetchReceivedInterests = async () => {
    try {
      const res = await fetch('/api/interests/my', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setMyReceivedInterests(data);
        
        // Accepted interests form the chat conversation list
        const accepted = data.filter((i: any) => i.status === 'ACCEPTED');
        const botRoom = {
          id: 'bot_room_static_owner',
          listingId: 999,
          tenantId: user.id, // For owners, the tenantId is themselves in context of bot room
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

  useEffect(() => {
    if (activeSubTab === 'listings') {
      fetchMyListings();
    } else if (activeSubTab === 'interests') {
      fetchReceivedInterests();
    } else if (activeSubTab === 'chat') {
      fetchReceivedInterests();
    }
  }, [activeSubTab]);

  useEffect(() => {
    fetchMyListings();
  }, []);

  // Sockets for Chat
  useEffect(() => {
    if (activeSubTab === 'chat' && token) {
      const socketUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:5000' 
        : (import.meta.env.VITE_BACKEND_URL || 'https://flatsync-backend.onrender.com');
      const socket = io(socketUrl, {
        auth: { token }
      });
      socketRef.current = socket;

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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const joinChatRoom = (room: any) => {
    if (!socketRef.current) return;
    setActiveRoom(room);
    setMessages([]);
    socketRef.current.emit('join_room', {
      listingId: room.listingId,
      tenantId: room.listingId === 999 ? user.id : room.tenantId
    });
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socketRef.current || !activeRoom || !messageInput.trim()) return;

    socketRef.current.emit('send_message', {
      listingId: activeRoom.listingId,
      receiverId: activeRoom.listingId === 999 ? 999 : activeRoom.tenantId,
      content: messageInput
    });
    setMessageInput('');
  };

  // Add listing
  const handleAddListing = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          location: newLoc,
          rent: newRent,
          availableFrom: newDate,
          roomType: newType,
          furnishingStatus: newFurnish
        })
      });
      if (res.ok) {
        alert('Listing posted successfully!');
        setNewLoc('');
        setNewRent(1000);
        setNewDate('');
        setShowAddForm(false);
        fetchMyListings();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create listing');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to create listing');
    }
  };

  // Toggle listing filled
  const handleToggleFilled = async (id: number) => {
    try {
      const res = await fetch(`/api/listings/${id}/filled`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchMyListings();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Accept or Decline Interest
  const handleRespondInterest = async (interestId: number, status: 'ACCEPTED' | 'DECLINED') => {
    setInterestLoading(true);
    try {
      const res = await fetch('/api/interests/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ interestId, status })
      });
      setInterestLoading(false);
      if (res.ok) {
        fetchReceivedInterests();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update interest status');
      }
    } catch (err) {
      setInterestLoading(false);
      console.error(err);
    }
  };

  const getScoreClass = (score: number) => {
    if (score >= 80) return 'score-high';
    if (score >= 50) return 'score-mid';
    return 'score-low';
  };

  return (
    <div className="dashboard-grid">
      <div className="sidebar">
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 18, color: 'white' }}>Owner Dashboard</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Welcome, {user.name}</p>
        </div>
        <div className={`sidebar-tab ${activeSubTab === 'listings' ? 'active' : ''}`} onClick={() => setActiveSubTab('listings')}>
          <List size={18} /> My Room Listings
        </div>
        <div className={`sidebar-tab ${activeSubTab === 'interests' ? 'active' : ''}`} onClick={() => setActiveSubTab('interests')}>
          <Heart size={18} /> Interest Requests
        </div>
        <div className={`sidebar-tab ${activeSubTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveSubTab('chat')}>
          <MessageSquare size={18} /> Real-Time Chat
        </div>
      </div>

      <div className="main-content">
        {/* LISTINGS TAB */}
        {activeSubTab === 'listings' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h2>Your Room Listings</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Manage your posted rooms, create new listings, or mark them as filled.</p>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-secondary" onClick={fetchMyListings}>
                  <RefreshCw size={14} /> Refresh
                </button>
                <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
                  <Plus size={16} /> Add New Listing
                </button>
              </div>
            </div>

            {myListings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                You have not posted any room listings yet. Click "Add New Listing" to start.
              </div>
            ) : (
              <div className="listings-grid">
                {myListings.map((listing) => (
                  <div key={listing.id} className="glass-card listing-card" style={{ opacity: listing.isFilled ? 0.6 : 1 }}>
                    <div className="listing-image-container">
                      <img 
                        src={JSON.parse(listing.photos)[0]} 
                        alt="Room" 
                        className="listing-image"
                      />
                      <div className="listing-rent-tag">₹{listing.rent}/mo</div>
                      {listing.isFilled && (
                        <div style={{ 
                          position: 'absolute', top: 12, left: 12, 
                          background: 'var(--danger)', color: 'white', 
                          padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700 
                        }}>
                          FILLED
                        </div>
                      )}
                    </div>
                    
                    <div className="listing-details">
                      <h3 style={{ fontSize: 16, color: 'white', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MapPin size={16} color="var(--accent-primary)" /> {listing.location}
                      </h3>
                      
                      <div className="listing-tags" style={{ margin: '8px 0' }}>
                        <span className="tag">{listing.roomType}</span>
                        <span className="tag">{listing.furnishingStatus}</span>
                        <span className="tag">Avail: {listing.availableFrom}</span>
                      </div>

                      <div style={{ marginTop: 'auto', paddingTop: 16, display: 'flex', gap: 8 }}>
                        <button 
                          className={`btn ${listing.isFilled ? 'btn-secondary' : 'btn-primary'}`}
                          style={{ flex: 1 }}
                          onClick={() => handleToggleFilled(listing.id)}
                        >
                          <CheckSquare size={14} /> 
                          {listing.isFilled ? 'Mark Active' : 'Mark Filled'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ADD LISTING MODAL */}
        {showAddForm && (
          <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
            <form onSubmit={handleAddListing} className="glass-card modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Add Room Listing</h2>
                <button type="button" className="btn btn-secondary btn-icon" onClick={() => setShowAddForm(false)} style={{ padding: 6 }}>
                  &times;
                </button>
              </div>

              <div className="form-group">
                <label className="form-label">Location</label>
                <CityInput
                  placeholder="Search and select city (e.g. Mumbai, Maharashtra)"
                  value={newLoc}
                  required={true}
                  onChange={setNewLoc}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Monthly Rent (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newRent}
                    required
                    onChange={(e) => setNewRent(parseInt(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Available From</label>
                  <input
                    type="date"
                    className="form-input"
                    value={newDate}
                    required
                    onChange={(e) => setNewDate(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Room Type</label>
                  <select className="form-input" value={newType} onChange={(e) => setNewType(e.target.value)}>
                    <option value="Single">Single Room</option>
                    <option value="Shared">Shared Room</option>
                    <option value="Studio">Studio Apartment</option>
                    <option value="Apartment">Full Apartment</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Furnishing Status</label>
                  <select className="form-input" value={newFurnish} onChange={(e) => setNewFurnish(e.target.value)}>
                    <option value="Furnished">Furnished</option>
                    <option value="Semi-Furnished">Semi-Furnished</option>
                    <option value="Unfurnished">Unfurnished</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Post Listing</button>
              </div>
            </form>
          </div>
        )}

        {/* RECEIVED INTERESTS TAB */}
        {activeSubTab === 'interests' && (
          <div>
            <h2>Interest Requests Received</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Tenants who expressed interest in your rooms, ranked with AI compatibility matching.</p>

            {myReceivedInterests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                You have not received any interest requests on your rooms yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {myReceivedInterests.map((interest) => {
                  const score = interest.compatibility.score;
                  return (
                    <div key={interest.id} className="glass-card" style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div className={`score-ring ${getScoreClass(score)}`} style={{ flexShrink: 0, width: 56, height: 56, fontSize: 16 }}>
                        {score}%
                      </div>
                      
                      <div style={{ flexGrow: 1, minWidth: 250 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                          <h3 style={{ color: 'white' }}>{interest.tenant.name}</h3>
                          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
                            Listing: {interest.listing.location}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 12, fontSize: 13 }}>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Preferred Location: </span>
                            <span style={{ color: 'white', fontWeight: 500 }}>{interest.tenant.tenantProfile?.preferredLocation}</span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Budget: </span>
                            <span style={{ color: 'white', fontWeight: 500 }}>${interest.tenant.tenantProfile?.budgetMin} - ${interest.tenant.tenantProfile?.budgetMax}</span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Move-In: </span>
                            <span style={{ color: 'white', fontWeight: 500 }}>{interest.tenant.tenantProfile?.moveInDate}</span>
                          </div>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 6, marginBottom: 12 }}>
                          <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.4 }}>
                            "{interest.compatibility.explanation}"
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 140 }} className="mobile-full-width">
                        {interest.status === 'PENDING' ? (
                          <>
                            <button 
                              className="btn btn-primary" 
                              style={{ padding: '8px 16px', background: 'var(--success-gradient)', color: 'white' }}
                              onClick={() => handleRespondInterest(interest.id, 'ACCEPTED')}
                              disabled={interestLoading}
                            >
                              <Check size={16} /> Accept
                            </button>
                            <button 
                              className="btn btn-danger" 
                              style={{ padding: '8px 16px' }}
                              onClick={() => handleRespondInterest(interest.id, 'DECLINED')}
                              disabled={interestLoading}
                            >
                              <X size={16} /> Decline
                            </button>
                          </>
                        ) : (
                          <div style={{ textAlign: 'center', padding: '8px 0' }}>
                            <span style={{ 
                              color: interest.status === 'ACCEPTED' ? 'var(--success)' : 'var(--danger)',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              fontSize: 13
                            }}>
                              {interest.status}
                            </span>
                            {interest.status === 'ACCEPTED' && (
                              <button 
                                className="btn btn-primary" 
                                style={{ marginTop: 12, width: '100%', fontSize: 12, padding: '6px' }} 
                                onClick={() => {
                                  setActiveSubTab('chat');
                                  setTimeout(() => joinChatRoom(interest), 100);
                                }}
                              >
                                Open Chat
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* REAL-TIME CHAT TAB */}
        {activeSubTab === 'chat' && (
          <div>
            <h2>Real-Time Chat</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>Message matched tenants regarding listings details and move-in coordination.</p>

            {chatRooms.length === 0 ? (
              <div className="glass-card" style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
                <MessageSquare size={36} style={{ marginBottom: 12, color: 'var(--text-muted)' }} />
                <p>No active chats. Real-time chat is unlocked once you accept a tenant's interest request.</p>
              </div>
            ) : (
              <div className="chat-container">
                <div className="chat-inbox">
                  <div className="inbox-header">Tenants</div>
                  {chatRooms.map((room) => (
                    <div 
                      key={room.id} 
                      className={`inbox-item ${activeRoom?.id === room.id ? 'active' : ''}`}
                      onClick={() => joinChatRoom(room)}
                    >
                      <div className="inbox-avatar">
                        {room.listingId === 999 ? 'F' : room.tenant.name[0].toUpperCase()}
                      </div>
                      <div className="inbox-info">
                        <div className="inbox-name">{room.listingId === 999 ? 'FlatSync AI Assistant' : room.tenant.name}</div>
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
                          <div style={{ fontWeight: 700, color: 'white' }}>{activeRoom.listingId === 999 ? 'FlatSync AI Assistant' : activeRoom.tenant.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Room: {activeRoom.listing.location}</div>
                        </div>
                      </div>

                      <div className="chat-messages">
                        {messages.length === 0 ? (
                          <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--text-muted)', fontSize: 13 }}>
                            No messages yet. Message {activeRoom.listingId === 999 ? 'FlatSync AI Assistant' : activeRoom.tenant.name} to say hello!
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
                      <p>Select a tenant conversation to chat.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
