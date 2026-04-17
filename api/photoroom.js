// api/photoroom.js
import axios from 'axios';
import FormData from 'form-data';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageUrl, prompt } = req.body;
  const PHOTOROOM_URL = 'https://image-api.photoroom.com/v2/edit';

  try {
    const response = await axios.get(imageUrl, { 
      responseType: 'arraybuffer',
      timeout: 5000 
    });
    
    const form = new FormData();
    form.append('imageFile', Buffer.from(response.data), 'image.jpg');
    form.append('background.prompt', prompt);
    form.append('padding', '0.15');
    // FIXED: Changed 'large' to '1600x1600' to satisfy the pattern requirement
    form.append('outputSize', '1600x1600'); 

    const photoroomRes = await axios.post(PHOTOROOM_URL, form, {
      headers: {
        ...form.getHeaders(),
        'x-api-key': process.env.VITE_PHOTOROOM_API_KEY,
      },
      responseType: 'arraybuffer',
    });

    res.setHeader('Content-Type', 'image/jpeg');
    return res.status(200).send(Buffer.from(photoroomRes.data));

  } catch (error) {
    const errorData = error.response?.data?.toString() || error.message;
    console.error('--- PHOTOROOM ERROR LOG ---');
    console.error('Status Code:', error.response?.status);
    console.error('Error Details:', errorData);
    
    return res.status(error.response?.status || 500).json({ 
      error: 'AI Processing Failed', 
      detail: errorData 
    });
  }
}