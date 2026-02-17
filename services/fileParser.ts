import { FileContent } from '../types';

// Augment window to include libraries loaded via CDN
declare global {
  interface Window {
    pdfjsLib: any;
    mammoth: any;
  }
}

export const extractContentFromFile = async (file: File): Promise<FileContent> => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const mimeType = file.type;

  // Handle Images
  if (['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(extension || '') || mimeType.startsWith('image/')) {
    return await readImageFile(file);
  }

  // Handle Text-based formats
  let text = '';
  switch (extension) {
    case 'txt':
      text = await readTextFile(file);
      break;
    case 'pdf':
      text = await readPdfFile(file);
      break;
    case 'docx':
      text = await readDocxFile(file);
      break;
    default:
      throw new Error(`Unsupported file type: .${extension}`);
  }

  return { type: 'text', content: text };
};

const readImageFile = (file: File): Promise<FileContent> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (!result) {
        reject(new Error("Failed to read image file"));
        return;
      }
      // Result is in format: data:image/jpeg;base64,....
      // We need to extract the base64 data and ensure we have a valid mime type
      const parts = result.split(',');
      const base64Data = parts[1];
      let finalMimeType = file.type;
      
      // Fallback mime type extraction if file.type is empty
      if (!finalMimeType && parts[0]) {
        const match = parts[0].match(/:(.*?);/);
        if (match) {
          finalMimeType = match[1];
        }
      }

      resolve({
        type: 'image',
        mimeType: finalMimeType || 'image/jpeg', // Default to jpeg if unknown
        data: base64Data
      });
    };
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
};

const readTextFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || '');
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
};

const readPdfFile = async (file: File): Promise<string> => {
  if (!window.pdfjsLib) {
    throw new Error('PDF library not loaded');
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
};

const readDocxFile = async (file: File): Promise<string> => {
  if (!window.mammoth) {
    throw new Error('DOCX library not loaded');
  }

  const arrayBuffer = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer });
  return result.value;
};
