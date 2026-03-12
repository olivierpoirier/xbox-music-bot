import play from "play-dl";
import { state, playing, setPlaying, QueueItem, MpvHandle, MpvEvent } from "./types";
import { startMpv, mpvPause, mpvLoadFile, mpvStop, mpvSetLoopFile } from "./mpv";
import { getDirectPlayableUrl, normalizeUrl, resolvePlayable } from "./ytdlp";
import { MPV_CONFIG } from "./config";

let globalMpvHandle: MpvHandle | null = null;
let isLooping = false;
let currentListener: ((ev: MpvEvent) => void) | null = null;

/* ------------------- PRELOAD SYSTEM ------------------- */

let preloaded: { itemId: string; url: string } | null = null;
let preloadingForId: string | null = null;

async function preloadNextTrack(item: QueueItem): Promise<void> {
  if (!item) return;
  if (item.url.startsWith("provider:")) return;
  if (preloadingForId === item.id) return;
  if (preloaded?.itemId === item.id) return;

  preloadingForId = item.id;

  try {
    const direct = await getDirectPlayableUrl(normalizeUrl(item.url));

    if (direct) {
      preloaded = { itemId: item.id, url: direct };
      console.log(`[player] ⚡ Préchargé: ${item.title || item.url}`);
    }
  } catch (err) {
    console.warn("[player] preload failed", err);
  } finally {
    if (preloadingForId === item.id) {
      preloadingForId = null;
    }
  }
}

function consumePreloaded(item: QueueItem): string | null {
  if (!preloaded) return null;
  if (preloaded.itemId !== item.id) return null;

  const out = preloaded.url;
  preloaded = null;
  return out;
}

function clearPreloadForItem(itemId: string): void {
  if (preloaded?.itemId === itemId) {
    preloaded = null;
  }
  if (preloadingForId === itemId) {
    preloadingForId = null;
  }
}

function resetNowState(): void {
  state.now = null;
  setPlaying(null);
}

/* ------------------- MPV ------------------- */

export async function ensureMpvRunning(): Promise<MpvHandle> {
  if (globalMpvHandle && globalMpvHandle.proc.exitCode === null) {
    return globalMpvHandle;
  }

  console.log("[player] 🔥 Starting MPV engine");

  globalMpvHandle = await startMpv("");

  globalMpvHandle.proc.once("exit", () => {
    console.warn("[player] MPV exited");
    globalMpvHandle = null;

    if (playing) {
      resetNowState();
    }
  });

  return globalMpvHandle;
}

/* ------------------- CORE PLAY ------------------- */

async function attachListener(
  handle: MpvHandle,
  item: QueueItem,
  onStateChange: () => void
): Promise<void> {
  const attemptId = item.id;

  if (currentListener) {
    handle.removeListener(currentListener);
    currentListener = null;
  }

  currentListener = (ev: MpvEvent) => {
    if (!playing || playing.item.id !== attemptId) return;

    if (ev.type === "playback-restart") {
      if (state.now) {
        state.now.isBuffering = false;
        state.now.startedAt = state.control.paused
          ? null
          : Date.now() - ((state.now.positionOffsetSec || 0) * 1000);

        onStateChange();
      }
      return;
    }

    if (ev.type !== "property-change") return;

    if (ev.name === "time-pos" && typeof ev.data === "number") {
      const now = state.now;
      if (!now) return;

      now.positionOffsetSec = ev.data;

      if (now.isBuffering) {
        now.isBuffering = false;
      }

      if (!state.control.paused) {
        const theoreticalPos =
          now.startedAt ? (Date.now() - now.startedAt) / 1000 : 0;

        const drift = Math.abs(theoreticalPos - ev.data);

        if (drift > 1 || !now.startedAt) {
          now.startedAt = Date.now() - (ev.data * 1000);
        }
      }

      onStateChange();
      return;
    }

    if (ev.name === "duration" && typeof ev.data === "number" && state.now) {
      if (ev.data > 0 && state.now.durationSec !== ev.data) {
        state.now.durationSec = ev.data;
        onStateChange();
      }
      return;
    }

    if (ev.name === "idle-active" && ev.data === true) {
      const hasStarted = (state.now?.positionOffsetSec || 0) > 0;

      if (playing?.item.id === attemptId && hasStarted) {
        handleEndOfTrack(item, onStateChange);
      }
    }
  };

  handle.on(currentListener);
}

async function tryPlayWith(
  playUrl: string,
  item: QueueItem,
  onStateChange: () => void
): Promise<boolean> {
  try {
    const handle = await ensureMpvRunning();

    setPlaying({ item, handle });

    state.now = {
      url: item.url,
      title: item.title,
      thumb: item.thumb,
      addedBy: item.addedBy,
      group: item.group,
      durationSec: item.durationSec || 0,
      isBuffering: true,
      positionOffsetSec: 0,
      startedAt: null,
    };

    onStateChange();

    await attachListener(handle, item, onStateChange);

    await mpvLoadFile(handle, playUrl, false);
    await mpvSetLoopFile(handle, state.control.repeat);
    await mpvPause(handle, state.control.paused);
    await handle.waitForPlaybackStart(MPV_CONFIG.globalStartTimeoutMs);

    return true;
  } catch (err) {
    console.error("[player] play error", err);
    return false;
  }
}

