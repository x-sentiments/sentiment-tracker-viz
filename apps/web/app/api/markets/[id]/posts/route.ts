import { NextResponse } from "next/server";
import { getSupabaseClient } from "../../../../../src/lib/supabase";

// Force dynamic rendering - don't cache this route
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient();

    // Parse query params for pagination
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);

    // Fetch raw posts for this market
    const { data: rawPosts, error: rawError } = await supabase
      .from("raw_posts")
      .select("id, text, author_id, author_followers, author_verified, post_created_at")
      .eq("market_id", id)
      .order("post_created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (rawError) {
      throw new Error(rawError.message);
    }

    if (!rawPosts || rawPosts.length === 0) {
      return NextResponse.json(
        { market_id: id, posts: [] },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "Pragma": "no-cache",
          },
        }
      );
    }

    // Fetch scored posts to get display labels (pick one per raw post)
    const rawPostIds = rawPosts.map((p) => p.id);
    const { data: scoredPosts, error: scoredError } = await supabase
      .from("scored_posts")
      .select("raw_post_id, display_labels")
      .in("raw_post_id", rawPostIds);

    if (scoredError) {
      console.error("Scored posts error:", scoredError);
    }

    // Map scored display labels to raw posts
    const labelsMap = new Map<string, unknown>();
    if (scoredPosts) {
      for (const sp of scoredPosts) {
        // Take the first display_labels we find for each raw_post
        if (sp.display_labels && !labelsMap.has(sp.raw_post_id)) {
          labelsMap.set(sp.raw_post_id, sp.display_labels);
        }
      }
    }

    // Combine data
    const posts = rawPosts.map((p) => ({
      id: p.id,
      text: p.text,
      author_id: p.author_id,
      author_followers: p.author_followers,
      author_verified: p.author_verified,
      post_created_at: p.post_created_at,
      display_labels: labelsMap.get(p.id) || null
    }));

    return NextResponse.json(
      {
        market_id: id,
        posts,
        pagination: {
          limit,
          offset,
          count: posts.length,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
        },
      }
    );
  } catch (error) {
    console.error("Market posts error:", error);
    return NextResponse.json(
      { error: { code: "FETCH_ERROR", message: (error as Error).message } },
      { status: 500 }
    );
  }
}
