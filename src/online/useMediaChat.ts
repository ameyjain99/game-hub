import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { EVT, type VoiceSignal, type MediaState } from '../net/protocol';

// Public STUN only. Most home/mobile networks connect peer-to-peer with just
// this; players behind strict/symmetric NATs will need a TURN relay added here.
const ICE_SERVERS: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

/** A connection 'disconnected' this long gets an ICE restart (most blips heal sooner on their own). */
const RESTART_AFTER_MS = 3_000;
/** A new or restarted connection that still isn't up after this is rebuilt from scratch. */
const REBUILD_AFTER_MS = 15_000;
/** Rebuilds in a row before a pair is given up on (until either side reconnects). */
const MAX_REBUILDS = 3;

/** Small tiles need little video: a low, capped bitrate keeps every camera
 *  moving, and leaves room for audio, when a table of cameras shares one uplink. */
const CAMERA: MediaTrackConstraints = { width: { ideal: 480 }, height: { ideal: 360 }, frameRate: { ideal: 20, max: 24 } };
const VIDEO_MAX_BITRATE = 250_000;

// Voices first. Each link is checked every few seconds; when it can't carry
// video (heavy loss, a long round trip, almost no spare bitrate) the camera is
// paused towards that one peer so the audio stays clear, and brought back once
// the link has been healthy for a while.
const LINK_CHECK_MS = 3_000;
const WEAK_CHECKS = 2; // weak this many checks in a row: pause video
const GOOD_CHECKS = 4; // then healthy this many in a row: bring it back
const HOLD_MIN_MS = 20_000;
const WEAK_LOSS = 0.15;
const WEAK_RTT_S = 0.9;
const WEAK_BITRATE = 90_000;

/** Whether a peer connection's stats say the link is too weak for video. */
export function linkIsWeak(stats: Iterable<Record<string, unknown>>): boolean {
  for (const r of stats) {
    if (r.type === 'remote-inbound-rtp') {
      if (typeof r.fractionLost === 'number' && r.fractionLost > WEAK_LOSS) return true;
      if (typeof r.roundTripTime === 'number' && r.roundTripTime > WEAK_RTT_S) return true;
    }
    if (r.type === 'candidate-pair' && r.nominated && r.state === 'succeeded') {
      if (typeof r.availableOutgoingBitrate === 'number' && r.availableOutgoingBitrate < WEAK_BITRATE) return true;
      if (typeof r.currentRoundTripTime === 'number' && r.currentRoundTripTime > WEAK_RTT_S) return true;
    }
  }
  return false;
}

function capVideo(sender: RTCRtpSender | null): void {
  try {
    const params = sender?.getParameters();
    if (!sender || !params?.encodings?.length) return;
    params.encodings[0].maxBitrate = VIDEO_MAX_BITRATE;
    void sender.setParameters(params).catch(() => undefined);
  } catch {
    // an older browser without sender parameters: the camera constraints still apply
  }
}

/** How a peer's connection is doing, for its video tile. */
type PeerStatus = 'connecting' | 'live' | 'reconnecting' | 'failed';

interface Peer {
  pc: RTCPeerConnection;
  /** Names this connection: signals for an older one between the same pair are dropped. */
  sid: string;
  /** Whether this side made the offer (and so is the one that restarts ICE). */
  offerer: boolean;
  /** Hidden element that plays the peer's audio (video tiles render muted). */
  audio: HTMLAudioElement;
  /** Everything we receive from this peer (audio + video), assembled in ontrack. */
  remote: MediaStream;
  /** Senders of the pre-negotiated transceivers; the mic/camera are swapped in
   *  and out of them with replaceTrack, so toggling never renegotiates. */
  audioSender: RTCRtpSender | null;
  videoSender: RTCRtpSender | null;
  pendingIce: RTCIceCandidateInit[];
  /** Whether an ICE restart has been tried since this connection was last up. */
  restarted: boolean;
  /** The pending recovery step (restart, then rebuild). */
  timer: ReturnType<typeof setTimeout> | null;
  /** Our camera is paused towards this peer because the link is weak (voices first). */
  videoHeld: boolean;
  heldAt: number;
  /** Link checks in a row that came back weak (while sending) or healthy (while held). */
  streak: number;
}

