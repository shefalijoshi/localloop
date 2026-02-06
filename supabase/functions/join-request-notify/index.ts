import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const RESEND_TOKEN = Deno.env.get('RESEND_TOKEN');
const API_URL = Deno.env.get('API_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY');
serve(async (req)=>{
  const supabase = createClient(API_URL, SERVICE_ROLE_KEY);
  try {
    const { record, old_record } = await req.json();
    // 1. Only process if status changed to 'request_pending'
    if (record.status !== 'request_pending' || old_record?.status === 'request_pending') {
      return new Response('No action needed', {
        status: 200
      });
    }
    // 2. Fetch Joiner Details
    const { data: joiner, error: joinerErr } = await supabase.from('profiles').select('display_name, address, location_verified').eq('id', record.profile_id).single();
    if (joinerErr || !joiner) throw new Error(`Joiner not found: ${joinerErr?.message}`);
    // 3. Parse Street Name (Regex: remove leading numbers and space)
    const streetName = joiner.address ? joiner.address.replace(/^[0-9]+\s+/, '') : 'Unknown Street';
    // 4. Find Seed User(s) for this neighborhood
    const { data: seedUsers, error: seedError } = await supabase.from('seed_users').select('profile_id').eq('neighborhood_id', record.neighborhood_id).limit(1);
    if (seedError || !seedUsers || seedUsers.length === 0) {
      await logEvent(supabase, 'seed_not_found', record, {
        error: 'No seed user assigned'
      });
      return new Response('Seed not found', {
        status: 200
      }) // 200 to prevent webhook retries
      ;
    }
    const profileId = seedUsers?.[0]?.profile_id;
    const { data: profileDetails, error: profileError } = await supabase.from('profile_details').select('email, display_name').eq('profile_id', profileId).single();
    if (profileError || !profileDetails || profileDetails.length === 0) {
      await logEvent(supabase, 'seed_profile_not_found', record, {
        error: 'No seed user profile'
      });
      return new Response('Seed user\'s profile not found', {
        status: 200
      }) // 200 to prevent webhook retries
      ;
    }
    // 5. Send Email via Resend
    const seedEmail = profileDetails.email;
    const verificationStatus = joiner.location_verified ? "✅ Location Verified" : "⚠️ Location Not Verified";
    const verificationCode = record.vouch_verification_code;
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_TOKEN}`
      },
      body: JSON.stringify({
        from: 'LocalLoop <notifications@localloop.com>',
        to: [
          seedEmail
        ],
        subject: `Vouch Request: ${streetName}`,
        html: `
          <h3>New Neighbor Request</h3>
          <p><strong>${joiner.display_name}</strong> from <strong>${streetName}</strong> wants to join your neighborhood group.</p>
          <p>Status: ${verificationStatus}</p>
          <p>Verification code: ${verificationCode}</p>
          <p><a href="https://yourapp.com/vouch/${record.id}">View Request and Vouch</a></p>
        `
      })
    });
    const emailData = await emailRes.json();
    // 6. Final Log for Support
    await logEvent(supabase, 'notification_email_dispatched', record, {
      resend_id: emailData.id,
      recipient: seedEmail,
      recipientName: profileDetails.display_name,
      street_parsed: streetName,
      vouch_code: verificationCode
    });
    return new Response(JSON.stringify(emailData), {
      status: 200
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({
      error: err.message
    }), {
      status: 500
    });
  }
});
// Helper to keep the main logic clean
async function logEvent(supabase, type, record, meta) {
  await supabase.from('system_events').insert({
    event_type: type,
    neighborhood_id: record.neighborhood_id,
    profile_id: record.profile_id,
    user_id: record.user_id,
    metadata: meta
  });
}
