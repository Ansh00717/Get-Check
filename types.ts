export interface SectionAnalysis {
  sectionName: string;
  strengths: string[];
  weaknesses: string[];
  improvementSuggestions: string[];
}

export interface KeywordAnalysis {
  found: string[];
  missing: string[];
}

export interface JobMatch {
  role: string;
  matchPercentage: number;
  reason: string;
}

export interface AtsCompatibility {
  score: number;
  issues: string[];
}

export interface ContentQuality {
  actionVerbsUsage: string;
  quantifiedAchievements: string;
  clarity: string;
  professionalTone: string;
}

export interface SpecificImprovement {
  section: string;
  problem: string;
  suggestedRewrite: string;
}

export interface ResumeAnalysisResult {
  overallScore: number;
  overallJustification: string;
  sectionAnalysis: SectionAnalysis[];
  atsCompatibility: AtsCompatibility;
  keywordAnalysis: KeywordAnalysis;
  jobMatches: JobMatch[];
  contentQuality: ContentQuality;
  dos: string[];
  donts: string[];
  specificImprovements: SpecificImprovement[];
  finalVerdict: {
    impression: string;
    strength: 'Strong' | 'Average' | 'Weak';
    priorityImprovements: string[];
  };
}

export type AnalysisStatus = 'idle' | 'parsing' | 'validating' | 'analyzing' | 'success' | 'error';

export interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
}

export type FileContent = 
  | { type: 'text'; content: string }
  | { type: 'image'; mimeType: string; data: string };
