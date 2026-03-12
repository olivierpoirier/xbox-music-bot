import { spawn } from "child_process";
import play from "play-dl";

import { YTDLP_CONFIG } from "./config";
import { ProbeResult, ResolvedItem } from "./types";

/* ------------------------------------------------ */
/* CACHE                                            */
/* ------------------------------------------------ */

type CacheVal<T> = {
  v: T;
  exp: number;
};

const PROBE_CACHE = new Map<string, CacheVal<ProbeResult>>();
const DIRECT_CACHE = new Map<string, CacheVal<string>>();
const FLAT_CACHE = new Map<string, CacheVal<ResolvedItem[]>>();

function cacheGet<K, V>(map: Map<K, CacheVal<V>>, key: K): V | undefined {
  const val = map.get(key);
  if (!val) return undefined;

  if (val.exp < Date.now()) {
    map.delete(key);
    return undefined;
  }

  return val.v;
}

function cacheSet<K, V>(map: Map<K, CacheVal<V>>, key: K, value: V): void {
  if (map.size >= YTDLP_CONFIG.cacheMax) {
    const first = map.keys().next();
    if (!first.done) map.delete(first.value);
  }

  map.set(key, {
    v: value,
    exp: Date.now() + YTDLP_CONFIG.cacheTTL,
  });
}

/* ------------------------------------------------ */
/* URL HELPERS                                      */
/* ------------------------------------------------ */

export function normalizeUrl(url: string): string {
  if (!url) return "";

  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();

    if (host.includes("youtu.be")) {
      const id = u.pathname.replace(/^\/+/, "");
      if (id) return `https://www.youtube.com/watch?v=${id}`;
    }

    if (host.includes("youtube.com")) {
      if (u.pathname === "/watch") {
        const id = u.searchParams.get("v");
        if (id) return `https://www.youtube.com/watch?v=${id}`;
      }

      if (u.pathname === "/shorts") {
        const parts = u.pathname.split("/").filter(Boolean);
        const id = parts[1];
        if (id) return `https://www.youtube.com/watch?v=${id}`;
      }

      if (u.pathname.startsWith("/shorts/")) {
        const id = u.pathname.split("/")[2];
        if (id) return `https://www.youtube.com/watch?v=${id}`;
      }
    }

    return url;
  } catch {
    return url;
  }
}

function isSpotifyUrl(url: string): boolean {
  return url.includes("spotify.com") || url.includes("open.spotify");
}

function isYoutubeUrl(url: string): boolean {
  return url.includes("youtube.com") || url.includes("youtu.be");
}

function isYoutubeSearchUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname.toLowerCase().includes("youtube.com") &&
      u.pathname === "/results"
    );
  } catch {
    return false;
  }
}

function isYouTubePlaylistUrl(url: string): boolean {
  return (
    url.includes("list=") ||
    url.includes("/playlist") ||
    url.includes("music.youtube.com/playlist")
  );
}

function isSoundCloudSetUrl(url: string): boolean {
  return url.includes("soundcloud.com") && url.includes("/sets/");
}

function isProbablyPlaylistUrl(url: string): boolean {
  return isYouTubePlaylistUrl(url) || isSoundCloudSetUrl(url);
}

function buildYtDlpArgs(
  url: string,
  extraArgs: string[] = [],
  opts?: {
    useCookies?: boolean;
  }
): string[] {
  const args = [...YTDLP_CONFIG.baseArgs];

  const useCookies =
    Boolean(opts?.useCookies) &&
    YTDLP_CONFIG.hasCookies &&
    isYoutubeUrl(url) &&
    !isYoutubeSearchUrl(url);

  if (useCookies) {
    args.push("--cookies", YTDLP_CONFIG.cookiesPath.replace(/\\/g, "/"));
  }

  return [...args, ...extraArgs];
}

