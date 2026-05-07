// app/api/twilio/voice/route.js
// Handles incoming phone calls via Twilio
// Twilio calls this URL when someone calls the business number

import Anthropic from '@anthropic-ai/sdk'
import { getBusinessBySlug, createLead, saveMessage } from '../../../../lib/supabase'
import twilio from 'twilio'
const VoiceResponse = twilio.twiml.VoiceResponse

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Step 1: Twilio calls this when call comes in — play greeting
export async function POST(request) {
  const formData = await request.formData()
  const businessSlug = request.nextUrl.searchParams.get('slug')
  const callerNumber = formData.get('From')

  const twiml = new VoiceResponse()

  try {
    const business = await getBusinessBySlug(businessSlug)
    const greeting = business?.greeting || `Thank you for calling ${business?.name || 'us'}. I am your AI receptionist. How can I help you today?`

    // Gather speech from caller
    const gather = twiml.gather({
      input: 'speech',
      timeout: 5,
      speechTimeout: 'auto',
      action: `/api/twilio/respond?slug=${businessSlug}`,
      method: 'POST',
      language: 'en-CA',
    })

    gather.say({
      voice: 'Polly.Joanna-Neural',
      language: 'en-CA',
    }, greeting)

    // If no input
    twiml.say({ voice: 'Polly.Joanna-Neural' }, 'I did not hear anything. Please call back and I will be happy to help.')
    twiml.hangup()

  } catch (error) {
    console.error('Voice route error:', error)
    twiml.say('Thank you for calling. Please hold while we connect you.')
    twiml.hangup()
  }

  return new Response(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' }
  })
}
