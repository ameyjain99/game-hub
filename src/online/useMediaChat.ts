import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { EVT, type VoiceSignal, type MediaState } from '../net/protocol';

// Public STUN only. Most home/mobile networks connect peer-to-peer with just
// this; players behind strict/symmetric NATs will need a TURN relay added here.
const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

interface Peer {
  pc: RTCPeerConnection;
  /** Hidden element that plays the peer's audio (video tiles render muted). */
  audio: HTMLAudioElement;
  /** Everything we receive from this peer (audio + video), assembled in ontrack. */
  remote: MediaStream;
  /** Senders of the pre-negotiated transceivers; the mic/camera are swapped in
   *  and out of them with replaceTrack, so toggling never renegotiates. */
  audioSender: RTCRtpSender | null;
  videoSender: RTCRtpSender | null;
  pendingIce: RTCIceCandidateInit[];
}

export interface MediaChat {
  ready: boolean;
  error: string | null;
  /** Peer player-ids we currently have a connection to. */
  connectedPeers: string[];
  micMuted: boolean;
  camOff: boolean;
  toggleMic(): Promise<void>;
  toggleCam(): Promise<void>;
  /** Your own mic/camera stream (render muted to avoid echo). */
  localStream: MediaStream | null;
  /** Each connected peer's media stream, by player id. */
  remoteStreams: Map<string, MediaStream>;
  /** Each peer's announced mic/cam state (for showing a silhouette when cam is off). */
  peerMedia: Map<string, MediaState>;
}

interface Options {
  socket: Socket | null;
  code: string | null;
  myId: string | null;
  enabled: boolean;
  /** Whether this game supports video (adds a video transceiver + cam toggle). */
  video?: boolean;
}

/**
 * A WebRTC audio (and optional video) mesh over the game's Socket.IO signaling
 * channel. Each pair of players holds one peer connection; media flows directly
 * between browsers and never through the server. The lexicographically smaller id
 * initiates each offer, avoiding offer/answer glare. A 'media' signal broadcasts
 * each player's mic/cam on-off state so peers can show a silhouette.
 *
 * **Nothing is captured on join** – neither the microphone nor the camera. Each
 * is acquired (and its permission prompt shown) only when the player turns it on,
 * so entering a room never lights up the webcam or opens the mic. Peers pre-add
 * inactive audio/video transceivers at connect time, so toggling a device later
 * is a plain replaceTrack with no renegotiation.
 */
