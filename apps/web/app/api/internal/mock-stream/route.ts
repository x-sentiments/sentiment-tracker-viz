import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "../../../src/lib/supabase";
import { extractPostFeatures } from "../../../src/lib/grokClient";

const mockStreamSchema = z.object({
  market_id: z.string().uuid(),
  count: z.number().int().min(1).max(50).default(5)
});

// Sample mock posts for testing
const MOCK_POSTS = [
  {
    text: "Latest polls show Trump leading in key swing states. This could be significant for 2028.",
    author_followers: 125000,
    author_verified: true
  },
  {
    text: "Kamala Harris gaining momentum with younger voters according to new data 📊",
    author_followers: 45000,
    author_verified: false
  },
  {
    text: "Breaking: Major endorsement coming this week that could shift the race dramatically",
    author_followers: 890000,
    author_verified: true
  },
  {
    text: "I think we're going to see a surprise candidate emerge. Mark my words! 🔮",
    author_followers: 2500,
    author_verified: false
  },
  {
    text: "Political analysts are split 50/50 on this one. Too early to call.",
    author_followers: 78000,
    author_verified: true
  },
  {
    text: "The economy will be the deciding factor. People vote with their wallets.",
    author_followers: 15000,
    author_verified: false
  },
  {
    text: "Don't trust the polls - they were wrong before and they'll be wrong again!",
    author_followers: 3200,
    author_verified: false
  },
  {
    text: "Just heard from a reliable source that campaign internals look very different from public polls",
    author_followers: 560000,
    author_verified: true
  },
  {
    text: "This election is going to come down to turnout. Simple as that.",
    author_followers: 22000,
    author_verified: false
  },
  {
    text: "My prediction: we won't know the winner until days after the election 🗳️",
    author_followers: 8900,
    author_verified: false
  }
];

function assertSecret(req: Request) {
  const secret = req.headers.get("x-internal-secret") ?? req.headers.get("x_internal_secret");
  if (!secret || secret !== process.env.INTERNAL_WEBHOOK_SECRET) {
    throw new Error("Unauthorized");
  }
}

export async function POST(req: Request) {
  try {
    assertSecret(req);

    const body = await req.json();
    const { market_id, count } = mockStreamSchema.parse(body);
    const supabase = createServiceRoleClient();

    // Verify market exists
    const { data: market, error: marketError } = await supabase
      .from("markets")
      .select("id")
      .eq("id", market_id)
      .single();

    if (marketError || !market) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Market not found" } },
        { status: 404 }
      );
    }

    // Generate mock posts
    const postsToInsert = [];
    const now = Date.now();

    for (let i = 0; i < count; i++) {
      const mockPost = MOCK_POSTS[i % MOCK_POSTS.length];
      const jitter = Math.random() * 3600000; // Random time within last hour

      postsToInsert.push({
        market_id,
        x_post_id: `mock_${now}_${i}_${Math.random().toString(36).substring(7)}`,
        text: mockPost.text,
        post_created_at: new Date(now - jitter).toISOString(),
        author_id: `mock_author_${i}`,
        author_followers: mockPost.author_followers,
        author_verified: mockPost.author_verified,
        author_created_at: new Date(now - 365 * 24 * 3600 * 1000).toISOString(), // 1 year ago
        metrics: {
          likes: Math.floor(Math.random() * 100),
          reposts: Math.floor(Math.random() * 20),
          replies: Math.floor(Math.random() * 15),
          quotes: Math.floor(Math.random() * 5)
        },
        features: extractPostFeatures(mockPost.text),
        is_active: true
      });
    }

    // Insert posts
    const { data: inserted, error: insertError } = await supabase
      .from("raw_posts")
      .insert(postsToInsert)
      .select("id");

    if (insertError) {
      throw new Error(insertError.message);
    }

    return NextResponse.json({
      status: "created",
      count: inserted?.length || 0,
      message: `Created ${inserted?.length || 0} mock posts for market ${market_id}`
    });
  } catch (error) {
    console.error("Mock stream error:", error);
    return NextResponse.json(
      {
        error: {
          code: "MOCK_ERROR",
          message: error instanceof Error ? error.message : "Unknown error"
        }
      },
      { status: 400 }
    );
  }
}
