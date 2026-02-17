import { GoogleGenAI } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
console.log("API KEY:", apiKey);
console.log("ENV OBJECT:", import.meta.env);
console.log("API KEY VALUE:", import.meta.env.VITE_GEMINI_API_KEY);

const ai = new GoogleGenAI({ apiKey });

async function test() {
  console.log("Checking models...");
  try {
    // Attempt to list models
    const resp = await ai.models.list();
    
    let models = [];
    if (Array.isArray(resp)) {
      models = resp;
    } else if (resp && Array.isArray(resp.models)) {
      models = resp.models;
    } else if (resp && Array.isArray(resp.pageInternal)) {
      models = resp.pageInternal;
    } else if (resp && typeof resp[Symbol.asyncIterator] === 'function') {
        for await (const m of resp) {
            models.push(m);
        }
    }
    
    console.log("Found models:", models.length);
    const allNames = models.map(m => m.name || m);
    console.log(allNames.join('\n'));
    
  } catch (error) {
    console.error("Error listing models:", error);
  }
}

test();
