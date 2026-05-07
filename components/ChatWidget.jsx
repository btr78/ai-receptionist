// components/ChatWidget.jsx
// Embed this on any business website with one script tag
// <script src="https://yourapp.com/widget.js" data-slug="hamilton-plumbing-pro"></script>

'use client'
import { useState, useEffect, useRef } from 'react'

export default function ChatWidget({ businessSlug, business }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [leadId, setLeadId] = useState(null)
  const [stage, setStage] = useState('chat') // chat | contact | booked
  const [contactForm, setContactForm] = useState({ name: '', phone: '', email: '' })
  const bottomRef = useRef()

  const color = business?.widget_color || '#2563eb'

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Show greeting when widget opens
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: business?.greeting || `Hi! I am the AI receptionist for ${business?.name}. How can I help you today?`,
        time: new Date()
      }])
    }
  }, [open])

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return
    const userMsg = text.trim()
    setInput('')

    setMessages(prev => [...prev, { role: 'user', content: userMsg, time: new Date() }])
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          businessSlug,
          leadId,
          history: messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
        })
      })

      const data = await res.json()

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply,
        time: new Date(),
        showPhone: data.emergencyPhone,
        bookingDetected: data.bookingDetected,
      }])

      if (data.leadId && !leadId) setLeadId(data.leadId)
      if (data.bookingDetected) setStage('contact')

    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, something went wrong. Please call us directly at ' + (business?.phone || 'our office'),
        time: new Date()
      }])
    }
    setLoading(false)
  }

  const submitContact = async () => {
    if (!contactForm.name || !contactForm.phone) return
    setLoading(true)
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessSlug,
          leadId,
          ...contactForm,
          notes: 'Submitted contact form via widget'
        })
      })
      setStage('booked')
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Perfect! We have your number ${contactForm.phone} and will call you back within 1 hour. Thank you ${contactForm.name}!`,
        time: new Date()
      }])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const quickReplies = [
    'I need a plumber',
    'Emergency - pipe burst',
    'Book an appointment',
    'How much does it cost?',
    'What are your hours?',
  ]

  return (
    <>
      {/* WIDGET BUTTON */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: color,
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          transition: 'transform 0.2s',
          transform: open ? 'scale(0.9)' : 'scale(1)',
        }}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
          </svg>
        )}
      </button>

      {/* UNREAD DOT */}
      {!open && messages.length === 0 && (
        <div style={{ position:'fixed', bottom:72, right:24, width:10, height:10, background:'#ef4444', borderRadius:'50%', zIndex:9999, border:'2px solid white' }} />
      )}

      {/* CHAT WINDOW */}
      {open && (
        <div style={{
          position: 'fixed',
          bottom: 96,
          right: 24,
          width: 360,
          maxHeight: 560,
          background: '#fff',
          borderRadius: 20,
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 9998,
          overflow: 'hidden',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        }}>

          {/* HEADER */}
          <div style={{ background: color, padding: '16px 20px', color: '#fff' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:'50%', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>🤖</div>
              <div>
                <div style={{ fontWeight:700, fontSize:15 }}>{business?.name || 'AI Receptionist'}</div>
                <div style={{ fontSize:11, opacity:0.85, display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:'#4ade80' }}></div>
                  Online — responds instantly
                </div>
              </div>
            </div>
          </div>

          {/* MESSAGES */}
          <div style={{ flex:1, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:12, minHeight:200, maxHeight:320 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display:'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth:'82%',
                  padding:'10px 14px',
                  borderRadius: msg.role === 'user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                  background: msg.role === 'user' ? color : '#f3f4f6',
                  color: msg.role === 'user' ? '#fff' : '#1f2937',
                  fontSize: 13,
                  lineHeight: 1.5,
                }}>
                  {msg.content}
                  {msg.showPhone && (
                    <div style={{ marginTop:8, padding:'8px 10px', background:'rgba(239,68,68,0.1)', borderRadius:8, fontSize:12 }}>
                      🚨 Emergency: <a href={`tel:${msg.showPhone}`} style={{ color:'#dc2626', fontWeight:700 }}>{msg.showPhone}</a>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display:'flex', gap:4, alignItems:'center', padding:'8px 14px', background:'#f3f4f6', borderRadius:'4px 14px 14px 14px', width:'fit-content' }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:'#9ca3af', animation:'pulse 1s ease-in-out infinite', animationDelay:`${i*0.15}s` }} />
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* QUICK REPLIES — show on first message only */}
          {messages.length === 1 && (
            <div style={{ padding:'0 14px 10px', display:'flex', gap:6, flexWrap:'wrap' }}>
              {quickReplies.map((q, i) => (
                <button key={i} onClick={() => sendMessage(q)}
                  style={{ background:'#f3f4f6', border:`1px solid #e5e7eb`, borderRadius:99, padding:'5px 12px', fontSize:11, color:'#374151', cursor:'pointer', fontFamily:'inherit' }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* CONTACT FORM — appears when booking detected */}
          {stage === 'contact' && (
            <div style={{ padding:'12px 16px', background:'#f9fafb', borderTop:'1px solid #e5e7eb' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:8 }}>Leave your details and we will call you back:</div>
              <input
                placeholder="Your name *"
                value={contactForm.name}
                onChange={e => setContactForm(f => ({...f, name: e.target.value}))}
                style={{ width:'100%', padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:12, marginBottom:6, fontFamily:'inherit', outline:'none' }}
              />
              <input
                placeholder="Phone number *"
                value={contactForm.phone}
                onChange={e => setContactForm(f => ({...f, phone: e.target.value}))}
                style={{ width:'100%', padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:12, marginBottom:6, fontFamily:'inherit', outline:'none' }}
              />
              <button
                onClick={submitContact}
                disabled={!contactForm.name || !contactForm.phone || loading}
                style={{ width:'100%', padding:'9px', background: contactForm.name && contactForm.phone ? color : '#9ca3af', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                Call me back within 1 hour
              </button>
            </div>
          )}

          {/* INPUT */}
          {stage !== 'contact' && (
            <div style={{ padding:12, borderTop:'1px solid #f3f4f6', display:'flex', gap:8 }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
                placeholder="Type your message..."
                style={{ flex:1, padding:'9px 12px', border:'1px solid #e5e7eb', borderRadius:99, fontSize:13, fontFamily:'inherit', outline:'none' }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                style={{ width:38, height:38, borderRadius:'50%', background: input.trim() ? color : '#e5e7eb', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </div>
          )}

          {/* FOOTER */}
          <div style={{ textAlign:'center', padding:'6px', fontSize:10, color:'#9ca3af' }}>
            Powered by <a href="https://yourreceptionistapp.com" style={{ color:'#9ca3af' }}>AI Receptionist</a>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1)} }
      `}</style>
    </>
  )
}
