import express from "express";
import { InitResponse } from "../shared/types/api";
import {
  createServer,
  context,
  getServerPort,
  reddit,
  redis
} from "@devvit/web/server";
import { createPost } from "./core/post";

const app = express();

// Middleware for JSON body parsing
app.use(express.json());
// Middleware for URL-encoded body parsing
app.use(express.urlencoded({ extended: true }));
// Middleware for plain text body parsing
app.use(express.text());

const router = express.Router();

router.get<
  { postId: string },
  InitResponse | { status: string; message: string }
>("/api/init", async (_req, res): Promise<void> => {
  const { postId } = context;

  if (!postId) {
    console.error("API Init Error: postId not found in devvit context");
    res.status(400).json({
      status: "error",
      message: "postId is required but missing from context",
    });
    return;
  }

  try {
    const username = await reddit.getCurrentUsername();

    res.json({
      type: "init",
      postId: postId,
      username: username ?? "anonymous",
    });
  } catch (error) {
    console.error(`API Init Error for post ${postId}:`, error);
    let errorMessage = "Unknown error during initialization";
    if (error instanceof Error) {
      errorMessage = `Initialization failed: ${error.message}`;
    }
    res.status(400).json({ status: "error", message: errorMessage });
  }
});

// Add your game-specific API endpoints here
// Examples:
// router.post("/api/save-score", async (req, res) => { ... });
// router.get("/api/leaderboard", async (req, res) => { ... });
// router.post("/api/game-event", async (req, res) => { ... });

// ##########################################################################
// # DEMO SAMPLE: State + Score + Leaderboard using Redis
// ##########################################################################

type StoredState = {
  username: string;
  level?: number;
  bestScore?: number;              // <- optional; we mirror leaderboard here
  data?: Record<string, unknown>;
  updatedAt: number;
};

function stateKey(postId: string, username: string) {
  return `state:${postId}:${username}`;
}
function leaderboardKey(postId: string) {
  return `lb:${postId}`;
}
async function getUsername(): Promise<string> {
  const u = await reddit.getCurrentUsername();
  return u ?? "anonymous";
}

// GET /api/state -> fetch current user's state for this post
router.get("/api/state", async (_req, res) => {
  try {
    const { postId } = context;
    if (!postId) return res.status(400).json({ error: "Missing postId in context" });

    const username = await getUsername();
    const key = stateKey(postId, username);
    const json = await redis.get(key);
    if (!json) return res.status(404).json({ error: "No state found" });

    res.json(JSON.parse(json) as StoredState);
  } catch (err) {
    console.error("GET /api/state error:", err);
    res.status(500).json({ error: "Failed to fetch state" });
  }
});

// POST /api/state -> upsert current user's state for this post
router.post("/api/state", async (req, res) => {
  try {
    const { postId } = context;
    if (!postId) return res.status(400).json({ error: "Missing postId in context" });

    const username = await getUsername();
    if (username === "anonymous") return res.status(401).json({ error: "Login required" });

    const { level, data } = req.body ?? {};
    if (level !== undefined && typeof level !== "number") {
      return res.status(400).json({ error: "level must be a number" });
    }
    if (data !== undefined && (typeof data !== "object" || data === null)) {
      return res.status(400).json({ error: "data must be an object" });
    }

    const key = stateKey(postId, username);
    const prevRaw = await redis.get(key);
    const prev = (prevRaw ? JSON.parse(prevRaw) : {}) as Partial<StoredState>;

    // build the new state; only include optional fields if they exist
    const next: StoredState = {
      username,
      updatedAt: Date.now(),
      ...(typeof level === "number" ? { level } : (prev.level !== undefined ? { level: prev.level } : {})),
      ...(data !== undefined           ? { data }  : (prev.data  !== undefined ? { data: prev.data } : {})),
      ...(prev.bestScore !== undefined ? { bestScore: prev.bestScore } : {}),
    };

    await redis.set(key, JSON.stringify(next));
    res.json(next);
  } catch (err) {
    console.error("POST /api/state error:", err);
    res.status(500).json({ error: "Failed to save state" });
  }
});

