import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Send, Play, Pause } from 'lucide-react';
import { t, formatCallDuration } from '../i18n';

interface VoiceRecorderProps {
  onSendVoiceNote: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onSendVoiceNote, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    startRecording();
    return () => {
      cleanup();
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Audio Context for Canvas Waveform
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 64;

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      drawWaveform();

      // MediaRecorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        setRecordedBlob(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);

      timerRef.current = window.setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to access microphone for voice note', err);
      alert(t('micPermissionDenied'));
      onCancel();
    }
  };

  const drawWaveform = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 2;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        ctx.fillStyle = '#10b981'; // emerald-500
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
        x += barWidth;
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
  };

  const handleSend = () => {
    stopRecording();
    if (recordedBlob) {
      onSendVoiceNote(recordedBlob, duration);
    } else if (audioChunksRef.current.length > 0) {
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      onSendVoiceNote(blob, duration);
    }
  };

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    if (audioContextRef.current) audioContextRef.current.close();
  };

  const togglePreviewPlay = () => {
    if (!previewAudioRef.current && audioUrl) {
      const audio = new Audio(audioUrl);
      previewAudioRef.current = audio;
      audio.onended = () => setIsPlayingPreview(false);
    }

    if (previewAudioRef.current) {
      if (isPlayingPreview) {
        previewAudioRef.current.pause();
        setIsPlayingPreview(false);
      } else {
        previewAudioRef.current.play();
        setIsPlayingPreview(true);
      }
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 bg-emerald-950 text-white p-3 rounded-2xl border border-emerald-800 shadow-lg animate-fade-in w-full">
      {/* Delete / Cancel Button */}
      <button
        onClick={() => {
          cleanup();
          onCancel();
        }}
        className="p-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 transition"
        title={t('cancel')}
      >
        <Trash2 className="w-5 h-5" />
      </button>

      {/* Recording Waveform & Timer */}
      <div className="flex-1 flex items-center gap-3 bg-emerald-900/60 px-3 py-1.5 rounded-xl border border-emerald-800">
        <div className="flex items-center gap-2 text-emerald-400 font-mono text-sm font-bold min-w-[50px]">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
          {formatCallDuration(duration)}
        </div>

        <canvas ref={canvasRef} width={140} height={28} className="rounded" />
      </div>

      {/* Stop / Preview Controls */}
      {isRecording ? (
        <button
          onClick={stopRecording}
          className="p-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white transition"
          title="إيقاف التسجيل المعاين"
        >
          <Square className="w-5 h-5" />
        </button>
      ) : (
        <button
          onClick={togglePreviewPlay}
          className="p-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white transition"
          title="استماع"
        >
          {isPlayingPreview ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>
      )}

      {/* Send Button */}
      <button
        onClick={handleSend}
        className="p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition flex items-center justify-center"
        title={t('send')}
      >
        <Send className="w-5 h-5" />
      </button>
    </div>
  );
};
