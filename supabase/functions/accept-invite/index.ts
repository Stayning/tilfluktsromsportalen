import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with user's auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Get user from JWT
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: authHeader } },
      }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user's phone number
    const phone = user.phone
    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'User has no phone number', new_shelters_count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Normalize phone formats to match both with and without + prefix
    const phoneWithPlus = phone.startsWith('+') ? phone : `+${phone}`
    const phoneWithoutPlus = phone.startsWith('+') ? phone.slice(1) : phone

    // Find all pending invites for this phone number (match both formats)
    const { data: pendingInvites, error: invitesError } = await supabaseAdmin
      .from('tilfluktsrom_invites')
      .select('id, shelter_id, invited_by')
      .in('phone_number', [phoneWithPlus, phoneWithoutPlus])
      .eq('status', 'pending')

    if (invitesError) {
      console.error('Error fetching invites:', invitesError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch invites' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!pendingInvites || pendingInvites.length === 0) {
      return new Response(
        JSON.stringify({ new_shelters_count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Process each invite in a transaction-like manner
    let successCount = 0

    for (const invite of pendingInvites) {
      // Check if membership already exists
      const { data: existingMember } = await supabaseAdmin
        .from('tilfluktsrom_members')
        .select('id')
        .eq('shelter_id', invite.shelter_id)
        .eq('user_id', user.id)
        .single()

      if (existingMember) {
        // Already a member, just update the invite status
        await supabaseAdmin
          .from('tilfluktsrom_invites')
          .update({ status: 'accepted' })
          .eq('id', invite.id)
        continue
      }

      // Insert membership
      const { error: memberError } = await supabaseAdmin
        .from('tilfluktsrom_members')
        .insert({
          shelter_id: invite.shelter_id,
          user_id: user.id,
          invited_by: invite.invited_by,
          is_active: true,
        })

      if (memberError) {
        console.error('Error creating membership:', memberError)
        continue
      }

      // Update invite status
      const { error: updateError } = await supabaseAdmin
        .from('tilfluktsrom_invites')
        .update({ status: 'accepted' })
        .eq('id', invite.id)

      if (updateError) {
        console.error('Error updating invite:', updateError)
        continue
      }

      successCount++
    }

    return new Response(
      JSON.stringify({ new_shelters_count: successCount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