// POST /api/score -> submit/update best score for this post
router.post("/api/score", async (req, res) => {
  try {
    const { postId } = context;
    if (!postId) return res.status(400).json({ error: "Missing postId in context" });

    const username = await getUsername();
    if (username === "anonymous") return res.status(401).json({ error: "Login required" });

    const { score } = req.body ?? {};
    if (typeof score !== "number" || !Number.isFinite(score)) {
      return res.status(400).json({ error: "score must be a finite number" });
    }

    // simple clamp, avoids abuse with huge numbers
    const sanitized = Math.max(0, Math.min(score, 1_000_000_000));
    const lbKey = leaderboardKey(postId);

    // read old score (if any) and keep the max
    const existing = await redis.zScore(lbKey, username);
    const best = existing !== undefined && existing !== null
      ? Math.max(Number(existing), sanitized)
      : sanitized;

    // zAdd here updates the sorted set; score used for ranking, member is the username
    await redis.zAdd(lbKey, { score: best, member: username });

    // also mirror this best score into the per-user state
    const sKey = stateKey(postId, username);
    const prevRaw = await redis.get(sKey);
    const prev = (prevRaw ? JSON.parse(prevRaw) : {}) as Partial<StoredState>;

    const next: StoredState = {
      username,
      updatedAt: Date.now(),
      ...(prev.level !== undefined ? { level: prev.level } : {}),
      ...(prev.data  !== undefined ? { data: prev.data } : {}),
      bestScore: best,
    };

    await redis.set(sKey, JSON.stringify(next));

    res.json({ username, score: best, updatedAt: next.updatedAt });
  } catch (err) {
    console.error("POST /api/score error:", err);
    res.status(500).json({ error: "Failed to submit score" });
  }
});

// GET /api/leaderboard?limit=10 -> top N + caller's rank
router.get("/api/leaderboard", async (req, res) => {
  try {
    const { postId } = context;
    if (!postId) {
      return res.status(400).json({ error: "Missing postId in context" });
    }

    const username = await getUsername();
    const limitParam = Number(req.query.limit ?? 10);
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 100)) : 10;

    const lbKey = leaderboardKey(postId);

    // zRange can return with scores when asked; our SDK does ascending by default
    // so to emulate "top N", either use rev:true (if available) or flip ranks manually
    const entries = await redis.zRange(lbKey, 0, limit - 1);

    const top = entries.map((e, i) => ({
      rank: i + 1,
      username: e.member,
      score: Number(e.score ?? 0),
    }));

    // find caller's rank: only ascending zRank is guaranteed
    const ascRank = await redis.zRank(lbKey, username);
    const total = Number((await redis.zCard(lbKey)) ?? 0);
    const meRank0 =
      ascRank !== null && ascRank !== undefined && total
        ? total - 1 - Number(ascRank) // flip ascending to descending
        : ascRank;

    const me =
      meRank0 !== undefined && meRank0 !== null
        ? {
            rank: Number(meRank0) + 1,
            username,
            score: Number((await redis.zScore(lbKey, username)) ?? 0),
          }
        : null;

    res.json({
      top,
      me,
      totalPlayers: total,
      generatedAt: Date.now(),
    });
  } catch (err) {
    console.error("GET /api/leaderboard error:", err);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// ##########################################################################

router.post("/internal/on-app-install", async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      status: "success",
      message: `Post created in subreddit ${context.subredditName} with id ${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: "error",
      message: "Failed to create post",
    });
  }
});

router.post("/internal/menu/post-create", async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: "error",
      message: "Failed to create post",
    });
  }
});

app.use(router);

const server = createServer(app);
server.on("error", (err) => console.error(`server error; ${err.stack}`));
server.listen(getServerPort());
