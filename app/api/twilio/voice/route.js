// app/api/twilio/voice/route.js
// Answers incoming calls instantly - no external calls, maximum reliability

export async function POST(request) {
  const url = new URL(request.url)
  const slug = url.searchParams.get('slug') || 'hamilton-plumbing-pro'

  // Instantly return TwiML - no Supabase call, no delays
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" timeout="8" speechTimeout="auto" action="${process.env.NEXT_PUBLIC_APP_URL || 'https://ai-receptionist-blond-pi.vercel.app'}/api/twilio/respond?slug=${slug}" method="POST" language="en-CA">
    <Say voice="Polly.Joanna-Neural" language="en-CA">Thank you for calling Hamilton Plumbing Pro. I am your AI receptionist, available 24 hours a day, 7 days a week. How can I help you today?</Say>
  </Gather>
  <Redirect method="POST">${process.env.NEXT_PUBLIC_APP_URL || 'https://ai-receptionist-blond-pi.vercel.app'}/api/twilio/voice?slug=${slug}</Redirect>
</Response>`

  return new Response(twiml, {
    status: 200,
    headers: {
      'Content-Type': 'text/xml',
      'Cache-Control': 'no-cache',
    }
  })
}

export async function GET(request) {
  const url = new URL(request.url)
  const slug = url.searchParams.get('slug') || 'hamilton-plumbing-pro'

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" timeout="8" speechTimeout="auto" action="${process.env.NEXT_PUBLIC_APP_URL || 'https://ai-receptionist-blond-pi.vercel.app'}/api/twilio/respond?slug=${slug}" method="POST" language="en-CA">
    <Say voice="Polly.Joanna-Neural" language="en-CA">Thank you for calling Hamilton Plumbing Pro. I am your AI receptionist, available 24 hours a day, 7 days a week. How can I help you today?</Say>
  </Gather>
  <Redirect method="POST">${process.env.NEXT_PUBLIC_APP_URL || 'https://ai-receptionist-blond-pi.vercel.app'}/api/twilio/voice?slug=${slug}</Redirect>
</Response>`

  return new Response(twiml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' }
  })
}
