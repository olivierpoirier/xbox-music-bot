process.env.PLAY_DL_SKIP_PROMPT = "true";

import "dotenv/config";
import express from "express";
import http from "http";
import { Server as IOServer } from "socket.io";
import path from "node:path";
import play from "play-dl";

import { state, nextId, playing, QueueItem } from "./types";
import { ensurePlayerLoop, ensureMpvRunning, skip, stopPlayer } from "./player";
import {
  mpvPause,
  mpvSetLoopFile,
  mpvSeekAbsolute,
} from "./mpv";
import {
  resolveUrlToPlayableItems,
  probeSingle,
  normalizeUrl,
} from "./ytdlp";
import { ensureVoicemeeterReady } from "./utils";

const app = express();
const server = http.createServer(app);

const io = new IOServer(server, {
  cors: { origin: "*" },
  perMessageDeflate: false,
});

/* --- VARIABLES DE CONTRÔLE DU CYCLE DE VIE --- */

let isVoicemeeterMissing = false;
let activeUsers = 0;
let shutdownTimer: NodeJS.Timeout | null = null;
const SHUTDOWN_DELAY = 60_000;

app.use(express.static(path.resolve(process.cwd(), "../frontend/dist")));

/* --- HELPERS --- */

function computePosition(now: typeof state.now): number {
  if (!now) return 0;

  if (state.control.paused || now.isBuffering || !now.startedAt) {
    return now.positionOffsetSec ?? 0;
  }

  const current = (Date.now() - now.startedAt) / 1000;
  const duration = now.durationSec ?? 0;

  if (duration > 0 && current >= duration) {
    return duration;
  }

  return Math.max(0, current);
}

function isSpotifyUrl(url: string): boolean {
  return url.includes("spotify.com") || url.includes("open.spotify");
}

function isYoutubeSearchUrl(url: string): boolean {
  return (
    url.includes("youtube.com/results?") ||
    url.includes("music.youtube.com/search?")
  );
}

function isPlaylistUrl(url: string): boolean {
  return (
    url.includes("list=") ||
    url.includes("/playlist") ||
    url.includes("/sets/")
  );
}

function isProbablyUrl(input: string): boolean {
  return /^https?:\/\//i.test(input);
}

function broadcast(): void {
  const queued = state.queue.filter((q) => q.status === "queued");
  const totalDuration = queued.reduce(
    (acc, item) => acc + (item.durationSec || 0),
    0
  );

  io.emit("state", {
    ok: true,
    now: state.now,
    queue: queued.slice(0, 50),
    stats: {
      totalQueued: queued.length,
      remainingTimeSec: totalDuration,
    },
    control: state.control,
  });
}

async function enrichQueuedItem(entryId: string, url: string): Promise<void> {
  try {
    const enriched = await probeSingle(url);
    const item = state.queue.find((q) => q.id === entryId);

    if (!item) return;
    if (item.status === "done" || item.status === "error") return;

    item.title = enriched.title;
    item.thumb = enriched.thumb ?? null;
    item.durationSec = enriched.durationSec;

    if (state.now && state.now.url === item.url) {
      state.now.title = enriched.title;
      state.now.thumb = enriched.thumb ?? null;
      state.now.durationSec = enriched.durationSec;
    }

    broadcast();
  } catch (err) {
    console.warn("[probeSingle] failed", err);
  }
}

async function resolveSearchTextToVideoUrl(query: string): Promise<{
  url: string;
  title?: string;
  thumb?: string | null;
  durationSec?: number;
} | null> {
  try {
    const results = await play.search(query, {
      limit: 1,
      source: { youtube: "video" },
    });

    const first = results[0];
    if (!first?.url) return null;

    return {
      url: first.url,
      title: first.title || query,
      thumb: first.thumbnails?.[0]?.url || null,
      durationSec: (first as any).durationInSec || 0,
    };
  } catch (err) {
    console.error("[search text resolve failed]", err);
    return null;
  }
}

