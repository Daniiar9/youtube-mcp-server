import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { existsSync } from "fs";

// --- Types ---

export interface UserProfile {
  industry?: string;
  competitors: string[];
  keywords: string[];
  trackedChannels: string[];
  notes: string[];
  updatedAt: string;
}

export interface MonitorTarget {
  id: string;
  type: "channel" | "keyword";
  value: string;
  lastCheckedAt?: string;
  createdAt: string;
}

export interface InsightEntry {
  id: string;
  agentId: string;
  type: "buying_signal" | "competitor_move" | "sentiment" | "trend";
  title: string;
  detail: string;
  source: { videoId?: string; channelId?: string; query?: string };
  createdAt: string;
}

export interface ConversationEntry {
  role: "user" | "agent";
  agentId?: string;
  content: string;
  timestamp: string;
}

export interface MemoryState {
  user: UserProfile;
  monitors: MonitorTarget[];
  insights: InsightEntry[];
  conversations: ConversationEntry[];
}

// --- Store ---

const DEFAULT_STATE: MemoryState = {
  user: {
    competitors: [],
    keywords: [],
    trackedChannels: [],
    notes: [],
    updatedAt: new Date().toISOString(),
  },
  monitors: [],
  insights: [],
  conversations: [],
};

function getStorePath(): string {
  return process.env.YOUTUBE_MCP_MEMORY_PATH || join(process.cwd(), ".youtube-mcp-memory.json");
}

export async function loadMemory(): Promise<MemoryState> {
  const path = getStorePath();
  if (!existsSync(path)) {
    return structuredClone(DEFAULT_STATE);
  }
  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw) as MemoryState;
}

export async function saveMemory(state: MemoryState): Promise<void> {
  const path = getStorePath();
  const dir = dirname(path);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(path, JSON.stringify(state, null, 2), "utf-8");
}

// --- Helpers ---

export async function updateUser(updates: Partial<UserProfile>): Promise<UserProfile> {
  const state = await loadMemory();
  state.user = { ...state.user, ...updates, updatedAt: new Date().toISOString() };
  await saveMemory(state);
  return state.user;
}

export async function addMonitor(type: "channel" | "keyword", value: string): Promise<MonitorTarget> {
  const state = await loadMemory();
  const existing = state.monitors.find(m => m.type === type && m.value === value);
  if (existing) return existing;

  const monitor: MonitorTarget = {
    id: `mon_${Date.now()}`,
    type,
    value,
    createdAt: new Date().toISOString(),
  };
  state.monitors.push(monitor);
  await saveMemory(state);
  return monitor;
}

export async function removeMonitor(id: string): Promise<boolean> {
  const state = await loadMemory();
  const before = state.monitors.length;
  state.monitors = state.monitors.filter(m => m.id !== id);
  await saveMemory(state);
  return state.monitors.length < before;
}

export async function addInsight(insight: Omit<InsightEntry, "id" | "createdAt">): Promise<InsightEntry> {
  const state = await loadMemory();
  const entry: InsightEntry = {
    ...insight,
    id: `ins_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  state.insights.push(entry);
  // Keep last 500 insights
  if (state.insights.length > 500) {
    state.insights = state.insights.slice(-500);
  }
  await saveMemory(state);
  return entry;
}

export async function addConversation(entry: Omit<ConversationEntry, "timestamp">): Promise<void> {
  const state = await loadMemory();
  state.conversations.push({ ...entry, timestamp: new Date().toISOString() });
  // Keep last 200 conversations
  if (state.conversations.length > 200) {
    state.conversations = state.conversations.slice(-200);
  }
  await saveMemory(state);
}

export async function getInsights(filter?: {
  agentId?: string;
  type?: InsightEntry["type"];
  limit?: number;
}): Promise<InsightEntry[]> {
  const state = await loadMemory();
  let results = state.insights;
  if (filter?.agentId) results = results.filter(i => i.agentId === filter.agentId);
  if (filter?.type) results = results.filter(i => i.type === filter.type);
  results = results.slice(-(filter?.limit || 50));
  return results;
}
