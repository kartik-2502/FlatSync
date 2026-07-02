import { useState, useEffect } from 'react';
import { 
  Users, Home, MessageSquare, Heart, RefreshCw, 
  Trash2, ToggleLeft, ToggleRight, BarChart2 
} from 'lucide-react';

interface AdminDashboardProps {
  token: string;
}

export default function AdminDashboard({ token }: AdminDashboardProps) {
  const [activeSubTab, setActiveSubTab] = useState<'stats' | 'users' | 'listings'>('stats');
  
  // Stats state
  const [stats, setStats] = useState<any | null>(null);

  // Users state
  const [users, setUsers] = useState<any[]>([]);

  // Listings state
  const [listings, setListings] = useState<any[]>([]);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setStats(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setUsers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchListings = async () => {
    try {
      const res = await fetch('/api/admin/listings', {
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

  useEffect(() => {
    if (activeSubTab === 'stats') fetchStats();
    if (activeSubTab === 'users') fetchUsers();
    if (activeSubTab === 'listings') fetchListings();
  }, [activeSubTab]);

  useEffect(() => {
    fetchStats();
  }, []);

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Are you absolutely sure you want to delete this user? This will remove all their listings, profiles, and messages recursively.')) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert('User deleted successfully.');
        fetchUsers();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete user');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteListing = async (id: number) => {
    if (!confirm('Are you sure you want to delete this room listing?')) return;
    try {
      const res = await fetch(`/api/admin/listings/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert('Listing deleted successfully.');
        fetchListings();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete listing');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleFilled = async (id: number) => {
    try {
      const res = await fetch(`/api/listings/${id}/filled`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchListings();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="dashboard-grid">
      <div className="sidebar">
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 18, color: 'white' }}>Admin Control Panel</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>System Moderation Mode</p>
        </div>
        <div className={`sidebar-tab ${activeSubTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveSubTab('stats')}>
          <BarChart2 size={18} /> Platform Analytics
        </div>
        <div className={`sidebar-tab ${activeSubTab === 'users' ? 'active' : ''}`} onClick={() => setActiveSubTab('users')}>
          <Users size={18} /> Manage Users
        </div>
        <div className={`sidebar-tab ${activeSubTab === 'listings' ? 'active' : ''}`} onClick={() => setActiveSubTab('listings')}>
          <Home size={18} /> Manage Listings
        </div>
      </div>

      <div className="main-content">
        {/* ANALYTICS STATS TAB */}
        {activeSubTab === 'stats' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h2>Platform Analytics Overview</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Real-time database statistics and activity overview.</p>
              </div>
              <button className="btn btn-secondary" onClick={fetchStats}>
                <RefreshCw size={14} /> Refresh
              </button>
            </div>

            {stats ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 40 }}>
                  <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-primary)', padding: 12, borderRadius: 8 }}>
                      <Users size={24} />
                    </div>
                    <div>
                      <h4 style={{ color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase' }}>Total Users</h4>
                      <p style={{ fontSize: 24, fontWeight: 800, color: 'white' }}>{stats.users.total}</p>
                    </div>
                  </div>
                  <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', padding: 12, borderRadius: 8 }}>
                      <Home size={24} />
                    </div>
                    <div>
                      <h4 style={{ color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase' }}>Room Listings</h4>
                      <p style={{ fontSize: 24, fontWeight: 800, color: 'white' }}>{stats.listings.total}</p>
                    </div>
                  </div>
                  <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)', padding: 12, borderRadius: 8 }}>
                      <Heart size={24} />
                    </div>
                    <div>
                      <h4 style={{ color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase' }}>Interest Claims</h4>
                      <p style={{ fontSize: 24, fontWeight: 800, color: 'white' }}>{stats.interests.total}</p>
                    </div>
                  </div>
                  <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ background: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-secondary)', padding: 12, borderRadius: 8 }}>
                      <MessageSquare size={24} />
                    </div>
                    <div>
                      <h4 style={{ color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase' }}>Chat Messages</h4>
                      <p style={{ fontSize: 24, fontWeight: 800, color: 'white' }}>{stats.messages.total}</p>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
                  <div className="glass-card">
                    <h3 style={{ marginBottom: 16, color: 'white' }}>Role Distribution</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Tenants (looking for room):</span>
                        <span style={{ fontWeight: 700, color: 'white' }}>{stats.users.tenants}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Owners (room providers):</span>
                        <span style={{ fontWeight: 700, color: 'white' }}>{stats.users.owners}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>System Administrators:</span>
                        <span style={{ fontWeight: 700, color: 'white' }}>{stats.users.admins}</span>
                      </div>
                    </div>
                  </div>

                  <div className="glass-card">
                    <h3 style={{ marginBottom: 16, color: 'white' }}>Listing & Matching Activity</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Active Listings:</span>
                        <span style={{ fontWeight: 700, color: 'var(--success)' }}>{stats.listings.active}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Filled Room Listings:</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{stats.listings.filled}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Accepted Matches:</span>
                        <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{stats.interests.accepted}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p style={{ color: 'var(--text-secondary)' }}>Loading analytics...</p>
            )}
          </div>
        )}

        {/* USERS LIST TAB */}
        {activeSubTab === 'users' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h2>Manage Platform Users</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Monitor registered users, roles, and moderate spam accounts.</p>
              </div>
              <button className="btn btn-secondary" onClick={fetchUsers}>
                <RefreshCw size={14} /> Refresh
              </button>
            </div>

            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Created At</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td style={{ fontWeight: 600, color: 'white' }}>{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className="user-badge" style={{ 
                          background: u.role === 'ADMIN' ? 'rgba(239, 68, 68, 0.15)' : u.role === 'OWNER' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: u.role === 'ADMIN' ? 'var(--danger)' : u.role === 'OWNER' ? 'var(--accent-secondary)' : 'var(--success)',
                          border: 'none'
                        }}>
                          {u.role}
                        </span>
                      </td>
                      <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td>
                        {u.role !== 'ADMIN' ? (
                          <button className="btn btn-danger btn-icon" onClick={() => handleDeleteUser(u.id)} style={{ padding: 8 }}>
                            <Trash2 size={14} />
                          </button>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Protected</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* LISTINGS LIST TAB */}
        {activeSubTab === 'listings' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h2>Manage Room Listings</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Moderate listing posts, toggle filled states, and remove posts.</p>
              </div>
              <button className="btn btn-secondary" onClick={fetchListings}>
                <RefreshCw size={14} /> Refresh
              </button>
            </div>

            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Location</th>
                    <th>Room Type</th>
                    <th>Rent</th>
                    <th>Owner</th>
                    <th>Status</th>
                    <th>Created At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map((l) => (
                    <tr key={l.id}>
                      <td>{l.id}</td>
                      <td style={{ fontWeight: 600, color: 'white' }}>{l.location}</td>
                      <td>{l.roomType}</td>
                      <td>₹{l.rent}/mo</td>
                      <td>{l.owner.name} ({l.owner.email})</td>
                      <td>
                        <span style={{ 
                          color: l.isFilled ? 'var(--text-muted)' : 'var(--success)',
                          fontWeight: 700 
                        }}>
                          {l.isFilled ? 'FILLED' : 'ACTIVE'}
                        </span>
                      </td>
                      <td>{new Date(l.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button 
                            className="btn btn-secondary btn-icon" 
                            onClick={() => handleToggleFilled(l.id)} 
                            style={{ padding: 8 }}
                            title="Toggle status"
                          >
                            {l.isFilled ? <ToggleLeft size={16} /> : <ToggleRight size={16} color="var(--success)" />}
                          </button>
                          <button 
                            className="btn btn-danger btn-icon" 
                            onClick={() => handleDeleteListing(l.id)} 
                            style={{ padding: 8 }}
                            title="Delete listing"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
