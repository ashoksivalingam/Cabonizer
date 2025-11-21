import { AlgorithmParams } from '../types';

// Helper to create a simple distance transform (Manhattan/Chamfer approximation)
// Since exact Euclidean EDT is complex to port perfectly without libraries, 
// a two-pass L1/L2 approximation is sufficient for "shaving" pixels in web apps.
const computeDistanceMap = (mask: Uint8Array, width: number, height: number, invert: boolean = false): Float32Array => {
  const size = width * height;
  const dist = new Float32Array(size);
  const INF = 1e6;

  // Initialize
  for (let i = 0; i < size; i++) {
    const val = mask[i];
    // If invert is true, we want distance to nearest 0 (background) from 1 (foreground)
    // If invert is false, we want distance to nearest 0 (non-mask) from 1 (mask)
    
    if (invert) {
      // Distance transform of (1 - mask)
      // If pixel is 0 (background), dist is 0. If 1 (object), dist is INF initially.
      dist[i] = val === 0 ? 0 : INF;
    } else {
      // Distance transform of mask
      // If pixel is 1 (object), dist is INF. If 0 (background), dist is 0. 
      dist[i] = val === 1 ? 0 : INF;
    }
  }

  // Pass 1: Top-Left to Bottom-Right
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (dist[idx] > 0) {
        const up = (y > 0) ? dist[(y - 1) * width + x] : INF;
        const left = (x > 0) ? dist[y * width + (x - 1)] : INF;
        dist[idx] = Math.min(dist[idx], up + 1, left + 1);
      }
    }
  }

  // Pass 2: Bottom-Right to Top-Left
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const idx = y * width + x;
      if (dist[idx] > 0) {
        const down = (y < height - 1) ? dist[(y + 1) * width + x] : INF;
        const right = (x < width - 1) ? dist[y * width + (x + 1)] : INF;
        dist[idx] = Math.min(dist[idx], down + 1, right + 1);
      }
    }
  }

  return dist;
};

