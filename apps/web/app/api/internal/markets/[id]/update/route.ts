import { NextResponse } from "next/server";
import { computeProbabilities } from "../../../../src/lib/probabilityAdapter";

interface Params {
  params: { id: string };
}

export async function POST(req: Request, { params }: Params) {
  try {
    const secret = req.headers.get("x_internal_secret");
    if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) throw new Error("Unauthorized");

    const payload = await req.json();
    const result = await computeProbabilities(params.id, payload);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: { code: "UPDATE_ERROR", message: (error as Error).message } },
      { status: 400 }
    );
  }
}


