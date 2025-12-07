import { NextResponse } from "next/server";

export async function GET() {
  // TODO: Fetch from Supabase markets + current probabilities.
  return NextResponse.json({
    markets: []
  });
}


