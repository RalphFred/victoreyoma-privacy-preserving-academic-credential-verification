import { NextResponse } from "next/server";

const PINATA_PINNING_API = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

export async function POST(request) {
  try {
    const body = await request.json();
    const { encryptedPayload, metadata = {} } = body ?? {};

    if (!encryptedPayload || typeof encryptedPayload !== "string") {
      return NextResponse.json({ error: "Missing encryptedPayload" }, { status: 400 });
    }

    const pinataJwt = process.env.PINATA_JWT;
    if (!pinataJwt) {
      return NextResponse.json(
        { error: "Pinata JWT is not configured on server (PINATA_JWT)" },
        { status: 500 },
      );
    }

    const pinataPayload = {
      pinataContent: {
        encryptedPayload,
        ...metadata,
      },
      pinataMetadata: {
        name:
          typeof metadata.name === "string" && metadata.name.length
            ? metadata.name
            : `ppacvs-${Date.now()}`,
      },
    };

    const response = await fetch(PINATA_PINNING_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pinataJwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pinataPayload),
    });

    if (!response.ok) {
      const message = await response.text();
      return NextResponse.json(
        { error: `Pinata error: ${message}` },
        { status: response.status },
      );
    }

    const result = await response.json();

    return NextResponse.json({
      cid: result.IpfsHash,
      pinSize: result.PinSize,
      timestamp: result.Timestamp,
      isDuplicate: result.isDuplicate ?? false,
    });
  } catch (error) {
    console.error("Pinata upload failed", error);
    return NextResponse.json(
      { error: error?.message ?? "Upload failed" },
      { status: 500 },
    );
  }
}