export function useMediaChat({ socket, code, myId, enabled, video = false }: Options): MediaChat {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
  const [micMuted, setMicMuted] = useState(true); // mic starts OFF until the user enables it
  const [camOff, setCamOff] = useState(true); // camera starts OFF until the user enables it
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [peerMedia, setPeerMedia] = useState<Map<string, MediaState>>(new Map());

  const micTrackRef = useRef<MediaStreamTrack | null>(null);
  const camTrackRef = useRef<MediaStreamTrack | null>(null);
  const peersRef = useRef<Map<string, Peer>>(new Map());
  const micOnRef = useRef(false);
  const camOnRef = useRef(false);

  const refreshLocal = () => {
    const tracks = [micTrackRef.current, camTrackRef.current].filter(Boolean) as MediaStreamTrack[];
    setLocalStream(tracks.length ? new MediaStream(tracks) : null);
  };

  useEffect(() => {
    if (!enabled || !socket || !code || !myId) return;
    let cancelled = false;

    const syncPeerList = () => setConnectedPeers([...peersRef.current.keys()]);
    const signal = (to: string | null, kind: VoiceSignal['kind'], data?: unknown) =>
      socket.emit(EVT.voice, { code, from: myId, to, kind, data } satisfies VoiceSignal);
    const announceMedia = (to: string | null) =>
      signal(to, 'media', { micOn: micOnRef.current, camOn: camOnRef.current } satisfies MediaState);

    const closePeer = (id: string) => {
      const peer = peersRef.current.get(id);
      if (!peer) return;
      peer.pc.close();
      peer.audio.srcObject = null;
      peer.audio.remove();
      peersRef.current.delete(id);
      setRemoteStreams((m) => {
        const next = new Map(m);
        next.delete(id);
        return next;
      });
      setPeerMedia((m) => {
        const next = new Map(m);
        next.delete(id);
        return next;
      });
      syncPeerList();
    };

    const makePeer = (id: string): Peer => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      const remote = new MediaStream();
      const audio = document.createElement('audio');
      audio.autoplay = true;
      document.body.appendChild(audio);

      pc.ontrack = (e) => {
        remote.addTrack(e.track);
        audio.srcObject = remote;
        void audio.play().catch(() => undefined);
        setRemoteStreams((m) => new Map(m).set(id, remote));
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) signal(id, 'ice', e.candidate.toJSON());
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') closePeer(id);
      };

      const peer: Peer = { pc, audio, remote, audioSender: null, videoSender: null, pendingIce: [] };
      peersRef.current.set(id, peer);
      syncPeerList();
      return peer;
    };

    const ensurePeer = (id: string): Peer => peersRef.current.get(id) ?? makePeer(id);

    // Grab the audio/video senders (set up by the offerer's addTransceiver or, on
    // the answerer, created by setRemoteDescription) and push whatever mic/cam is
    // already live into them. Keeping transceiver creation on the OFFERER only
    // avoids the answerer sending on an m-line that isn't in the negotiated SDP.
    const attachSenders = (peer: Peer) => {
      for (const tx of peer.pc.getTransceivers()) {
        const kind = tx.receiver.track?.kind;
        if (kind === 'audio' && !peer.audioSender) {
          peer.audioSender = tx.sender;
          // Ensure we offer to send (a transceiver from the remote offer can come
          // up recvonly; replaceTrack alone won't flip it).
          if (tx.direction !== 'sendrecv') tx.direction = 'sendrecv';
          if (micTrackRef.current) void tx.sender.replaceTrack(micTrackRef.current);
        } else if (kind === 'video' && !peer.videoSender) {
          peer.videoSender = tx.sender;
          if (tx.direction !== 'sendrecv') tx.direction = 'sendrecv';
          if (camTrackRef.current) void tx.sender.replaceTrack(camTrackRef.current);
        }
      }
    };

    const drainIce = async (peer: Peer) => {
      for (const c of peer.pendingIce) await peer.pc.addIceCandidate(c).catch(() => undefined);
      peer.pendingIce = [];
    };

    const handle = async (msg: VoiceSignal) => {
      if (msg.from === myId) return;
      if (msg.to !== null && msg.to !== myId) return;
      const from = msg.from;

      switch (msg.kind) {
        case 'hello': {
          if (myId < from) {
            const peer = ensurePeer(from);
            // The offerer defines the m-lines (one audio, one video if supported).
            if (peer.pc.getTransceivers().length === 0) {
              peer.pc.addTransceiver('audio', { direction: 'sendrecv' });
              if (video) peer.pc.addTransceiver('video', { direction: 'sendrecv' });
              attachSenders(peer);
            }
            const offer = await peer.pc.createOffer();
            await peer.pc.setLocalDescription(offer);
            signal(from, 'offer', offer);
          } else if (msg.to === null) {
            signal(from, 'hello');
          }
          announceMedia(from); // let the new peer know our mic/cam state
          break;
        }
        case 'offer': {
          const peer = ensurePeer(from);
          await peer.pc.setRemoteDescription(msg.data as RTCSessionDescriptionInit);
          attachSenders(peer); // transceivers now exist from the remote offer
          await drainIce(peer);
          const answer = await peer.pc.createAnswer();
          await peer.pc.setLocalDescription(answer);
          signal(from, 'answer', answer);
          announceMedia(from);
          break;
        }
        case 'answer': {
          const peer = peersRef.current.get(from);
          if (peer) {
            await peer.pc.setRemoteDescription(msg.data as RTCSessionDescriptionInit);
            await drainIce(peer);
          }
          break;
        }
        case 'ice': {
          const peer = peersRef.current.get(from);
          const cand = msg.data as RTCIceCandidateInit;
          if (peer?.pc.remoteDescription) await peer.pc.addIceCandidate(cand).catch(() => undefined);
          else if (peer) peer.pendingIce.push(cand);
          break;
        }
        case 'media': {
          const ms = msg.data as MediaState;
          setPeerMedia((m) => new Map(m).set(from, ms));
          break;
        }
        case 'bye':
          closePeer(from);
          break;
      }
    };

    const onVoice = (msg: VoiceSignal) => {
      void handle(msg);
    };

    // The mesh connects immediately with no local media; mic/cam are added later.
    socket.on(EVT.voice, onVoice);
    if (!cancelled) {
      micOnRef.current = false;
      camOnRef.current = false;
      setReady(true);
      setError(null);
      signal(null, 'hello');
      announceMedia(null);
    }

    return () => {
      cancelled = true;
      socket.off(EVT.voice, onVoice);
      signal(null, 'bye');
      for (const id of [...peersRef.current.keys()]) closePeer(id);
      micTrackRef.current?.stop();
      camTrackRef.current?.stop();
      micTrackRef.current = null;
      camTrackRef.current = null;
      micOnRef.current = false;
      camOnRef.current = false;
      setReady(false);
      setConnectedPeers([]);
      setLocalStream(null);
      setRemoteStreams(new Map());
      setPeerMedia(new Map());
      setMicMuted(true);
      setCamOff(true);
    };
  }, [enabled, socket, code, myId, video]);

  const broadcastMedia = () => {
    if (socket && code && myId) {
      socket.emit(EVT.voice, {
        code,
        from: myId,
        to: null,
        kind: 'media',
        data: { micOn: micOnRef.current, camOn: camOnRef.current } satisfies MediaState,
      } satisfies VoiceSignal);
    }
  };

  const toggleMic = async () => {
    if (micMuted) {
      // Turn the mic ON – the permission prompt happens here, not on join.
      let track: MediaStreamTrack;
      try {
        const m = await navigator.mediaDevices.getUserMedia({ audio: true });
        track = m.getAudioTracks()[0];
      } catch {
        return; // denied / no mic – stay off
      }
      micTrackRef.current = track;
      for (const peer of peersRef.current.values()) void peer.audioSender?.replaceTrack(track);
      micOnRef.current = true;
      setMicMuted(false);
    } else {
      // Turn the mic OFF – stop the track so the device is fully released.
      for (const peer of peersRef.current.values()) void peer.audioSender?.replaceTrack(null);
      micTrackRef.current?.stop();
      micTrackRef.current = null;
      micOnRef.current = false;
      setMicMuted(true);
    }
    refreshLocal();
    broadcastMedia();
  };

  const toggleCam = async () => {
    if (!video) return;
    if (camOff) {
      // Turn the camera ON – the permission prompt happens here, not on join.
      let track: MediaStreamTrack;
      try {
        const cam = await navigator.mediaDevices.getUserMedia({ video: true });
        track = cam.getVideoTracks()[0];
      } catch {
        return; // denied / no camera – stay off
      }
      camTrackRef.current = track;
      for (const peer of peersRef.current.values()) void peer.videoSender?.replaceTrack(track);
      camOnRef.current = true;
      setCamOff(false);
    } else {
      // Turn the camera OFF – stop the track so the hardware/indicator goes dark.
      for (const peer of peersRef.current.values()) void peer.videoSender?.replaceTrack(null);
      camTrackRef.current?.stop();
      camTrackRef.current = null;
      camOnRef.current = false;
      setCamOff(true);
    }
    refreshLocal();
    broadcastMedia();
  };

  return {
    ready,
    error,
    connectedPeers,
    micMuted,
    camOff,
    toggleMic,
    toggleCam,
    localStream,
    remoteStreams,
    peerMedia,
  };
}
