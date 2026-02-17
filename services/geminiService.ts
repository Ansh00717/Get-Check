import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ResumeAnalysisResult, FileContent } from "../types";

// ── RESUME VALIDATION ──────────────────────────────────────────────
const VALIDATION_SYSTEM_INSTRUCTION = `
You are a professional Resume Validation System.
Your ONLY task is to determine whether the provided document is a resume or CV intended for job or internship applications.
You must be strict — do NOT guess or assume.
`;

const VALIDATION_PROMPT = `
Determine if the following document is a valid resume/CV.

A valid resume/CV must contain most of the following:
- Candidate name or contact information
- Education section
- Skills section
- Work experience, internships, or projects
- Certifications or achievements (optional but common)
- Professional summary or objective (optional)

If the document is an essay, random paragraph, story, legal document, business report, blank/near-empty file, notes, casual text, or any unrelated content, classify it as INVALID.

Do NOT assume. Do NOT guess. Only classify as valid if you are confident it is a resume/CV.
`;

const VALIDATION_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    is_resume: { type: Type.BOOLEAN, description: "Whether the document is a valid resume/CV" },
    confidence: { type: Type.STRING, description: "Confidence level: high, medium, or low" },
    reason: { type: Type.STRING, description: "Short explanation if the document is not a resume" },
  },
  required: ["is_resume", "confidence"],
};

// ── ANALYSIS ───────────────────────────────────────────────────────
const ANALYSIS_SYSTEM_INSTRUCTION = `
You are an expert ATS Resume Analyzer, Career Recruiter, and Professional Resume Coach with 15+ years of experience.
Your job is to analyze resumes realistically and honestly. Do not exaggerate scores.

STEP 1: VALIDATION
First, determine if the provided text is actually a resume or CV.
- A valid resume must have: Name/Contact, Experience/Projects, Education, or Skills.
- If it is NOT a resume (e.g., essay, recipe, code snippet, blank text, homework), you MUST fail the analysis gracefully:
  - Set 'overallScore' to 0.
  - Set 'overallJustification' to exactly "INVALID_RESUME".
  - Fill other required fields with empty/dummy strings to satisfy the schema (e.g., "N/A").

STEP 2: ANALYSIS (Only if Valid)
Analyze structure, content, ATS compatibility, clarity, and impact.
You must also infer the candidate's likely target job roles based on their skills and experience.
`;

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    overallScore: { type: Type.NUMBER, description: "Score out of 10. Set to 0 if invalid resume." },
    overallJustification: { type: Type.STRING, description: "Short justification. If invalid, this MUST start with 'INVALID_RESUME'." },
    sectionAnalysis: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sectionName: { type: Type.STRING },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
          improvementSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["sectionName", "strengths", "weaknesses", "improvementSuggestions"],
      },
    },
    atsCompatibility: {
      type: Type.OBJECT,
      properties: {
        score: { type: Type.NUMBER, description: "Score out of 10 for parseability" },
        issues: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["score", "issues"],
    },
    keywordAnalysis: {
      type: Type.OBJECT,
      properties: {
        found: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Important keywords found in the resume" },
        missing: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Standard industry keywords missing for the inferred role" },
      },
      required: ["found", "missing"],
    },
    jobMatches: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          role: { type: Type.STRING, description: "Job title" },
          matchPercentage: { type: Type.NUMBER, description: "0-100" },
          reason: { type: Type.STRING, description: "Brief reason for score" },
        },
        required: ["role", "matchPercentage", "reason"],
      },
      description: "Top 3 job roles this resume fits best",
    },
    contentQuality: {
      type: Type.OBJECT,
      properties: {
        actionVerbsUsage: { type: Type.STRING },
        quantifiedAchievements: { type: Type.STRING },
        clarity: { type: Type.STRING },
        professionalTone: { type: Type.STRING },
      },
      required: ["actionVerbsUsage", "quantifiedAchievements", "clarity", "professionalTone"],
    },
    dos: { type: Type.ARRAY, items: { type: Type.STRING } },
    donts: { type: Type.ARRAY, items: { type: Type.STRING } },
    specificImprovements: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          section: { type: Type.STRING },
          problem: { type: Type.STRING },
          suggestedRewrite: { type: Type.STRING },
        },
        required: ["section", "problem", "suggestedRewrite"],
      },
    },
    finalVerdict: {
      type: Type.OBJECT,
      properties: {
        impression: { type: Type.STRING },
        strength: { type: Type.STRING, enum: ["Strong", "Average", "Weak"] },
        priorityImprovements: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["impression", "strength", "priorityImprovements"],
    },
  },
  required: [
    "overallScore",
    "overallJustification",
    "sectionAnalysis",
    "atsCompatibility",
    "keywordAnalysis",
    "jobMatches",
    "contentQuality",
    "dos",
    "donts",
    "specificImprovements",
    "finalVerdict",
  ],
};

// Helper to initialise the Gemini client once
const getAI = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please set VITE_GEMINI_API_KEY.");
  }
  return new GoogleGenAI({ apiKey });
};

const MODELS_TO_TRY = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-001",
  "gemini-2.5-pro" 
];

const generateWithFallback = async (ai: GoogleGenAI, contents: any, config: any) => {
  let lastError: any;

  for (const modelName of MODELS_TO_TRY) {
    try {
      console.log(`Attempting analysis with model: ${modelName}`);
      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config,
      });
      return response;
    } catch (error: any) {
      console.warn(`Model ${modelName} failed:`, error.message);
      lastError = error;
      // If it's a 429 (Quota) or 404 (Not Found - potentially due to region/key), try next.
    }
  }
  
  throw lastError || new Error("All models failed to generate content.");
};

export const analyzeResume = async (input: FileContent): Promise<ResumeAnalysisResult> => {
  const ai = getAI();
  
  let contents: any;
  const promptText = `
    Analyze the following resume. 
    Validation Check: Is this a resume? If no, return overallScore: 0 and overallJustification: "INVALID_RESUME".
    If yes:
    1. Identify the candidate's primary job role based on their experience.
    2. Suggest 2 other related roles they might fit.
    3. Evaluate keywords found and missing for their primary role.
    4. Provide specific actionable feedback.
  `;

  if (input.type === 'text') {
    contents = `${promptText}\n\nRESUME CONTENT:\n${input.content}`;
  } else {
    contents = {
      parts: [
        { text: promptText },
        {
          inlineData: {
            mimeType: input.mimeType,
            data: input.data
          }
        }
      ]
    };
  }

  try {
    const response = await generateWithFallback(ai, contents, {
      temperature: 0,
      systemInstruction: ANALYSIS_SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    });

    const jsonText = response.text;
    if (!jsonText) {
      throw new Error("Empty response from Gemini.");
    }

    return JSON.parse(jsonText) as ResumeAnalysisResult;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};
