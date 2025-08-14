// =================================================================
// ENHANCED VERSION 17.0 - IMPROVED SCRIPT, VOICES & SUBTITLES
// =================================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const fsp = require('fs').promises;
const os = require('os');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { OpenAI } = require('openai');
const ffmpeg = require('fluent-ffmpeg');

// --- FFmpeg Configuration ---
try {
    const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
    ffmpeg.setFfmpegPath(ffmpegPath);
    console.log("✅ FFmpeg is configured correctly.");
} catch (e) {
    console.error("❌ CRITICAL ERROR: Could not find FFmpeg.");
    process.exit(1);
}

const app = express();
const port = 3001;
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- API Keys & AI Model Initialization ---
const googleApiKey = process.env.GOOGLE_API_KEY;
const pexelsApiKey = process.env.PEXELS_API_KEY;
const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

const genAI = new GoogleGenerativeAI(googleApiKey);
const googleModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
let openai;
if (openaiApiKey) {
    openai = new OpenAI({ apiKey: openaiApiKey });
    console.log("✅ OpenAI (Backup AI) is configured.");
}

// --- VOICE MAPPING FOR DIFFERENT PRODUCTS ---
const VOICE_MAPPING = {
    // Male voices
    'tech': 'EXAVITQu4vr4xnSDxMaL', // Antoni
    'gadgets': 'pNInz6obpgDQGcFmaJgB', // Adam
    'electronics': 'VR6AewLTigWG4xSOukaG', // Richard
    'automotive': 'nPczCjzI2devNBz1zQrb', // Brian
    'sports': 'EXAVITQu4vr4xnSDxMaL', // Antoni
    
    // Female voices
    'beauty': '21m00Tcm4TlvDq8ikWAM', // Rachel
    'skincare': '21m00Tcm4TlvDq8ikWAM', // Rachel
    'fashion': 'LcfcDJNUP1GQjkzn1xUU', // Emily
    'clothing': 'LcfcDJNUP1GQjkzn1xUU', // Emily
    'jewelry': '21m00Tcm4TlvDq8ikWAM', // Rachel
    'food': 'LcfcDJNUP1GQjkzn1xUU', // Emily
    'snacks': 'LcfcDJNUP1GQjkzn1xUU', // Emily
    'health': '21m00Tcm4TlvDq8ikWAM', // Rachel
    'fitness': 'LcfcDJNUP1GQjkzn1xUU', // Emily
    'home': 'LcfcDJNUP1GQjkzn1xUU', // Emily
    'kitchen': '21m00Tcm4TlvDq8ikWAM', // Rachel
    'default': '21m00Tcm4TlvDq8ikWAM' // Rachel as default
};

// --- UNIVERSAL AI FUNCTION WITH FALLBACK ---
async function generateAiContent(prompt, useGoogleFirst = true) {
    if (useGoogleFirst) {
        try {
            const result = await googleModel.generateContent(prompt);
            return result.response.text();
        } catch (googleError) {
            console.warn(`[AI] ⚠️ Google failed: ${googleError.message}. Trying OpenAI...`);
        }
    }

    if (openai) {
        try {
            const response = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: prompt }],
            });
            return response.choices[0].message.content;
        } catch (openaiError) {
            console.error(`[AI] ❌ OpenAI (Backup) also failed: ${openaiError.message}`);
            throw openaiError;
        }
    }
    
    throw new Error("All AI providers failed or are not configured.");
}

// --- HELPER FUNCTIONS ---
function getVoiceForProduct(productName) {
    const product = productName.toLowerCase();
    
    // Check each category
    for (const [category, voiceId] of Object.entries(VOICE_MAPPING)) {
        if (product.includes(category)) {
            return voiceId;
        }
    }
    
    return VOICE_MAPPING.default;
}

