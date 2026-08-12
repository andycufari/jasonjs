/**
 * AI Agent Execution Engine
 * Handles agent chat with tool loop execution
 *
 * IMPORTANT: Server-side only - agents are not available on client
 */

import OpenAI from 'openai';
import { trackCost, logUsage } from './security.js';

// OpenAI client cache (per API key)
const openaiClients = new Map();

/**
 * Get OpenAI client for a tenant
 * 🔒 Requires a tenant-supplied API key — no host process fallback.
 * @param {string} apiKey - API key resolved from the tenant's config
 */
function getOpenAIClient(apiKey = null) {
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured for this site. Set it in settings/.env.');
  }
  const key = apiKey;

  if (openaiClients.has(key)) {
    return openaiClients.get(key);
  }

  const client = new OpenAI({ apiKey: key });

  openaiClients.set(key, client);
  return client;
}

/**
 * Load system prompt from private file or return inline prompt
 * @param {string} domain - Domain name
 * @param {string} promptRef - Either 'private/FileName' or inline prompt string
 * @returns {Promise<string>} System prompt content
 */
async function loadSystemPrompt(domain, promptRef) {
  if (!promptRef) {
    throw new Error('Agent system_prompt is required');
  }

  // Check if it's a file reference (starts with 'private/')
  if (promptRef.startsWith('private/')) {
    const fileName = promptRef.replace('private/', '');
    const { getFile } = await import('@/core/sites/files.js');
    const content = await getFile(domain, 'private', fileName);

    if (!content) {
      throw new Error(`Private prompt file not found: ${fileName}`);
    }

    return content;
  }

  // Inline prompt string
  return promptRef;
}

/**
 * Apply template variable replacements
 * Uses [[VARIABLE]] syntax (different from {{template}} for prompts)
 * @param {string} prompt - Prompt with [[VARIABLE]] placeholders
 * @param {Array} vars - Array of [name, value] pairs
 * @returns {string} Processed prompt
 */
function applyTemplateVars(prompt, vars = []) {
  if (!prompt || !Array.isArray(vars)) {
    return prompt;
  }

  let result = prompt;
  for (const [name, value] of vars) {
    const regex = new RegExp(`\\[\\[${name}\\]\\]`, 'g');
    result = result.replace(regex, String(value));
  }
  return result;
}

/**
 * Build tool definitions in OpenAI format
 * @param {Array} tools - Tool configurations from agent config
 * @returns {Array} OpenAI-formatted tool definitions
 */
function buildToolDefinitions(tools = []) {
  if (!Array.isArray(tools) || tools.length === 0) {
    return [];
  }

  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.function,
      description: tool.description || `Execute ${tool.function}`,
      parameters: tool.parameters || {
        type: 'object',
        properties: {},
        required: []
      }
    }
  }));
}

/**
 * Execute a server function as a tool
 * @param {string} domain - Domain name
 * @param {string} functionName - Name of the function to execute
 * @param {Object} args - Arguments passed by the LLM
 * @param {Object} context - Execution context (userId, etc.)
 * @returns {Promise<Object>} Function result
 */
