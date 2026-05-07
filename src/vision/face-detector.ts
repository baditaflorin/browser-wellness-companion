/**
 * Face Mesh Detector — wraps MediaPipe Face Landmarker
 * Uses @mediapipe/tasks-vision for face landmark detection
 */

import { FaceLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';

export interface FaceDetection {
  landmarks: Array<Array<{ x: number; y: number; z: number }>>;
  box: { x: number; y: number; width: number; height: number } | null;
}

export class FaceMeshDetector {
  private faceLandmarker: FaceLandmarker | null = null;
  private lastTimestamp = -1;

  async initialize(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    });
  }

  async detect(video: HTMLVideoElement): Promise<FaceDetection | null> {
    if (!this.faceLandmarker) return null;

    const timestamp = performance.now();
    // MediaPipe requires strictly increasing timestamps
    if (timestamp <= this.lastTimestamp) return null;
    this.lastTimestamp = timestamp;

    try {
      const result = this.faceLandmarker.detectForVideo(video, timestamp);

      if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
        return null;
      }

      // Convert normalized landmarks to an array of {x, y, z}
      const landmarks = result.faceLandmarks.map(face =>
        face.map(lm => ({
          x: lm.x,
          y: lm.y,
          z: lm.z,
        }))
      );

      // Compute bounding box from landmarks (in pixel coordinates)
      const firstFace = result.faceLandmarks[0];
      let minX = 1, minY = 1, maxX = 0, maxY = 0;
      for (const lm of firstFace) {
        if (lm.x < minX) minX = lm.x;
        if (lm.y < minY) minY = lm.y;
        if (lm.x > maxX) maxX = lm.x;
        if (lm.y > maxY) maxY = lm.y;
      }

      const box = {
        x: minX * video.videoWidth,
        y: minY * video.videoHeight,
        width: (maxX - minX) * video.videoWidth,
        height: (maxY - minY) * video.videoHeight,
      };

      return { landmarks, box };
    } catch (e) {
      // Can happen during rapid tab switching
      console.warn('Face detection error:', e);
      return null;
    }
  }

  close(): void {
    this.faceLandmarker?.close();
    this.faceLandmarker = null;
  }
}
