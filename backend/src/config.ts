import path from "path";
import fs from "fs";

const PLATFORM = process.platform;
const IS_WINDOWS = PLATFORM === "win32";
const IS_LINUX = PLATFORM === "linux";

function readEnv(key: string): string {
  return (process.env[key] || "").trim();
}

function envOrDefault(key: string, fallback: string): string {
  const value = readEnv(key);
  return value || fallback;
}

function envEnabled(key: string, defaultValue = true): boolean {
  const value = readEnv(key).toLowerCase();

  if (!value) return defaultValue;

  return !["0", "false", "no", "off"].includes(value);
}

export const APP_CONFIG = {
  PORT: 4000,
  platform: PLATFORM,
  isWindows: IS_WINDOWS,
  isLinux: IS_LINUX,
};

const COOKIES_PATH = path.resolve(process.cwd(), "cookies.txt");
const HAS_COOKIES = fs.existsSync(COOKIES_PATH);

if (HAS_COOKIES) {
  console.log(`✅ Fichier cookies trouvé à : ${COOKIES_PATH}`);
} else {
  console.warn(`⚠️ Fichier cookies introuvable à : ${COOKIES_PATH}`);
}

const YTDLP_JS_RUNTIME = readEnv("YTDLP_JS_RUNTIME");

export const AUDIO_CONFIG = {
  windowsVoicemeeterPath: envOrDefault(
    "VOICEMEETER_PATH",
    "C:\\Program Files (x86)\\VB\\Voicemeeter\\voicemeeterpro.exe"
  ),

  windowsVoicemeeterExeName: envOrDefault(
    "VOICEMEETER_EXE_NAME",
    "voicemeeterpro.exe"
  ),

  // Device Windows par défaut pour mpv -> VoiceMeeter
  windowsMpvAudioDevice: envOrDefault(
    "WINDOWS_MPV_AUDIO_DEVICE",
    "wasapi/{422c5f03-d063-4b65-b529-c54272b9bac9}"
  ),

  // Linux : création automatique d'un sink/source virtuel
  linuxEnableVirtualSink: envEnabled("LINUX_ENABLE_VIRTUAL_SINK", true),
  linuxVirtualSinkName: envOrDefault("LINUX_VIRTUAL_SINK_NAME", "xmbot_sink"),
  linuxVirtualSinkDescription: envOrDefault(
    "LINUX_VIRTUAL_SINK_DESCRIPTION",
    "XM-Bot-Virtual-Sink"
  ),
};

export const MPV_CONFIG = {
  bin: envOrDefault("MPV_BIN", "mpv"),

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

    // Robustesse
    "--audio-buffer=5.0",
    "--audio-fallback-to-null=yes",
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
  bin: envOrDefault("YTDLP_BIN", IS_WINDOWS ? "yt-dlp.exe" : "yt-dlp"),

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