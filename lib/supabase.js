// lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Public client - for widget (read-only business data, insert leads)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Service client - for server-side (full access, never expose to browser)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Get business by slug (for widget)
export async function getBusinessBySlug(slug) {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .single()
  if (error) return null
  return data
}

// Create a new lead
export async function createLead(businessId, leadData) {
  const { data, error } = await supabaseAdmin
    .from('leads')
    .insert({
      business_id: businessId,
      ...leadData
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// Save a conversation message
export async function saveMessage(leadId, businessId, role, content, channel = 'chat') {
  const { error } = await supabaseAdmin
    .from('conversations')
    .insert({ lead_id: leadId, business_id: businessId, role, content, channel })
  if (error) console.error('Save message error:', error)
}

// Update lead status and notes
export async function updateLead(leadId, updates) {
  const { error } = await supabaseAdmin
    .from('leads')
    .update(updates)
    .eq('id', leadId)
  if (error) console.error('Update lead error:', error)
}

// Get all leads for a business (for dashboard)
export async function getLeads(businessId, limit = 50) {
  const { data, error } = await supabaseAdmin
    .from('leads')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) return []
  return data
}

// Get conversation history for a lead
export async function getConversation(leadId) {
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true })
  if (error) return []
  return data
}
