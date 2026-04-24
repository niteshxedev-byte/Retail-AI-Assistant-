import { ChatOllama } from "@langchain/ollama";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { AgentExecutor, createToolCallingAgent } from "@langchain/classic/agents";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { 
    searchProducts, 
    getProduct, 
    getOrder, 
    evaluateReturn, 
    getPolicyText 
} from "./agentTools.js";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const model = new ChatOllama({
  model: "deepseek-v3.2:cloud",
  baseUrl: process.env.OLLAMA_URL || "https://ollama.com",
  headers: {
    "Authorization": `Bearer ${process.env.OLLAMA_API_KEY}`
  },
  temperature: 0, 
});

const tools = [
  new DynamicStructuredTool({
    name: "search_products",
    description: "Search for products based on various filters like price, size, and tags.",
    schema: z.object({
      query: z.string().optional().describe("A text query to search for"),
      maxPrice: z.number().optional().describe("Maximum price"),
      size: z.string().optional().describe("Size required (e.g., '8', '10', '16')"),
      tags: z.array(z.string()).optional().describe("Tags like 'modest', 'evening', 'lace'"),
      isSale: z.boolean().optional().describe("Filter for items on sale")
    }),
    func: searchProducts,
  }),
  new DynamicStructuredTool({
    name: "get_product",
    description: "Get detailed information about a specific product by its ID.",
    schema: z.object({
      productId: z.string().describe("The ID of the product (e.g., 'P0001')")
    }),
    func: async ({ productId }) => await getProduct(productId),
  }),
  new DynamicStructuredTool({
    name: "get_order",
    description: "Get details about a specific customer order by its ID.",
    schema: z.object({
      orderId: z.string().describe("The ID of the order (e.g., 'O0001')")
    }),
    func: async ({ orderId }) => await getOrder(orderId),
  }),
  new DynamicStructuredTool({
    name: "evaluate_return",
    description: "Evaluate if an order is eligible for a return based on the store policy.",
    schema: z.object({
      orderId: z.string().describe("The ID of the order to evaluate")
    }),
    func: async ({ orderId }) => await evaluateReturn(orderId),
  }),
];

const policyText = getPolicyText();

const prompt = ChatPromptTemplate.fromMessages([
  ["system", `You are a Retail AI Assistant for THIS STORE ONLY. You help customers find products, check orders, and answer return questions.

===== CRITICAL: WHAT YOU CAN AND CANNOT DO =====

✅ YOU CAN ONLY:
- Search for products in our store
- Show product details by ID
- Check order status
- Evaluate return eligibility
- Answer questions about our return policy

❌ YOU CANNOT AND MUST REFUSE:
- Write code, scripts, or technical solutions (Python, JavaScript, etc.)
- Generate mock/example/fake data or product lists
- Recommend external stores, competitors, or brands
- Provide general fashion/shopping advice unrelated to our store
- Help with tasks outside shopping (calculations, translations, etc.)

If the user asks for ANYTHING in the "CANNOT" list, respond EXACTLY:
"I can only help with finding products, checking orders, and returns for this store. I cannot assist with that request."

Then STOP. Do NOT offer alternatives, explanations, or "what if" scenarios.

===== SEARCH RETRY RULES (MECHANICAL HARD LIMIT) =====

COUNT EVERY SINGLE search_products CALL.
Maximum allowed: 3 calls per user message.
The 4th call is NEVER PERMITTED.

After your 3rd search_products call:
1. STOP immediately
2. Do NOT call any tool again
3. Tell the user: "I searched our catalog but couldn't find matching products. Please try different search terms or browse our store directly."

Retry strategy:
- Call 1: Exact user query
- Call 2 (if empty): Remove ONE filter (e.g., drop tags OR maxPrice OR size)
- Call 3 (if still empty): Simplify to just the core query text
- After Call 3: STOP and tell user nothing found

=== TOOL USAGE RULES ===

1. search_products → Returns: product_id, title, vendor, price, compare_at_price, tags, is_sale, is_clearance, bestseller_score, stock_for_size
   - This data is COMPLETE. Do NOT call get_product on every result.
   - Use ONCE per search attempt (max 3 attempts per user message)

2. get_product → Returns full details for ONE product
   - Use ONLY when user asks about a specific product ID (e.g., "tell me about P0001")

3. get_order → Returns: order_id, order_date, product_id, size, price_paid
   - Use ONLY when user wants order details (NOT for return checks)

4. evaluate_return → Returns COMPLETE return verdict: order details, product name, price, days_since_order, canReturn, reason, refundType
   - For ANY return question, call this ONCE with order ID
   - Do NOT call get_order or get_product first. It fetches them internally.

=== ANTI-HALLUCINATION RULES (ABSOLUTE) ===

🚫 NEVER INVENT DATA
- Every product ID, price, tag, stock number, bestseller score MUST come from a tool result
- Do NOT generate example products, mock data, or placeholder values
- Do NOT write code that contains fake product data
- If a tool returns empty/null/"not found", tell the user. Do NOT create alternatives.

🚫 NEVER RECOMMEND COMPETITORS
- Do NOT mention: Lulus, ASOS, Nordstrom, Amazon, Zara, H&M, or any external brand/website
- You represent THIS store ONLY

🚫 NEVER GIVE GENERIC ADVICE
- Do NOT offer general fashion tips, styling guides, or "shopping strategies"
- Stick to facts from your tools

🚫 IF YOU DON'T HAVE THE ANSWER
- Say: "I don't have that information" or "That's outside my scope"
- Do NOT guess, approximate, or invent

=== RESPONSE FORMAT ===

- Use markdown: **bold** for emphasis, bullet points for lists
- Be helpful and comprehensive based ONLY on tool data
- For product lists:
  - **Product Title** (ID) — $price | Tags | Bestseller: score/100
  - One product per line

=== STORE RETURN POLICY ===
${policyText}

Today's date: ${new Date().toISOString().split('T')[0]}`],
  new MessagesPlaceholder("chat_history"),
  ["human", "{input}"],
  new MessagesPlaceholder("agent_scratchpad"),
]);

