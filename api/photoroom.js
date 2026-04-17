// api/photoroom.js
import axios from 'axios';
import FormData from 'form-data';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageUrl, prompt } = req.body;

  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    
    const form = new FormData();
    form.append('image_file', Buffer.from(response.data), 'image.jpg');
    form.append('background.prompt', prompt);
    form.append('padding', '0.15');
    form.append('output_size', 'large');

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

    res.setHeader('Content-Type', 'image/jpeg');
    return res.status(200).send(Buffer.from(photoroomRes.data));
  } catch (error) {
    // THIS PART IS CRITICAL: It will show the real error in Vercel Logs
    const errorDetail = error.response?.data?.toString() || error.message;
    console.error('PHOTOROOM_ERROR_DETAIL:', errorDetail);
    
    return res.status(500).json({ 
      error: 'AI Processing Failed', 
      detail: errorDetail 
    });
  }
}