// config.js
import { config as dotenvConfig } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenvConfig();

// Replicating __dirname functionality
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  leonardo: {
    apiKey: process.env.LEONARDOAI_API_KEY,
    modelId: '1e60896f-3c26-4296-8ecc-53e2afecc132',
    imageDimensions: { height: 512, width: 512 },
    pollingInterval: 10000,
  },
  luma: {
    apiKey: process.env.LUMAAI_API_KEY,
    pollingInterval: 10000,
  },
  prompts: {
    image: "A scene depicting Thanos selecting fruits at a bustling market. The first image shows Thanos examining a ripe apple, his expression thoughtful. The second image captures him choosing a bunch of bananas, smiling slightly. The third image features Thanos inspecting a watermelon, appearing pleased. The fourth image portrays him placing the selected fruits into a basket, content with his choices. Each image should be detailed, showcasing Thanos's distinctive features and the vibrant market surroundings.",
    video: "A short video featuring Thanos at a lively market. The video begins with Thanos thoughtfully examining a ripe apple, then transitions to him selecting a bunch of bananas with a slight smile. Next, it shows him inspecting a watermelon, appearing pleased. Finally, the video concludes with Thanos placing the selected fruits into a basket, content with his choices. The video should capture the essence of each moment, highlighting Thanos's expressions and the dynamic market environment.",
  },
  output: {
    imageFileName: 'generated_image.png',
    videoFileName: 'generated_video.mp4',
    videoWithCaptionsAndVoiceoverFileName: 'generated_video_with_captions_and_voiceover.mp4',
  },
  ffmpegPath: path.resolve(__dirname, 'node_modules', 'ffmpeg-static', 'ffmpeg'),
};
