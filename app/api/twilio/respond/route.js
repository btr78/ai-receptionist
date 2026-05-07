// app/api/twilio/respond/route.js
// AI responds to each thing the caller says

// Simple in-memory session store
const sessions = new Map()

export async function POST(request) {
  const searchParams = request.nextUrl.searchParams
  const slug = searchParams.get('slug') || 'hamilton-plumbing-pro'

  const formData = await request.formData()
  const callSid = formData.get('CallSid') || 'unknown'
  const callerNumber = formData.get('From') || 'Unknown'
  const speechResult = formData.get('SpeechResult') || ''
  const confidence = parseFloat(formData.get('Confidence') || '0')

  // Low confidence - ask to repeat
  if (!speechResult || confidence < 0.35) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="/api/twilio/respond?slug=${slug}" method="POST" language="en-CA">
    <Say voice="Polly.Joanna-Neural" language="en-CA">Sorry, I did not catch that. Could you please repeat?</Say>
  </Gather>
</Response>`
    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }

  // Get or create session
  if (!sessions.has(callSid)) {
    sessions.set(callSid, { history: [], callerNumber, slug })
  }
  const session = sessions.get(callSid)

  // Detect emergency immediately - connect right away
  const emergencyWords = ['flood', 'flooding', 'burst', 'gas leak', 'no heat', 'emergency', 'urgent']
  const isEmergency = emergencyWords.some(w => speechResult.toLowerCase().includes(w))

  if (isEmergency) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural" language="en-CA">This sounds like an emergency. I am connecting you to our emergency line right now. Please hold.</Say>
  <Dial>905-555-0199</Dial>
</Response>`
    sessions.delete(callSid)
    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }

  // Add to history
  session.history.push({ role: 'user', content: speechResult })

  // Call AI
  let aiReply = "Thank you for calling. Our team will call you back shortly."

  try {
    const messages = session.history.slice(-8)
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        system: `You are the phone receptionist for Hamilton Plumbing Pro in Hamilton, Ontario.
Keep ALL responses under 25 words - this is a voice call.
Services: drain cleaning, water heater, pipe repair, emergency plumbing.
Hours: Mon-Fri 8am-6pm, Sat 9am-2pm. Emergency: 905-555-0199.
Goal: get their name, service needed, and phone number. Tell them team calls back within 1 hour.
Caller phone on file: ${callerNumber}`,
        messages,
      })
    })

    if (anthropicRes.ok) {
      const data = await anthropicRes.json()
      aiReply = data.content?.[0]?.text || aiReply
    }
  } catch(e) {
    console.error('AI error:', e.message)
  }

  // Save to history
  session.history.push({ role: 'assistant', content: aiReply })
  sessions.set(callSid, session)

  // Detect call ending
  const endWords = ['goodbye', 'bye', 'thank you', 'thanks', 'that is all', 'no that is it']
  const isEnding = endWords.some(w => speechResult.toLowerCase().includes(w))

  // Save lead to Supabase after a few exchanges
  if (session.history.length >= 4) {
    try {
      const supabaseRes = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/leads`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            phone: callerNumber,
            channel: 'phone',
            status: 'new',
            urgency: 'normal',
            notes: `Phone call. Said: "${speechResult}"`
          })
        }
      )
    } catch(e) {}
  }

  if (isEnding) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna-Neural" language="en-CA">${aiReply} Have a great day! Goodbye!</Say>
  <Hangup/>
</Response>`
    sessions.delete(callSid)
    return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } })
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" timeout="6" speechTimeout="auto" action="/api/twilio/respond?slug=${slug}" method="POST" language="en-CA">
    <Say voice="Polly.Joanna-Neural" language="en-CA">${aiReply}</Say>
  </Gather>
  <Say voice="Polly.Joanna-Neural">Thank you for calling. Our team will be in touch soon. Goodbye!</Say>
</Response>`

  return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } })
}
