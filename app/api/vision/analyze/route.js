import { z } from 'zod';
import { requireUserFromBearer } from '../../../../lib/supabaseServer';
import { limit, keyFor } from '../../../../lib/rateLimit';
import { getIp, logRequest, newRequestId } from '../../../../lib/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Gemini API configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyD0y0WSew3hSqN_CRa3MeJuOz1q8Y5-g5k';
const GEMINI_MODEL = 'gemini-3-flash-preview';

const BodySchema = z.object({
  image: z.string().min(100), // base64 image data
  date_hint: z.string().optional(), // YYYY-MM-DD format
  media_type: z.string().optional(), // e.g., 'image/jpeg'
  timezone: z.string().optional(), // e.g., 'local', 'UTC', '-05:00'
});

const VISION_PROMPT = `You are analyzing a photo of a baby care log. Extract all events you can identify from this handwritten or printed log.

Valid event types (use EXACTLY these names):
- DooDoo: poop/bowel movement
- PeePee: urination/wet diaper
- Diaper: diaper change (use this if it's unclear whether pee or poop)
- YumYum: feeding (breast milk, formula, solid food)
- SleepStart: when baby fell asleep
- SleepEnd: when baby woke up
- Temperature: temperature measurement
- Medicine: medication given
- Puke: spit up or vomiting
- BabyMood: baby's mood/demeanor
- Play: play activity
- Note: any written notes, comments, or observations on the log

For each event you identify, extract:
1. event_type: one of the valid types above (MUST match exactly)
2. occurred_at: date and time as it appears on the log (format: "YYYY-MM-DDTHH:MM:SS" with NO timezone suffix)
3. meta: relevant metadata based on event type (include "notes" field for any written comments)

DATE HANDLING (IMPORTANT):
- If a date is clearly visible in the image (e.g., "1/25", "Jan 25", "2025-01-25"), USE THAT DATE
- Only use the fallback date provided below if NO date is visible in the image
- Always combine visible times (e.g., "8:30") with the correct date
- DO NOT add "Z" or any timezone suffix - just return the local time as written on the paper

Metadata structures by type:
- YumYum: { yum: { kind: "breast"|"bottle"|"formula"|"solid", quantity: "120ml", side: "L"|"R"|"B" }, notes: "optional notes" }
- DooDoo: { doo: { consistency: "normal"|"loose"|"hard", color: "brown/yellow/green" }, notes: "optional notes" }
- PeePee: { pee: { amount: "small"|"medium"|"large" }, notes: "optional notes" }
- SleepStart/SleepEnd: { notes: "optional notes" }
- Temperature: { temp: { value: 98.6, unit: "F" }, notes: "optional notes" }
- Medicine: { medicine: { name: "medication name", dose: "dosage" }, notes: "optional notes" }
- Note: { notes: "the actual note text" }

IMPORTANT:
- Return ONLY a valid JSON array, no other text or markdown
- If you can't identify any events, return an empty array: []
- Use 24-hour time format for timestamps
- DO NOT include "Z" or timezone in occurred_at - just the local time as it appears
- Look for checkmarks, x marks, times written, and notes in columns
- Include ANY written notes or comments in the "notes" field of meta
- For Note events, put the note content in meta.notes

Return format example:
[
  { "event_type": "YumYum", "occurred_at": "2025-01-25T08:30:00", "meta": { "yum": { "kind": "breast", "side": "L" }, "notes": "fed well" } },
  { "event_type": "Note", "occurred_at": "2025-01-25T09:00:00", "meta": { "notes": "Baby was fussy today" } }
]`;

/**
 * Parse a datetime string and apply the specified timezone.
 * ALWAYS strips any timezone from the input since times on paper logs are local times.
 */
function parseWithTimezone(dateStr, timezone) {
  if (!dateStr) return null;

  // Strip any timezone suffix (Z, +XX:XX, -XX:XX) since paper times are local
  // We want to interpret the time as-is in the user's selected timezone
  let normalized = dateStr.trim()
    .replace(/Z$/, '')
    .replace(/[+-]\d{2}:\d{2}$/, '')
    .replace(/[+-]\d{4}$/, '')
    .replace(/\.\d{3}$/, ''); // Also strip milliseconds

  if (timezone === 'UTC') {
    // Interpret the time as UTC
    return new Date(normalized + 'Z');
  } else if (timezone && timezone !== 'local') {
    // Interpret the time in the specified timezone offset (e.g., -08:00)
    return new Date(normalized + timezone);
  } else {
    // Fallback: treat as UTC if no timezone specified
    return new Date(normalized + 'Z');
  }
}