async function getPexelsVideoForLine(visualDescription) {
    if (!pexelsApiKey) throw new Error("Pexels API Key is missing.");
    try {
        const res = await axios.get(`https://api.pexels.com/videos/search`, {
            headers: { Authorization: pexelsApiKey }, 
            params: { 
                query: `${visualDescription} aesthetic`, 
                per_page: 10, 
                orientation: 'portrait',
                min_duration: 10,
                max_duration: 30
            }
        });
        if (res.data.videos && res.data.videos.length > 0) {
            // Find HD quality video
            const video = res.data.videos.find(v => v.duration >= 10 && v.duration <= 30);
            if (video) {
                return video.video_files.find(f => f.quality === 'hd' && f.link)?.link;
            }
        }
        return null;
    } catch (error) { 
        console.error(`[PEXELS] ❌ Search failed for "${visualDescription}":`, error.message); 
        return null; 
    }
}

async function generateVoice(text, language, voiceId, timestamp) {
    try {
        console.log(`[VOICEOVER] 🎤 Generating voice with ID: ${voiceId} in ${language}...`);
        const response = await axios.post(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, 
            { 
                text, 
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: 0.75,
                    similarity_boost: 0.75,
                    style: 0.5,
                    use_speaker_boost: true
                }
            }, 
            { 
                headers: { 
                    'Accept': 'audio/mpeg', 
                    'xi-api-key': elevenLabsApiKey 
                }, 
                responseType: 'arraybuffer' 
            }
        );
        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, `voice-${timestamp}.mp3`);
        await fsp.writeFile(tempFilePath, response.data);
        console.log(`[VOICEOVER] ✅ Audio saved locally.`);
        return tempFilePath;
    } catch (error) { 
        throw new Error("Failed to create voiceover: " + (error.response?.data?.detail?.message || error.message)); 
    }
}

// Enhanced script generation based on mood and product
async function generateEnhancedScript(productName, mood, language) {
    let moodPrompts = {
        'exciting': 'Create an EXCITING, energetic TikTok script that builds hype and urgency',
        'trendy': 'Create a TRENDY, cool TikTok script using current slang and viral phrases',
        'informative': 'Create an INFORMATIVE TikTok script that educates while entertaining',
        'funny': 'Create a FUNNY, humorous TikTok script with jokes and playful language',
        'emotional': 'Create an EMOTIONAL TikTok script that connects with feelings and experiences',
        'mysterious': 'Create a MYSTERIOUS, intriguing TikTok script that builds curiosity',
        'luxurious': 'Create a LUXURIOUS, premium TikTok script that emphasizes quality and exclusivity',
        'relatable': 'Create a RELATABLE TikTok script that feels like talking to a best friend'
    };

    const moodDirection = moodPrompts[mood.toLowerCase()] || moodPrompts['exciting'];
    
    const scriptPrompt = `${moodDirection} about "${productName}".

REQUIREMENTS:
- Exactly 4 short lines (each line 6-12 words max)
- Perfect for 15-30 second TikTok video
- Must mention the product naturally
- Use ${mood} tone throughout
- Include call-to-action in last line
- Make it engaging and viral-worthy

Format: Return ONLY the 4 lines, each starting with "LINE:"

Example format:
LINE: [Hook that grabs attention]
LINE: [Product benefit/feature]
LINE: [Social proof/emotion]
LINE: [Call to action]`;

    console.log('[AI] 📝 Generating enhanced script...');
    const script = await generateAiContent(scriptPrompt);
    return script;
}

