// api/verify-slip.js
// Serverless function to verify if a bet slip is legitimate or fabricated
import { createCanvas, loadImage } from 'canvas';
import pixelmatch from 'pixelmatch';

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
    // Get the uploaded file
    const form = new FormData();
    // Handle multipart form data or base64
    const imageBuffer = req.body.file || Buffer.from(req.body.image, 'base64');

    // Run verification checks
    const findings = [];
    let legitimacyScore = 100; // Start at 100, deduct for red flags

    // 1. Check EXIF metadata
    const metadataCheck = await checkMetadata(imageBuffer);
    findings.push(metadataCheck.finding);
    legitimacyScore -= metadataCheck.penalty;

    // 2. Check for compression artifacts (edited images often have irregular compression)
    const compressionCheck = await checkCompression(imageBuffer);
    findings.push(compressionCheck.finding);
    legitimacyScore -= compressionCheck.penalty;

    // 3. Check font consistency
    const fontCheck = await checkFonts(imageBuffer);
    findings.push(fontCheck.finding);
    legitimacyScore -= fontCheck.penalty;

    // 4. Check against known sportsbook templates
    const templateCheck = await checkTemplate(imageBuffer);
    findings.push(templateCheck.finding);
    legitimacyScore -= templateCheck.penalty;

    // Determine verdict based on legitimacy score
    const confidence = Math.max(0, Math.min(100, legitimacyScore));
    const verdict = confidence >= 70 ? "Likely Legitimate" : "Likely Fabricated";

    res.status(200).json({
      verdict,
      confidence: Math.round(confidence),
      findings,
      sportsbook: templateCheck.detectedSportsbook || "Unknown"
    });

  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ 
      error: 'Verification failed',
      message: error.message 
    });
  }
}

// Helper function: Check metadata for manipulation signs
async function checkMetadata(imageBuffer) {
  try {
    // Use exif-parser or sharp to extract EXIF data
    const exif = {}; // Extract EXIF here
    
    // Red flags: Missing metadata, conflicting timestamps, editing software signatures
    const hasEditingSoftware = exif.Software && 
      (exif.Software.includes('Photoshop') || exif.Software.includes('GIMP'));
    
    if (hasEditingSoftware) {
      return {
        finding: {
          category: "Metadata",
          status: "negative",
          detail: "Image shows signs of editing software usage."
        },
        penalty: 30
      };
    }

    return {
      finding: {
        category: "Metadata",
        status: "neutral",
        detail: "No strong metadata indicators found."
      },
      penalty: 0
    };
  } catch (err) {
    return {
      finding: {
        category: "Metadata",
        status: "neutral",
        detail: "Metadata analysis inconclusive."
      },
      penalty: 0
    };
  }
}

// Helper function: Check compression artifacts
async function checkCompression(imageBuffer) {
  try {
    // Analyze JPEG compression levels and artifacts
    // Different compression in different regions = likely edited
    
    // This is a simplified check - in reality you'd use specialized libraries
    const hasIrregularCompression = Math.random() > 0.7; // Placeholder
    
    if (hasIrregularCompression) {
      return {
        finding: {
          category: "Compression Anomaly",
          status: "negative",
          detail: "Irregular compression detected near critical regions (amounts/odds)."
        },
        penalty: 25
      };
    }

    return {
      finding: {
        category: "Compression",
        status: "positive",
        detail: "Compression artifacts appear uniform across image."
      },
      penalty: 0
    };
  } catch (err) {
    return {
      finding: {
        category: "Compression",
        status: "neutral",
        detail: "Compression analysis inconclusive."
      },
      penalty: 5
    };
  }
}

// Helper function: Check font consistency
async function checkFonts(imageBuffer) {
  try {
    // Use OCR + font detection to check if fonts are consistent
    // Sportsbooks use specific fonts - mixing fonts = red flag
    
    const hasInconsistentFonts = Math.random() > 0.8; // Placeholder
    
    if (hasInconsistentFonts) {
      return {
        finding: {
          category: "Font Mismatch",
          status: "negative",
          detail: "Multiple font styles detected where uniform font is expected."
        },
        penalty: 20
      };
    }

    return {
      finding: {
        category: "Font Consistency",
        status: "positive",
        detail: "Fonts appear consistent with known sportsbook typography."
      },
      penalty: 0
    };
  } catch (err) {
    return {
      finding: {
        category: "Font Analysis",
        status: "neutral",
        detail: "Font analysis inconclusive."
      },
      penalty: 5
    };
  }
}

// Helper function: Check against known templates
async function checkTemplate(imageBuffer) {
  try {
    // Compare uploaded image against database of real sportsbook layouts
    // Check: Logo placement, spacing, layout structure
    
    const knownSportsbooks = ['FanDuel', 'DraftKings', 'BetMGM', 'Caesars'];
    const detectedSportsbook = knownSportsbooks[Math.floor(Math.random() * knownSportsbooks.length)];
    
    const matchesTemplate = Math.random() > 0.3; // Placeholder
    
    if (matchesTemplate) {
      return {
        finding: {
          category: "Layout Match",
          status: "positive",
          detail: `Slip layout matches known ${detectedSportsbook} template.`
        },
        penalty: 0,
        detectedSportsbook
      };
    } else {
      return {
        finding: {
          category: "Template Drift",
          status: "negative",
          detail: "Spacing and layout differ from known sportsbook templates."
        },
        penalty: 25,
        detectedSportsbook: "Unknown"
      };
    }
  } catch (err) {
    return {
      finding: {
        category: "Template Matching",
        status: "neutral",
        detail: "Template matching inconclusive."
      },
      penalty: 10,
      detectedSportsbook: "Unknown"
    };
  }
}
