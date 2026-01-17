// api/extract-bet-slip.js
// This is a Vercel serverless function that securely calls Veryfi API

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image, filename } = req.body;

    // Your Veryfi credentials from environment variables (secure!)
    const clientId = process.env.VERYFI_CLIENT_ID;
    const username = process.env.VERYFI_USERNAME;
    const apiKey = process.env.VERYFI_API_KEY;

    // Call Veryfi API
    const response = await fetch('https://api.veryfi.com/api/v8/partner/documents/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CLIENT-ID': clientId,
        'AUTHORIZATION': `apikey ${username}:${apiKey}`
      },
      body: JSON.stringify({
        file_name: filename || 'bet_slip.jpg',
        file_data: image,
        categories: ['receipt', 'sports'],
        auto_delete: true // Auto-delete after processing for privacy
      })
    });

    if (!response.ok) {
      throw new Error(`Veryfi API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract relevant betting information from Veryfi response
    const extractedData = {
      sportsbook: data.vendor?.name || 'Unknown',
      amount: data.total || 0,
      date: data.date || new Date().toISOString().split('T')[0],
      // You can add more fields based on what Veryfi returns
      rawData: data // Include full response for debugging
    };

    res.status(200).json(extractedData);

  } catch (error) {
    console.error('Error processing bet slip:', error);
    res.status(500).json({ 
      error: 'Failed to process bet slip',
      message: error.message 
    });
  }
}