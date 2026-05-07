// app/api/chat/route.js
// Uses plain fetch to call Anthropic API - no SDK needed

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
    const { message, businessSlug, history = [] } = body

    if (!message) {
      return Response.json({ error: 'No message provided' }, { status: 400, headers: CORS })
    }

    // Fallback business — always works even without Supabase
    const business = {
      name: 'Hamilton Plumbing Pro',
      phone: '905-555-0100',
      city: 'Hamilton',
      services: 'drain cleaning, water heater repair, pipe repair, emergency plumbing, bathroom renovation',
      hours: 'Monday to Friday 8am to 6pm, Saturday 9am to 2pm',
      emergency: true,
      emergencyPhone: '905-555-0199',
    }

    // Try to get real business from Supabase
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && businessSlug) {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/businesses?slug=eq.${businessSlug}&active=eq.true&select=*`,
          {
            headers: {
              'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            }
          }
        )
        const data = await res.json()
        if (data && data[0]) {
          const b = data[0]
          business.name = b.name || business.name
          business.phone = b.phone || business.phone
          business.city = b.city || business.city
          business.services = Array.isArray(b.services) ? b.services.join(', ') : business.services
          business.hours = b.hours || business.hours
          business.emergency = b.emergency_available || business.emergency
          business.emergencyPhone = b.emergency_phone || business.emergencyPhone
        }
      }
    } catch(e) {
      console.log('Supabase lookup failed, using fallback business')
    }

    const systemPrompt = `You are the AI receptionist for ${business.name}, a plumbing company in ${business.city}, Canada.

GOALS: Find out what they need, get their name and phone, offer to book or call back within 1 hour.

BUSINESS: ${business.name} | Phone: ${business.phone} | Services: ${business.services} | Hours: ${business.hours}
EMERGENCY: ${business.emergency ? 'YES 24/7 at ' + business.emergencyPhone : 'No emergency service'}

RULES: Keep replies to 2-3 sentences. Be warm and helpful. Never quote prices. If emergency, give emergency number immediately.`

    const messages = [
      ...history.slice(-10).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message }
    ]

    // Call Anthropic API directly with fetch
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: systemPrompt,
        messages,
      }),
    })

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text()
      console.error('Anthropic error:', errText)
      return Response.json(
        { reply: `Thank you for contacting ${business.name}. Please call us at ${business.phone} and we will help you right away!` },
        { headers: CORS }
      )
    }

    const data = await anthropicRes.json()
    const reply = data.content?.[0]?.text || `Please call us at ${business.phone} and we will help right away!`

    const bookingWords = ['book', 'schedule', 'appointment', 'available', 'come out', 'when can', 'send someone']
    const bookingDetected = bookingWords.some(w => message.toLowerCase().includes(w))

    return Response.json({
      reply,
      bookingDetected,
      businessPhone: business.phone,
      emergencyPhone: business.emergency ? business.emergencyPhone : null,
    }, { headers: CORS })

  } catch (error) {
    console.error('Chat API error:', error.message)
    return Response.json(
      { reply: 'Please call us directly at 905-555-0100 and we will help you right away!' },
      { status: 200, headers: CORS }
    )
  }
}
