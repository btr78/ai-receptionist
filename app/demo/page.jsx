'use client'
import { useState, useEffect, useRef } from 'react'

const BUSINESS = {
  name: "Hamilton Plumbing Pro",
  slug: "hamilton-plumbing-pro",
  phone: "905-555-0100",
  color: "#1d4ed8",
  greeting: "Hi! I am the AI receptionist for Hamilton Plumbing Pro. How can I help you today? I can book appointments, answer questions, or connect you with our emergency line."
}

function ChatWidget({ business }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [leadId, setLeadId] = useState(null)
  const [showContact, setShowContact] = useState(false)
  const [contact, setContact] = useState({ name:'', phone:'' })
  const [submitted, setSubmitted] = useState(false)
  const bottomRef = useRef()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role:'assistant', content: business.greeting }])
    }
  }, [open])

  const quickReplies = [
    "I need a plumber urgently",
    "Book an appointment",
    "What services do you offer?",
    "What are your hours?",
  ]

  const send = async (text) => {
    if (!text.trim() || loading) return
    const userMsg = text.trim()
    setInput('')
    const newMsgs = [...messages, { role:'user', content: userMsg }]
    setMessages(newMsgs)
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          businessSlug: business.slug,
          leadId,
          history: newMsgs.slice(-8).map(m => ({ role: m.role, content: m.content }))
        })
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role:'assistant', content: data.reply || data.error }])
      if (data.leadId) setLeadId(data.leadId)
      if (data.bookingDetected) setShowContact(true)
    } catch(e) {
      setMessages(prev => [...prev, { role:'assistant', content: 'Connection error. Please call us at ' + business.phone }])
    }
    setLoading(false)
  }

  const submitContact = async () => {
    if (!contact.name || !contact.phone) return
    setSubmitted(true)
    setShowContact(false)
    setMessages(prev => [...prev, { role:'assistant', content: `Perfect! We have your details ${contact.name} at ${contact.phone}. Our team will call you back within 1 hour to confirm your appointment!` }])
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessSlug: business.slug, leadId, ...contact })
      })
    } catch(e) {}
  }

  return (
    <>
      {/* Bubble */}
      <button onClick={() => setOpen(o => !o)} style={{ position:'fixed', bottom:24, right:24, width:60, height:60, borderRadius:'50%', background:business.color, border:'none', cursor:'pointer', boxShadow:'0 4px 20px rgba(0,0,0,0.25)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, transition:'transform 0.2s', transform: open ? 'scale(0.9)':'scale(1)' }}>
        {open
          ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          : <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
        }
      </button>

      {/* Pulse on bubble when closed */}
      {!open && <div style={{ position:'fixed', bottom:20, right:20, width:68, height:68, borderRadius:'50%', border:`2px solid ${business.color}`, opacity:0.4, zIndex:9998, animation:'ping 2s ease-out infinite' }} />}

      {/* Window */}
      {open && (
        <div style={{ position:'fixed', bottom:96, right:24, width:360, maxHeight:560, background:'#fff', borderRadius:20, boxShadow:'0 20px 60px rgba(0,0,0,0.15)', display:'flex', flexDirection:'column', zIndex:9998, overflow:'hidden', fontFamily:'-apple-system,sans-serif' }}>
          {/* Header */}
          <div style={{ background:business.color, padding:'16px 20px', color:'#fff' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:42, height:42, borderRadius:'50%', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>🤖</div>
              <div>
                <div style={{ fontWeight:700, fontSize:15 }}>{business.name}</div>
                <div style={{ fontSize:11, opacity:0.85, display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:'#4ade80' }}></div>
                  AI Receptionist — Online 24/7
                </div>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex:1, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:10, minHeight:180, maxHeight:300 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display:'flex', justifyContent: m.role==='user'?'flex-end':'flex-start' }}>
                <div style={{ maxWidth:'82%', padding:'10px 14px', borderRadius: m.role==='user'?'14px 4px 14px 14px':'4px 14px 14px 14px', background: m.role==='user'?business.color:'#f3f4f6', color: m.role==='user'?'#fff':'#1f2937', fontSize:13, lineHeight:1.6 }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display:'flex', gap:5, padding:'10px 14px', background:'#f3f4f6', borderRadius:'4px 14px 14px 14px', width:'fit-content' }}>
                {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:'#9ca3af', animation:`bounce 1s ease-in-out ${i*0.15}s infinite` }} />)}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick replies */}
          {messages.length === 1 && (
            <div style={{ padding:'0 14px 10px', display:'flex', gap:6, flexWrap:'wrap' }}>
              {quickReplies.map((q, i) => (
                <button key={i} onClick={() => send(q)} style={{ background:'#f3f4f6', border:`1px solid #e5e7eb`, borderRadius:99, padding:'5px 12px', fontSize:11, color:'#374151', cursor:'pointer' }}>{q}</button>
              ))}
            </div>
          )}

          {/* Contact form */}
          {showContact && !submitted && (
            <div style={{ padding:'12px 16px', background:'#f9fafb', borderTop:'1px solid #e5e7eb' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:8 }}>Leave your details for a callback:</div>
              <input placeholder="Your name *" value={contact.name} onChange={e => setContact(f => ({...f, name:e.target.value}))} style={{ width:'100%', padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:12, marginBottom:6, outline:'none' }} />
              <input placeholder="Phone number *" value={contact.phone} onChange={e => setContact(f => ({...f, phone:e.target.value}))} style={{ width:'100%', padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:12, marginBottom:8, outline:'none' }} />
              <button onClick={submitContact} disabled={!contact.name||!contact.phone} style={{ width:'100%', padding:'9px', background:contact.name&&contact.phone?business.color:'#9ca3af', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>Call me back within 1 hour</button>
            </div>
          )}

          {/* Input */}
          {!showContact && (
            <div style={{ padding:12, borderTop:'1px solid #f3f4f6', display:'flex', gap:8 }}>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==='Enter' && send(input)} placeholder="Type a message..." style={{ flex:1, padding:'9px 12px', border:'1px solid #e5e7eb', borderRadius:99, fontSize:13, outline:'none' }} />
              <button onClick={() => send(input)} disabled={!input.trim()||loading} style={{ width:38, height:38, borderRadius:'50%', background:input.trim()?business.color:'#e5e7eb', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              </button>
            </div>
          )}

          <div style={{ textAlign:'center', padding:'4px 0 8px', fontSize:9, color:'#d1d5db' }}>Powered by AI Receptionist</div>
        </div>
      )}

      <style>{`
        @keyframes ping { 0%{transform:scale(1);opacity:0.4} 100%{transform:scale(1.4);opacity:0} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
      `}</style>
    </>
  )
}

