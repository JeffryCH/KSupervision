import { NextResponse } from "next/server";

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

interface GooglePlaceDetailsResult {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  website?: string;
  geometry?: {
    location?: {
      lat?: number;
      lng?: number;
    };
  };
  address_components?: Array<{
    long_name?: string;
    short_name?: string;
    types?: string[];
  }>;
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
    const placeId = url.searchParams.get("placeId")?.trim();

    if (!placeId) {
      return NextResponse.json(
        { success: false, message: "El parámetro 'placeId' es obligatorio" },
        { status: 400 }
      );
    }

    const apiUrl = new URL(
      "https://maps.googleapis.com/maps/api/place/details/json"
    );
    apiUrl.searchParams.set("place_id", placeId);
    apiUrl.searchParams.set("key", GOOGLE_API_KEY);
    apiUrl.searchParams.set("language", "es");
    apiUrl.searchParams.set(
      "fields",
      [
        "place_id",
        "name",
        "formatted_address",
        "formatted_phone_number",
        "geometry",
        "website",
        "address_component",
      ].join(",")
    );

    const response = await fetch(apiUrl.toString());
    const data = await response.json();

    if (data.status !== "OK") {
      const message =
        data.error_message || data.status || "No se pudo obtener el lugar";
      return NextResponse.json({ success: false, message }, { status: 400 });
    }

    const result: GooglePlaceDetailsResult = data.result ?? {};

    const addressComponents = result.address_components ?? [];
    const normalizeRegion = (value?: string | null) => {
      if (!value) return "";
      return value
        .replace(/^Provincia\s+de\s+/i, "")
        .replace(/^Province\s+of\s+/i, "")
        .replace(/^Cant[oó]n\s+(?:de|del)\s+/i, "")
        .replace(/^County\s+of\s+/i, "")
        .trim();
    };

    const findComponent = (type: string) =>
      addressComponents.find((component) => component.types?.includes(type));

    const provinceComponent = findComponent("administrative_area_level_1");
    const cantonComponent = findComponent("administrative_area_level_2");

    return NextResponse.json({
      success: true,
      data: {
        id: result.place_id ?? placeId,
        name: result.name ?? "",
        address: result.formatted_address ?? "",
        phone: result.formatted_phone_number ?? "",
        website: result.website ?? "",
        province:
          normalizeRegion(
            provinceComponent?.long_name ?? provinceComponent?.short_name
          ) ?? "",
        canton:
          normalizeRegion(
            cantonComponent?.long_name ?? cantonComponent?.short_name
          ) ?? "",
        location: {
          latitude: result.geometry?.location?.lat ?? null,
          longitude: result.geometry?.location?.lng ?? null,
        },
      },
    });
  } catch (error) {
    console.error("Error al consultar detalles de Google Places:", error);
    return NextResponse.json(
      {
        success: false,
        message: "No se pudieron obtener los detalles del lugar",
      },
      { status: 500 }
    );
  }
}