function pushQueueItem(item: Omit<QueueItem, "id" | "createdAt" | "status"> & {
  status?: QueueItem["status"];
}): QueueItem {
  const newItem: QueueItem = {
    id: String(nextId.current++),
    createdAt: Date.now(),
    status: item.status || "queued",
    url: item.url,
    title: item.title,
    thumb: item.thumb ?? null,
    group: item.group,
    addedBy: item.addedBy,
    durationSec: item.durationSec,
  };

  state.queue.push(newItem);
  return newItem;
}

/* --- INITIALISATION --- */

async function setupSpotify() {
  try {
    await play.setToken({
      spotify: {
        client_id: (process.env.SPOTIFY_CLIENT_ID || "").trim(),
        client_secret: (process.env.SPOTIFY_CLIENT_SECRET || "").trim(),
        refresh_token: (process.env.SPOTIFY_REFRESH_TOKEN || "").trim(),
        market: "FR",
      },
    });

    console.log("✅ [Spotify] Token configuré");
  } catch (e) {
    console.error("❌ [Spotify] Erreur setup:", e);
  }
}

/* --- ROUTES HTTP --- */

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    activeUsers,
  });
});

/* --- LOGIQUE SOCKET --- */

io.on("connection", (socket) => {
  activeUsers++;
  console.log(`👤 Client connecté. Total: ${activeUsers}`);

  if (shutdownTimer) {
    console.log("🛑 Extinction annulée : un utilisateur est revenu.");
    clearTimeout(shutdownTimer);
    shutdownTimer = null;
  }

  if (isVoicemeeterMissing) {
    socket.emit(
      "error_system",
      "VoiceMeeter Banana n'est pas installé sur le serveur."
    );
  }

  broadcast();

  if (state.now) {
    socket.emit("progress", {
      positionSec: computePosition(state.now),
      durationSec: state.now.durationSec ?? null,
      paused: state.control.paused,
      repeat: state.control.repeat,
      title: state.now.title,
    });
  }

  /* --- ÉVÈNEMENTS DE LECTURE --- */

  socket.on("play", async (payload: { url?: string; addedBy?: string }) => {
    try {
      const raw = String(payload?.url || "").trim();
      const addedBy = (payload.addedBy || "anon").slice(0, 32);

      if (!raw) {
        socket.emit("toast", "Entrée vide.");
        return;
      }

      /* --- MODE RECHERCHE TEXTE --- */
      if (!isProbablyUrl(raw)) {
        socket.emit("toast", "Recherche YouTube en cours...");

        const found = await resolveSearchTextToVideoUrl(raw);

        if (!found) {
          socket.emit("toast", "Aucun résultat trouvé.");
          return;
        }

        pushQueueItem({
          url: found.url,
          title: found.title || "Titre en attente...",
          thumb: found.thumb ?? null,
          durationSec: found.durationSec || 0,
          addedBy,
        });

        broadcast();
        void ensurePlayerLoop(broadcast);
        return;
      }

      /* --- MODE URL --- */
      const normalized = normalizeUrl(raw);

      if (isYoutubeSearchUrl(normalized)) {
        socket.emit(
          "toast",
          "Ce lien est une page de recherche YouTube, pas une vidéo."
        );
        return;
      }

      const spotify = isSpotifyUrl(normalized);
      const playlist = isPlaylistUrl(normalized);

      if (spotify || playlist) {
        socket.emit("toast", "Analyse de la playlist...");

        const items = await resolveUrlToPlayableItems(normalized);

        if (!items.length) {
          socket.emit("toast", "Aucun titre exploitable trouvé.");
          return;
        }

        const group = `pl_${Date.now()}`;

        for (const it of items) {
          pushQueueItem({
            url: it.url,
            title: it.title || "Titre en attente...",
            thumb: it.thumb ?? null,
            durationSec: it.durationSec || 0,
            addedBy,
            group,
          });
        }

        socket.emit("toast", `${items.length} titres ajoutés !`);
        broadcast();
        void ensurePlayerLoop(broadcast);
        return;
      }

      const queued = pushQueueItem({
        url: normalized,
        title: "Analyse du signal...",
        thumb: null,
        addedBy,
      });

      broadcast();

      if (!isYoutubeSearchUrl(normalized)) {
        void enrichQueuedItem(queued.id, normalized);
      }

      void ensurePlayerLoop(broadcast);
    } catch (e) {
      console.error("[Play Error]", e);
      socket.emit("toast", "Erreur d'ajout.");
    }
  });

  socket.on("command", async (payload: { cmd: string; arg?: any }) => {
    const h = playing?.handle;

    switch (payload.cmd) {
      case "pause": {
        state.control.paused = true;

        if (h) {
          await mpvPause(h, true);
        }

        if (state.now?.startedAt) {
          state.now.positionOffsetSec = computePosition(state.now);
          state.now.startedAt = null;
        }
        break;
      }

      case "resume": {
        state.control.paused = false;

        if (h) {
          await mpvPause(h, false);
        }

        if (state.now && !state.now.isBuffering) {
          state.now.startedAt =
            Date.now() - ((state.now.positionOffsetSec || 0) * 1000);
        }
        break;
      }

      case "skip": {
        await skip(broadcast);
        break;
      }

      case "seek_abs": {
        if (h && typeof payload.arg === "number") {
          if (state.now) {
            state.now.positionOffsetSec = payload.arg;
            state.now.startedAt = null;
            state.now.isBuffering = true;
          }

          await mpvSeekAbsolute(h, payload.arg);
          broadcast();
        }
        break;
      }

      case "repeat": {
        const isRepeat = Boolean(payload.arg);
        state.control.repeat = isRepeat;

        if (h) {
          await mpvSetLoopFile(h, isRepeat);
        }
        break;
      }
    }

    broadcast();
  });

  socket.on("clear", async () => {
    state.queue.forEach((q) => {
      if (q.status === "queued" || q.status === "playing") {
        q.status = "done";
      }
    });

    await stopPlayer(broadcast);
    broadcast();
  });

  socket.on("remove_queue_item", async ({ id }: { id: string }) => {
    const item = state.queue.find((q) => q.id === id);
    if (!item) return;

    item.status = "done";

    if (playing && playing.item.id === id) {
      await skip(broadcast);
    } else {
      broadcast();
    }
  });

  socket.on("reorder_queue", ({ ids }: { ids: string[] }) => {
    const queuedItems = state.queue.filter((q) => q.status === "queued");

    const reordered: QueueItem[] = ids
      .map((id) => queuedItems.find((item) => item.id === id))
      .filter((item): item is QueueItem => Boolean(item));

    const remaining = queuedItems.filter((q) => !ids.includes(q.id));
    const completed = state.queue.filter((q) => q.status !== "queued");

    state.queue = [...completed, ...reordered, ...remaining];
    broadcast();
  });

  socket.on("disconnect", () => {
    activeUsers--;
    console.log(`👤 Client déconnecté. Restants: ${activeUsers}`);

    if (activeUsers <= 0) {
      console.log(
        `⏳ Plus personne sur l'interface. Extinction dans ${SHUTDOWN_DELAY / 1000}s...`
      );

      shutdownTimer = setTimeout(async () => {
        console.log("🔌 Auto-shutdown : Inactivité prolongée.");

        try {
          await stopPlayer(broadcast);
        } catch {}

        process.exit(0);
      }, SHUTDOWN_DELAY);
    }
  });
});

/* --- BOOTSTRAP --- */

async function bootstrap() {
  await setupSpotify();

  const ready = await ensureVoicemeeterReady();

  if (!ready) {
    isVoicemeeterMissing = true;
    console.error("❌ [System] VoiceMeeter Banana n'est pas détecté.");
    return;
  }

  ensureMpvRunning().catch(console.error);

  server.listen(4000, () => {
    console.log("🚀 Server Ready on port 4000");
  });
}

bootstrap();
