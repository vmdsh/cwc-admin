import axios from 'axios';
import FormData from 'form-data';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageUrl, prompt } = req.body;
  
  // NEW ENDPOINT (2026 Standard)
  const PHOTOROOM_URL = 'https://image-api.photoroom.com/v2/edit';
  
  // LOGGING FOR VERIFICATION
  console.log('--- AI GENERATION START ---');
  console.log('Target URL:', PHOTOROOM_URL);
  console.log('Source Image:', imageUrl);
  console.log('AI Prompt:', prompt);

  try {
    // 1. Download base image
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    
    // 2. Prepare Form Data
    const form = new FormData();
    form.append('image_file', Buffer.from(response.data), 'image.jpg');
    form.append('background.prompt', prompt);
    form.append('padding', '0.15');
    form.append('output_size', 'large');
    form.append('shadow.mode', 'ai.soft');

    // 3. Request to Photoroom
    const photoroomRes = await axios.post(PHOTOROOM_URL, form, {
      headers: {
        ...form.getHeaders(),
        'x-api-key': process.env.VITE_PHOTOROOM_API_KEY,
      },
      responseType: 'arraybuffer',
    });

    console.log('--- SUCCESS: IMAGE GENERATED ---');
    res.setHeader('Content-Type', 'image/jpeg');
    return res.status(200).send(Buffer.from(photoroomRes.data));

  } catch (error) {
    const errorData = error.response?.data?.toString() || error.message;
    console.error('--- PHOTOROOM ERROR LOG ---');
    console.error('Status Code:', error.response?.status || 'No Status');
    console.error('Error Details:', errorData);
    
    return res.status(error.response?.status || 500).json({ 
      error: 'AI Processing Failed', 
      detail: errorData 
    });
  }
}