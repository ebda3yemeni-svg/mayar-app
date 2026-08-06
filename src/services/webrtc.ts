import { soundSynth } from './audioSynthesizer';
import { CallType } from '../types';

export interface WebRTCConfig {
  stunServer?: string;
  turnServer?: string;
  turnUsername?: string;
  turnCredential?: string;
}

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];

  private onRemoteStreamCallback?: (stream: MediaStream) => void;
  private onIceCandidateCallback?: (candidate: RTCIceCandidate) => void;
  private onConnectionStateChangeCallback?: (state: RTCPeerConnectionState) => void;

  private isAudioMuted = false;
  private isVideoMuted = false;
  private currentFacingMode: 'user' | 'environment' = 'user';

  constructor(
    private sendSignaling: (type: string, payload: any) => void
  ) {}

  public async initializeCall(
    callType: CallType,
    config?: WebRTCConfig,
    callbacks?: {
      onRemoteStream?: (stream: MediaStream) => void;
      onIceCandidate?: (candidate: RTCIceCandidate) => void;
      onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
    }
  ): Promise<MediaStream | null> {
    if (callbacks) {
      if (callbacks.onRemoteStream) this.onRemoteStreamCallback = callbacks.onRemoteStream;
      if (callbacks.onIceCandidate) this.onIceCandidateCallback = callbacks.onIceCandidate;
      if (callbacks.onConnectionStateChange) this.onConnectionStateChangeCallback = callbacks.onConnectionStateChange;
    }

    // Configure STUN / TURN servers with robust fallbacks
    const iceServers: RTCIceServer[] = [
      { urls: config?.stunServer || 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ];

    if (config?.turnServer && config.turnUsername && config.turnCredential) {
      iceServers.push({
        urls: config.turnServer,
        username: config.turnUsername,
        credential: config.turnCredential,
      });
    }

    this.peerConnection = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 10,
    });
    this.remoteStream = new MediaStream();
    this.pendingCandidates = [];

    // 1. Get user local stream with optimized audio constraints (echo cancellation, noise suppression, auto gain)
    try {
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
      };

      const constraints: MediaStreamConstraints = {
        audio: audioConstraints,
        video:
          callType === 'video'
            ? {
                facingMode: this.currentFacingMode,
                width: { ideal: 1280, max: 1920 },
                height: { ideal: 720, max: 1080 },
                frameRate: { ideal: 30 },
              }
            : false,
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Add local tracks to peer connection
      this.localStream.getTracks().forEach((track) => {
        if (this.peerConnection && this.localStream) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });
    } catch (error) {
      console.warn('Failed to access media devices with optimal constraints, trying standard fallback:', error);
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === 'video' ? { facingMode: this.currentFacingMode } : false,
        });
        this.localStream.getTracks().forEach((track) => {
          if (this.peerConnection && this.localStream) {
            this.peerConnection.addTrack(track, this.localStream);
          }
        });
      } catch (fallbackError) {
        console.error('Failed to get media stream completely:', fallbackError);
      }
    }

    // 2. Event listener for ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        if (this.onIceCandidateCallback) {
          this.onIceCandidateCallback(event.candidate);
        }
        this.sendSignaling('webrtc:ice-candidate', { candidate: event.candidate });
      }
    };

    // 3. Event listener for remote stream tracks
    this.peerConnection.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        if (this.remoteStream) {
          // Prevent duplicate tracks
          if (!this.remoteStream.getTracks().some((t) => t.id === track.id)) {
            this.remoteStream.addTrack(track);
          }
        }
      });
      if (this.onRemoteStreamCallback && this.remoteStream) {
        this.onRemoteStreamCallback(this.remoteStream);
      }
    };

    // 4. Connection state monitoring
    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection) {
        const state = this.peerConnection.connectionState;
        console.log('[WebRTC Connection State]:', state);
        if (this.onConnectionStateChangeCallback) {
          this.onConnectionStateChangeCallback(state);
        }
        if (state === 'connected') {
          soundSynth.playCallConnectedChime();
        } else if (state === 'failed') {
          console.warn('[WebRTC Connection Failed] Attempting ICE restart...');
          this.restartIce();
        } else if (state === 'closed') {
          soundSynth.stopRingtone();
        }
      }
    };

    // 5. ICE connection state monitoring
    this.peerConnection.oniceconnectionstatechange = () => {
      if (this.peerConnection) {
        console.log('[WebRTC ICE Connection State]:', this.peerConnection.iceConnectionState);
        if (this.peerConnection.iceConnectionState === 'failed') {
          this.restartIce();
        }
      }
    };

    return this.localStream;
  }

  // Caller creates Offer SDP
  public async createOffer(): Promise<RTCSessionDescriptionInit | null> {
    if (!this.peerConnection) return null;
    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  // Receiver creates Answer SDP
  public async createAnswer(offerSdp: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> {
    if (!this.peerConnection) return null;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offerSdp));
    await this.flushPendingCandidates();
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  // Receiver sets Remote Answer
  public async handleAnswer(answerSdp: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answerSdp));
    await this.flushPendingCandidates();
  }

  // Add ICE Candidate with buffering until remote description is set
  public async addIceCandidate(candidateInit: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) return;
    if (!this.peerConnection.remoteDescription || !this.peerConnection.remoteDescription.type) {
      this.pendingCandidates.push(candidateInit);
      return;
    }
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidateInit));
    } catch (e) {
      console.warn('Error adding ICE candidate:', e);
    }
  }

  private async flushPendingCandidates(): Promise<void> {
    if (!this.peerConnection) return;
    while (this.pendingCandidates.length > 0) {
      const candidate = this.pendingCandidates.shift();
      if (candidate) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('Error flushing ICE candidate:', e);
        }
      }
    }
  }

  // Restart ICE for network reconnection
  public async restartIce(): Promise<void> {
    if (!this.peerConnection) return;
    try {
      const offer = await this.peerConnection.createOffer({ iceRestart: true });
      await this.peerConnection.setLocalDescription(offer);
      this.sendSignaling('webrtc:offer', { offerSdp: offer });
    } catch (err) {
      console.error('Failed ICE restart:', err);
    }
  }

  // Control audio mute
  public toggleAudio(): boolean {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        this.isAudioMuted = !this.isAudioMuted;
        audioTracks.forEach((track) => {
          track.enabled = !this.isAudioMuted;
        });
      }
    }
    return this.isAudioMuted;
  }

  // Control video enable/disable
  public toggleVideo(): boolean {
    if (this.localStream) {
      const videoTracks = this.localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        this.isVideoMuted = !this.isVideoMuted;
        videoTracks.forEach((track) => {
          track.enabled = !this.isVideoMuted;
        });
      }
    }
    return this.isVideoMuted;
  }

  // Switch camera (front <-> rear)
  public async switchCamera(callType: CallType): Promise<MediaStream | null> {
    if (callType !== 'video') return this.localStream;

    this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';

    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => track.stop());
    }

    try {
      const newVideoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.currentFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      const newVideoTrack = newVideoStream.getVideoTracks()[0];

      if (this.localStream && newVideoTrack) {
        this.localStream.getVideoTracks().forEach((t) => this.localStream?.removeTrack(t));
        this.localStream.addTrack(newVideoTrack);

        // Replace track in peer connection
        if (this.peerConnection) {
          const senders = this.peerConnection.getSenders();
          const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
          if (videoSender) {
            await videoSender.replaceTrack(newVideoTrack);
          }
        }
      }
    } catch (err) {
      console.warn('Could not switch camera:', err);
    }

    return this.localStream;
  }

  // Clean up all WebRTC media tracks and connections
  public endCall(): void {
    soundSynth.playCallEndedChime();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => track.stop());
      this.remoteStream = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.pendingCandidates = [];
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  public getCurrentFacingMode(): 'user' | 'environment' {
    return this.currentFacingMode;
  }
}