/** An offer or answer, tagged with the connection it belongs to. */
interface SdpSignal {
  sdp: RTCSessionDescriptionInit;
  sid: string;
  /** An ICE restart on an existing connection, not a new one. */
  restart?: boolean;
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
  /** How each peer's connection is doing (a tile says when it is reconnecting). */
  peerStatus: Map<string, PeerStatus>;
  /** Peers our own camera is paused towards, to keep the voices clear on a weak link. */
  heldPeers: string[];
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
 * **Nothing is captured on join** - neither the microphone nor the camera. Each
 * is acquired (and its permission prompt shown) only when the player turns it on,
 * so entering a room never lights up the webcam or opens the mic. Peers pre-add
 * inactive audio/video transceivers at connect time, so toggling a device later
 * is a plain replaceTrack with no renegotiation.
 *
 * **Connections heal.** Media runs browser to browser, so a blip on the game's
 * socket leaves a call alone. A connection that stalls first gets an ICE
 * restart (same connection, new network path); if that fails the pair is
 * rebuilt. After its socket reconnects, a player tells the room which peers it
 * still holds ('sync'), so a pair only one side lost starts over.
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
  const [peerStatus, setPeerStatus] = useState<Map<string, PeerStatus>>(new Map());
  const [heldPeers, setHeldPeers] = useState<string[]>([]);

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
    const announceMedia = (to: string | null) => {
      const held = (id: string) => !!peersRef.current.get(id)?.videoHeld;
      signal(to, 'media', { micOn: micOnRef.current, camOn: camOnRef.current, videoHeld: to !== null && held(to) } satisfies MediaState);
      // A broadcast can't carry what differs per peer: those hear it one by one.
      if (to === null) for (const id of peersRef.current.keys()) if (held(id)) announceMedia(id);
    };
    const syncHeld = () => setHeldPeers([...peersRef.current].filter(([, p]) => p.videoHeld).map(([id]) => id));

    /** Pause or bring back our camera towards one peer (the mic is never touched). */
    const holdVideo = (id: string, peer: Peer, hold: boolean) => {
      peer.videoHeld = hold;
      peer.heldAt = Date.now();
      peer.streak = 0;
      void peer.videoSender?.replaceTrack(hold ? null : camTrackRef.current).then(() => !hold && capVideo(peer.videoSender));
      announceMedia(id);
      syncHeld();
    };

    const checkLinks = async () => {
      for (const [id, peer] of [...peersRef.current]) {
        if (!camTrackRef.current) {
          if (peer.videoHeld) holdVideo(id, peer, false); // camera is off: nothing to hold
          continue;
        }
        if (!peer.videoSender || peer.pc.connectionState !== 'connected') continue;
        let weak: boolean;
        try {
          const report = await peer.pc.getStats();
          const rows: Record<string, unknown>[] = [];
          report.forEach((r: Record<string, unknown>) => rows.push(r));
          weak = linkIsWeak(rows);
        } catch {
          continue;
        }
        if (peersRef.current.get(id) !== peer) continue;
        if (!peer.videoHeld) {
          peer.streak = weak ? peer.streak + 1 : 0;
          if (peer.streak >= WEAK_CHECKS) holdVideo(id, peer, true);
        } else {
          peer.streak = weak ? 0 : peer.streak + 1;
          if (peer.streak >= GOOD_CHECKS && Date.now() - peer.heldAt >= HOLD_MIN_MS) holdVideo(id, peer, false);
        }
      }
    };
    const linkTimer = setInterval(() => void checkLinks(), LINK_CHECK_MS);

    const setStatus = (id: string, status: PeerStatus) =>
      setPeerStatus((m) => (m.get(id) === status ? m : new Map(m).set(id, status)));
    /** Rebuilds in a row per peer, so a pair that can't connect isn't retried for ever. */
    const rebuilds = new Map<string, number>();

    /** Drop the connection to a peer. `rebuilding` keeps what the tile shows
     *  (their camera state, the last frame) while a new connection comes up. */
    const closePeer = (id: string, rebuilding = false) => {
      const peer = peersRef.current.get(id);
      if (peer) {
        if (peer.timer) clearTimeout(peer.timer);
        peer.pc.onconnectionstatechange = null;
        peer.pc.close();
        peer.audio.srcObject = null;
        peer.audio.remove();
        peersRef.current.delete(id);
      }
      if (rebuilding) return;
      rebuilds.delete(id);
      syncHeld();
      const without = <V,>(m: Map<string, V>) => {
        if (!m.has(id)) return m;
        const next = new Map(m);
        next.delete(id);
        return next;
      };
      setRemoteStreams(without);
      setPeerMedia(without);
      setPeerStatus(without);
      syncPeerList();
    };

    const makePeer = (id: string, sid: string, offerer: boolean): Peer => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      const remote = new MediaStream();
      const audio = document.createElement('audio');
      audio.autoplay = true;
      document.body.appendChild(audio);

      const peer: Peer = { pc, sid, offerer, audio, remote, audioSender: null, videoSender: null, pendingIce: [], restarted: false, timer: null, videoHeld: false, heldAt: 0, streak: 0 };

