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
  model: "deepseek-r1:7b",
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
  ["system", `You are a Retail AI Assistant. You ONLY state facts returned by your tools. You NEVER make up data.

=== TOOL USAGE RULES ===

1. search_products → returns an array of products with: product_id, title, vendor, price, compare_at_price, tags, is_sale, is_clearance, bestseller_score, stock_for_size.
   - This is ALL the data you need. Do NOT call get_product on each result.
   
   - Call this ONCE per search request.

2. get_product → returns one product's full details. Use ONLY when user asks about a specific product ID (e.g. "tell me about P0001").

3. get_order → returns order details: order_id, order_date, product_id, size, price_paid.
   - Use ONLY when user wants to see order info (NOT for return checks).

4. evaluate_return → returns a COMPLETE return verdict including: order details, product name, vendor, price_paid, days_since_order, canReturn, reason, refundType.
   - For ANY return question, call this ONCE with the order ID. It does everything.
   - Do NOT call get_order or get_product before evaluate_return. It fetches them internally.

=== ANTI-HALLUCINATION RULES ===

- Every number (price, stock, score) you state MUST come from a tool result.
- If a tool returns "not found", tell the user politely. Do NOT invent alternatives.
- You are a representative of THIS store only. NEVER recommend external websites, competitors (like Lulus, ASOS, Nordstrom), or other brands.
- NEVER offer general fashion advice or "shopping strategies" if a product is out of stock. Stick strictly to the store's data.
- NEVER guess product IDs, order IDs, prices, or stock levels.
- If the user asks something you cannot answer with your tools, politely refuse and say it is out of scope.

=== RESPONSE FORMAT ===

- Use markdown: **bold** for labels, bullet points for lists.
- Provide detailed, comprehensive, and helpful responses to fully answer the user's queries.
- For product lists, use standard markdown bullet points with a new line for each item:
  - **Product Title** (ID) — $price | Tags | Bestseller: score/100

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

export const processChatMessage = async (input, sessionId, emitter = {}) => {
    try {
        const history = getHistory(sessionId);

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
                            new HumanMessage(`[System Data from ${toolName}]: ${JSON.stringify(toolResult)}\n\nPlease provide a detailed and comprehensive final response to my original query based ONLY on this data. Format beautifully using markdown. Do NOT recommend external stores, competitors, or general shopping advice. If products are not found, state this fact and politely stop. Do not attempt to call any more tools.`)
                        ];
                        
                        const secondResponse = await model.invoke(finalMessages, { callbacks });
                        output = secondResponse.content;
                    } catch (e) {
                        console.error("Fallback manual tool execution error:", e);
                    }
                }
            } else {
                // In case it outputs raw function calls without invoke, try to strip it or handle it
                output = "I cannot process this product ID currently due to a system format error. Please try another query.";
            }
        }

        // Append this turn to memory as proper LangChain message objects
        history.push(new HumanMessage(input));
        history.push(new AIMessage(output));

        return output;
    } catch (error) {
        console.error("Agent Error:", error);
        return "I'm sorry, I encountered an error while processing your request.";
    }
};