export async function POST(request) {
  const __start = Date.now();
  const __id = newRequestId();
  const __ip = getIp(request);

  // Parse and validate body
  const parsedBody = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(parsedBody);

  if (!parsed.success) {
    const __ms = Date.now() - __start;
    logRequest({ id: __id, route: '/api/vision/analyze', method: 'POST', status: 400, ms: __ms, userId: null, ip: __ip });
    return new Response(JSON.stringify({ error: 'Invalid body', details: parsed.error.flatten() }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  // Authenticate user
  const auth = await requireUserFromBearer(request);
  if (auth.error) {
    const __ms = Date.now() - __start;
    logRequest({ id: __id, route: '/api/vision/analyze', method: 'POST', status: auth.error.status, ms: __ms, userId: null, ip: __ip });
    return new Response(JSON.stringify({ error: auth.error.message }), {
      status: auth.error.status,
      headers: { 'content-type': 'application/json' }
    });
  }

  const { user } = auth;

  // Rate limit check (restrictive for vision API calls)
  const __key = keyFor({ route: '/api/vision/analyze', method: 'POST', userId: user.id, ip: __ip });
  const __rl = limit({ key: __key, windowMs: Number(process.env.RATE_WINDOW_MS) || 60000, max: 5 });
  if (!__rl.ok) {
    const __ms = Date.now() - __start;
    logRequest({ id: __id, route: '/api/vision/analyze', method: 'POST', status: 429, ms: __ms, userId: user.id, ip: __ip });
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: { 'content-type': 'application/json' }
    });
  }

  const { image, date_hint, media_type, timezone } = parsed.data;
  const dateForPrompt = date_hint || new Date().toISOString().slice(0, 10);

  // Detect media type from base64 if not provided
  let detectedMediaType = media_type || 'image/jpeg';
  if (!media_type && image.startsWith('/9j/')) {
    detectedMediaType = 'image/jpeg';
  } else if (!media_type && image.startsWith('iVBOR')) {
    detectedMediaType = 'image/png';
  }

  try {
    // Call Gemini Vision API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `${VISION_PROMPT}\n\nFALLBACK DATE (only use if NO date is visible in the image): ${dateForPrompt}` },
            {
              inlineData: {
                mimeType: detectedMediaType,
                data: image,
              }
            }
          ]
        }]
      }),
    });

    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.json().catch(() => ({}));
      console.error('Gemini API error:', errorData);
      const __ms = Date.now() - __start;
      logRequest({ id: __id, route: '/api/vision/analyze', method: 'POST', status: 502, ms: __ms, userId: user.id, ip: __ip });
      return new Response(JSON.stringify({ error: 'Vision API failed', details: errorData }), {
        status: 502,
        headers: { 'content-type': 'application/json' }
      });
    }

    const geminiData = await geminiResponse.json();
    const textContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

    // Parse the JSON response
    let events = [];
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanedText = textContent.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.slice(7);
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.slice(3);
      }
      if (cleanedText.endsWith('```')) {
        cleanedText = cleanedText.slice(0, -3);
      }
      cleanedText = cleanedText.trim();

      events = JSON.parse(cleanedText);

      // Validate and clean up events
      const validTypes = [
        'DooDoo', 'PeePee', 'Diaper', 'YumYum',
        'SleepStart', 'SleepEnd',
        'Puke', 'Sick', 'Temperature', 'Medicine', 'Doctor',
        'BabyMood', 'MyMood', 'Play', 'Milestone', 'Note',
        'KickMe', 'Contraction', 'Heartbeat',
        'CryCry', 'BlahBlah', 'Measure'
      ];

      events = events.filter(e => {
        if (!e.event_type || !validTypes.includes(e.event_type)) return false;
        if (!e.occurred_at) return false;
        return true;
      }).map(e => {
        // Apply timezone conversion
        const parsedDate = parseWithTimezone(e.occurred_at, timezone);
        if (!parsedDate || isNaN(parsedDate.getTime())) {
          return null;
        }
        return {
          event_type: e.event_type,
          occurred_at: parsedDate.toISOString(),
          meta: e.meta || {},
        };
      }).filter(Boolean);

    } catch (parseErr) {
      console.error('Failed to parse Gemini response:', parseErr, textContent);
      // Return empty array if parsing fails
      events = [];
    }

    const __ms = Date.now() - __start;
    logRequest({ id: __id, route: '/api/vision/analyze', method: 'POST', status: 200, ms: __ms, userId: user.id, ip: __ip });

    return new Response(JSON.stringify({ events, raw_response: textContent }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'X-Request-Id': __id }
    });

  } catch (err) {
    console.error('Vision API error:', err);
    const __ms = Date.now() - __start;
    logRequest({ id: __id, route: '/api/vision/analyze', method: 'POST', status: 500, ms: __ms, userId: user.id, ip: __ip });
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