async function createVideoWithSubtitles(videoUrls, textOverlays, voiceAudioPath, customMusicPath, includeSubtitles, timestamp) {
    return new Promise(async (resolve, reject) => {
        console.log(`[FFMPEG] 🎬 Creating ${includeSubtitles ? 'video with subtitles' : 'video without text'}`);
        const tempDir = os.tmpdir();
        const outputFilename = `final-video-${timestamp}.mp4`;
        const publicDir = path.join(__dirname, 'public');
        const videosDir = path.join(publicDir, 'videos');
        if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });
        const outputPath = path.join(videosDir, outputFilename);

        let downloadedFiles = [];
        try {
            // Download and prepare videos
            console.log('[FFMPEG] 📥 Downloading video assets...');
            for (let i = 0; i < videoUrls.length; i++) {
                const response = await axios({ url: videoUrls[i], responseType: 'arraybuffer' });
                const inputPath = path.join(tempDir, `input-${i}.mp4`);
                await fsp.writeFile(inputPath, response.data);
                downloadedFiles.push(inputPath);
            }

            const ffmpegCommand = ffmpeg();
            
            // Add inputs
            downloadedFiles.forEach(file => ffmpegCommand.input(file));
            if (voiceAudioPath) ffmpegCommand.input(voiceAudioPath);
            if (customMusicPath) ffmpegCommand.input(customMusicPath);

            const complexFilter = [];
            
            // Scale and prepare video segments (each 5-8 seconds for total 20-30 seconds)
            const segmentDuration = Math.min(8, 25 / downloadedFiles.length); // Ensure total doesn't exceed 30 seconds
            
            for (let i = 0; i < downloadedFiles.length; i++) {
                complexFilter.push(`[${i}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,trim=duration=${segmentDuration}[v${i}base]`);
                
                if (includeSubtitles && textOverlays[i]) {
                    // Add text overlay with modern TikTok style
                    const text = textOverlays[i].replace(/'/g, "\\'").replace(/"/g, '\\"');
                    complexFilter.push(`[v${i}base]drawtext=text='${text}':fontfile=/System/Library/Fonts/Arial.ttf:fontsize=60:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h-200:enable='between(t,${i * segmentDuration},${(i + 1) * segmentDuration})'[v${i}]`);
                } else {
                    complexFilter.push(`[v${i}base]copy[v${i}]`);
                }
            }
            
            // Concatenate videos
            complexFilter.push(`${Array.from({ length: downloadedFiles.length }, (_, i) => `[v${i}]`).join('')}concat=n=${downloadedFiles.length}:v=1:a=0[outv]`);

            // Handle audio
            let audioIndex = downloadedFiles.length;
            let outputOptions = ['-map', '[outv]'];
            
            if (voiceAudioPath && customMusicPath) {
                // Mix voice and music with proper levels
                complexFilter.push(`[${audioIndex}:a]volume=1.0,atrim=duration=30[voice];[${audioIndex + 1}:a]volume=0.2,atrim=duration=30[music];[voice][music]amix=inputs=2:duration=shortest[outa]`);
                outputOptions.push('-map', '[outa]');
            } else if (voiceAudioPath) {
                complexFilter.push(`[${audioIndex}:a]volume=1.0,atrim=duration=30[outa]`);
                outputOptions.push('-map', '[outa]');
            } else if (customMusicPath) {
                complexFilter.push(`[${audioIndex}:a]volume=0.3,atrim=duration=30[outa]`);
                outputOptions.push('-map', '[outa]');
            }

            outputOptions.push(
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '23',
                '-c:a', 'aac',
                '-b:a', '192k',
                '-t', '30', // Maximum 30 seconds
                '-movflags', '+faststart'
            );
            
            ffmpegCommand
                .complexFilter(complexFilter.join(';'))
                .outputOptions(outputOptions)
                .on('start', (cmd) => {
                    console.log('[FFMPEG] 🔥 Processing started...');
                })
                .on('progress', (progress) => {
                    if (progress.percent) {
                        console.log(`[FFMPEG] Progress: ${Math.round(progress.percent)}%`);
                    }
                })
                .on('end', async () => {
                    console.log(`[FFMPEG] ✅ Video created successfully!`);
                    // Cleanup
                    for (const file of downloadedFiles) {
                        await fsp.unlink(file).catch(() => {});
                    }
                    if (voiceAudioPath) {
                        await fsp.unlink(voiceAudioPath).catch(() => {});
                    }
                    resolve(`/videos/${outputFilename}`);
                })
                .on('error', (err, stdout, stderr) => {
                    console.error('[FFMPEG] ❌ Error:', err.message);
                    reject(err);
                })
                .save(outputPath);
                
        } catch (error) {
            console.error('[FFMPEG] ❌ Setup error:', error.message);
            reject(error);
        }
    });
}