function killProcessTree(proc: ReturnType<typeof spawn>) {
  try {
    if (process.platform === "win32" && proc.pid) {
      spawn("taskkill", ["/pid", String(proc.pid), "/f", "/t"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } else {
      proc.kill("SIGKILL");
    }
  } catch {}
}

function pickFirstHttpLine(output: string): string | null {
  return (
    output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => /^https?:\/\//i.test(line)) || null
  );
}

/* ------------------------------------------------ */
/* YT-DLP RUNNER                                    */
/* ------------------------------------------------ */

async function runYtDlp(
  url: string,
  extraArgs: string[],
  opts?: { useCookies?: boolean }
): Promise<string> {
  const finalArgs = buildYtDlpArgs(url, extraArgs, opts);

  return new Promise((resolve, reject) => {
    console.log(`[yt-dlp] ${YTDLP_CONFIG.bin} ${finalArgs.join(" ")}`);

    const proc = spawn(YTDLP_CONFIG.bin, finalArgs, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let out = "";
    let err = "";
    let finished = false;

    const timeout = setTimeout(() => {
      if (finished) return;
      finished = true;

      killProcessTree(proc);

      if (err.trim()) {
        console.error("[yt-dlp timeout stderr]", err);
      }

      reject(new Error("yt-dlp timeout"));
    }, YTDLP_CONFIG.processTimeoutMs);

    proc.stdout.on("data", (d) => {
      out += d.toString();
    });

    proc.stderr.on("data", (d) => {
      err += d.toString();
    });

    proc.on("error", (spawnErr) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      reject(spawnErr);
    });

    proc.on("close", (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);

      if (code === 0) {
        resolve(out.trim());
      } else {
        if (err.trim()) {
          console.error("[yt-dlp error]", err);
        }
        reject(new Error(err || `Exit code ${code}`));
      }
    });
  });
}

/* ------------------------------------------------ */
/* SPOTIFY                                          */
/* ------------------------------------------------ */

export async function resolveSpotify(url: string): Promise<ResolvedItem[]> {
  try {
    if (play.is_expired()) {
      await play.refreshToken();
    }

    const data = await play.spotify(url);

    const convert = (t: any): ResolvedItem => {
      const artist = t.artists?.[0]?.name || "";
      const title = t.name;
      const query = `${artist} - ${title}`;

      return {
        url: `provider:spotify:${query}`,
        title,
        thumb: t.thumbnail?.url || null,
        durationSec: t.durationInSec || 0,
      };
    };

    if (data instanceof play.SpotifyTrack) {
      return [convert(data)];
    }

    if (
      data instanceof play.SpotifyAlbum ||
      data instanceof play.SpotifyPlaylist
    ) {
      const tracks = await data.all_tracks();
      return tracks.slice(0, 200).map(convert);
    }

    return [];
  } catch (err) {
    console.error("[spotify resolver error]", err);
    return [];
  }
}

/* ------------------------------------------------ */
/* PLAYLIST RESOLVE                                 */
/* ------------------------------------------------ */

export async function resolveUrlToPlayableItems(
  url: string
): Promise<ResolvedItem[]> {
  const normalized = normalizeUrl(url);
  const cached = cacheGet(FLAT_CACHE, normalized);

  if (cached) return cached;

  /* SPOTIFY */

  if (isSpotifyUrl(normalized)) {
    const items = await resolveSpotify(normalized);
    cacheSet(FLAT_CACHE, normalized, items);
    return items;
  }

  /* SEARCH URL -> refuser comme playlist */

  if (isYoutubeSearchUrl(normalized)) {
    return [];
  }

  /* PLAYLISTS */

  if (isProbablyPlaylistUrl(normalized)) {
    try {
      const json = await runYtDlp(
        normalized,
        ["--flat-playlist", "-J", normalized],
        { useCookies: true }
      );

      const data = JSON.parse(json);

      if (Array.isArray(data.entries)) {
        const items = data.entries
          .map((e: any) => {
            let entryUrl =
              e.url || (e.id ? `https://www.youtube.com/watch?v=${e.id}` : null);

            if (!entryUrl) return null;

            entryUrl = normalizeUrl(entryUrl);

            return {
              url: entryUrl,
              title: e.title || "Unknown",
              thumb:
                e.thumbnail ||
                (Array.isArray(e.thumbnails) && e.thumbnails.length
                  ? e.thumbnails[e.thumbnails.length - 1].url
                  : null),
              durationSec: Number(e.duration) || 0,
            };
          })
          .filter(Boolean) as ResolvedItem[];

        cacheSet(FLAT_CACHE, normalized, items);
        return items;
      }
    } catch (err) {
      console.error("[playlist resolve error]", err);
    }
  }

  /* SINGLE */

  const single = await probeSingle(normalized);

  return [
    {
      ...single,
      url: normalized,
    },
  ];
}

/* ------------------------------------------------ */
/* PROBE (title + duration + thumb)                 */
/* ------------------------------------------------ */

export async function probeSingle(url: string): Promise<ProbeResult> {
  if (url.startsWith("provider:")) {
    return {
      title: url.split(":").pop() || "Track",
      durationSec: 0,
    };
  }

  const normalized = normalizeUrl(url);
  const cached = cacheGet(PROBE_CACHE, normalized);

  if (cached) return cached;

  if (isYoutubeSearchUrl(normalized)) {
    return {
      title: "Recherche YouTube",
      durationSec: 0,
    };
  }

  /* FAST PATH play-dl pour YouTube vidéo */

  if (play.yt_validate(normalized) === "video") {
    try {
      const info = await play.video_info(normalized);

      const res: ProbeResult = {
        title: info.video_details.title || "YouTube",
        thumb: info.video_details.thumbnails?.slice(-1)[0]?.url || null,
        durationSec: info.video_details.durationInSec || 0,
      };

      cacheSet(PROBE_CACHE, normalized, res);
      return res;
    } catch {
      // fallback yt-dlp plus bas
    }
  }

  /* yt-dlp fallback */

  try {
    const json = await runYtDlp(
      normalized,
      ["--dump-single-json", normalized],
      { useCookies: true }
    );

    const data = JSON.parse(json);

    const res: ProbeResult = {
      title: data.title || "External",
      thumb: data.thumbnail || null,
      durationSec: Number(data.duration) || 0,
    };

    cacheSet(PROBE_CACHE, normalized, res);
    return res;
  } catch {
    return {
      title: "Unknown",
      durationSec: 0,
    };
  }
}

/* ------------------------------------------------ */
/* DIRECT AUDIO URL                                 */
/* ------------------------------------------------ */

export async function getDirectPlayableUrl(
  url: string
): Promise<string | null> {
  if (url.startsWith("provider:")) return null;

  const normalized = normalizeUrl(url);

  if (isYoutubeSearchUrl(normalized)) {
    console.warn("[getDirectPlayableUrl] search URL refused:", normalized);
    return null;
  }

  const cached = cacheGet(DIRECT_CACHE, normalized);
  if (cached) return cached;

  const tryOnce = async (useCookies: boolean): Promise<string | null> => {
    try {
      const direct = await runYtDlp(
        normalized,
        ["-g", "-f", "bestaudio/best", normalized],
        { useCookies }
      );

      const firstLine = pickFirstHttpLine(direct);

      if (firstLine) {
        cacheSet(DIRECT_CACHE, normalized, firstLine);
      }

      return firstLine;
    } catch {
      return null;
    }
  };

  const withCookies = await tryOnce(true);
  if (withCookies) return withCookies;

  return await tryOnce(false);
}

/* ------------------------------------------------ */
/* ULTRA FAST RESOLVE                               */
/* ------------------------------------------------ */

export async function resolvePlayable(url: string): Promise<string | null> {
  if (url.startsWith("provider:")) return null;

  const normalized = normalizeUrl(url);

  if (isYoutubeSearchUrl(normalized)) {
    console.warn("[resolvePlayable] search URL refused:", normalized);
    return null;
  }

  const cached = cacheGet(DIRECT_CACHE, normalized);
  if (cached) return cached;

  const tryOnce = async (useCookies: boolean): Promise<string | null> => {
    try {
      const direct = await runYtDlp(
        normalized,
        ["-g", "-f", "bestaudio/best", normalized],
        { useCookies }
      );

      const firstLine = pickFirstHttpLine(direct);

      if (firstLine) {
        cacheSet(DIRECT_CACHE, normalized, firstLine);
        return firstLine;
      }
    } catch (err) {
      console.error("[resolvePlayable error]", err);
    }

    return null;
  };

  const withCookies = await tryOnce(true);
  if (withCookies) return withCookies;

  return await tryOnce(false);
}
