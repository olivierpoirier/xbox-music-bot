import { spawn } from "child_process";
import play from "play-dl";
import { resolveSpotifyUrl, SpotifyResolverError } from "./spotify";

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

function isDirectMediaUrl(url: string): boolean {
  return /\.(mp3|wav|ogg|opus|m4a|aac|flac|webm|mp4)(\?|#|$)/i.test(url);
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

function getSourceLabel(url: string): string {
  const value = url.toLowerCase();

  if (value.includes("youtube.com") || value.includes("youtu.be")) return "YouTube";
  if (value.includes("spotify.com")) return "Spotify";
  if (value.includes("soundcloud.com")) return "SoundCloud";
  if (value.includes("tiktok.com")) return "TikTok";
  if (value.includes("instagram.com")) return "Instagram";
  return "Audio";
}

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function buildFallbackThumb(title?: string, url?: string): string {
  const safeTitle = (title || getSourceLabel(url || "") || "Audio")
    .replace(/[<>&"]/g, "")
    .slice(0, 36);

  const source = getSourceLabel(url || "");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#111827"/>
          <stop offset="100%" stop-color="#1f2937"/>
        </linearGradient>
      </defs>
      <rect width="600" height="600" fill="url(#g)"/>
      <circle cx="300" cy="220" r="90" fill="#374151"/>
      <rect x="265" y="220" width="70" height="180" rx="22" fill="#d1d5db"/>
      <circle cx="320" cy="250" r="22" fill="#111827"/>
      <text x="300" y="470" text-anchor="middle" fill="#f9fafb" font-size="34" font-family="Arial, Helvetica, sans-serif" font-weight="700">
        ${safeTitle}
      </text>
      <text x="300" y="515" text-anchor="middle" fill="#9ca3af" font-size="22" font-family="Arial, Helvetica, sans-serif">
        ${source}
      </text>
    </svg>
  `;

  return svgToDataUri(svg);
}

function pickBestThumbnail(data: any, title?: string, url?: string): string {
  const direct =
    data?.thumbnail ||
    data?.thumbnails?.[data?.thumbnails?.length - 1]?.url ||
    data?.thumbnails?.[0]?.url ||
    null;

  return direct || buildFallbackThumb(title, url);
}

function buildEntryUrl(entry: any, playlistUrl: string): string | null {
  const raw =
    entry?.webpage_url ||
    entry?.original_url ||
    entry?.url ||
    entry?.webpage_url_basename ||
    null;

  if (typeof raw === "string" && /^https?:\/\//i.test(raw)) {
    return normalizeUrl(raw);
  }

  if (entry?.id && playlistUrl.includes("youtube")) {
    return normalizeUrl(`https://www.youtube.com/watch?v=${entry.id}`);
  }

  return null;
}

function mapEntryToResolvedItem(entry: any, playlistUrl: string): ResolvedItem | null {
  const entryUrl = buildEntryUrl(entry, playlistUrl);
  if (!entryUrl) return null;

  const title =
    entry?.title ||
    entry?.track ||
    entry?.fulltitle ||
    entry?.uploader ||
    "Unknown";

  return {
    url: entryUrl,
    title,
    thumb: pickBestThumbnail(entry, title, entryUrl),
    durationSec: Number(entry?.duration) || 0,
  };
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
    return await resolveSpotifyUrl(url);
  } catch (err) {
    if (err instanceof SpotifyResolverError) {
      console.error("[spotify resolver error]", err.code, err.message);

      if (err.code === "SPOTIFY_PLAYLIST_NOT_ACCESSIBLE") {
        throw err;
      }
    }

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

  if (isSpotifyUrl(normalized)) {
    const items = await resolveSpotify(normalized).then((list) =>
      list.map((it) => ({
        ...it,
        thumb: it.thumb || buildFallbackThumb(it.title, it.url),
      }))
    );

    cacheSet(FLAT_CACHE, normalized, items);
    return items;
  }

  if (isYoutubeSearchUrl(normalized)) {
    return [];
  }

  if (isProbablyPlaylistUrl(normalized)) {
    try {
      const json = await runYtDlp(
        normalized,
        ["-J", "--yes-playlist", normalized],
        { useCookies: true }
      );

      const data = JSON.parse(json);

      if (Array.isArray(data?.entries)) {
        const items = data.entries
          .map((entry: any) => mapEntryToResolvedItem(entry, normalized))
          .filter(Boolean) as ResolvedItem[];

        const hydrated = items.map((it) => ({
          ...it,
          thumb: it.thumb || buildFallbackThumb(it.title, it.url),
        }));

        cacheSet(FLAT_CACHE, normalized, hydrated);
        return hydrated;
      }
    } catch (err) {
      console.error("[playlist resolve error]", err);
    }
  }

  const single = await probeSingle(normalized);

  return [
    {
      ...single,
      thumb: single.thumb || buildFallbackThumb(single.title, normalized),
      url: normalized,
    },
  ];
}

/* ------------------------------------------------ */
/* PROBE (title + duration + thumb)                 */
/* ------------------------------------------------ */

export async function probeSingle(url: string): Promise<ProbeResult> {
  if (url.startsWith("provider:")) {
    const fallbackTitle = url.split(":").pop() || "Track";

    return {
      title: fallbackTitle,
      thumb: buildFallbackThumb(fallbackTitle, url),
      durationSec: 0,
    };
  }

  const normalized = normalizeUrl(url);
  const cached = cacheGet(PROBE_CACHE, normalized);

  if (cached) return cached;

  if (isYoutubeSearchUrl(normalized)) {
    return {
      title: "Recherche YouTube",
      thumb: buildFallbackThumb("Recherche", normalized),
      durationSec: 0,
    };
  }

  if (isDirectMediaUrl(normalized)) {
    const name = normalized.split("/").pop()?.split("?")[0] || "Audio direct";

    const res: ProbeResult = {
      title: decodeURIComponent(name),
      thumb: buildFallbackThumb(name, normalized),
      durationSec: 0,
    };

    cacheSet(PROBE_CACHE, normalized, res);
    return res;
  }

  if (play.yt_validate(normalized) === "video") {
    try {
      const info = await play.video_info(normalized);

      const res: ProbeResult = {
        title: info.video_details.title || "YouTube",
        thumb:
          info.video_details.thumbnails?.slice(-1)[0]?.url ||
          buildFallbackThumb(info.video_details.title || "YouTube", normalized),
        durationSec: info.video_details.durationInSec || 0,
      };

      cacheSet(PROBE_CACHE, normalized, res);
      return res;
    } catch {
      // fallback yt-dlp
    }
  }

  try {
    const json = await runYtDlp(
      normalized,
      ["--dump-single-json", "--no-playlist", normalized],
      { useCookies: true }
    );

    const data = JSON.parse(json);

    const title =
      data?.title ||
      data?.track ||
      data?.fulltitle ||
      data?.uploader ||
      getSourceLabel(normalized);

    const res: ProbeResult = {
      title,
      thumb: pickBestThumbnail(data, title, normalized),
      durationSec: Number(data?.duration) || 0,
    };

    cacheSet(PROBE_CACHE, normalized, res);
    return res;
  } catch {
    return {
      title: getSourceLabel(normalized),
      thumb: buildFallbackThumb(getSourceLabel(normalized), normalized),
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

  if (isDirectMediaUrl(normalized)) {
    return normalized;
  }

  const cached = cacheGet(DIRECT_CACHE, normalized);
  if (cached) return cached;

  const tryOnce = async (useCookies: boolean): Promise<string | null> => {
    try {
      const direct = await runYtDlp(
        normalized,
        ["-g", "-f", "bestaudio/best", "--no-playlist", normalized],
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

  if (isDirectMediaUrl(normalized)) {
    return normalized;
  }

  const cached = cacheGet(DIRECT_CACHE, normalized);
  if (cached) return cached;

  const tryOnce = async (useCookies: boolean): Promise<string | null> => {
    try {
      const direct = await runYtDlp(
        normalized,
        ["-g", "-f", "bestaudio/best", "--no-playlist", normalized],
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