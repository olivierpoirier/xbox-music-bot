import path from "path";
import fs from "fs";

export const APP_CONFIG = {
  PORT: parseInt(process.env.PORT || "4000", 10),
};

const COOKIES_PATH = path.resolve(process.cwd(), "cookies.txt");
const HAS_COOKIES = fs.existsSync(COOKIES_PATH);

if (HAS_COOKIES) {
  console.log(`✅ Fichier cookies trouvé à : ${COOKIES_PATH}`);
} else {
  console.warn(`⚠️ Fichier cookies introuvable à : ${COOKIES_PATH}`);
}

const YTDLP_JS_RUNTIME = (process.env.YTDLP_JS_RUNTIME || "").trim();

export const MPV_CONFIG = {
  bin: (process.env.MPV_BIN || "mpv").trim(),
  audioDevice: (
    process.env.MPV_AUDIO_DEVICE ||
    "wasapi/{422c5f03-d063-4b65-b529-c54272b9bac9}"
  ).trim(),

  baseArgs: [
    "--video=no",
    "--input-terminal=no",
    "--term-osd=no",
    "--load-scripts=no",
    "--volume=100",

    // Qualité audio
    "--audio-format=float",
    "--audio-channels=stereo",
    "--audio-samplerate=48000",
    "--audio-resample-filter-size=24",
    "--audio-resample-cutoff=0",
    "--audio-resample-linear=yes",
    "--gapless-audio=yes",
    "--audio-pitch-correction=yes",

    // Fluidité / stabilité
    "--audio-buffer=5.0",
    "--cache=yes",
    "--demuxer-max-bytes=512MiB",
    "--demuxer-readahead-secs=20",
    "--audio-stream-silence=yes",
    "--idle=yes",
    "--keep-open=no",
  ],

  audioFilters: "",

  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",

  ipcConnectTimeoutMs: 5000,
  globalStartTimeoutMs: 20000,
};

export const YTDLP_CONFIG = {
  bin: (process.env.YTDLP_BIN || "yt-dlp.exe").trim(),

  baseArgs: [
    "--force-ipv4",
    "--no-playlist",
    "--user-agent",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    ...(YTDLP_JS_RUNTIME ? ["--js-runtimes", YTDLP_JS_RUNTIME] : []),
  ],

  cacheTTL: 600_000,
  cacheMax: 512,
  processTimeoutMs: 60_000,
  cookiesPath: COOKIES_PATH,
  hasCookies: HAS_COOKIES,

  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID || "",
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || "",
    refreshToken: process.env.SPOTIFY_REFRESH_TOKEN || "",
  },
};
