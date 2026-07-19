import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret");

    // Fail closed: with no secret configured, refuse rather than falling back to a
    // constant (a committed default would let anyone trigger revalidation).
    const configuredSecret = process.env.SANITY_REVALIDATE_SECRET;
    if (!configuredSecret) {
      return NextResponse.json({ message: "Revalidation is not configured." }, { status: 503 });
    }

    if (secret !== configuredSecret) {
      return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
    }

    // Invalidate the "cms" tag. Next 16 requires a cache-life profile as the
    // second argument ("max" = stale-while-revalidate); the 1-arg form is
    // deprecated and fails typecheck.
    revalidateTag("cms", "max");
    console.log("Next.js cache revalidated for tag: cms");

    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
