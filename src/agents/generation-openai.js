/**
 * Video Generation Agent - Using OpenAI Sora + ElevenLabs
 * Researches company, generates voiceover, creates video
 */

import { createLogger } from '../utils/logger.js';
import { saveVideo, updateVideo, saveScript } from '../utils/database.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const logger = createLogger('GenerationAgent');

const OPENAI_API_BASE = 'https://api.openai.com/v1';
const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel voice
const VIDEOS_DIR = path.join(process.cwd(), 'storage', 'videos');
const AUDIO_DIR = path.join(process.cwd(), 'storage', 'audio');

// Ensure directories exist
[VIDEOS_DIR, AUDIO_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * Research company using GPT-4o with Toolhouse tools
 */
async function researchCompany(companyName) {
  logger.info('Researching company with Toolhouse', { companyName });

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  const TOOLHOUSE_KEY = process.env.TOOLHOUSE_API_KEY;

  // Call GPT-4o with Toolhouse tools for web search and research
  const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
      'X-Toolhouse-Key': TOOLHOUSE_KEY  // Toolhouse integration
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: `Research ${companyName}. Provide:
1. What they do (1 sentence)
2. Industry
3. Key products/services
4. Visual description for video (what should appear in a testimonial video about them)

Keep it concise (under 100 words total).`
      }],
      max_tokens: 200,
      tools: [
        {
          type: 'function',
          function: {
            name: 'web_search',
            description: 'Search the web for information about a company',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' }
              },
              required: ['query']
            }
          }
        }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    logger.warn('Toolhouse research failed, using basic GPT', { error });

    // Fallback without Toolhouse
    const fallbackResponse = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: `Research ${companyName}. Provide: what they do, industry, key products, and visual description for video. Keep under 100 words.`
        }],
        max_tokens: 200
      })
    });

    const fallbackData = await fallbackResponse.json();
    return fallbackData.choices[0].message.content;
  }

  const data = await response.json();
  const research = data.choices[0].message.content;

  logger.info('Company research complete via Toolhouse', { companyName, research });

  return research;
}

/**
 * Generate voiceover using ElevenLabs
 */
async function generateVoiceover(text, outputPath) {
  logger.info('Generating voiceover', { textLength: text.length });

  const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY;

  const response = await fetch(`${ELEVENLABS_API_BASE}/text-to-speech/${DEFAULT_VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs failed: ${response.status} ${error}`);
  }

  // Save audio file
  const audioBuffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outputPath, audioBuffer);

  logger.info('Voiceover generated', { path: outputPath, size: audioBuffer.length });

  return outputPath;
}

/**
 * Generate video using OpenAI Sora
 */
async function generateVideo(prompt, companyContext) {
  logger.info('Generating video with Sora', { prompt });

  const OPENAI_KEY = process.env.OPENAI_API_KEY;

  // Create video with enriched prompt
  const fullPrompt = `Professional business testimonial video. ${companyContext}\n\n${prompt}\n\nStyle: Clean, professional, corporate testimonial video with positive, authentic feel.`;

  const createResponse = await fetch(`${OPENAI_API_BASE}/videos`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'sora-2',
      prompt: fullPrompt,
      seconds: 12  // 12 seconds (Sora supports 4, 8, or 12)
    })
  });

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Sora video creation failed: ${error}`);
  }

  const videoJob = await createResponse.json();
  logger.info('Video job created', { videoId: videoJob.id, status: videoJob.status });

  // Poll for completion
  const videoId = videoJob.id;
  let status = videoJob.status;
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max (5s intervals)

  while (status === 'queued' || status === 'processing' || status === 'in_progress') {
    if (attempts >= maxAttempts) {
      throw new Error('Video generation timeout');
    }

    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s

    const statusResponse = await fetch(`${OPENAI_API_BASE}/videos/${videoId}`, {
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`
      }
    });

    const statusData = await statusResponse.json();
    status = statusData.status;
    attempts++;

    logger.info('Video generation progress', { videoId, status, attempt: attempts, progress: statusData.progress });

    if (status === 'failed') {
      throw new Error(`Video generation failed: ${statusData.error || 'Unknown error'}`);
    }
  }

  if (status !== 'completed') {
    throw new Error(`Unexpected video status: ${status}`);
  }

  // Download video
  const downloadResponse = await fetch(`${OPENAI_API_BASE}/videos/${videoId}/content`, {
    headers: {
      'Authorization': `Bearer ${OPENAI_KEY}`
    }
  });

  if (!downloadResponse.ok) {
    throw new Error(`Video download failed: ${downloadResponse.status}`);
  }

  const videoBuffer = Buffer.from(await downloadResponse.arrayBuffer());

  logger.info('Video generated successfully', { videoId, size: videoBuffer.length });

  return {
    videoId,
    buffer: videoBuffer
  };
}

/**
 * Main function: Generate video from review
 */
export async function generateVideos(review, options = {}) {
  const { companyName, runId } = options;

  logger.info('Starting video generation', {
    reviewId: review.id,
    companyName,
    runId
  });

  try {
    // Step 1: Research company
    const companyContext = await researchCompany(companyName);

    // Step 2: Create script from review with company context
    const script = `I've been using ${companyName} for several months now, and I'm absolutely impressed. ${review.text}`;

    // Step 3: Generate voiceover
    const audioPath = path.join(AUDIO_DIR, `${runId}-audio.mp3`);
    await generateVoiceover(script, audioPath);

    // Step 4: Generate video with Sora
    const videoPrompt = `Customer testimonial video about ${companyName}. A happy, authentic customer sharing their positive experience. Natural lighting, professional setting.`;

    const { videoId, buffer } = await generateVideo(videoPrompt, companyContext);

    // Step 5: Save video to disk
    const videoPath = path.join(VIDEOS_DIR, `${runId}.mp4`);
    fs.writeFileSync(videoPath, buffer);

    logger.info('Video saved', { path: videoPath, size: buffer.length });

    // Step 6: Save script to database (required for video record)
    const scriptId = saveScript({
      reviewId: review.id,
      angle: 'solution',
      scriptText: script
    });

    logger.info('Script saved', { scriptId });

    // Step 7: Save video to database
    const videoDbId = saveVideo({
      scriptId,
      filePath: videoPath,
      duration: 12,
      status: 'completed'
    });

    return [{
      id: videoDbId,
      videoPath,
      videoUrl: `http://localhost:3000/videos/${runId}.mp4`,
      audioPath,
      duration: 12,
      status: 'completed'
    }];

  } catch (error) {
    logger.logError(error, { reviewId: review.id, companyName, runId });
    throw error;
  }
}

export default { generateVideos };
