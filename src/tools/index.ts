import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppContext } from '../context.js';
import { registerInitTool } from './init.js';
import { registerVibeTool } from './vibe.js';
import { registerContextTool } from './context.js';
import { registerPlanTool } from './plan.js';
import { registerDesignTool } from './design.js';
import { registerPreflightTool } from './preflight.js';
import { registerGuardrailsAddTool } from './guardrails-add.js';
import { registerDriftTool, registerUpdateTool } from './drift.js';
import { registerScoreTool, registerVerifyTool } from './score.js';
import { registerCompoundTool, registerPlaybookTool } from './compound.js';
import { registerSuggestTool, registerWorktreeTool } from './suggest.js';
import { registerAutoDetectTool } from './detect.js';
import { registerEnforceTool } from './enforce.js';
import { registerFeedbackTool, registerMemoryStatsTools } from './feedback.js';
import { registerTypecheckTool } from './typecheck.js';
import { registerAutoFixTool } from './fix.js';
import { registerInferTool } from './infer.js';
import {
  registerMakerPromptTool,
  registerCheckerPromptTool,
  registerRetryTool,
  registerEscalateTool,
  registerDecomposeTool,
  registerMergeReviewTool,
} from './loop-engineering.js';
import { registerWatchTool } from './watch.js';
import { registerTemplateCustomizeTool } from './template.js';

export function registerAllTools(server: McpServer, ctx: AppContext) {
  // Core spec tools
  registerInitTool(server, ctx);
  registerVibeTool(server, ctx);
  registerContextTool(server, ctx);
  registerPlanTool(server, ctx);
  registerDesignTool(server, ctx);
  registerAutoDetectTool(server, ctx);

  // Guardrails
  registerPreflightTool(server, ctx);
  registerGuardrailsAddTool(server, ctx);

  // Live Sync + Fix
  registerDriftTool(server, ctx);
  registerUpdateTool(server, ctx);
  registerAutoFixTool(server, ctx);

  // Quality
  registerScoreTool(server, ctx);
  registerVerifyTool(server, ctx);
  registerTypecheckTool(server, ctx);

  // Memory + Bayesian
  registerCompoundTool(server, ctx);
  registerPlaybookTool(server, ctx);
  registerFeedbackTool(server, ctx);
  registerMemoryStatsTools(server, ctx);
  registerInferTool(server, ctx);

  // Loop Engineering
  registerMakerPromptTool(server, ctx);
  registerCheckerPromptTool(server, ctx);
  registerRetryTool(server, ctx);
  registerEscalateTool(server, ctx);
  registerDecomposeTool(server, ctx);
  registerMergeReviewTool(server, ctx);

  // Intelligence + Enforcement
  registerSuggestTool(server, ctx);
  registerWorktreeTool(server, ctx);
  registerEnforceTool(server, ctx);

  // Watch (file-change drift detection)
  registerWatchTool(server, ctx);

  // Template customization
  registerTemplateCustomizeTool(server, ctx);
}