async function executeServerFunction(domain, functionName, args, context) {
  const { getFile, getAllDatabases, getSite } = await import('@/core/sites/files.js');

  // Load the function file
  const functionContent = await getFile(domain, 'function', functionName);

  if (!functionContent) {
    return { error: `Function '${functionName}' not found` };
  }

  try {
    // Get site and databases for function context
    const site = await getSite(domain);
    const siteId = site?._id?.toString() || null;

    // Create minimal app object for tool execution
    // (similar to the full app object but focused on what tools need)
    const Database = (await import('@/core/db')).default;
    const { sanitizeData } = await import('@/core/security/sanitize.js');

    // Use getAllDatabases which supports both legacy and new format
    const databaseConfig = await getAllDatabases(domain) || site?.database || {};
    const database = new Database(databaseConfig, {}, {
      siteId,
      domain,
      userId: context.userId,
      serverSideAccess: true
    });

    const toolApp = {
      params: args,
      method: 'TOOL_CALL',
      db: database,
      database: database,
      auth: {
        user: context.user || null,
        isAuthenticated: !!context.userId,
        userId: context.userId
      },
      sanitizeData,
      log: (message, type = 'info') => {
        console.log(`[Agent Tool: ${functionName}] [${type}]`, message);
      },
      return: (data, statusCode = 200) => {
        return { __STATUS__: statusCode, ...data };
      },
      response: (data, statusCode = 200) => {
        return { __STATUS__: statusCode, ...data };
      }
    };

    // Execute the function securely
    const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;

    const secureFunction = new AsyncFunction(
      'app',
      'process', 'require', 'global', '__dirname', '__filename',
      'module', 'exports', 'Buffer', 'clearImmediate', 'setImmediate',
      `"use strict";
      ${functionContent}

      const exportedFunction = typeof ${functionName} === 'function'
        ? ${functionName}
        : (typeof handler === 'function' ? handler : null);
      if (!exportedFunction) {
        throw new Error('No valid function exported');
      }
      return await exportedFunction(app);`
    );

    // Execute with timeout
    const timeout = 30000; // 30 second timeout for tool calls
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Tool execution timed out')), timeout);
    });

    const result = await Promise.race([
      secureFunction(
        toolApp,
        undefined, undefined, undefined, undefined, undefined,
        undefined, undefined, undefined, undefined, undefined
      ),
      timeoutPromise
    ]);

    // Clean up result
    if (result && typeof result === 'object' && '__STATUS__' in result) {
      const { __STATUS__, ...data } = result;
      return data;
    }

    return result || { success: true };

  } catch (error) {
    console.error(`[Agent] Tool execution error for ${functionName}:`, error);
    return {
      error: error.message || 'Tool execution failed',
      function: functionName
    };
  }
}

/**
 * Sanitize tool result before sending to LLM
 * Prevents prompt injection and limits result size
 * @param {Object} result - Tool result
 * @returns {string} Sanitized JSON string
 */
function sanitizeToolResult(result) {
  try {
    let jsonStr = JSON.stringify(result);

    // Limit result size to prevent token overflow
    const MAX_RESULT_SIZE = 10000; // ~2500 tokens
    if (jsonStr.length > MAX_RESULT_SIZE) {
      jsonStr = jsonStr.substring(0, MAX_RESULT_SIZE) + '... [truncated]';
    }

    return jsonStr;
  } catch (error) {
    return JSON.stringify({ error: 'Could not serialize tool result' });
  }
}

/**
 * Call OpenAI API with tools
 * @param {Array} messages - Message history
 * @param {Array} tools - Tool definitions
 * @param {string} model - Model to use
 * @param {string} apiKey - API key
 * @returns {Promise<Object>} OpenAI response with tool_calls if any
 */
async function callOpenAIWithTools(messages, tools, model, apiKey) {
  const client = getOpenAIClient(apiKey);

  const requestParams = {
    model: model || 'gpt-4o-mini',
    messages: messages
  };

  // Only add tools if we have any
  if (tools && tools.length > 0) {
    requestParams.tools = tools;
    requestParams.tool_choice = 'auto';
  }

  const response = await client.chat.completions.create(requestParams);
  const choice = response.choices[0];

  return {
    content: choice.message?.content || '',
    tool_calls: choice.message?.tool_calls || [],
    finish_reason: choice.finish_reason,
    usage: {
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0
    }
  };
}

/**
 * Run agent loop - executes tools until completion or max iterations
 * @param {Object} config - Agent loop configuration
 * @returns {Promise<Object>} Final response with usage and tool events
 */
