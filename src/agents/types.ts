export interface AgentIdentity {
  id: string;
  name: string;
  role: string;
}

export interface AgentSoul {
  thinkingStyle: string;
  boundaries: string[];
  priorities: string[];
}

export interface AgentConfig {
  identity: AgentIdentity;
  soul: AgentSoul;
  skills: string[]; // which YouTube tools this agent can use
}

export interface AgentResult {
  agentId: string;
  success: boolean;
  summary: string;
  insights: Array<{
    type: "buying_signal" | "competitor_move" | "sentiment" | "trend";
    title: string;
    detail: string;
    source: { videoId?: string; channelId?: string; query?: string };
  }>;
}
