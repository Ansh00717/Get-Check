<p align="center">
  <img width="1280" height="714" alt="Getcheckai" src="https://github.com/user-attachments/assets/016f3881-b8a1-4597-975d-9cad97543a6e" />
</p>

**🚀 GetCheck AI – Smart Resume Analyzer**

An AI-powered Resume & CV Analyzer built using React + Vite + TypeScript + Google Gemini API that evaluates resumes, provides structured feedback, and generates improvement suggestions with a professional scoring system.

🔗 Live Demo: https://getcheckai.netlify.app

**✨ Features**

📄 Upload Resume (PDF, DOCX, TXT)
🧠 AI-powered Resume Analysis
📊 Overall Score (Out of 10)
📈 ATS Compatibility Evaluation
📝 Section-wise Feedback
⚠️ Strengths & Weaknesses Detection
🎯 Improvement Suggestions
🌗 Light & Dark Mode UI
🚫 Resume Validation (Detects non-resume files)

**🛠️ Tech Stack**

Frontend: React + Vite + TypeScript
Styling: Tailwind CSS
AI Integration: Google Gemini API
Deployment: Netlify
Version Control: Git & GitHub

**🧠 How It Works**

User uploads resume file
File is parsed into text
AI validates if document is a resume
Gemini analyzes content
Structured JSON feedback is returned
Score and improvement suggestions are displayed

**🔐 Environment Setup (For Developers)**

To run locally:
Clone the repository
Install dependencies:
npm install
Create a .env.local file in the root directory:
VITE_GEMINI_API_KEY=your_api_key_here
Start development server:
npm run dev

**⚠️ Important Note**

This project uses the Google Gemini API free tier, which has usage limits (rate limits and daily quota). For heavy usage, adding billing or moving API calls to a backend service is recommended.

**📌 Why I Built This**

I built this project to explore AI integration in real-world applications and create a practical tool that helps students and job seekers improve their resumes using structured AI analysis.

**🚀 Future Improvements**

Backend integration for secure API handling
Resume keyword matching with job descriptions
Downloadable PDF feedback report
User authentication and history tracking
Multi-language resume support
