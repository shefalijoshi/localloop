import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
function generateCircleGeoJSON(centerLat, centerLon, radiusInMeters, numPoints = 32) {
  const points = [];
  const earthRadius = 6371000; // meters
  const lat = centerLat * Math.PI / 180;
  const lon = centerLon * Math.PI / 180;
  const angularDistance = radiusInMeters / earthRadius;
  for(let i = 0; i <= numPoints; i++){
    const bearing = i / numPoints * 2 * Math.PI;
    const pointLat = Math.asin(Math.sin(lat) * Math.cos(angularDistance) + Math.cos(lat) * Math.sin(angularDistance) * Math.cos(bearing));
    const pointLon = lon + Math.atan2(Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat), Math.cos(angularDistance) - Math.sin(lat) * Math.sin(pointLat));
    let lonDeg = pointLon * 180 / Math.PI;
    if (lonDeg > 180) lonDeg -= 360;
    if (lonDeg < -180) lonDeg += 360;
    points.push([
      lonDeg,
      pointLat * 180 / Math.PI
    ]);
  }
  return {
    type: "Feature",
    properties: {
      fill: "#BC6C4D",
      "fill-opacity": 0.12,
      stroke: "#A55E42",
      "stroke-width": 3
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        points
      ]
    }
  };
}
serve(async (req)=>{
  const payload = await req.json();
  const record = payload.record;
  if (!record) return new Response("No record", {
    status: 400
  });
  const { id, center_lat, center_lng, radius_miles, map_image_url } = record;
  if (map_image_url) return new Response("Already generated", {
    status: 200
  });
  const MAPBOX_TOKEN = Deno.env.get("MAPBOX_TOKEN");
  const API_URL = Deno.env.get("API_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY");
  const supabase = createClient(API_URL, SERVICE_ROLE_KEY);
  // Convert miles → meters
  const radiusMeters = Number(radius_miles ?? 0.5) * 1609.344;
  // Generate GeoJSON polygon
  const circleGeoJSON = generateCircleGeoJSON(Number(center_lat), Number(center_lng), radiusMeters);
  const overlay = encodeURIComponent(JSON.stringify(circleGeoJSON));
  const size = "512x512@2x";
  const mapUrl = `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/` + `pin-s+A55E42(${center_lng},${center_lat}),` + `geojson(${overlay})/auto/${size}?format=jpg80&access_token=${MAPBOX_TOKEN}`;
  console.log(mapUrl);
  const mapResp = await fetch(mapUrl);
  if (!mapResp.ok) {
    console.error(await mapResp.text());
    return new Response("Mapbox error", {
      status: 500
    });
  }
  const image = new Uint8Array(await mapResp.arrayBuffer());
  const filePath = `neighborhoods/${id}.jpg`;
  await supabase.storage.from("neighborhood-maps").upload(filePath, image, {
    contentType: "image/jpeg",
    upsert: true
  });
  const { data } = supabase.storage.from("neighborhood-maps").getPublicUrl(filePath);
  await supabase.from("neighborhoods").update({
    map_image_url: data.publicUrl
  }).eq("id", id);
  return new Response(JSON.stringify({
    success: true
  }), {
    headers: {
      "Content-Type": "application/json"
    }
  });
});
