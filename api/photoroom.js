// api/photoroom.js
import axios from 'axios';
import FormData from 'form-data';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, imageUrl } = req.body;
  // Using the standard V2 Editing endpoint which supports imageFromPrompt
  const PHOTOROOM_URL = 'https://image-api.photoroom.com/v2/edit';

  try {
    const form = new FormData();

    if (imageUrl) {
      // SERVICE MODE: Refine an existing Club photo (e.g., a real room) 
      // into a professional architectural shot
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      form.append('imageFile', Buffer.from(response.data), 'club_base.jpg');
      form.append('background.prompt', prompt);
    } else {
      // CREATION MODE: Generate a full Service Scene from scratch
      // Using the 'imageFromPrompt' logic for Club Atmosphere
      form.append('imageFromPrompt.prompt', prompt);
    }

    form.append('outputSize', '1600x1600');
    form.append('padding', '0'); // No padding for full-bleed atmosphere shots

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
    console.error('CLUB_CREATION_ERROR:', errorData);
    return res.status(500).json({ error: 'Club Image Generation Failed', detail: errorData });
  }
}