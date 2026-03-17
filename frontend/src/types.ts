export type Command =
  | "pause"
  | "resume"
  | "skip"
  | "skip_group"
  | "shuffle"
  | "repeat"
  | "seek"
  | "seek_abs";

export type Control = {
  paused?: boolean;
  volume?: number;
  skipSeq?: number;
  repeat?: boolean;
};

export type Now = {
  url?: string;
  title?: string;
  thumb?: string;
  addedBy?: string;
  startedAt?: number | null;
  group?: string;
  durationSec?: number;
  positionOffsetSec?: number;
  isBuffering: boolean;
};

export type QueueItem = {
  id: string;
  url: string;
  title?: string;
  thumb?: string;
  group?: string;
  addedBy?: string;
  status: "queued" | "playing" | "done" | "error";
  createdAt?: number;
  durationSec?: number;
};

export type QueueResponse = {
  ok: boolean;
  now: Now | null;
  queue: QueueItem[];
  history?: QueueItem[];
  control: Control | null;
  stats?: {
    totalQueued?: number;
    remainingTimeSec?: number;
  };
};