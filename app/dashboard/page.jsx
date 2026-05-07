// app/dashboard/page.jsx
// Business owner dashboard - sees all leads and conversations

'use client'
import { useState, useEffect } from 'react'

const STATUS_COLORS = {
  new: '#3b82f6',
  contacted: '#f59e0b',
  booked: '#10b981',
  closed: '#6b7280',
}

const URGENCY_COLORS = {
  normal: '#6b7280',
  urgent: '#f59e0b',
  emergency: '#ef4444',
}

export default function Dashboard() {
  const [leads, setLeads] = useState([])
  const [selected, setSelected] = useState(null)
  const [conversation, setConversation] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [stats, setStats] = useState({ total:0, new:0, booked:0, today:0 })

  useEffect(() => {
    fetchLeads()
  }, [filter])

  const fetchLeads = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/leads?filter=${filter}`)
      const data = await res.json()
      setLeads(data.leads || [])
      setStats(data.stats || { total:0, new:0, booked:0, today:0 })
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const selectLead = async (lead) => {
    setSelected(lead)
    try {
      const res = await fetch(`/api/leads/${lead.id}/conversation`)
      const data = await res.json()
      setConversation(data.messages || [])
    } catch (e) {
      setConversation([])
    }
  }

  const updateStatus = async (leadId, status) => {
    await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
    fetchLeads()
    if (selected?.id === leadId) setSelected(s => ({...s, status}))
  }

  const formatTime = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    const now = new Date()
    const diff = now - d
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`
    return d.toLocaleDateString('en-CA')
  }

  return (
    <div style={{ display:'flex', height:'100vh', background:'#f9fafb', fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif' }}>

      {/* SIDEBAR */}
      <div style={{ width:260, background:'#1e3a5f', color:'#fff', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'24px 20px', borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize:18, fontWeight:800, marginBottom:2 }}>AI Receptionist</div>
          <div style={{ fontSize:11, opacity:0.6, fontFamily:'monospace' }}>Business Dashboard</div>
        </div>
        <nav style={{ padding:'16px 10px', flex:1 }}>
          {[
            { label:'All Leads', value:'all', icon:'👥' },
            { label:'New', value:'new', icon:'🔵' },
            { label:'Booked', value:'booked', icon:'✅' },
            { label:'Emergency', value:'emergency', icon:'🚨' },
          ].map(item => (
            <button key={item.value} onClick={() => setFilter(item.value)}
              style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 14px', borderRadius:10, border:'none', cursor:'pointer', marginBottom:4, textAlign:'left', fontSize:13, fontFamily:'inherit',
                background: filter === item.value ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: filter === item.value ? '#fff' : 'rgba(255,255,255,0.65)',
              }}>
              <span>{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div style={{ padding:'16px 20px', borderTop:'1px solid rgba(255,255,255,0.1)', fontSize:11, opacity:0.5 }}>
          Powered by AI Receptionist
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* TOP BAR */}
        <div style={{ background:'#fff', padding:'16px 24px', borderBottom:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h1 style={{ fontSize:20, fontWeight:800, color:'#111827' }}>Leads & Conversations</h1>
          <div style={{ display:'flex', gap:16 }}>
            {[
              { label:'Total', val:stats.total, color:'#6b7280' },
              { label:'New Today', val:stats.today, color:'#3b82f6' },
              { label:'Booked', val:stats.booked, color:'#10b981' },
            ].map(s => (
              <div key={s.label} style={{ textAlign:'center' }}>
                <div style={{ fontSize:22, fontWeight:900, color:s.color }}>{s.val}</div>
                <div style={{ fontSize:10, color:'#9ca3af', fontFamily:'monospace' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

          {/* LEADS LIST */}
          <div style={{ width:340, borderRight:'1px solid #e5e7eb', overflowY:'auto', background:'#fff' }}>
            {loading ? (
              <div style={{ padding:40, textAlign:'center', color:'#9ca3af', fontSize:13 }}>Loading leads...</div>
            ) : leads.length === 0 ? (
              <div style={{ padding:40, textAlign:'center' }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📞</div>
                <div style={{ fontSize:14, color:'#9ca3af' }}>No leads yet. Calls and chats will appear here.</div>
              </div>
            ) : leads.map(lead => (
              <div key={lead.id} onClick={() => selectLead(lead)}
                style={{
                  padding:'14px 18px',
                  borderBottom:'1px solid #f3f4f6',
                  cursor:'pointer',
                  background: selected?.id === lead.id ? '#eff6ff' : '#fff',
                  borderLeft: selected?.id === lead.id ? '3px solid #3b82f6' : '3px solid transparent',
                }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <div style={{ fontWeight:700, fontSize:14, color:'#111827' }}>{lead.name || 'Unknown'}</div>
                  <div style={{ fontSize:11, color:'#9ca3af' }}>{formatTime(lead.created_at)}</div>
                </div>
                <div style={{ fontSize:12, color:'#6b7280', marginBottom:6 }}>{lead.phone || 'No phone'} · {lead.channel}</div>
                <div style={{ fontSize:12, color:'#374151', marginBottom:8 }}>{lead.service_needed || 'Service not specified'}</div>
                <div style={{ display:'flex', gap:6 }}>
                  <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99, background:`${STATUS_COLORS[lead.status]}20`, color:STATUS_COLORS[lead.status] }}>
                    {lead.status}
                  </span>
                  {lead.urgency !== 'normal' && (
                    <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99, background:`${URGENCY_COLORS[lead.urgency]}20`, color:URGENCY_COLORS[lead.urgency] }}>
                      {lead.urgency}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* CONVERSATION VIEW */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            {!selected ? (
              <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, color:'#9ca3af' }}>
                <div style={{ fontSize:48 }}>💬</div>
                <div style={{ fontSize:14 }}>Select a lead to view the conversation</div>
              </div>
            ) : (
              <>
                {/* Lead header */}
                <div style={{ background:'#fff', padding:'16px 24px', borderBottom:'1px solid #e5e7eb' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div>
                      <div style={{ fontSize:18, fontWeight:800, color:'#111827', marginBottom:4 }}>{selected.name || 'Unknown Caller'}</div>
                      <div style={{ display:'flex', gap:16, fontSize:13, color:'#6b7280' }}>
                        {selected.phone && <span>📞 <a href={`tel:${selected.phone}`} style={{ color:'#3b82f6' }}>{selected.phone}</a></span>}
                        {selected.email && <span>✉️ {selected.email}</span>}
                        <span>🔧 {selected.service_needed || 'Unknown service'}</span>
                        <span style={{ textTransform:'capitalize' }}>📺 {selected.channel}</span>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:8}}>
                      {['new','contacted','booked','closed'].map(s => (
                        <button key={s} onClick={() => updateStatus(selected.id, s)}
                          style={{ padding:'6px 14px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:700, fontFamily:'inherit',
                            background: selected.status === s ? STATUS_COLORS[s] : '#f3f4f6',
                            color: selected.status === s ? '#fff' : '#6b7280',
                          }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div style={{ flex:1, overflowY:'auto', padding:24, display:'flex', flexDirection:'column', gap:12 }}>
                  {conversation.length === 0 ? (
                    <div style={{ textAlign:'center', color:'#9ca3af', fontSize:13, marginTop:40 }}>No conversation history yet</div>
                  ) : conversation.map((msg, i) => (
                    <div key={i} style={{ display:'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth:'70%',
                        padding:'10px 14px',
                        borderRadius: msg.role === 'user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                        background: msg.role === 'user' ? '#eff6ff' : '#f3f4f6',
                        fontSize:13, lineHeight:1.6, color:'#1f2937',
                      }}>
                        <div style={{ fontSize:9, fontFamily:'monospace', color:'#9ca3af', marginBottom:4 }}>
                          {msg.role === 'user' ? '👤 Visitor' : '🤖 AI Receptionist'} · {formatTime(msg.created_at)}
                        </div>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
