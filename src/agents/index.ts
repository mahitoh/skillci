import type { AgentAdapter } from "../types.js";
import { claudeAdapter } from "./claude.js";

/**
 * Registry of agent adapters. To support a new coding agent, implement the
 * AgentAdapter interface and register it here — that's the whole contract.
 * This is the project's primary contribution surface.
 */
const ADAPTERS: AgentAdapter[] = [claudeAdapter];

export function listAgents(): AgentAdapter[] {
  return ADAPTERS;
}

export function getAgent(id: string): AgentAdapter | undefined {
  return ADAPTERS.find((a) => a.id === id);
}

/** Return the first adapter that is actually runnable on this machine. */
export async function firstAvailableAgent(): Promise<AgentAdapter | undefined> {
  for (const adapter of ADAPTERS) {
    if (await adapter.isAvailable()) return adapter;
  }
  return undefined;
}
