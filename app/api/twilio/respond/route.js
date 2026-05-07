// app/api/twilio/respond/route.js
// Handles each speech input from the caller and responds with AI

import Anthropic from '@anthropic-ai/sdk'
import { getBusinessBySlug, createLead, saveMessage, updateLead } from '../../../../lib/supabase'
import twilio from 'twilio'
const VoiceResponse = twilio.twiml.VoiceResponse

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// In-memory conversation store (in production use Redis or Supabase)
// For MVP this works for single-call sessions
const callSessions = new Map()

export async function POST(request) {
  const formData = await request.formData()
  const businessSlug = request.nextUrl.searchParams.get('slug')
  const callSid = formData.get('CallSid')
  const callerNumber = formData.get('From')
  const speechResult = formData.get('SpeechResult')
  const confidence = parseFloat(formData.get('Confidence') || '0')

  const twiml = new VoiceResponse()

  try {
    // Get business
    const business = await getBusinessBySlug(businessSlug)
    if (!business) {
      twiml.say('Sorry, we are having technical difficulties. Please call back later.')
      twiml.hangup()
      return new Response(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
    }

    // Low confidence - ask to repeat
    if (!speechResult || confidence < 0.4) {
      const gather = twiml.gather({
        input: 'speech',
        timeout: 5,
        speechTimeout: 'auto',
        action: `/api/twilio/respond?slug=${businessSlug}`,
        method: 'POST',
        language: 'en-CA',
      })
      gather.say({ voice: 'Polly.Joanna-Neural' }, 'Sorry, I did not catch that. Could you please repeat?')
      return new Response(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
    }

    // Get or create session
    if (!callSessions.has(callSid)) {
      callSessions.set(callSid, { history: [], leadId: null, callerNumber })
    }
    const session = callSessions.get(callSid)

    // Detect emergency immediately
    const isEmergency = detectEmergency(speechResult)
    if (isEmergency && business.emergency_available && business.emergency_phone) {
      const emergencyNumber = business.emergency_phone.replace(/\D/g, '')
      twiml.say({ voice: 'Polly.Joanna-Neural' },
        `This sounds like an emergency. I am connecting you to our emergency line right now. Please hold.`)
      twiml.dial(business.emergency_phone)
      return new Response(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
    }

    // Build system prompt for phone (shorter responses for voice)
    const systemPrompt = buildPhoneSystemPrompt(business, callerNumber)

    // Call Claude
    const messages = [
      ...session.history.slice(-8),
      { role: 'user', content: speechResult }
    ]

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: systemPrompt,
      messages,
    })

    const aiReply = response.content[0]?.text || 'Let me connect you with our team right away.'

    // Update session history
    session.history.push({ role: 'user', content: speechResult })
    session.history.push({ role: 'assistant', content: aiReply })

    // Create lead if we have enough info
    if (!session.leadId && session.history.length >= 4) {
      const info = extractPhoneLeadInfo(session.history, callerNumber)
      const lead = await createLead(business.id, {
        phone: callerNumber,
        name: info.name,
        service_needed: info.service,
        urgency: info.urgency,
        channel: 'phone',
        status: 'new',
        notes: `Called in. Service: ${info.service || 'Unknown'}.`
      })
      session.leadId = lead.id
      callSessions.set(callSid, session)
    }

    // Save messages
    if (session.leadId) {
      await saveMessage(session.leadId, business.id, 'user', speechResult, 'phone')
      await saveMessage(session.leadId, business.id, 'assistant', aiReply, 'phone')
    }

    // Check if we should end the call
    const shouldEnd = detectCallEnd(speechResult, aiReply)

    // Gather next response
    const gather = twiml.gather({
      input: 'speech',
      timeout: 6,
      speechTimeout: 'auto',
      action: `/api/twilio/respond?slug=${businessSlug}`,
      method: 'POST',
      language: 'en-CA',
    })

    gather.say({ voice: 'Polly.Joanna-Neural' }, aiReply)

    if (shouldEnd) {
      twiml.say({ voice: 'Polly.Joanna-Neural' }, 'Thank you for calling. Have a great day!')
      twiml.hangup()
      callSessions.delete(callSid)
    } else {
      twiml.say({ voice: 'Polly.Joanna-Neural' }, 'Is there anything else I can help you with?')
    }

  } catch (error) {
    console.error('Respond route error:', error)
    twiml.say({ voice: 'Polly.Joanna-Neural' }, 
      `Thank you for calling. Our team will call you back at ${formatPhone(callerNumber)} shortly.`)
    twiml.hangup()
  }

  return new Response(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
}

function buildPhoneSystemPrompt(business, callerPhone) {
  const services = business.services?.join(', ') || 'plumbing and HVAC services'
  return `You are the phone receptionist for ${business.name}. Keep ALL responses under 30 words — this is a voice call.
Business: ${business.name} in ${business.city}, ${business.province}
Services: ${services}
Hours: ${business.hours || 'Mon-Fri 8am-6pm'}
Caller phone: ${callerPhone}
Rules: Be warm and brief. Get their name and service needed. Tell them the team will call back within 1 hour to confirm. Never say prices.`
}

function detectEmergency(text) {
  const words = ['flood', 'flooding', 'burst', 'no heat', 'gas leak', 'emergency', 'urgent', 'immediately']
  return words.some(w => text.toLowerCase().includes(w))
}

function detectCallEnd(userText, aiText) {
  const endWords = ['goodbye', 'bye', 'thank you', 'thanks', 'that is all', 'thats all', 'no that is it']
  return endWords.some(w => userText.toLowerCase().includes(w))
}

function extractPhoneLeadInfo(history, callerPhone) {
  const allText = history.map(h => h.content).join(' ').toLowerCase()
  const nameMatch = allText.match(/(?:my name is|this is|i'm|i am)\s+([a-z]+(?:\s+[a-z]+)?)/i)
  const services = {
    'drain cleaning': ['drain', 'clog', 'blocked'],
    'water heater': ['hot water', 'water heater'],
    'pipe repair': ['pipe', 'burst', 'leak'],
    'emergency': ['flood', 'emergency', 'burst'],
    'furnace repair': ['furnace', 'heat', 'heating'],
  }
  let service = 'General inquiry'
  for (const [svc, kw] of Object.entries(services)) {
    if (kw.some(k => allText.includes(k))) { service = svc; break }
  }
  const urgency = ['emergency', 'urgent', 'flooding', 'burst'].some(w => allText.includes(w)) ? 'emergency' : 'normal'
  return { name: nameMatch?.[1] || null, service, urgency }
}

function formatPhone(phone) {
  const digits = (phone || '').replace(/\D/g, '').slice(-10)
  return digits.length === 10
    ? `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`
    : phone
}