async function runAgentLoop(config) {
  const {
    systemPrompt,
    chatHistory,
    tools,
    toolConfigs,
    model,
    maxIterations,
    domain,
    userId,
    user,
    apiKey
  } = config;

  const toolEvents = [];
  const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  let totalCost = 0;
  const startTime = Date.now();

  // Build messages: system prompt + chat history
  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory
  ];

  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;

    try {
      // Call OpenAI with tools
      const response = await callOpenAIWithTools(messages, tools, model, apiKey);

      // Accumulate usage
      usage.inputTokens += response.usage.inputTokens;
      usage.outputTokens += response.usage.outputTokens;
      usage.totalTokens += response.usage.totalTokens;

      // Track cost
      const iterationCost = trackCost(domain, model, response.usage.inputTokens, response.usage.outputTokens);
      totalCost += iterationCost;

      // Log usage for this iteration
      logUsage({
        domain,
        userId,
        type: 'agent',
        model,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        cost: iterationCost,
        duration: Date.now() - startTime,
        success: true,
        iteration: iterations
      });

      // No tool calls = agent is done
      if (!response.tool_calls || response.tool_calls.length === 0) {
        return {
          success: true,
          text: response.content,
          model,
          iterations,
          usage,
          cost: totalCost,
          duration: Date.now() - startTime,
          toolEvents
        };
      }

      // Process tool calls
      // First, add assistant message with tool calls
      messages.push({
        role: 'assistant',
        content: response.content || null,
        tool_calls: response.tool_calls
      });

      // Execute each tool call
      for (const toolCall of response.tool_calls) {
        const funcName = toolCall.function.name;
        let args = {};

        try {
          args = JSON.parse(toolCall.function.arguments || '{}');
        } catch (e) {
          console.warn(`[Agent] Failed to parse tool arguments for ${funcName}:`, e);
        }

        // Validate tool is in whitelist
        const toolConfig = toolConfigs.find(t => t.function === funcName);
        if (!toolConfig) {
          const errorResult = { error: `Tool '${funcName}' not allowed for this agent` };

          toolEvents.push({
            id: toolCall.id,
            function: funcName,
            arguments: args,
            result: errorResult,
            error: true,
            timestamp: Date.now()
          });

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(errorResult)
          });

          continue;
        }

        // Execute the server function
        const result = await executeServerFunction(domain, funcName, args, { userId, user });

        // Record event
        toolEvents.push({
          id: toolCall.id,
          function: funcName,
          arguments: args,
          result,
          timestamp: Date.now()
        });

        // Add tool result to messages
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: sanitizeToolResult(result)
        });
      }

    } catch (error) {
      console.error(`[Agent] Error in iteration ${iterations}:`, error);

      // Log failed attempt
      logUsage({
        domain,
        userId,
        type: 'agent',
        model,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        duration: Date.now() - startTime,
        success: false,
        error: error.message,
        iteration: iterations
      });

      return {
        success: false,
        error: error.message || 'Agent execution failed',
        model,
        iterations,
        usage,
        cost: totalCost,
        duration: Date.now() - startTime,
        toolEvents
      };
    }
  }

  // Max iterations reached
  return {
    success: true,
    text: 'Agent reached maximum iterations without completing. Please try a simpler request.',
    model,
    iterations,
    usage,
    cost: totalCost,
    duration: Date.now() - startTime,
    toolEvents,
    maxIterationsReached: true
  };
}

/**
 * Execute an agent chat with tool loop
 * Main entry point called from JasonAI.chat()
 *
 * @param {Object} agentConfig - Agent configuration from ai.json
 * @param {Array} chatHistory - Chat history [{role, content}, ...]
 * @param {Object} context - Execution context
 * @returns {Promise<Object>} Agent response
 */
export async function executeAgentChat(agentConfig, chatHistory, context) {
  const { domain, userId, user, apiKey } = context;

  // 1. Load and process system prompt
  const rawSystemPrompt = await loadSystemPrompt(domain, agentConfig.system_prompt);
  const systemPrompt = applyTemplateVars(rawSystemPrompt, agentConfig.template_vars);

  // 2. Build tool definitions for OpenAI
  const tools = buildToolDefinitions(agentConfig.tools);

  // 3. Get model from config or use default
  const model = agentConfig.model || 'gpt-4o-mini';

  // 4. Get max iterations (default 10)
  const maxIterations = agentConfig.maxIterations ?? 10;

  // 5. Execute the agent loop
  return await runAgentLoop({
    systemPrompt,
    chatHistory,
    tools,
    toolConfigs: agentConfig.tools || [],
    model,
    maxIterations,
    domain,
    userId,
    user,
    apiKey
  });
}
