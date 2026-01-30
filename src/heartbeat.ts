import { runAllAgents } from "./agents/orchestrator.js";
import { addConversation, loadMemory, saveMemory } from "./memory/store.js";

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

export function startHeartbeat(intervalMinutes: number = 30): { started: boolean; intervalMinutes: number } {
  if (heartbeatInterval) {
    return { started: false, intervalMinutes };
  }

  heartbeatInterval = setInterval(async () => {
    try {
      const results = await runAllAgents();
      const totalInsights = results.reduce((sum, r) => sum + r.insights.length, 0);

      await addConversation({
        role: "agent",
        agentId: "heartbeat",
        content: `Heartbeat ran ${results.length} agent(s), produced ${totalInsights} insight(s).`,
      });

      // Update monitor timestamps
      const state = await loadMemory();
      const now = new Date().toISOString();
      for (const mon of state.monitors) {
        mon.lastCheckedAt = now;
      }
      await saveMemory(state);
    } catch (error) {
      console.error("Heartbeat error:", error);
    }
  }, intervalMinutes * 60 * 1000);

  return { started: true, intervalMinutes };
}

export function stopHeartbeat(): boolean {
  if (!heartbeatInterval) return false;
  clearInterval(heartbeatInterval);
  heartbeatInterval = null;
  return true;
}

export function isHeartbeatRunning(): boolean {
  return heartbeatInterval !== null;
}
