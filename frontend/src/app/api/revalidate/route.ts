import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret");

    const configuredSecret = process.env.SANITY_REVALIDATE_SECRET || "acemco_revalidate_secret_2026";

    if (secret !== configuredSecret) {
      return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
    }

    // Clear the Next.js cache for the "cms" tag
    revalidateTag("cms", "max");
    console.log("Next.js cache revalidated for tag: cms");

    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
