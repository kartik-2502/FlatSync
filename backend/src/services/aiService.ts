export interface CompatibilityResult {
  score: number;
  explanation: string;
  method: 'LLM' | 'RULE';
}

export async function calculateCompatibility(
  tenantProfile: { preferredLocation: string; budgetMin: number; budgetMax: number; moveInDate: string },
  listing: { location: string; rent: number; roomType: string; furnishingStatus: string }
): Promise<CompatibilityResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey.trim() !== '' && !apiKey.startsWith('YOUR_GEMINI_')) {
    try {
      console.log(`AI Service: Calling Gemini API for location match '${tenantProfile.preferredLocation}' vs '${listing.location}'`);
      
      const prompt = `Given this room listing: 
Location: ${listing.location}
Rent: ₹${listing.rent}/month
Room Type: ${listing.roomType}
Furnishing: ${listing.furnishingStatus}

and this tenant profile:
Preferred Location: ${tenantProfile.preferredLocation}
Budget Range: ₹${tenantProfile.budgetMin} - ₹${tenantProfile.budgetMax}/month
Move-in Date: ${tenantProfile.moveInDate}

compute a compatibility score from 0 to 100 based on budget and location match. Return JSON: { score: number, explanation: string }`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API returned status ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text) {
        const parsed = JSON.parse(text.trim());
        if (typeof parsed.score === 'number' && typeof parsed.explanation === 'string') {
          return {
            score: Math.min(100, Math.max(0, parsed.score)),
            explanation: parsed.explanation,
            method: 'LLM'
          };
        }
      }
    } catch (error) {
      console.warn('Gemini LLM Call failed, falling back to rule-based logic:', error);
    }
  }

  // Fallback Rule-Based Compatibility Engine
  console.log(`AI Service: Using rule-based fallback for location match '${tenantProfile.preferredLocation}' vs '${listing.location}'`);
  return calculateRuleBasedCompatibility(tenantProfile, listing);
}

function calculateRuleBasedCompatibility(
  tenantProfile: { preferredLocation: string; budgetMin: number; budgetMax: number },
  listing: { location: string; rent: number }
): CompatibilityResult {
  const prefLoc = tenantProfile.preferredLocation.toLowerCase().trim();
  const listLoc = listing.location.toLowerCase().trim();
  
  // 1. Location match calculation (Max 50)
  let locationScore = 0;
  if (prefLoc === listLoc) {
    locationScore = 50;
  } else if (listLoc.includes(prefLoc) || prefLoc.includes(listLoc)) {
    locationScore = 45;
  } else {
    const prefWords = prefLoc.split(/[\s,]+/);
    const listWords = listLoc.split(/[\s,]+/);
    const common = prefWords.filter(w => w.length > 2 && listWords.includes(w));
    if (common.length > 0) {
      locationScore = 40;
    } else {
      locationScore = 15; // baseline / fallback location match
    }
  }

  // 2. Budget match calculation (Max 50)
  const rent = listing.rent;
  const min = tenantProfile.budgetMin;
  const max = tenantProfile.budgetMax;
  let budgetScore = 0;

  if (rent >= min && rent <= max) {
    budgetScore = 50;
  } else if (rent < min) {
    // Cheaper than budget min is mostly good but not perfectly matched to expectations
    const diffPercent = (min - rent) / min;
    budgetScore = Math.max(35, Math.round(50 - diffPercent * 30));
  } else {
    // Rent exceeds tenant max budget
    const diffPercent = (rent - max) / max;
    if (diffPercent <= 0.3) {
      // Scale down linearly for up to 30% over budget
      budgetScore = Math.max(0, Math.round(50 - diffPercent * 166.7));
    } else {
      budgetScore = 0;
    }
  }

  const score = locationScore + budgetScore;
  
  // 3. Generate structured explanation
  let explanation = '';
  if (score >= 80) {
    explanation = `Excellent match! The listing in '${listing.location}' aligns very well with your preferred location ('${tenantProfile.preferredLocation}'). The rent of ₹${listing.rent} fits perfectly within your budget range of ₹${min} - ₹${max}.`;
  } else if (score >= 50) {
    const locMatch = locationScore >= 40 ? 'good location match' : 'moderate location mismatch';
    const budMatch = rent >= min && rent <= max ? 'ideal budget fit' : `rent (₹${listing.rent}) is slightly outside budget range`;
    explanation = `Moderate match. There is a ${locMatch} and a ${budMatch}. Overall, this listing represents a reasonable option to consider.`;
  } else {
    explanation = `Poor match. The listing in '${listing.location}' (Rent: ₹${listing.rent}/mo) has significant discrepancies with your preferred location ('${tenantProfile.preferredLocation}') and budget range (₹${min} - ₹${max}).`;
  }

  return {
    score,
    explanation,
    method: 'RULE'
  };
}
