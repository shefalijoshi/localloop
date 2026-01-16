// src/lib/geocoding.ts

export interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

/**
 * Fetches precise coordinates and standardized address from Mapbox.
 * Supports AbortSignal to prevent race conditions during rapid typing.
 */
export async function getCoordsFromAddress(
  address: string, 
  signal?: AbortSignal
): Promise<GeocodingResult | null> {
  if (address.length < 5) return null;

  try {
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) throw new Error("Mapbox token is missing");

    // We restrict types to 'address' and 'poi' (points of interest) 
    // to ensure we aren't verifying a whole city or zip code.
    const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      address
    )}.json?access_token=${token}&limit=1&types=address,poi`;

    const response = await fetch(endpoint, {
      ...(signal ? { signal } : {})
    });
    if (!response.ok) throw new Error("Network response was not ok");
    
    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const [lng, lat] = feature.center;
      
      return { 
        lat, 
        lng, 
        formattedAddress: feature.place_name 
      };
    }
    
    return null;
  } catch (error: any) {
    // If the request was aborted, we don't want to log an error
    if (error.name === 'AbortError') return null;
    
    console.error("Geocoding helper error:", error);
    return null;
  }
}

// Haversine formula to calculate distance in meters
export function getDistanceInMeters (coord1: [number, number], coord2: [number, number]) {
  const R = 6371e3; // Earth's radius
  const dLat = (coord2[1] - coord1[1]) * Math.PI / 180;
  const dLon = (coord2[0] - coord1[0]) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(coord1[1] * Math.PI / 180) * Math.cos(coord2[1] * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};