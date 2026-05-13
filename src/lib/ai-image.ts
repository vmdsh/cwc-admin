import { processToSpec } from './image-utils'; // We will create this next

const PHOTOROOM_SANDBOX_KEY = 'sandbox_YOUR_ACTUAL_API_KEY';

export const generateSandboxImage = async (prompt: string): Promise<Blob> => {
  // Photoroom GET endpoint uses the prompt directly in the URL
  const url = `https://sdk.photoroom.com/v1/create-image?prompt=${encodeURIComponent(prompt)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Api-Key': PHOTOROOM_SANDBOX_KEY
    }
  });

  if (!response.ok) throw new Error('Photoroom Sandbox request failed');

  const blob = await response.blob();
  
  // Convert the watermarked sandbox result to your required 1024x1024 WebP spec
  return await processToSpec(blob);
};