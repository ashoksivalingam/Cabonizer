import { AlgorithmParams } from './types';

export const MAX_FILES = 10;

export const DEFAULT_PARAMS: AlgorithmParams = {
  // Distance in RGB space (0-255) to consider "background".
  // Lower = stricter matching. Higher = wider range of background colors removed.
  // Min: 0 (Strict), Max: 128 (Loose)
  colorTolerance: 15,

  // Multiplier for colorTolerance to determine where the shadow fade ends.
  // Higher = softer, longer shadows. Lower = sharper cutoff.
  // Min: 1 (Sharp), Max: 100 (Very Soft)
  fadeStrength: 50,

  // Pixels to erode from the object edge to remove halos/fringing.
  // Min: 0 (No shave), Max: 50 (Aggressive erosion)
  shavePx: 0,

  // Width in pixels of the soft edge feathering.
  // Warning: High values (>5) can cause a transparent gap between object and shadow.
  // Min: 0 (Hard edge), Max: 100 (Very soft)
  featherWidth: 0,

  // Alpha value (0-255) separating the "solid object" from the "shadow".
  // Pixels above this alpha are treated as object (and feathered). Below are shadow.
  // Min: 1, Max: 254
  objectThreshold: 210,

  // 0.0 to 1.0. Desaturates semi-transparent edges to remove color cast.
  // Min: 0.0 (No desaturation), Max: 1.0 (Black & White edges)
  edgeDesat: 1.0,

  // 0.0 to 1.0. Multiplies brightness of edges.
  // Min: 0.0 (Pitch Black edges), Max: 1.0 (Original brightness)
  edgeDark: 0.0,

  // 0.0 to 1.0. Darkens the RGB channels of transparent pixels.
  // Critical for preventing white halos in shadows (makes the shadow gray/black instead of white-transparent).
  // Min: 0.0 (Pitch black), Max: 1.0 (No darkening)
  globalDarkFactor: 0.0,

  // 1.0 to 3.0. Multiplies the alpha channel to make shadows denser/darker.
  // Simulates duplicating the layer on top of itself.
  // Min: 1.0 (Original), Max: 3.0 (Very Dense)
  alphaBoost: 2.5,

  autoDetectBg: true,
  manualBgColor: [0, 255, 0],
};