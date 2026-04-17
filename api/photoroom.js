// api/photoroom.js
import axios from 'axios';
import FormData from 'form-data';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { imageUrl, prompt } = req.body;

  try {
    // 1. Download the baguette image from Supabase
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    
    // 2. Prepare the Form Data for Photoroom
    const form = new FormData();
    form.append('image_file', Buffer.from(response.data), 'image.jpg');
    form.append('background.prompt', prompt);
    form.append('padding', '0.15');
    form.append('output_size', 'large');
    form.append('shadow.mode', 'ai.soft');

    // 3. Call Photoroom (Backend to Backend - No CORS!)
    const photoroomRes = await axios.post(
      'https://sdk.photoroom.com/v1/editing',
      form,
      {
        headers: {
          ...form.getHeaders(),
          'x-api-key': process.env.VITE_PHOTOROOM_API_KEY,
        },
        responseType: 'arraybuffer', 
      }
    );

    // 4. Send the processed image back to your Products.tsx
    res.setHeader('Content-Type', 'image/jpeg');
    res.status(200).send(Buffer.from(photoroomRes.data));
  } catch (error) {
    console.error('Photoroom API Error:', error.response?.status || error.message);
    res.status(500).json({ error: 'AI Processing Failed' });
  }
}