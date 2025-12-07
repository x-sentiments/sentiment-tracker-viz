import { NextResponse } from "next/server";

interface Params {
  params: { id: string };
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = params;
  // TODO: Fetch probability_snapshots for the market.
  return NextResponse.json({ market_id: id, snapshots: [] });
}


