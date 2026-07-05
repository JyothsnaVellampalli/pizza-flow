// src/lib/openrouter.ts
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { GoogleGenAI } from "@google/genai";

const MODEL = 'gemini-2.5-flash'; // fast, cheap, counter-safe latency

export async function callOpenRouter(
  systemPrompt: string,
  userMessage: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = []
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  // Try OpenRouter first if key is available
  if (process.env.OPENROUTER_API_KEY) {
    try {
      // 1. Initialize the OpenRouter model using LangChain ChatOpenAI
      const chat = new ChatOpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        configuration: {
          baseURL: "https://openrouter.ai/api/v1",
          defaultHeaders: {
            "HTTP-Referer": "https://pizzaflow.vercel.app",
          }
        },
        model: MODEL,
        modelName: MODEL,
        temperature: 0.2,
      });

      // 2. Prepare chat history (limit to last 20 messages for last 10 user/assistant exchanges)
      const slicedHistory = history.slice(-20);
      const chatHistory = slicedHistory.map((msg) => {
        if (msg.role === "user") {
          return new HumanMessage(msg.content);
        } else {
          return new AIMessage(msg.content);
        }
      });

      // 3. Create the chat prompt template
      const prompt = ChatPromptTemplate.fromMessages([
        ["system", systemPrompt],
        new MessagesPlaceholder("chat_history"),
        ["human", "{input}"]
      ]);

      // 4. Formulate the chain and invoke
      const chain = prompt.pipe(chat);
      const response = await chain.invoke({
        chat_history: chatHistory,
        input: userMessage
      });

      if (response && response.content) {
        const text = typeof response.content === "string" 
          ? response.content 
          : JSON.stringify(response.content);
        return { ok: true, text };
      }
      throw new Error("Invalid response content from LangChain OpenRouter");
    } catch (e: any) {
      console.error("LangChain OpenRouter error, falling back to Gemini:", e);
      // Fall through to Gemini fallback if LangChain fails
    }
  }

  // Fallback to Gemini if OpenRouter is not set up or fails
  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Formulate fallback system message + history in standard Google GenAI format
      const formattedContents: any[] = [];
      
      // Add history
      const slicedHistory = history.slice(-20);
      slicedHistory.forEach((msg) => {
        formattedContents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }]
        });
      });

      // Add the final user message
      formattedContents.push({
        role: "user",
        parts: [{ text: userMessage }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: formattedContents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.2, // low temperature for grounded statistics
        },
      });

      if (response.text) {
        return { ok: true, text: response.text };
      }
      throw new Error("Empty response from Gemini");
    } catch (e) {
      return { ok: false, error: `Both OpenRouter and Gemini fallback failed. Gemini Error: ${String(e)}` };
    }
  }

  return { ok: false, error: "No API keys configured (OPENROUTER_API_KEY or GEMINI_API_KEY)" };
}

