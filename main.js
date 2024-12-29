import fs from 'fs';
import path from 'path';
import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';
import { config } from './config.js';
import { fileURLToPath } from 'url';
import os from 'os';
import { LumaAI } from 'lumaai';

// Set FFmpeg path
ffmpeg.setFfmpegPath(config.ffmpegPath);

// Replicate __dirname functionality
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//Initialize the Luma AI Client
const lumaClient = new LumaAI({ authToken: config.luma.apiKey });

// Function to get the user's Desktop path
function getDesktopPath() {
  const homeDir = os.homedir();
  const desktopPath = path.join(homeDir, 'Desktop');
  return desktopPath;
}

// Function to poll the status of the image generation
async function pollImageGeneration(generationId) {
  const url = `https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`;
  const maxAttempts = 50;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${config.leonardo.apiKey}` }
      });

      const { status, generated_images } = response.data.generations_by_pk;
      console.log('Image generation status:', status);

      if (status === 'COMPLETE' && generated_images && generated_images.length > 0) {
        return generated_images.map(image => image.url);
      } else if (status === 'FAILED') {
        throw new Error('Image generation failed');
      }

      attempts++;
      await new Promise(resolve => setTimeout(resolve, config.leonardo.pollingInterval));
    } catch (error) {
      throw new Error(`Error polling Leonardo AI API: ${error.message}`);
    }
  }

  throw new Error('Image generation exceeded maximum attempts');
}

// Function to generate an image with Leonardo AI
async function generateImage(prompt) {
  try {
    const response = await axios.post('https://cloud.leonardo.ai/api/rest/v1/generations', {
      modelId: config.leonardo.modelId,
      prompt: prompt,
      width: config.leonardo.imageDimensions.width,
      height: config.leonardo.imageDimensions.height,
    }, {
      headers: {
        'Authorization': `Bearer ${config.leonardo.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const generationId = response.data.sdGenerationJob.generationId;
    console.log('Generated image ID:', generationId);

    return await pollImageGeneration(generationId);

  } catch (error) {
    throw new Error(`Leonardo AI image generation failed: ${error.message}`);
  }
}

// Function to generate a video with Luma AI
async function generateVideo(prompt, imageUrls) {
  try {
    console.log('Generating video with Luma AI using images:', imageUrls);

    // Prepare keyframes from image URLs
    const keyframes = imageUrls.reduce((frames, imageUrl, index) => {
      frames[`frame${index}`] = {
        type: 'image',
        url: imageUrl,
      };
      return frames;
    }, {});

    // Create a video generation request
    const generation = await lumaClient.generations.create({
      prompt: prompt,
      keyframes: keyframes,
      aspect_ratio: '16:9', // Adjust as needed
      loop: false, // Set to true if you want the video to loop
    });

    // Poll for generation status
    let completed = false;
    while (!completed) {
      const status = await lumaClient.generations.get(generation.id);
      if (status.state === 'completed') {
        completed = true;
        console.log('Video generation completed successfully.');
        return status.assets.video;
      } else if (status.state === 'failed') {
        throw new Error(`Video generation failed: ${status.failure_reason}`);
      } else {
        console.log('Video generation in progress...');
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for 3 seconds
      }
    }
  } catch (error) {
    throw new Error(`Luma AI video generation failed: ${error.message}`);
  }
}

// Function to download and save a file from a URL
async function downloadFile(url, outputPath) {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    await fs.promises.writeFile(outputPath, response.data);
    console.log(`File saved to: ${outputPath}`);
  } catch (error) {
    throw new Error(`Failed to download file: ${error.message}`);
  }
}

// Function to add captions and voice-over to a video
async function addCaptionsAndVoiceoverToVideo(inputVideoPath, outputVideoPath, captionsFilePath, voiceoverFilePath) {
  try {
    await new Promise((resolve, reject) => {
      ffmpeg(inputVideoPath)
        .outputOptions('-vf', `subtitles=${captionsFilePath}`)
        .input(voiceoverFilePath)
        .outputOptions('-c:v', 'libx264')
        .outputOptions('-c:a', 'aac')
        .outputOptions('-strict', 'experimental')
        .on('end', () => {
          console.log('Captions and voice-over added successfully');
          resolve();
        })
        .on('error', (err) => {
          console.error(`Error adding captions and voice-over: ${err.message}`);
          reject(err);
        })
        .save(outputVideoPath);
    });
  } catch (error) {
    throw new Error(`Failed to add captions and voice-over: ${error.message}`);
  }
}

// Main function to orchestrate the image and video generation
async function main() {
  try {
    console.log('Starting image generation...');
    const imageUrls = await generateImage(config.prompts.image);
    const imagePaths = imageUrls.map((_, index) => path.join(__dirname, `image_${index + 1}.png`));

    for (let i = 0; i < imageUrls.length; i++) {
      await downloadFile(imageUrls[i], imagePaths[i]);
    }

    console.log('Starting video generation...');
    const videoUrl = await generateVideo(config.prompts.video, imageUrls);
    const videoPath = path.join(__dirname, config.output.videoFileName);
    await downloadFile(videoUrl, videoPath);

    const captionsFilePath = path.join(__dirname, 'captions.srt');
    const voiceoverFilePath = path.join(__dirname, 'voiceover.mp3');
    const videoWithCaptionsAndVoiceoverPath = path.join(__dirname, config.output.videoWithCaptionsAndVoiceoverFileName);
    await addCaptionsAndVoiceoverToVideo(videoPath, videoWithCaptionsAndVoiceoverPath, captionsFilePath, voiceoverFilePath);

    const desktopPath = path.join(process.env.HOME || process.env.USERPROFILE, 'Desktop');
    const finalVideoPath = path.join(desktopPath, config.output.finalVideoFileName);
    await fs.promises.rename(videoWithCaptionsAndVoiceoverPath, finalVideoPath);

    console.log('Generation process completed successfully.');
  } catch (error) {
    console.error('Error in the generation process:', error.message);
  }
}

// Execute the main function
main();