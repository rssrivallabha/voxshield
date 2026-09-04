export interface LiveAudioMetrics {
  signalLevelDbfs: number; // RMS in dBFS (e.g. -18.4)
  peakDbfs: number; // Peak amplitude in dBFS (e.g. -6.2)
  voiceActivity: 'ACTIVE' | 'SILENT';
  clipping: 'NONE' | 'CLIPPING_DETECTED';
  sampleRate: number; // e.g. 48000
  channels: number; // e.g. 1
  qualityStatus: 'PASS' | 'WARN' | 'DEGRADED' | 'SILENT';
  approxSnrDb: number;
}

export function calculateRealAudioMetrics(
  timeDomainData: Float32Array | Uint8Array,
  sampleRate: number = 48000,
  channels: number = 1
): LiveAudioMetrics {
  let sumSquares = 0;
  let maxAbs = 0;
  const count = timeDomainData.length;

  if (count === 0) {
    return {
      signalLevelDbfs: -100,
      peakDbfs: -100,
      voiceActivity: 'SILENT',
      clipping: 'NONE',
      sampleRate,
      channels,
      qualityStatus: 'SILENT',
      approxSnrDb: 0,
    };
  }

  const isUint8 = timeDomainData instanceof Uint8Array;

  for (let i = 0; i < count; i++) {
    let normalized = 0;
    if (isUint8) {
      // Map 0..255 to -1.0..1.0
      normalized = (timeDomainData[i] - 128) / 128;
    } else {
      normalized = (timeDomainData as Float32Array)[i];
    }

    const absVal = Math.abs(normalized);
    if (absVal > maxAbs) maxAbs = absVal;
    sumSquares += normalized * normalized;
  }

  const rms = Math.sqrt(sumSquares / count);

  // Convert to dBFS (0 dBFS = max digital amplitude 1.0)
  const rmsDbfs = rms > 0.00001 ? Math.max(-96, Math.min(0, 20 * Math.log10(rms))) : -96;
  const peakDbfs = maxAbs > 0.00001 ? Math.max(-96, Math.min(0, 20 * Math.log10(maxAbs))) : -96;

  const isClipping = maxAbs >= 0.98;
  const isVoiceActive = rmsDbfs > -45;

  let qualityStatus: LiveAudioMetrics['qualityStatus'] = 'PASS';
  if (rmsDbfs <= -50) {
    qualityStatus = 'SILENT';
  } else if (isClipping || rmsDbfs > -1) {
    qualityStatus = 'DEGRADED';
  } else if (rmsDbfs < -35) {
    qualityStatus = 'WARN';
  }

  // Estimated Signal-to-Noise Ratio (dB)
  const noiseFloorDbfs = -60;
  const approxSnrDb = Math.max(0, Math.round(rmsDbfs - noiseFloorDbfs));

  return {
    signalLevelDbfs: Number(rmsDbfs.toFixed(1)),
    peakDbfs: Number(peakDbfs.toFixed(1)),
    voiceActivity: isVoiceActive ? 'ACTIVE' : 'SILENT',
    clipping: isClipping ? 'CLIPPING_DETECTED' : 'NONE',
    sampleRate,
    channels,
    qualityStatus,
    approxSnrDb,
  };
}
