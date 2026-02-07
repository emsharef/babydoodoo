import { z } from 'zod';
import { requireUserFromBearer } from '../../../../lib/supabaseServer';
import { limit, keyFor } from '../../../../lib/rateLimit';
import { getIp, logRequest, newRequestId } from '../../../../lib/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Gemini API configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3-flash-preview';

const BodySchema = z.object({
  image: z.string().min(100), // base64 image data
  date_hint: z.string().optional(), // YYYY-MM-DD format
  media_type: z.string().optional(), // e.g., 'image/jpeg'
  timezone: z.string().optional(), // e.g., 'local', 'UTC', '-05:00'
  translate_notes: z.boolean().optional(), // translate notes to user's language
  translate_language: z.string().optional(), // target language code (e.g., 'en', 'zh')
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

Metadata structures by type (use EXACTLY these field values):
- YumYum: { yum: { kind: "breast"|"bottle"|"formula"|"solid", quantity: 120, side: "left"|"right"|"both" }, notes: "optional notes" }
  (quantity is a NUMBER in ml, no units - e.g., 120 not "120ml")
- DooDoo: { doo: { consistency: "runny"|"normal"|"firm", color: "yellow"|"green"|"brown" }, notes: "optional notes" }
- PeePee: { pee: { amount: "small"|"medium"|"large" }, notes: "optional notes" }
- Diaper: { diaper: { kind: "wet"|"dirty"|"both"|"dry" }, notes: "optional notes" }
- SleepStart/SleepEnd: { sleep: { duration_min: 90 }, notes: "optional notes" }
  (duration_min is a NUMBER in minutes, no units)
- Temperature: { temp: { value: 98.6, unit: "F"|"C" }, notes: "optional notes" }
  (value is a NUMBER, no units - unit is specified separately)
- Medicine: { medicine: { name: "medication name", dose: 5, unit: "mg"|"ml"|"drops", route: "PO"|"Topical"|"Other" }, notes: "optional notes" }
  (dose is a NUMBER, no units - unit is specified separately)
- Puke: { puke: { amount: "small"|"medium"|"large" }, notes: "optional notes" }
- BabyMood: { mood: "😄"|"🙂"|"😐"|"😕"|"😢"|"😡", notes: "optional notes" }
- Play: { play: { kind: "tummy"|"reading"|"walk"|"music"|"bath", duration_min: 10 }, notes: "optional notes" }
  (duration_min is a NUMBER in minutes, no units)
- Note: { notes: "the actual note text" }

NUMERIC FIELDS: quantity, duration_min, dose, value, bpm must be NUMBERS only (e.g., 120), never strings with units (e.g., "120ml").

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
  { "event_type": "YumYum", "occurred_at": "2025-01-25T08:30:00", "meta": { "yum": { "kind": "breast", "side": "left" }, "notes": "fed well" } },
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
  const __rl = limit({ key: __key, windowMs: Number(process.env.RATE_WINDOW_MS) || 60000, max: 20 });
  if (!__rl.ok) {
    const __ms = Date.now() - __start;
    logRequest({ id: __id, route: '/api/vision/analyze', method: 'POST', status: 429, ms: __ms, userId: user.id, ip: __ip });
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: { 'content-type': 'application/json' }
    });
  }

  const { image, date_hint, media_type, timezone, translate_notes, translate_language } = parsed.data;
  const dateForPrompt = date_hint || new Date().toISOString().slice(0, 10);

  // Detect media type from base64 if not provided
  let detectedMediaType = media_type || 'image/jpeg';
  if (!media_type && image.startsWith('/9j/')) {
    detectedMediaType = 'image/jpeg';
  } else if (!media_type && image.startsWith('iVBOR')) {
    detectedMediaType = 'image/png';
  }

  // Build the prompt with optional translation instruction
  let promptText = VISION_PROMPT;
  if (translate_notes) {
    const langNames = { en: 'English', zh: 'Chinese' };
    const targetLang = langNames[translate_language] || 'English';
    promptText += `\n\nTRANSLATION: If any notes or text on the log are written in a language other than ${targetLang}, translate them to ${targetLang} in the "notes" field.`;
  }
  promptText += `\n\nFALLBACK DATE (only use if NO date is visible in the image): ${dateForPrompt}`;

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
            { text: promptText },
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

      // Helper to extract numeric value from strings like "120ml" or "50 oz"
      const toNumber = (val) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
          const num = parseFloat(val.replace(/[^\d.-]/g, ''));
          return isNaN(num) ? null : num;
        }
        return null;
      };

      // Sanitize numeric fields in meta
      const sanitizeMeta = (meta) => {
        if (!meta) return {};
        const cleaned = { ...meta };
        if (cleaned.yum?.quantity != null) {
          cleaned.yum = { ...cleaned.yum, quantity: toNumber(cleaned.yum.quantity) };
        }
        if (cleaned.temp?.value != null) {
          cleaned.temp = { ...cleaned.temp, value: toNumber(cleaned.temp.value) };
        }
        if (cleaned.medicine?.dose != null) {
          cleaned.medicine = { ...cleaned.medicine, dose: toNumber(cleaned.medicine.dose) };
        }
        if (cleaned.play?.duration_min != null) {
          cleaned.play = { ...cleaned.play, duration_min: toNumber(cleaned.play.duration_min) };
        }
        if (cleaned.sleep?.duration_min != null) {
          cleaned.sleep = { ...cleaned.sleep, duration_min: toNumber(cleaned.sleep.duration_min) };
        }
        if (cleaned.heartbeat?.bpm != null) {
          cleaned.heartbeat = { ...cleaned.heartbeat, bpm: toNumber(cleaned.heartbeat.bpm) };
        }
        if (cleaned.contraction?.duration_sec != null) {
          cleaned.contraction = { ...cleaned.contraction, duration_sec: toNumber(cleaned.contraction.duration_sec) };
        }
        if (cleaned.contraction?.intensity != null) {
          cleaned.contraction = { ...cleaned.contraction, intensity: toNumber(cleaned.contraction.intensity) };
        }
        if (cleaned.measure?.inches != null) {
          cleaned.measure = { ...cleaned.measure, inches: toNumber(cleaned.measure.inches) };
        }
        if (cleaned.measure?.lb != null) {
          cleaned.measure = { ...cleaned.measure, lb: toNumber(cleaned.measure.lb) };
        }
        if (cleaned.measure?.oz != null) {
          cleaned.measure = { ...cleaned.measure, oz: toNumber(cleaned.measure.oz) };
        }
        if (cleaned.kick?.count != null) {
          cleaned.kick = { ...cleaned.kick, count: toNumber(cleaned.kick.count) };
        }
        return cleaned;
      };

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
          meta: sanitizeMeta(e.meta),
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