export default function DemoPage() {
  return (
    <div style={{ fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif', background:'#f8fafc', minHeight:'100vh' }}>
      {/* Fake plumbing website header */}
      <header style={{ background:'#1d4ed8', color:'#fff', padding:'16px 40px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:28 }}>🔧</span>
          <div>
            <div style={{ fontSize:20, fontWeight:800 }}>Hamilton Plumbing Pro</div>
            <div style={{ fontSize:12, opacity:0.8 }}>Licensed & Insured • Serving Hamilton since 2005</div>
          </div>
        </div>
        <div style={{ fontSize:18, fontWeight:700 }}>📞 905-555-0100</div>
      </header>

      {/* Hero */}
      <div style={{ background:'linear-gradient(135deg,#1e3a5f,#1d4ed8)', color:'#fff', padding:'80px 40px', textAlign:'center' }}>
        <h1 style={{ fontSize:'clamp(28px,5vw,52px)', fontWeight:900, marginBottom:16, lineHeight:1.1 }}>Fast, Reliable Plumbing<br/>When You Need It Most</h1>
        <p style={{ fontSize:18, opacity:0.85, marginBottom:32, maxWidth:500, margin:'0 auto 32px' }}>Available 24/7 for emergencies. Book online or chat with our AI receptionist.</p>
        <div style={{ display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap' }}>
          <button style={{ background:'#fff', color:'#1d4ed8', border:'none', borderRadius:12, padding:'14px 32px', fontSize:16, fontWeight:700, cursor:'pointer' }}>Book Appointment</button>
          <button style={{ background:'transparent', color:'#fff', border:'2px solid rgba(255,255,255,0.5)', borderRadius:12, padding:'14px 32px', fontSize:16, fontWeight:600, cursor:'pointer' }}>Call Now</button>
        </div>
      </div>

      {/* Services */}
      <div style={{ padding:'60px 40px', maxWidth:900, margin:'0 auto' }}>
        <h2 style={{ fontSize:32, fontWeight:900, color:'#1e293b', marginBottom:32, textAlign:'center' }}>Our Services</h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:20 }}>
          {[
            { icon:'🚰', name:'Drain Cleaning', desc:'Fast and effective clog removal' },
            { icon:'🔥', name:'Water Heater', desc:'Installation, repair, and replacement' },
            { icon:'🔧', name:'Pipe Repair', desc:'Burst pipes fixed same day' },
            { icon:'🚿', name:'Bathroom Reno', desc:'Full bathroom renovations' },
            { icon:'🚨', name:'24/7 Emergency', desc:'We answer every call, day or night' },
            { icon:'🏠', name:'General Plumbing', desc:'Any plumbing job, big or small' },
          ].map((s, i) => (
            <div key={i} style={{ background:'#fff', borderRadius:16, padding:'24px 20px', textAlign:'center', boxShadow:'0 2px 12px rgba(0,0,0,0.06)', border:'1px solid #e2e8f0' }}>
              <div style={{ fontSize:36, marginBottom:12 }}>{s.icon}</div>
              <div style={{ fontSize:15, fontWeight:700, color:'#1e293b', marginBottom:6 }}>{s.name}</div>
              <div style={{ fontSize:13, color:'#64748b' }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Banner */}
      <div style={{ background:'#1d4ed8', color:'#fff', padding:'40px', textAlign:'center', margin:'0 40px 60px', borderRadius:20 }}>
        <h3 style={{ fontSize:24, fontWeight:800, marginBottom:8 }}>Need a plumber right now?</h3>
        <p style={{ opacity:0.85, marginBottom:20 }}>Chat with our AI receptionist in the bottom right corner — available 24/7!</p>
        <div style={{ background:'rgba(255,255,255,0.15)', border:'2px solid rgba(255,255,255,0.3)', borderRadius:12, padding:'12px 24px', display:'inline-block', fontSize:15, fontWeight:600 }}>
          👉 Click the blue chat bubble in the bottom right
        </div>
      </div>

      {/* AI Chat Widget */}
      <ChatWidget business={BUSINESS} />
    </div>
  )
}