export const processImage = async (
  file: File, 
  params: AlgorithmParams
): Promise<{ originalUrl: string; processedUrl: string; width: number; height: number }> => {
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const w = img.width;
      const h = img.height;
      canvas.width = w;
      canvas.height = h;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }
      
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data; // RGBA flat array
      
      // --- 1. Detect Background Color ---
      let keyR: number, keyG: number, keyB: number;
      
      if (params.autoDetectBg) {
        const corners = [
          [0, 0], 
          [w - 1, 0], 
          [0, h - 1], 
          [w - 1, h - 1]
        ];
        
        let sumR = 0, sumG = 0, sumB = 0;
        corners.forEach(([cx, cy]) => {
          const idx = (cy * w + cx) * 4;
          sumR += data[idx];
          sumG += data[idx + 1];
          sumB += data[idx + 2];
        });
        keyR = sumR / 4;
        keyG = sumG / 4;
        keyB = sumB / 4;
      } else {
        [keyR, keyG, keyB] = params.manualBgColor;
      }

      // --- 2. RAW Alpha (Shadow-friendly) ---
      const size = w * h;
      const alphaRaw = new Uint8Array(size); // Equivalent to alpha_raw
      const origR = new Float32Array(size);
      const origG = new Float32Array(size);
      const origB = new Float32Array(size);
      
      for (let i = 0; i < size; i++) {
        const idx = i * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        
        origR[i] = r;
        origG[i] = g;
        origB[i] = b;
      }

      let maxDist = 0;
      const dists = new Float32Array(size);
      for (let i = 0; i < size; i++) {
        const idx = i * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const d = Math.sqrt((r - keyR) ** 2 + (g - keyG) ** 2 + (b - keyB) ** 2);
        dists[i] = d;
        if (d > maxDist) maxDist = d;
      }
      
      const distMaxDiv = maxDist + 1e-6;
      const opaqueDistNorm = params.colorTolerance / 255.0;
      const clearDistNorm = (params.colorTolerance * params.fadeStrength) / 255.0;

      for (let i = 0; i < size; i++) {
        const distNorm = dists[i] / distMaxDiv;
        
        if (distNorm <= opaqueDistNorm) {
          alphaRaw[i] = 0;
        } else if (distNorm > clearDistNorm) {
          alphaRaw[i] = 255;
        } else {
          // mask_fade
          const fade = (distNorm - opaqueDistNorm) / (clearDistNorm - opaqueDistNorm);
          alphaRaw[i] = Math.floor(255 * fade);
        }
      }

      // --- 3. Identify Object vs Shadows ---
      const objectMask = new Uint8Array(size);
      const shadowMask = new Uint8Array(size); // 0 or 1
      
      for (let i = 0; i < size; i++) {
        if (alphaRaw[i] >= params.objectThreshold) objectMask[i] = 1;
        if (alphaRaw[i] > 0 && alphaRaw[i] < params.objectThreshold) shadowMask[i] = 1;
      }

      // --- 4. Shave (Erosion) ---
      let shavedObj = new Uint8Array(size);
      if (params.shavePx > 0) {
        // Standard Shave: Shrink the object mask.
        const distInside = computeDistanceMap(objectMask, w, h, true);
        
        for(let i=0; i<size; i++) {
           shavedObj[i] = distInside[i] > params.shavePx ? 1 : 0;
        }
      } else {
        shavedObj.set(objectMask);
      }

      // --- 5. Feather ---
      // Only run feathering if width > 0, otherwise it's just hard mask
      let objectFeather = new Float32Array(size);
      
      if (params.featherWidth > 0) {
        const distFeather = computeDistanceMap(shavedObj, w, h, true);
        for(let i=0; i<size; i++) {
          let val = distFeather[i] / params.featherWidth;
          if (val > 1) val = 1;
          if (val < 0) val = 0;
          objectFeather[i] = val;
        }
      } else {
        // If 0 feather width, just use shaved object as full opacity mask for the object part
        for(let i=0; i<size; i++) {
            objectFeather[i] = shavedObj[i] === 1 ? 1.0 : 0.0;
        }
      }

      // --- 6. Final Assembly ---
      const alpha = new Uint8Array(alphaRaw);
      const boost = params.alphaBoost || 1.0;
      
      for(let i=0; i<size; i++) {
        let finalA = 0;

        if (shavedObj[i] === 1) {
          // Inside object
          finalA = alphaRaw[i] * objectFeather[i];
        } else {
            // Outside object (Background or Shadow)
            if (shadowMask[i] === 1) {
                // Keep shadow alpha
                finalA = alphaRaw[i];
            } else {
                // Background
                finalA = 0;
            }
        }

        // Apply Alpha Boost (Denser shadows)
        // Simulate "merging duplicate layers" by multiplying alpha
        if (finalA > 0) {
            finalA = Math.min(255, finalA * boost);
        }

        alpha[i] = finalA;
      }

      // --- 7. Edge Desaturation ---
      const finalR = new Float32Array(size);
      const finalG = new Float32Array(size);
      const finalB = new Float32Array(size);
      
      for(let i=0; i<size; i++) {
        let r = origR[i];
        let g = origG[i];
        let b = origB[i];
        const a = alpha[i];
        
        if (a > 0 && a < 255) {
          const gray = 0.2989*r + 0.5870*g + 0.1140*b;
          r = (r * (1 - params.edgeDesat) + gray * params.edgeDesat) * params.edgeDark;
          g = (g * (1 - params.edgeDesat) + gray * params.edgeDesat) * params.edgeDark;
          b = (b * (1 - params.edgeDesat) + gray * params.edgeDesat) * params.edgeDark;
        }
        
        // Clip
        finalR[i] = Math.min(255, Math.max(0, r));
        finalG[i] = Math.min(255, Math.max(0, g));
        finalB[i] = Math.min(255, Math.max(0, b));
      }

      // --- 8. Output Final Shadow-Preserved PNG ---
      const outputData = ctx.createImageData(w, h);
      const outD = outputData.data;
      
      for(let i=0; i<size; i++) {
        const idx = i * 4;
        
        // Use original RGB but darkened globally
        const origGray = 0.2989 * origR[i] + 0.5870 * origG[i] + 0.1140 * origB[i];
        const darkGray = Math.min(255, Math.max(0, origGray * params.globalDarkFactor));
        
        outD[idx] = darkGray;
        outD[idx + 1] = darkGray;
        outD[idx + 2] = darkGray;
        outD[idx + 3] = alpha[i];
      }
      
      // Draw back to canvas to get blob
      ctx.putImageData(outputData, 0, 0);
      
      const processedUrl = canvas.toDataURL('image/png');
      resolve({
        originalUrl: url,
        processedUrl: processedUrl,
        width: w,
        height: h
      });
    };
    
    img.onerror = (err) => reject(err);
    img.src = url;
  });
};