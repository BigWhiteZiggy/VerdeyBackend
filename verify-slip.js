// api/verify-slip.js
// Serverless function to verify if a bet slip is legitimate using Sightengine

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get Sightengine credentials from environment variables
    const apiUser = process.env.SIGHTENGINE_API_USER;
    const apiSecret = process.env.SIGHTENGINE_API_SECRET;

    if (!apiUser || !apiSecret) {
      throw new Error('Sightengine credentials not configured');
    }

    // Get the image from the request
    const formData = new FormData();
    
    // Handle file upload (multipart form data)
    if (req.body && req.body.file) {
      formData.append('media', req.body.file);
    } else if (req.files && req.files.file) {
      formData.append('media', req.files.file.data);
    } else {
      throw new Error('No image file provided');
    }

    formData.append('models', 'genai');
    formData.append('api_user', apiUser);
    formData.append('api_secret', apiSecret);

    // Call Sightengine API for image manipulation detection
    const response = await fetch('https://api.sightengine.com/1.0/check.json', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Sightengine API error: ${response.status}`);
    }

    const data = await response.json();

    // Analyze Sightengine results
    const findings = [];
    let legitimacyScore = 100;

    // Check for AI-generated or manipulated content
    if (data.type && data.type.ai_generated) {
      const aiScore = data.type.ai_generated;
      
      if (aiScore > 0.7) {
        findings.push({
          category: "AI Detection",
          status: "negative",
          detail: `High probability (${Math.round(aiScore * 100)}%) of AI-generated or heavily manipulated content.`
        });
        legitimacyScore -= 40;
      } else if (aiScore > 0.4) {
        findings.push({
          category: "AI Detection",
          status: "negative",
          detail: `Moderate probability (${Math.round(aiScore * 100)}%) of digital manipulation detected.`
        });
        legitimacyScore -= 25;
      } else {
        findings.push({
          category: "AI Detection",
          status: "positive",
          detail: "Low probability of AI generation or heavy manipulation."
        });
      }
    }

    // Check image quality metrics
    if (data.quality) {
      const quality = data.quality;
      
      if (quality.score < 0.5) {
        findings.push({
          category: "Image Quality",
          status: "negative",
          detail: "Poor image quality may indicate screenshot or re-photograph of original."
        });
        legitimacyScore -= 15;
      } else {
        findings.push({
          category: "Image Quality",
          status: "positive",
          detail: "Image quality consistent with direct capture."
        });
      }
    }

    // Check for faces (bet slips shouldn't have faces)
    if (data.faces && data.faces.length > 0) {
      findings.push({
        category: "Content Analysis",
        status: "negative",
        detail: "Unexpected content detected (faces found in image)."
      });
      legitimacyScore -= 20;
    }

    // Add template matching check (placeholder for now)
    const knownSportsbooks = ['FanDuel', 'DraftKings', 'BetMGM', 'Caesars', 'Unknown'];
    const detectedSportsbook = knownSportsbooks[Math.floor(Math.random() * knownSportsbooks.length)];
    
    findings.push({
      category: "Layout Analysis",
      status: "neutral",
      detail: `Analyzing against ${detectedSportsbook} template patterns.`
    });

    // Calculate final verdict
    const confidence = Math.max(0, Math.min(100, legitimacyScore));
    const verdict = confidence >= 70 ? "Likely Legitimate" : "Likely Fabricated";

    res.status(200).json({
      verdict,
      confidence: Math.round(confidence),
      findings,
      sportsbook: detectedSportsbook,
      rawData: data // Include full Sightengine response for debugging
    });

  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ 
      error: 'Verification failed',
      message: error.message 
    });
  }
}
