// app/api/twilio/voice/route.js
// Answers incoming phone calls with AI greeting

export async function POST(request) {
  const searchParams = request.nextUrl.searchParams
  const slug = searchParams.get('slug') || 'hamilton-plumbing-pro'

  // Get business greeting from Supabase or use fallback
  let greeting = "Hi! Thank you for calling Hamilton Plumbing Pro. I am your AI receptionist available 24 hours a day. How can I help you today?"
  let businessName = "Hamilton Plumbing Pro"

  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/businesses?slug=eq.${slug}&active=eq.true&select=name,greeting,phone`,
        {
          headers: {
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          }
        }
      )
      const data = await res.json()
      if (data && data[0]) {
        businessName = data[0].name || businessName
        greeting = data[0].greeting || `Hi! Thank you for calling ${businessName}. I am your AI receptionist. How can I help you today?`
      }
    }
  } catch(e) {
    console.log('Using fallback greeting')
  }

  // Return TwiML to gather speech from caller
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="/api/twilio/respond?slug=${slug}" method="POST" language="en-CA">
    <Say voice="Polly.Joanna-Neural" language="en-CA">${greeting}</Say>
  </Gather>
  <Say voice="Polly.Joanna-Neural">I did not hear anything. Please call back and we will be happy to help. Goodbye!</Say>
</Response>`

  return new Response(twiml, {
    headers: { 'Content-Type': 'text/xml' }
  })
}
