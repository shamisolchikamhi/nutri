function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function resizeImageDataUrl(dataUrl: string, maxSize = 1024) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("Could not process image"));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => reject(new Error("Could not load image"));
    image.src = dataUrl;
  });
}

async function extractVideoFrames(file: File) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not load video"));
      video.src = url;
    });
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
    const latest = Math.max(0, duration - 0.05);
    const timestamps = [0.08, 0.22, 0.38, 0.55, 0.72, 0.9].map((point) => Math.min(latest, duration * point));
    const frames: string[] = [];
    for (const time of timestamps) {
      await new Promise<void>((resolve, reject) => {
        video.onseeked = () => resolve();
        video.onerror = () => reject(new Error("Could not read video frame"));
        video.currentTime = time;
      });
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1024 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) continue;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.82));
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function processRecipeMediaFiles(files: FileList | null) {
  if (!files) return [];
  const frames: string[] = [];
  for (const file of Array.from(files).slice(0, 4)) {
    if (file.type.startsWith("image/")) frames.push(await resizeImageDataUrl(await readFileAsDataUrl(file)));
    else if (file.type.startsWith("video/")) frames.push(...await extractVideoFrames(file));
  }
  return frames.slice(0, 8);
}
