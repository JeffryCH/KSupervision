import { NextResponse } from "next/server";

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

interface GooglePlaceResult {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  geometry?: {
    location?: {
      lat?: number;
      lng?: number;
    };
  };
  types?: string[];
  rating?: number;
}

export async function GET(request: Request) {
  if (!GOOGLE_API_KEY) {
    return NextResponse.json(
      {
        success: false,
        message:
          "GOOGLE_PLACES_API_KEY no está configurado en las variables de entorno",
      },
      { status: 500 }
    );
  }

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("query")?.trim();

    if (!query) {
      return NextResponse.json(
        {
          success: false,
          message: "El parámetro 'query' es obligatorio",
        },
        { status: 400 }
      );
    }

    const apiUrl = new URL(
      "https://maps.googleapis.com/maps/api/place/textsearch/json"
    );
    apiUrl.searchParams.set("query", query);
    apiUrl.searchParams.set("key", GOOGLE_API_KEY);
    apiUrl.searchParams.set("language", "es");
    apiUrl.searchParams.set("region", "cr");

    const response = await fetch(apiUrl.toString());
    const data = await response.json();

    if (data.status !== "OK") {
      const message =
        data.error_message ||
        data.status ||
        "La búsqueda de lugares no devolvió resultados";
      return NextResponse.json({ success: false, message }, { status: 400 });
    }

    const results: GooglePlaceResult[] = Array.isArray(data.results)
      ? data.results
      : [];

    const places = results.map((place) => ({
      id: place.place_id ?? "",
      name: place.name ?? "",
      address: place.formatted_address ?? "",
      location: {
        latitude: place.geometry?.location?.lat ?? null,
        longitude: place.geometry?.location?.lng ?? null,
      },
      types: place.types ?? [],
      rating: place.rating ?? null,
    }));

    return NextResponse.json({ success: true, data: places });
  } catch (error) {
    console.error("Error al consultar Google Places:", error);
    return NextResponse.json(
      {
        success: false,
        message: "No se pudo completar la búsqueda de lugares",
      },
      { status: 500 }
    );
  }
}
