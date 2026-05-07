import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS })
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { message, businessSlug, leadId, history = [] } = body

    if (!message) {
      return Response.json({ error: 'No message provided' }, { status: 400, headers: CORS })
    }

    // Get business from Supabase
    let business = null
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
      const { data } = await supabase
        .from('businesses')
        .select('*')
        .eq('slug', businessSlug)
        .eq('active', true)
        .single()
      business = data
    } catch (e) {
      console.error('Supabase error:', e)
    }

    // Fallback business if not found in DB
    if (!business) {
      business = {
        name: 'Hamilton Plumbing Pro',
        phone: '905-555-0100',
        city: 'Hamilton',
        province: 'ON',
        services: ['drain cleaning', 'water heater repair', 'pipe repair', 'emergency plumbing'],
        hours: 'Monday to Friday 8am to 6pm, Saturday 9am to 2pm',
        emergency_available: true,
        emergency_phone: '905-555-0199',
      }
    }

    const services = Array.isArray(business.services) ? business.services.join(', ') : 'plumbing services'

    const systemPrompt = `You are the AI receptionist for ${business.name}, a plumbing company in ${business.city || 'Hamilton'}, Canada.

YOUR GOALS:
1. Find out what service they need
2. Ask how urgent it is
3. Get their name and phone number
4. Book appointment or confirm callback within 1 hour

BUSINESS INFO:
- Company: ${business.name}
- Phone: ${business.phone}
- Services: ${services}
- Hours: ${business.hours || 'Mon-Fri 8am-6pm'}
- Emergency: ${business.emergency_available ? 'YES - 24/7 at ' + (business.emergency_phone || business.phone) : 'No'}

RULES:
- Keep replies SHORT — 2-3 sentences max
- Be warm and professional
- If emergency: give emergency number IMMEDIATELY
- Never quote prices — say technician will provide quote on site
- Always try to collect name and phone number`

    const messages = [
      ...history.slice(-10).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message }
    ]

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: systemPrompt,
      messages,
    })

    const reply = response.content[0]?.text || 'Sorry, let me connect you with our team. Please call ' + business.phone

    // Detect booking intent
    const bookingWords = ['book', 'schedule', 'appointment', 'available', 'come out', 'send someone', 'when can']
    const bookingDetected = bookingWords.some(w => message.toLowerCase().includes(w))

    // Save to Supabase if we can
    try {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
      // Simple lead capture - extract phone if present
      const phoneMatch = message.match(/(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/)
      if (phoneMatch && business.id) {
        await supabaseAdmin.from('leads').insert({
          business_id: business.id,
          phone: phoneMatch[0],
          channel: 'chat',
          status: 'new',
          notes: 'Via web chat widget'
        })
      }
    } catch(e) {
      // Silent fail - don't break the chat
    }

    return Response.json({
      reply,
      bookingDetected,
      businessPhone: business.phone,
      emergencyPhone: business.emergency_available ? business.emergency_phone : null,
    }, { headers: CORS })

  } catch (error) {
    console.error('Chat API error:', error)
    return Response.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500, headers: CORS }
    )
  }
}
