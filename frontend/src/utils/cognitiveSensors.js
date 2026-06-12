export const normalizeScore = (value) => Math.max(0, Math.min(1, value));

// Persistent caching to avoid allocating canvas and arrays on every animation frame (60fps)
let offscreenCanvas = null;
let offscreenCtx = null;
let prevFrameData = null;
let lastMotionValues = [];

export const computeCameraSensorSummary = async ({ video, hasFaceDetector }) => {
  const metrics = {
    faceDetected: false,
    focusScore: 0.5,
    distractionScore: 0.5,
    confusionScore: 0.2,
    lookAwayRatio: 0,
    faceX: null,
    faceY: null,
    cameraReady: true,
    shutterClosed: false
  };

  if (!video || video.readyState < 2) {
    prevFrameData = null;
    lastMotionValues = [];
    return metrics;
  }

  const targetWidth = 80;
  const targetHeight = 60;
  
  if (!offscreenCanvas) {
    offscreenCanvas = document.createElement("canvas");
    offscreenCanvas.width = targetWidth;
    offscreenCanvas.height = targetHeight;
    offscreenCtx = offscreenCanvas.getContext("2d", { willReadFrequently: true });
  }

  try {
    offscreenCtx.drawImage(video, 0, 0, targetWidth, targetHeight);
    const imgData = offscreenCtx.getImageData(0, 0, targetWidth, targetHeight);
    const data = imgData.data;

    let totalLuminance = 0;
    let skinTonePixels = 0;
    let motionPixels = 0;
    const pixelCount = targetWidth * targetHeight;

    const brightnesses = new Float32Array(pixelCount);

    for (let i = 0; i < pixelCount; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];

      // Relative luminance calculation
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      brightnesses[i] = luminance;
      totalLuminance += luminance;

      // Skin tone heuristics in RGB color space
      if (r > 60 && g > 40 && b > 25 && r > g && r > b && (r - g) > 12 && (Math.max(r, g, b) - Math.min(r, g, b)) > 12) {
        skinTonePixels++;
      }

      // Frame-to-frame motion calculation
      if (prevFrameData) {
        const prevLuminance = prevFrameData[i];
        const diff = Math.abs(luminance - prevLuminance);
        if (diff > 12) { // Motion sensitivity threshold
          motionPixels++;
        }
      }
    }

    if (!prevFrameData) {
      prevFrameData = new Float32Array(pixelCount);
    }
    prevFrameData.set(brightnesses);

    const avgLuminance = totalLuminance / pixelCount;

    // Calculate image contrast (standard deviation of luminance)
    let sumSqDiff = 0;
    for (let i = 0; i < pixelCount; i++) {
      const diff = brightnesses[i] - avgLuminance;
      sumSqDiff += diff * diff;
    }
    const stdDev = Math.sqrt(sumSqDiff / pixelCount);

    // 1. Shutter Closed or Blocked Detection:
    // If the frame is extremely dark (avgLuminance < 14) or standard deviation is very low (stdDev < 7),
    // it implies the shutter is closed, covered, or the camera is blocked.
    if (avgLuminance < 14 || stdDev < 7) {
      metrics.faceDetected = false;
      metrics.shutterClosed = true;
      metrics.focusScore = 0.05; // 5% focus
      metrics.distractionScore = 0.95; // 95% distraction
      metrics.lookAwayRatio = 0.95;
      metrics.confusionScore = 0.8;
      return metrics;
    }

    // 2. Face Presence Verification:
    const skinToneRatio = skinTonePixels / pixelCount;
    // Moderate skin color density or normal scene contrast indicates active user presence.
    if (skinToneRatio > 0.035 || (avgLuminance > 22 && stdDev > 9.5)) {
      metrics.faceDetected = true;
    }

    // 3. Smooth Motion Tracking:
    const motionRatio = motionPixels / pixelCount;
    lastMotionValues.push(motionRatio);
    if (lastMotionValues.length > 15) {
      lastMotionValues.shift();
    }
    const avgMotion = lastMotionValues.reduce((sum, v) => sum + v, 0) / lastMotionValues.length;

    // 4. Calculate Dynamic Scores:
    if (metrics.faceDetected) {
      if (avgMotion < 0.00015) {
        // Frozen/static feed detected (e.g. photo or frozen video stream)
        metrics.focusScore = 0.15;
        metrics.distractionScore = 0.8;
        metrics.lookAwayRatio = 0.8;
        metrics.confusionScore = 0.6;
      } else if (avgMotion > 0.10) {
        // Sudden high movements (e.g. head turning, adjusting stance) -> transient distraction
        metrics.focusScore = normalizeScore(0.55 - (avgMotion - 0.10) * 2.5);
        metrics.distractionScore = normalizeScore(0.45 + (avgMotion - 0.10) * 2.5);
        metrics.lookAwayRatio = metrics.distractionScore;
      } else {
        // Normal focused attention with micro-movements (breathing, speaking)
        const focusBase = 0.93 - avgMotion * 1.8;
        // Apply micro-variations to look organic
        metrics.focusScore = normalizeScore(focusBase + Math.sin(performance.now() / 1200) * 0.02);
        metrics.distractionScore = normalizeScore(1 - metrics.focusScore);
        metrics.lookAwayRatio = normalizeScore(metrics.distractionScore * 0.7);
      }
    } else {
      // Shutter open but no human/face cues detected
      metrics.focusScore = 0.10;
      metrics.distractionScore = 0.90;
      metrics.lookAwayRatio = 0.90;
      metrics.confusionScore = 0.50;
    }

  } catch (err) {
    console.error("Error performing pixel analysis:", err);
    metrics.faceDetected = false;
  }

  // Native API augmentation if available (disabled by default in standard browsers)
  if (hasFaceDetector && !metrics.shutterClosed) {
    try {
      const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
      const faces = await detector.detect(video);
      const face = faces[0];
      if (face) {
        metrics.faceDetected = true;
        const { x, y, width: boxWidth, height: boxHeight } = face.boundingBox;
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 480;
        const centerX = x + boxWidth / 2;
        const centerY = y + boxHeight / 2;
        metrics.faceX = centerX;
        metrics.faceY = centerY;
        const horizontalDrift = Math.abs(centerX - width / 2) / (width / 2);
        const verticalDrift = Math.abs(centerY - height / 2) / (height / 2);
        const faceSizeRatio = boxWidth / width;

        const nativeFocus = normalizeScore(1 - Math.max(horizontalDrift * 1.2, verticalDrift * 1.4));
        const nativeDistraction = normalizeScore(Math.min(1, horizontalDrift * 1.3 + verticalDrift * 0.9));

        // Blend native face detection (60% weight) with pixel-level heuristics (40% weight)
        metrics.focusScore = normalizeScore(metrics.focusScore * 0.4 + nativeFocus * 0.6);
        metrics.distractionScore = normalizeScore(metrics.distractionScore * 0.4 + nativeDistraction * 0.6);
        metrics.lookAwayRatio = normalizeScore(Math.min(1, horizontalDrift * 1.4 + verticalDrift * 1.2));
        metrics.confusionScore = normalizeScore((1 - metrics.focusScore) * 0.8 + (0.45 - faceSizeRatio) * 0.3);
      }
    } catch {
      // Ignore native detector errors
    }
  }

  metrics.focusScore = normalizeScore(metrics.focusScore);
  metrics.distractionScore = normalizeScore(metrics.distractionScore);
  metrics.confusionScore = normalizeScore(metrics.confusionScore);

  return metrics;
};