      pc.ontrack = (e) => {
        remote.addTrack(e.track);
        audio.srcObject = remote;
        void audio.play().catch(() => undefined);
        setRemoteStreams((m) => new Map(m).set(id, remote));
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) signal(id, 'ice', { cand: e.candidate.toJSON(), sid });
      };
      pc.onconnectionstatechange = () => {
        if (peersRef.current.get(id) !== peer) return;
        const state = pc.connectionState;
        if (state === 'connected') {
          if (peer.timer) clearTimeout(peer.timer);
          peer.timer = null;
          peer.restarted = false;
          rebuilds.delete(id);
          setStatus(id, 'live');
          capVideo(peer.videoSender);
          void audio.play().catch(() => undefined);
        } else if (state === 'disconnected') {
          // Usually a blip that heals by itself: only step in if it lasts.
          setStatus(id, 'reconnecting');
          if (peer.timer) clearTimeout(peer.timer);
          peer.timer = setTimeout(() => recover(id, peer), RESTART_AFTER_MS);
        } else if (state === 'failed') {
          setStatus(id, 'reconnecting');
          recover(id, peer);
        }
      };

      peersRef.current.set(id, peer);
      setStatus(id, rebuilds.has(id) ? 'reconnecting' : 'connecting');
      // A connection that never comes up (a lost offer, no route) is retried.
      peer.restarted = true;
      peer.timer = setTimeout(() => recover(id, peer), REBUILD_AFTER_MS);
      syncPeerList();
      return peer;
    };

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

    /** Open a brand new connection to a peer (this side makes the offer). */
    const offerTo = async (id: string) => {
      const peer = makePeer(id, Math.random().toString(36).slice(2), true);
      // The offerer defines the m-lines (one audio, one video if supported).
      peer.pc.addTransceiver('audio', { direction: 'sendrecv' });
      if (video) peer.pc.addTransceiver('video', { direction: 'sendrecv' });
      attachSenders(peer);
      const offer = await peer.pc.createOffer();
      await peer.pc.setLocalDescription(offer);
      signal(id, 'offer', { sdp: offer, sid: peer.sid } satisfies SdpSignal);
    };

    /** Start a pair over. The smaller id always makes the offer, so the larger asks for one. */
    const startOver = (id: string) => {
      closePeer(id, true);
      if (myId < id) void offerTo(id).catch(() => undefined);
      else signal(id, 'hello');
    };

    /** Same connection, fresh network path: what gets a call through a changed or flaky network. */
    const restartIce = async (id: string, peer: Peer) => {
      try {
        const offer = await peer.pc.createOffer({ iceRestart: true });
        await peer.pc.setLocalDescription(offer);
        signal(id, 'offer', { sdp: offer, sid: peer.sid, restart: true } satisfies SdpSignal);
      } catch {
        startOver(id);
      }
    };

    /** A connection is down: first an ICE restart, then (if that didn't bring
     *  it back) a rebuild. Waits for the socket, which carries the handshake. */
    function recover(id: string, peer: Peer): void {
      if (peersRef.current.get(id) !== peer || peer.pc.connectionState === 'connected') return;
      if (peer.timer) clearTimeout(peer.timer);
      peer.timer = null;
      if (!socket!.connected) return; // picked up again when the socket reconnects
      if (!peer.restarted) {
        peer.restarted = true;
        if (peer.offerer) void restartIce(id, peer);
        else signal(id, 'restart', { sid: peer.sid });
        peer.timer = setTimeout(() => recover(id, peer), REBUILD_AFTER_MS);
        return;
      }
      const tries = (rebuilds.get(id) ?? 0) + 1;
      rebuilds.set(id, tries);
      if (tries > MAX_REBUILDS) {
        setStatus(id, 'failed'); // no route between these two networks
        return;
      }
      startOver(id);
    }

    const handle = async (msg: VoiceSignal) => {
      if (msg.from === myId) return;
      if (msg.to !== null && msg.to !== myId) return;
      const from = msg.from;

      switch (msg.kind) {
        case 'hello': {
          // They hold no connection to us (just arrived, reloaded, or gave up
          // on the old one): whatever we hold for them is stale.
          closePeer(from, true);
          rebuilds.delete(from);
          if (myId < from) await offerTo(from);
          else if (msg.to === null) signal(from, 'hello');
          announceMedia(from); // let the new peer know our mic/cam state
          break;
        }
        case 'offer': {
          const d = msg.data as SdpSignal;
          let peer = peersRef.current.get(from);
          if (peer && peer.sid !== d.sid) {
            closePeer(from, true); // they started a new connection: ours is the old one
            peer = undefined;
          }
          if (!peer) {
            if (d.restart) {
              signal(from, 'hello'); // we no longer hold that connection: start over
              break;
            }
            peer = makePeer(from, d.sid, false);
          }
          await peer.pc.setRemoteDescription(d.sdp);
          attachSenders(peer); // transceivers now exist from the remote offer
          await drainIce(peer);
          const answer = await peer.pc.createAnswer();
          await peer.pc.setLocalDescription(answer);
          signal(from, 'answer', { sdp: answer, sid: peer.sid } satisfies SdpSignal);
          announceMedia(from);
          break;
        }
        case 'answer': {
          const d = msg.data as SdpSignal;
          const peer = peersRef.current.get(from);
          if (peer && peer.sid === d.sid) {
            await peer.pc.setRemoteDescription(d.sdp);
            await drainIce(peer);
          }
          break;
        }
        case 'ice': {
          const d = msg.data as { cand: RTCIceCandidateInit; sid: string };
          const peer = peersRef.current.get(from);
          if (!peer || peer.sid !== d.sid) break;
          if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(d.cand).catch(() => undefined);
          else peer.pendingIce.push(d.cand);
          break;
        }
        case 'restart': {
          const peer = peersRef.current.get(from);
          if (peer?.offerer && peer.sid === (msg.data as { sid: string }).sid) void restartIce(from, peer);
          else startOver(from);
          break;
        }
        case 'sync': {
          // Their socket dropped and is back. If both sides still hold the pair
          // the call never stopped; if either lost it, start over.
          const have = (msg.data as { have: string[] }).have;
          const peer = peersRef.current.get(from);
          if (peer && have.includes(myId)) {
            announceMedia(from);
            if (peer.pc.connectionState === 'failed' || peer.pc.connectionState === 'disconnected') recover(from, peer);
          } else {
            rebuilds.delete(from);
            startOver(from);
          }
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
      void handle(msg).catch(() => undefined);
    };
    // Our own socket came back: say who we still hold, and pick up any
    // recovery that was waiting for it.
    const onReconnect = () => {
      signal(null, 'sync', { have: [...peersRef.current.keys()] });
      announceMedia(null);
      for (const [id, peer] of [...peersRef.current]) {
        const state = peer.pc.connectionState;
        if (state === 'failed' || state === 'disconnected') {
          rebuilds.delete(id);
          recover(id, peer);
        }
      }
    };

    // The mesh connects immediately with no local media; mic/cam are added later.
    socket.on(EVT.voice, onVoice);
    socket.on('connect', onReconnect);
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
      clearInterval(linkTimer);
      socket.off(EVT.voice, onVoice);
      socket.off('connect', onReconnect);
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
      setPeerStatus(new Map());
      setHeldPeers([]);
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

  /** A change at the camera starts every link afresh: nothing is held. */
  const releaseHolds = () => {
    for (const peer of peersRef.current.values()) {
      peer.videoHeld = false;
      peer.streak = 0;
    }
    setHeldPeers([]);
  };

  const micOff = () => {
    // Stop the track so the device is fully released.
    for (const peer of peersRef.current.values()) void peer.audioSender?.replaceTrack(null);
    if (micTrackRef.current) micTrackRef.current.onended = null;
    micTrackRef.current?.stop();
    micTrackRef.current = null;
    micOnRef.current = false;
    setMicMuted(true);
    refreshLocal();
    broadcastMedia();
  };

  const camOffNow = () => {
    // Stop the track so the hardware/indicator goes dark.
    for (const peer of peersRef.current.values()) void peer.videoSender?.replaceTrack(null);
    if (camTrackRef.current) camTrackRef.current.onended = null;
    camTrackRef.current?.stop();
    camTrackRef.current = null;
    camOnRef.current = false;
    setCamOff(true);
    releaseHolds();
    refreshLocal();
    broadcastMedia();
  };

  const toggleMic = async () => {
    if (!micMuted) return micOff();
    // Turn the mic ON - the permission prompt happens here, not on join.
    let track: MediaStreamTrack;
    try {
      const m = await navigator.mediaDevices.getUserMedia({ audio: true });
      track = m.getAudioTracks()[0];
    } catch {
      return; // denied / no mic - stay off
    }
    track.onended = micOff; // unplugged, or taken by the system: show it as off
    micTrackRef.current = track;
    for (const peer of peersRef.current.values()) void peer.audioSender?.replaceTrack(track);
    micOnRef.current = true;
    setMicMuted(false);
    refreshLocal();
    broadcastMedia();
  };

  const toggleCam = async () => {
    if (!video) return;
    if (!camOff) return camOffNow();
    // Turn the camera ON - the permission prompt happens here, not on join.
    let track: MediaStreamTrack;
    try {
      const cam = await navigator.mediaDevices.getUserMedia({ video: CAMERA });
      track = cam.getVideoTracks()[0];
    } catch {
      return; // denied / no camera - stay off
    }
    track.onended = camOffNow;
    camTrackRef.current = track;
    for (const peer of peersRef.current.values()) {
      void peer.videoSender?.replaceTrack(track).then(() => capVideo(peer.videoSender));
    }
    camOnRef.current = true;
    setCamOff(false);
    releaseHolds();
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
    peerStatus,
    heldPeers,
  };
}
