// app/api/leads/route.js
import { getLeads, supabaseAdmin } from '../../../lib/supabase'

// GET /api/leads - get all leads for dashboard
export async function GET(request) {
  const searchParams = request.nextUrl.searchParams
  const filter = searchParams.get('filter') || 'all'
  const businessId = searchParams.get('businessId')

  try {
    // Build query
    let query = supabaseAdmin.from('leads').select('*')

    if (businessId) query = query.eq('business_id', businessId)
    if (filter === 'new') query = query.eq('status', 'new')
    if (filter === 'booked') query = query.eq('status', 'booked')
    if (filter === 'emergency') query = query.eq('urgency', 'emergency')

    query = query.order('created_at', { ascending: false }).limit(100)

    const { data: leads, error } = await query
    if (error) throw error

    // Calculate stats
    const today = new Date()
    today.setHours(0,0,0,0)

    const stats = {
      total: leads.length,
      new: leads.filter(l => l.status === 'new').length,
      booked: leads.filter(l => l.status === 'booked').length,
      today: leads.filter(l => new Date(l.created_at) >= today).length,
    }

    return Response.json({ leads, stats })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/leads - update lead info from widget contact form
export async function POST(request) {
  const body = await request.json()
  const { businessSlug, leadId, name, phone, email, notes } = body

  try {
    if (leadId) {
      // Update existing lead
      const { data, error } = await supabaseAdmin
        .from('leads')
        .update({ name, phone, email, notes, status: 'contacted' })
        .eq('id', leadId)
        .select()
        .single()
      if (error) throw error
      return Response.json({ lead: data })
    } else {
      // Create new lead (fallback)
      const { data: business } = await supabaseAdmin
        .from('businesses')
        .select('id')
        .eq('slug', businessSlug)
        .single()

      if (!business) return Response.json({ error: 'Business not found' }, { status: 404 })

      const { data, error } = await supabaseAdmin
        .from('leads')
        .insert({ business_id: business.id, name, phone, email, notes, channel: 'chat', status: 'new' })
        .select()
        .single()
      if (error) throw error
      return Response.json({ lead: data })
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