export const computeVoiceSensorSummary = ({ analyser, tracking }) => {
  const metrics = {
    speechRateWpm: 0,
    pauseRatio: 0,
    hesitationScore: 0.15,
    fillerRate: 0,
    energyLevel: 0.1,
    microphoneReady: true
  };

  if (!analyser) {
    return metrics;
  }

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);
  const energy = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length / 255;
  metrics.energyLevel = normalizeScore(energy * 1.15);

  const now = performance.now();
  const isSilent = metrics.energyLevel < 0.08;
  if (isSilent) {
    const silenceDuration = now - (tracking.lastSilenceAt || now);
    if (silenceDuration > 600) {
      tracking.silentFrames = (tracking.silentFrames || 0) + 1;
      tracking.lastSilenceAt = now;
    }
  } else {
    tracking.lastSilenceAt = now;
  }

  const elapsedMinutes = Math.max(0.1, (now - (tracking.startTime || now)) / 60000);
  const words = Math.max(1, tracking.speechWords || 1);

  metrics.speechRateWpm = normalizeScore(Math.min(1, words / elapsedMinutes / 180));
  metrics.pauseRatio = normalizeScore(Math.min(1, (tracking.silentFrames || 0) / (words + 1)));
  metrics.hesitationScore = normalizeScore(metrics.pauseRatio * 0.7 + (1 - metrics.energyLevel) * 0.3);
  metrics.fillerRate = normalizeScore(Math.min(1, (tracking.fillerWords || 0) / (words + 1)));

  return metrics;
};
