import { NextResponse } from "next/server";

interface Params {
  params: { id: string };
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = params;
  // TODO: Fetch market detail, outcomes, current probabilities.
  return NextResponse.json({ market_id: id, outcomes: [], probabilities: {} });
}


