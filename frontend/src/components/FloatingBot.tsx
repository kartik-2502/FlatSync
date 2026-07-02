import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, ArrowRight } from 'lucide-react';

interface Message {
  sender: 'user' | 'bot';
  text: string;
}

export default function FloatingBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'bot',
      text: 'Namaste! 🙏 I am your FlatSync Help Bot. Click any of the quick questions below or ask me a custom question!'
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const faqs = [
    {
      q: 'How is compatibility calculated?',
      a: 'Compatibility is scored from 0 to 100 based on location match (Max 50 pts) and budget range fit (Max 50 pts) using Gemini AI, falling back to rule-based logic if offline.'
    },
    {
      q: 'What are the seeded accounts?',
      a: 'Admin: admin@rentfinder.com (AdminPassword123!), Owners: owner1@rentfinder.com (password123), Tenants: tenant1@rentfinder.com (password123)'
    },
    {
      q: 'How do I start a real-time chat?',
      a: 'Tenants express interest in Browse Rooms. Owners accept the request in Interest Requests. Once accepted, real-time chat unlocks automatically!'
    },
    {
      q: 'What cities are supported?',
      a: 'We support autocomplete suggestions for major cities across all 28 states and UTs of India (e.g. Mumbai, Bengaluru, Delhi, Pune, Chennai).'
    }
  ];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    const userText = inputVal.trim();
    setMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setInputVal('');

    // Formulate quick client-side bot response
    setTimeout(() => {
      let reply = '';
      const txt = userText.toLowerCase();

      if (txt.includes('cred') || txt.includes('login') || txt.includes('seed') || txt.includes('password')) {
        reply = 'Seeded credentials: Admin: admin@rentfinder.com (AdminPassword123!), Owners: owner1@rentfinder.com, Tenants: tenant1@rentfinder.com (password123 for users).';
      } else if (txt.includes('score') || txt.includes('calculat') || txt.includes('compat')) {
        reply = 'Scores are calculated from 0 to 100, combining location matching (50 points) and budget ranges (50 points) using Gemini AI, with cached database storage.';
      } else if (txt.includes('chat') || txt.includes('messag') || txt.includes('websocket')) {
        reply = 'Real-time WebSocket chat is enabled after an owner accepts a tenant\'s interest request. The chat pane persists messages in SQLite.';
      } else if (txt.includes('city') || txt.includes('state') || txt.includes('india')) {
        reply = 'We support city autocomplete matching for all 28 Indian states, helping you select standardized city names dynamically.';
      } else if (txt.includes('zip') || txt.includes('package') || txt.includes('submit')) {
        reply = 'The project source is compiled and packaged in flatsync.zip in the project root folder.';
      } else if (txt.includes('hi') || txt.includes('hello') || txt.includes('hey')) {
        reply = 'Hello! I can guide you on seeded credentials, compatibility calculations, websocket chat, or Indian cities support. What can I explain?';
      } else {
        reply = 'I am here to help! Ask me about seeded passwords, chat rules, compatibility formulas, or city auto-recommendations.';
      }

      setMessages((prev) => [...prev, { sender: 'bot', text: reply }]);
    }, 400);
  };

  const handleFaqClick = (faq: { q: string; a: string }) => {
    setMessages((prev) => [
      ...prev,
      { sender: 'user', text: faq.q },
      { sender: 'bot', text: faq.a }
    ]);
  };

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000, fontFamily: 'var(--font-sans)' }}>
      {/* Floating assistant bubble */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--accent-gradient)',
            border: 'none',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1.08) translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1) translateY(0)';
          }}
        >
          <Bot size={24} />
        </button>
      )}

      {/* Floating chatbot window */}
      {isOpen && (
        <div
          className="glass-card"
          style={{
            width: '360px',
            height: '480px',
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            overflow: 'hidden',
            borderRadius: 'var(--border-radius-md)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            animation: 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 20px',
              background: 'rgba(99, 102, 241, 0.1)',
              borderBottom: '1px solid var(--glass-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ background: 'var(--accent-gradient)', padding: 6, borderRadius: '50%', display: 'flex', color: 'white' }}>
                <Bot size={16} />
              </div>
              <div>
                <h4 style={{ color: 'white', fontSize: '14px', fontWeight: 700 }}>FlatSync Assistant</h4>
                <span style={{ fontSize: '10px', color: 'var(--success)' }}>● System Online</span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Chat Messages Body */}
          <div style={{ flexGrow: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  background: msg.sender === 'user' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                  color: 'white',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  borderBottomRightRadius: msg.sender === 'user' ? '2px' : '12px',
                  borderBottomLeftRadius: msg.sender === 'bot' ? '2px' : '12px',
                  fontSize: '13px',
                  lineHeight: '1.4',
                  maxWidth: '85%'
                }}
              >
                {msg.text}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Quick FAQ Actions */}
          <div
            style={{
              padding: '10px 16px',
              background: 'rgba(255,255,255,0.02)',
              borderTop: '1px solid var(--glass-border)',
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              whiteSpace: 'nowrap'
            }}
          >
            {faqs.map((faq, idx) => (
              <button
                key={idx}
                onClick={() => handleFaqClick(faq)}
                style={{
                  display: 'inline-block',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-secondary)',
                  borderRadius: '20px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'white';
                  e.currentTarget.style.background = 'rgba(99,102,241,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                }}
              >
                {faq.q}
              </button>
            ))}
          </div>

          {/* Form Input */}
          <form
            onSubmit={handleSend}
            style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--glass-border)',
              display: 'flex',
              gap: '10px'
            }}
          >
            <input
              type="text"
              placeholder="Ask a question..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              style={{
                flexGrow: 1,
                padding: '8px 12px',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid var(--bg-tertiary)',
                borderRadius: '6px',
                color: 'white',
                fontSize: '13px'
              }}
            />
            <button
              type="submit"
              style={{
                background: 'var(--accent-gradient)',
                border: 'none',
                color: 'white',
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <ArrowRight size={14} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