/* ------------------- RESOLUTION ------------------- */

async function resolveSpotifyItem(item: QueueItem): Promise<boolean> {
  if (!item.url.startsWith("provider:spotify:")) return true;

  try {
    const query = item.url.replace("provider:spotify:", "").trim();

    const results = await play.search(query, {
      limit: 1,
      source: { youtube: "video" },
    });

    if (!results.length || !results[0]?.url) {
      throw new Error("No YouTube result found");
    }

    item.url = results[0].url;
    item.title = item.title || results[0].title || query;
    item.thumb = item.thumb || results[0].thumbnails?.[0]?.url || null;

    return true;
  } catch (err) {
    console.error("[player] spotify resolve failed", err);
    return false;
  }
}

async function resolvePlaybackUrl(item: QueueItem): Promise<string | null> {
  const preloadedUrl = consumePreloaded(item);
  if (preloadedUrl) {
    console.log("[player] ⚡ Using preloaded audio");
    return preloadedUrl;
  }

  const normalized = normalizeUrl(item.url);

  try {
    const resolved = await resolvePlayable(normalized);
    if (resolved) return resolved;
  } catch (err) {
    console.warn("[player] resolvePlayable failed, trying fallback", err);
  }

  try {
    const fallback = await getDirectPlayableUrl(normalized);
    if (fallback) return fallback;
  } catch (err) {
    console.warn("[player] getDirectPlayableUrl failed", err);
  }

  return null;
}

/* ------------------- END TRACK ------------------- */

function handleEndOfTrack(item: QueueItem, onStateChange: () => void): void {
  if (item.status !== "playing") return;

  if (state.control.repeat) {
    if (state.now) {
      state.now.positionOffsetSec = 0;
      state.now.startedAt = Date.now();
    }
    return;
  }

  console.log("[player] ✅ Track finished");

  item.status = "done";
  clearPreloadForItem(item.id);
  resetNowState();

  onStateChange();

  setTimeout(() => {
    void ensurePlayerLoop(onStateChange);
  }, 100);
}

function failItemAndContinue(item: QueueItem, onStateChange: () => void): void {
  item.status = "error";
  clearPreloadForItem(item.id);
  resetNowState();
  onStateChange();

  setTimeout(() => {
    void ensurePlayerLoop(onStateChange);
  }, 300);
}

/* ------------------- QUEUE LOOP ------------------- */

export async function ensurePlayerLoop(onStateChange: () => void): Promise<void> {
  if (isLooping) return;
  if (playing && playing.item.status === "playing") return;

  isLooping = true;

  try {
    const nextItem = state.queue.find((q) => q.status === "queued");

    if (!nextItem) {
      resetNowState();
      onStateChange();
      return;
    }

    const followUpItem = state.queue.find(
      (q) => q.status === "queued" && q.id !== nextItem.id
    );

    if (followUpItem) {
      void preloadNextTrack(followUpItem);
    }

    console.log("[player] 🎵 Starting", nextItem.title || nextItem.url);

    const spotifyOk = await resolveSpotifyItem(nextItem);
    if (!spotifyOk) {
      failItemAndContinue(nextItem, onStateChange);
      return;
    }

    nextItem.status = "playing";

    const playUrl = await resolvePlaybackUrl(nextItem);

    if (!playUrl) {
      console.error("[player] unable to resolve playable URL");
      failItemAndContinue(nextItem, onStateChange);
      return;
    }

    const success = await tryPlayWith(playUrl, nextItem, onStateChange);

    if (!success) {
      failItemAndContinue(nextItem, onStateChange);
      return;
    }
  } catch (err) {
    console.error("[player] loop error", err);
  } finally {
    isLooping = false;
  }
}

/* ------------------- ACTIONS ------------------- */

export async function skip(onStateChange: () => void): Promise<void> {
  if (!playing) {
    void ensurePlayerLoop(onStateChange);
    return;
  }

  console.log("[player] ⏭ skip");

  const h = playing.handle;
  const currentItem = playing.item;

  currentItem.status = "done";
  clearPreloadForItem(currentItem.id);
  resetNowState();

  onStateChange();

  try {
    await mpvStop(h);
  } catch {}

  void ensurePlayerLoop(onStateChange);
}

export async function stopPlayer(onStateChange: () => void): Promise<void> {
  if (globalMpvHandle) {
    try {
      globalMpvHandle.kill();
    } catch {}
    globalMpvHandle = null;
  }

  preloaded = null;
  preloadingForId = null;

  if (currentListener && playing?.handle) {
    try {
      playing.handle.removeListener(currentListener);
    } catch {}
    currentListener = null;
  }

  resetNowState();
  onStateChange();
}
