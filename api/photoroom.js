// api/photoroom.js
import axios from 'axios';
import FormData from 'form-data';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageUrl, prompt } = req.body;

  try {
    // 1. Get the image from Supabase
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    
    // 2. Prepare Photoroom Form - Ensure keys match Photoroom Specs
    const form = new FormData();
    form.append('image_file', Buffer.from(response.data), 'image.jpg');
    form.append('background.prompt', prompt);
    form.append('padding', '0.15');
    form.append('output_size', 'large');

    // 3. Call Photoroom - Use the EXACT endpoint
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

    // 4. Return the image buffer
    res.setHeader('Content-Type', 'image/jpeg');
    return res.status(200).send(Buffer.from(photoroomRes.data));
  } catch (error) {
    // Log the specific error for Vercel
    const errorData = error.response?.data?.toString() || error.message;
    console.error('PHOTOROOM_ERROR_DETAIL:', errorData);

    return res.status(error.response?.status || 500).json({ 
      error: 'AI Processing Failed', 
      detail: errorData 
    });
  }
}