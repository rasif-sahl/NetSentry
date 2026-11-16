import type { AgentBridge } from "../main/agent-types";
declare global { interface Window { netsentry?: AgentBridge; } }