const agent = createToolCallingAgent({
  llm: model,
  tools,
  prompt,
});

const agentExecutor = new AgentExecutor({
  agent,
  tools,
  maxIterations: 5, // Limit total iterations to prevent runaway loops
  handleParsingErrors: true, // Gracefully handle tool parsing errors
});

// In-memory conversation store keyed by session/socket ID
const chatMemory = new Map();

export const getHistory = (sessionId) => {
    if (!chatMemory.has(sessionId)) {
        chatMemory.set(sessionId, []);
    }
    return chatMemory.get(sessionId);
};

export const clearHistory = (sessionId) => {
    chatMemory.delete(sessionId);
};

// Validation function to detect hallucinated content
const validateOutput = (output) => {
    const forbidden = [
        // Code patterns
        /```python/i,
        /```javascript/i,
        /def\s+\w+\s*\(/,
        /function\s+\w+\s*\(/,
        /import\s+\w+/,
        /from\s+\w+\s+import/,
        
        // Mock data patterns
        /P\d{4}.*P\d{4}.*P\d{4}/, // Multiple fake product IDs
        /"product_id":\s*"P\d{4}"/,
        /\[\s*\{.*"product_id".*\}\s*,/,
        
        // Competitor mentions
        /\b(lulus|asos|nordstrom|amazon|zara|h&m|forever\s*21|shein)\b/i,
    ];
    
    for (const pattern of forbidden) {
        if (pattern.test(output)) {
            return {
                valid: false,
                reason: "Response contains forbidden content (code, mock data, or competitor mentions)"
            };
        }
    }
    
    return { valid: true };
};

export const processChatMessage = async (input, sessionId, emitter = {}) => {
    try {
        const history = getHistory(sessionId);
        
        // Hard limit enforcement at code level
        let toolCallCount = 0;
        let searchCallCount = 0;
        const MAX_TOOL_CALLS = 10; // Total safety limit
        const MAX_SEARCH_CALLS = 3; // Search-specific limit
        
        let isThinkingBlock = false;
        let isToolCallStream = false;
        let streamedTextLength = 0;
        
        const callbacks = [{
            handleLLMNewToken(token) {
                if (token.includes("<think>")) {
                    isThinkingBlock = true;
                    token = token.replace("<think>", "");
                }
                if (token.includes("</think>")) {
                    isThinkingBlock = false;
                    token = token.replace("</think>", "");
                }
                
                // Prevent raw XML from leaking into the UI's live analysis block
                if (token.includes("<function_calls>") || token.includes("<invoke") || token.includes("<tool_call>")) {
                    isToolCallStream = true;
                }
                
                if (!isToolCallStream && emitter.onAnalysisChunk && token) {
                    const cleanToken = token.replace(/<[^>]*>?/gm, ''); // strip remaining stray xml
                    if (cleanToken.trim() !== '') {
                        streamedTextLength += cleanToken.length;
                        emitter.onAnalysisChunk(cleanToken);
                    }
                }
            },
            handleAgentAction(action) {
                // Enforce hard limits
                toolCallCount++;
                if (action.tool === "search_products") {
                    searchCallCount++;
                }
                
                // Block if limits exceeded
                if (toolCallCount > MAX_TOOL_CALLS) {
                    throw new Error("Tool call limit exceeded. Please rephrase your request.");
                }
                
                if (searchCallCount > MAX_SEARCH_CALLS) {
                    throw new Error("Search limit reached. No matching products found.");
                }
                
                const thoughtStr = action.log && action.log.trim() !== "" 
                    ? action.log 
                    : `Analyzing request... I will use the ${action.tool} tool to find the information.`;
                    
                if (emitter.onThought) {
                    emitter.onThought(thoughtStr);
                }
                
                // If the model didn't stream any text natively, simulate it so the UI Analysis block still works
                if (streamedTextLength === 0 && emitter.onAnalysisChunk) {
                    emitter.onAnalysisChunk(thoughtStr);
                }

                if (emitter.onToolCall) {
                    emitter.onToolCall({
                        name: action.tool,
                        input: typeof action.toolInput === "string" 
                            ? action.toolInput 
                            : JSON.stringify(action.toolInput),
                    });
                }
            },
            handleToolStart(tool, input) {
                // Some native tool calling agents fire handleToolStart directly instead of handleAgentAction
                if (emitter.onThought) {
                    emitter.onThought(`Analyzing request... I am preparing to use the ${tool.name} tool.`);
                }
            },
            handleToolEnd(output) {
                if (emitter.onToolResult) {
                    const text = typeof output === "string" ? output : JSON.stringify(output);
                    emitter.onToolResult(text.length > 300 ? text.slice(0, 300) + "..." : text);
                }
            },
        }];

        const response = await agentExecutor.invoke(
            {
                input,
                chat_history: history,
            },
            { callbacks }
        );

        let output = response.output;

        // Fallback: If Ollama fails to parse the XML tool call natively, handle it manually
        if (output && output.includes("<function_calls>")) {
            const toolMatch = output.match(/<invoke name="([^"]+)">([\s\S]*?)<\/invoke>/);
            if (toolMatch) {
                const toolName = toolMatch[1];
                const paramsStr = toolMatch[2];
                const params = {};
                
                const paramRegex = /<parameter name="([^"]+)"[^>]*>([\s\S]*?)<\/parameter>/g;
                let match;
                while ((match = paramRegex.exec(paramsStr)) !== null) {
                    let val = match[2].trim();
                    try { val = JSON.parse(val); } catch(e) {} // Parse numbers/booleans if possible
                    params[match[1]] = val;
                }
                
                // Enforce limits on fallback path too
                toolCallCount++;
                if (toolName === "search_products") {
                    searchCallCount++;
                }
                
                if (toolCallCount > MAX_TOOL_CALLS || searchCallCount > MAX_SEARCH_CALLS) {
                    output = "I've reached my search limit. Please try a different query or browse our store directly.";
                } else {
                    const tool = tools.find(t => t.name === toolName);
                    if (tool) {
                        const fallbackThought = `Analyzing request... I will use the ${toolName} tool to find the information.`;
                        if (emitter.onThought) emitter.onThought(fallbackThought);
                        if (streamedTextLength === 0 && emitter.onAnalysisChunk) emitter.onAnalysisChunk(fallbackThought);
                        
                        if (emitter.onToolCall) {
                            emitter.onToolCall({ name: toolName, input: JSON.stringify(params) });
                        }
                        try {
                            const toolResult = await tool.func(params);
                            if (emitter.onToolResult) {
                                const text = typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult);
                                emitter.onToolResult(text.length > 300 ? text.slice(0, 300) + "..." : text);
                            }
                            
                            const finalMessages = [
                                ...history,
                                new HumanMessage(input),
                                new HumanMessage(`[System Data from ${toolName}]: ${JSON.stringify(toolResult)}\n\nPlease provide a detailed and comprehensive final response to my original query based ONLY on this data. Format beautifully using markdown. Do NOT recommend external stores, competitors, or general shopping advice. If products are not found, state this fact and politely stop. Do not attempt to call any more tools. Do NOT write code or generate mock data.`)
                            ];
                            
                            const secondResponse = await model.invoke(finalMessages, { callbacks });
                            output = secondResponse.content;
                        } catch (e) {
                            console.error("Fallback manual tool execution error:", e);
                            output = "I encountered an error processing that request. Please try again.";
                        }
                    }
                }
            } else {
                // In case it outputs raw function calls without invoke, try to strip it or handle it
                output = "I cannot process this request due to a system format error. Please try another query.";
            }
        }
        
        // Validate output before returning
        const validation = validateOutput(output);
        if (!validation.valid) {
            console.warn(`Output validation failed: ${validation.reason}`);
            output = "I can only help with finding products, checking orders, and returns for this store. I cannot assist with that request.";
        }

        // Append this turn to memory as proper LangChain message objects
        history.push(new HumanMessage(input));
        history.push(new AIMessage(output));

        return output;
    } catch (error) {
        console.error("Agent Error:", error);
        
        // Better error messages based on type
        if (error.message && error.message.includes("limit exceeded")) {
            return "I've reached my search limit. Please try a simpler query or browse our store directly.";
        }
        
        if (error.message && error.message.includes("limit reached")) {
            return "I searched our catalog but couldn't find matching products. Please try different search terms.";
        }
        
        return "I'm sorry, I encountered an error while processing your request. Please try rephrasing your question.";
    }
};
