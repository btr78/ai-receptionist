// app/api/chat/route.js
// The AI brain — handles all chat messages from the widget

import Anthropic from '@anthropic-ai/sdk'
import { getBusinessBySlug, createLead, saveMessage, updateLead } from '../../../lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request) {
  try {
    const body = await request.json()
    const { message, businessSlug, leadId, history = [], visitorName, visitorPhone } = body

    if (!message || !businessSlug) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get the business profile
    const business = await getBusinessBySlug(businessSlug)
    if (!business) {
      return Response.json({ error: 'Business not found' }, { status: 404 })
    }

    // Build the system prompt from the business profile
    const systemPrompt = buildSystemPrompt(business)

    // Build messages array (keep last 10 for context)
    const messages = [
      ...history.slice(-10).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message }
    ]

    // Call Claude Haiku (cheapest, fast enough for chat)
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: systemPrompt,
      messages,
    })

    const reply = response.content[0]?.text || 'Sorry, I had trouble with that. Please call us directly.'

    // Extract any lead info from the conversation
    const extractedInfo = extractLeadInfo(message, reply, history)

    // Create or update lead in database
    let currentLeadId = leadId
    if (!currentLeadId && (extractedInfo.name || extractedInfo.phone || extractedInfo.service)) {
      const lead = await createLead(business.id, {
        name: extractedInfo.name || visitorName,
        phone: extractedInfo.phone || visitorPhone,
        service_needed: extractedInfo.service,
        urgency: extractedInfo.urgency || 'normal',
        channel: 'chat',
        status: 'new',
        notes: `Service: ${extractedInfo.service || 'Unknown'}. Via web chat.`
      })
      currentLeadId = lead.id
    }

    // Save messages to database
    if (currentLeadId) {
      await saveMessage(currentLeadId, business.id, 'user', message, 'chat')
      await saveMessage(currentLeadId, business.id, 'assistant', reply, 'chat')
    }

    // Detect if appointment was mentioned
    const bookingDetected = detectBookingIntent(message, reply)

    return Response.json({
      reply,
      leadId: currentLeadId,
      bookingDetected,
      businessPhone: business.phone,
      emergencyPhone: business.emergency_available ? business.emergency_phone : null,
    })

  } catch (error) {
    console.error('Chat API error:', error)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}

// Build a system prompt from the business profile
function buildSystemPrompt(business) {
  const services = business.services?.join(', ') || 'general services'
  const hours = business.hours || 'during business hours'
  const emergency = business.emergency_available
    ? `We DO offer 24/7 emergency service. Emergency number: ${business.emergency_phone || business.phone}.`
    : 'We do not offer after-hours emergency service.'

  return `You are the AI receptionist for ${business.name}, a professional ${business.city || ''} plumbing and HVAC company.

YOUR JOB:
1. Greet callers warmly and professionally
2. Find out what service they need and how urgent it is
3. Collect their name and phone number
4. Book an appointment if possible, or let them know we will call them back
5. Answer basic questions about our services and hours

BUSINESS INFORMATION:
- Company: ${business.name}
- Phone: ${business.phone}
- Location: ${business.city}, ${business.province}
- Services: ${services}
- Hours: ${hours}
- Emergency service: ${emergency}

CONVERSATION RULES:
- Keep responses SHORT — 2-3 sentences maximum
- Always be warm, professional, and reassuring
- If someone has an emergency, give them the emergency number IMMEDIATELY
- Always try to get their name and phone number early in the conversation
- If they want to book, ask for their preferred day and time
- Never make up prices — say "our technician will provide a quote on site"
- If you cannot help, offer to have the owner call them back
- Respond in the same language the customer uses (English or French)

LEAD CAPTURE FLOW:
1. Ask what service they need
2. Ask how urgent (is it an emergency?)
3. Ask for their name
4. Ask for their phone number or email
5. Offer to book or say the team will call back within 1 hour

${business.greeting ? `CUSTOM GREETING: ${business.greeting}` : ''}

Remember: You represent a real local business. Be human, be helpful, be brief.`
}

// Extract lead information from conversation
function extractLeadInfo(message, reply, history) {
  const allText = [...history.map(h => h.content), message, reply].join(' ').toLowerCase()

  // Simple extraction - in production you'd use regex or Claude for this
  const phoneMatch = message.match(/(\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|\d{10})/)
  const nameMatch = message.match(/(?:my name is|i'm|i am|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i)

  // Detect urgency
  const urgencyWords = ['emergency', 'flooding', 'burst', 'no heat', 'no hot water', 'urgent', 'asap', 'immediately']
  const urgency = urgencyWords.some(w => allText.includes(w)) ? 'emergency' : 'normal'

  // Detect service
  const serviceKeywords = {
    'drain cleaning': ['drain', 'clog', 'blocked', 'slow drain'],
    'water heater': ['hot water', 'water heater', 'no hot water', 'heater'],
    'pipe repair': ['pipe', 'burst', 'leak', 'leaking'],
    'emergency plumbing': ['emergency', 'flooding', 'burst pipe', 'urgent'],
    'furnace repair': ['furnace', 'heat', 'no heat', 'heating'],
    'ac repair': ['air conditioning', 'ac', 'cooling', 'cool'],
    'toilet repair': ['toilet', 'flush', 'running toilet'],
    'general plumbing': ['plumbing', 'plumber', 'fix', 'repair'],
  }

  let service = null
  for (const [svc, keywords] of Object.entries(serviceKeywords)) {
    if (keywords.some(k => allText.includes(k))) {
      service = svc
      break
    }
  }

  return {
    name: nameMatch?.[1] || null,
    phone: phoneMatch?.[0] || null,
    service,
    urgency,
  }
}

// Detect if customer wants to book an appointment
function detectBookingIntent(message, reply) {
  const bookingWords = ['book', 'schedule', 'appointment', 'available', 'come out', 'send someone', 'when can']
  return bookingWords.some(w => message.toLowerCase().includes(w))
}