// --- MAIN API ENDPOINT ---
app.post('/api/generate', async (req, res) => {
    const { productName, productUrl, mood, language, audioOption, includeSubtitles = false } = req.body;
    const timestamp = Date.now();
    console.log(`\n\n--- [${timestamp}] 🚀 ENHANCED VIDEO JOB STARTED ---`);
    
    const finalProductName = productName || productUrl || 'Amazing Product';
    
    try {
        // Step 1: Generate Enhanced Script
        console.log('[AI] 📝 Generating mood-based script...');
        const fullScript = await generateEnhancedScript(finalProductName, mood, language);
        console.log('[AI] ✅ Enhanced script generated!');

        const textOverlays = fullScript.split('\n')
            .filter(line => line.startsWith('LINE:'))
            .map(line => line.replace('LINE:', '').trim())
            .slice(0, 4); // Exactly 4 lines for 15-30 second video

        if (textOverlays.length < 3) {
            throw new Error("AI failed to generate proper script format.");
        }

               // Step 2: Find matching videos for each script line
        console.log('[PEXELS] 🎬 Finding product-specific videos...');
        const videoUrls = [];
        
        for (let i = 0; i < textOverlays.length; i++) {
            const line = textOverlays[i];
            console.log(`[PEXELS] Processing line ${i+1}: "${line}"`);
            
            // Generate visual keywords for this specific line
            const visualPrompt = `Generate 3-4 keywords for Pexels video search that visually represent this product script line: "${line}" for "${finalProductName}". Only keywords, no explanation.`;
            
            const visualDescription = (await generateAiContent(visualPrompt)).trim();
            console.log(`[PEXELS] 🔍 Searching for: "${visualDescription}"`);
            
            // Try multiple search strategies
            let videoUrl = await getPexelsVideoForLine(visualDescription) || 
                          await getPexelsVideoForLine(`${finalProductName} ${mood}`) ||
                          await getPexelsVideoForLine(`${finalProductName} product`) ||
                          await getPexelsVideoForLine(`${mood} lifestyle aesthetic`);
            
            if (videoUrl) {
                videoUrls.push(videoUrl);
                console.log(`[PEXELS] ✅ Found video for line ${i+1}`);
            } else {
                console.warn(`[PEXELS] ⚠️ No video found for line ${i+1}, will use fallback`);
            }
        }

        // Ensure we have at least 3 videos
        if (videoUrls.length < 3) {
            console.log('[PEXELS] 🔄 Adding fallback videos...');
            const fallbackSearches = [
                `${finalProductName} unboxing`,
                `${mood} product showcase`,
                `lifestyle ${mood}`,
                `modern aesthetic`,
                `trending product`
            ];
            
            for (const search of fallbackSearches) {
                if (videoUrls.length >= 4) break;
                const fallbackVideo = await getPexelsVideoForLine(search);
                if (fallbackVideo && !videoUrls.includes(fallbackVideo)) {
                    videoUrls.push(fallbackVideo);
                    console.log(`[PEXELS] ✅ Added fallback video: ${search}`);
                }
            }
        }

        if (videoUrls.length === 0) {
            throw new Error("Could not find any suitable videos for the product.");
        }

        console.log(`[PEXELS] ✅ Total videos found: ${videoUrls.length}`);

        // Step 3: Audio Generation
        let voiceAudioPath = null;
        let customMusicPath = null;
        
        // Select appropriate voice based on product category
        const selectedVoiceId = getVoiceForProduct(finalProductName);
        console.log(`[VOICE] 🎯 Selected voice ID for "${finalProductName}": ${selectedVoiceId}`);
        
        // Handle background music
        if (audioOption.includes('music')) {
            const musicDir = path.join(__dirname, 'public', 'music');
            if (fs.existsSync(musicDir)) {
                const musicFiles = fs.readdirSync(musicDir).filter(f => 
                    f.endsWith('.wav') || f.endsWith('.mp3') || f.endsWith('.m4a')
                );
                if (musicFiles.length > 0) {
                    const randomMusic = musicFiles[Math.floor(Math.random() * musicFiles.length)];
                    customMusicPath = path.join(musicDir, randomMusic);
                    console.log(`[MUSIC] 🎵 Selected: ${randomMusic}`);
                } else {
                    console.warn('[MUSIC] ⚠️ No music files found in /public/music directory');
                }
            } else {
                console.warn('[MUSIC] ⚠️ Music directory not found');
            }
        }
        
        // Handle voiceover generation
        if (audioOption.includes('voice')) {
            const voiceScript = textOverlays.join('. ') + '.';
            console.log(`[VOICE] 🎤 Generating voiceover: "${voiceScript.substring(0, 100)}..."`);
            voiceAudioPath = await generateVoice(voiceScript, language, selectedVoiceId, timestamp);
        }

        // Step 4: Create Final Video
        console.log('[VIDEO] 🎬 Starting TikTok video creation...');
        const finalVideoUrl = await createVideoWithSubtitles(
            videoUrls.slice(0, 4), // Use max 4 videos
            textOverlays.slice(0, 4), // Use max 4 text overlays
            voiceAudioPath,
            customMusicPath,
            includeSubtitles,
            timestamp
        );
        
        console.log(`\n--- [${timestamp}] ✅✅✅ TIKTOK VIDEO GENERATED SUCCESSFULLY! ✅✅✅`);
        console.log(`Video URL: http://localhost:3001${finalVideoUrl}`);
        console.log(`Duration: ~25 seconds (TikTok optimized)`);
        console.log(`Quality: HD 1080x1920 (9:16 ratio)`);
        console.log(`Audio: ${audioOption}`);
        console.log(`Subtitles: ${includeSubtitles ? 'Enabled' : 'Disabled'}`);
        
        res.json({ 
            success: true,
            videoUrl: `http://localhost:3001${finalVideoUrl}`, 
            script: fullScript,
            scriptLines: textOverlays,
            metadata: {
                duration: '~25 seconds',
                format: 'TikTok Ready (9:16)',
                quality: 'HD 1080x1920',
                voice: selectedVoiceId,
                mood: mood,
                subtitles: includeSubtitles
            }
        });
        
    } catch (error) {
        console.error(`\n--- [${timestamp}] ❌ VIDEO GENERATION FAILED ---`);
        console.error('Error Details:', error.message);
        
        // Enhanced error handling
        let errorMessage = "Video generation failed: ";
        if (error.message.includes('Pexels')) {
            errorMessage += "Could not find suitable videos. Try a different product or mood.";
        } else if (error.message.includes('ElevenLabs') || error.message.includes('voiceover')) {
            errorMessage += "Voice generation failed. Check ElevenLabs API key and quota.";
        } else if (error.message.includes('AI') || error.message.includes('script')) {
            errorMessage += "Script generation failed. Try again with different parameters.";
        } else if (error.message.includes('FFmpeg')) {
            errorMessage += "Video processing failed. Check FFmpeg installation.";
        } else {
            errorMessage += error.message;
        }
        
        res.status(500).json({ 
            success: false,
            message: errorMessage,
            error: error.message,
            timestamp: timestamp
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        services: {
            ffmpeg: '✅ Ready',
            ai: googleApiKey ? '✅ Google AI Ready' : '❌ No AI Key',
            pexels: pexelsApiKey ? '✅ Pexels Ready' : '❌ No Pexels Key',
            elevenlabs: elevenLabsApiKey ? '✅ ElevenLabs Ready' : '❌ No Voice Key'
        }
    });
});

// Start server
app.listen(port, () => {
    console.log(`\n🚀 TikTok Video Generator Server Running!`);
    console.log(`📍 URL: http://localhost:${port}`);
    console.log(`🎬 Ready to create viral TikTok videos!`);
    console.log(`\n📋 Available Services:`);
    console.log(`   ✅ AI Script Generation (Google + OpenAI backup)`);
    console.log(`   ✅ Professional Voice Generation (ElevenLabs)`);
    console.log(`   ✅ HD Video Search (Pexels)`);
    console.log(`   ✅ TikTok-optimized Video Creation (FFmpeg)`);
    console.log(`   ✅ Subtitle Support`);
    console.log(`   ✅ Background Music Integration`);
    console.log(`\n⏳ Waiting for requests...`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down TikTok Video Generator...');
    process.exit(0);
});