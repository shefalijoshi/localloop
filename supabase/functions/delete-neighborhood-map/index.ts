import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
serve(async (req)=>{
  try {
    const payload = await req.json();
    const record = payload.old_record;
    if (!record || !record.id) {
      return new Response("No record in payload", {
        status: 400
      });
    }
    // Environment variables
    const API_URL = Deno.env.get("API_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY");
    const supabase = createClient(API_URL, SERVICE_ROLE_KEY);
    const filePath = `neighborhoods/${record.id}.jpg`;
    const { error: removeError } = await supabase.storage.from("neighborhood-maps").remove([
      filePath
    ]);
    if (removeError) {
      console.error("Failed to delete image:", removeError);
      // We still return 200 so webhook doesn’t keep retrying forever
      return new Response(JSON.stringify({
        success: false,
        error: removeError
      }), {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    return new Response(JSON.stringify({
      success: true
    }), {
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response("Internal server error", {
      status: 500
    });
  }
});
