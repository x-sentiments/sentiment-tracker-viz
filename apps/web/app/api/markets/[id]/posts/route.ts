import { NextResponse } from "next/server";

interface Params {
  params: { id: string };
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = params;
  // TODO: Paginate curated posts for display.
  return NextResponse.json({ market_id: id, posts: [] });
}


