import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Delete,
  LockKeyhole,
  Mic,
  MoreHorizontal,
  Paperclip,
  Plus,
  Send,
  Settings,
  ShieldCheck,
  Smile,
  Unlock,
  Wifi,
  X,
} from "lucide-react";
import "./App.css";

type View = "calculator" | "chat";
type MessageKind = "text" | "image" | "video" | "audio";
type MessageStatus = "pending" | "sent" | "delivered";

type Message = {
  id: string;
  senderId: string;
  text?: string;
  kind: MessageKind;
  attachmentId?: string;
  attachmentName?: string;
  createdAt: number;
  status: MessageStatus;
};

type Attachment = {
  id: string;
  blob: Blob;
  name: string;
  kind: MessageKind;
};

type PeerPacket = {
  type: "presence" | "message" | "error" | "connected";
  online?: boolean;
  message?: Message;
  error?: string;
  senderId?: string;
};

const MESSAGE_KEY = "poki.messages";
const PROFILE_KEY = "poki.profile";
const SECRET_KEY = "poki.unlockHash";
const ROOM_KEY = "poki.room";
const DEVICE_KEY = "poki.device";
const SIGNALING_URL = (
  import.meta.env.VITE_SIGNALING_URL ??
  "wss://poki-backend-ktsn.onrender.com/ws"
)
  .replace(/^http:\/\//, "ws://")
  .replace(/^https:\/\//, "wss://")
  .replace(/\/$/, "");

const calculatorKeys = [
  "C",
  "⌫",
  "%",
  "÷",
  "7",
  "8",
  "9",
  "×",
  "4",
  "5",
  "6",
  "−",
  "1",
  "2",
  "3",
  "+",
  "0",
  ".",
  "=",
];

const getDeviceId = () => {
  const stored = localStorage.getItem(DEVICE_KEY);
  if (stored) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem(DEVICE_KEY, id);
  return id;
};

const getProfile = () => {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "{}") as {
      name?: string;
      partner?: string;
    };
  } catch {
    return {};
  }
};

const readMessages = (): Message[] => {
  try {
    return JSON.parse(localStorage.getItem(MESSAGE_KEY) ?? "[]") as Message[];
  } catch {
    return [];
  }
};

const hashText = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
};

const calculate = (raw: string) => {
  const normalized = raw
    .replaceAll("×", "*")
    .replaceAll("÷", "/")
    .replaceAll("−", "-")
    .replace(/%/g, "/100");
  if (!/^[0-9+\-*/().\s]+$/.test(normalized)) return "Error";
  try {
    const result = Function(`"use strict"; return (${normalized})`)();
    if (!Number.isFinite(result)) return "Error";
    return String(Number(result.toFixed(8)));
  } catch {
    return "Error";
  }
};

const openAttachmentDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("poki-local", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("attachments", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const saveAttachment = async (attachment: Attachment) => {
  const db = await openAttachmentDb();
  await new Promise<void>((resolve, reject) => {
    const request = db
      .transaction("attachments", "readwrite")
      .objectStore("attachments")
      .put(attachment);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
};

function App() {
  const [view, setView] = useState<View>("calculator");
  const [expression, setExpression] = useState("");
  const [unlockSequence, setUnlockSequence] = useState("");
  const [unlockHash, setUnlockHash] = useState<string | null>(() =>
    localStorage.getItem(SECRET_KEY),
  );
  const [showSettings, setShowSettings] = useState(false);
  const [profile, setProfile] = useState(getProfile);
  const [room, setRoom] = useState(
    () => localStorage.getItem(ROOM_KEY) ?? "POKI-LOCAL",
  );
  const [messages, setMessages] = useState<Message[]>(readMessages);
  const [messageText, setMessageText] = useState("");
  const [online, setOnline] = useState(false);
  const [peerName, setPeerName] = useState("Waiting for partner");
  const [connectionError, setConnectionError] = useState("");
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>(
    {},
  );
  const socketRef = useRef<WebSocket | null>(null);
  const deviceId = useRef(getDeviceId());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(MESSAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    return () =>
      Object.values(attachmentUrls).forEach((url) => URL.revokeObjectURL(url));
  }, [attachmentUrls]);

  useEffect(() => {
    if (view !== "chat") return;
    const socket = new WebSocket(
      `${SIGNALING_URL}/${encodeURIComponent(room)}`,
    );
    socketRef.current = socket;
    setConnectionError("");
    socket.onopen = () => {
      setOnline(true);
      socket.send(
        JSON.stringify({
          type: "hello",
          deviceId: deviceId.current,
          name: profile.name ?? "Poki friend",
          pinHash: unlockHash ?? "",
        }),
      );
    };
    socket.onmessage = (event) => {
      try {
        const packet = JSON.parse(event.data) as PeerPacket & { name?: string };
        if (packet.type === "presence") {
          setOnline(Boolean(packet.online));
          if (packet.name) setPeerName(packet.name);
        }
        if (packet.type === "connected") {
          setOnline(Boolean(packet.online));
        }
        if (packet.type === "error") {
          setConnectionError(
            packet.error ?? "Unable to join this private room.",
          );
          setOnline(false);
        }
        const incomingMessage = packet.message;
        if (
          packet.type === "message" &&
          incomingMessage &&
          packet.senderId !== deviceId.current
        ) {
          setMessages((current) =>
            current.some((item) => item.id === incomingMessage.id)
              ? current
              : [...current, { ...incomingMessage, status: "delivered" }],
          );
        }
      } catch {
        // Ignore malformed packets from the signaling layer.
      }
    };
    socket.onclose = () => {
      setOnline(false);
      setConnectionError(
        (current) =>
          current || "Connection closed. Check the backend URL and try again.",
      );
    };
    socket.onerror = () => {
      setOnline(false);
      setConnectionError(
        "Could not connect to the Poki relay. Make sure the backend is running with wss:// enabled.",
      );
    };
    return () => {
      socket.close();
      socketRef.current = null;
      setOnline(false);
    };
  }, [view, room, profile.name, unlockHash]);

  const openChat = () => {
    setView("chat");
    setExpression("");
    setUnlockSequence("");
  };

  const handleCalculatorKey = async (key: string) => {
    if (key === "C") {
      setExpression("");
      setUnlockSequence("");
      return;
    }
    if (key === "⌫") {
      setExpression((current) => current.slice(0, -1));
      setUnlockSequence((current) => current.slice(0, -1));
      return;
    }
    if (key === "=") {
      setExpression((current) => (current ? calculate(current) : "0"));
      return;
    }
    const nextExpression = `${expression}${key}`;
    setExpression(nextExpression);
    if (/^\d$/.test(key)) {
      const nextSequence = `${unlockSequence}${key}`.slice(-12);
      setUnlockSequence(nextSequence);
      if (unlockHash && (await hashText(nextSequence)) === unlockHash)
        openChat();
    } else {
      setUnlockSequence("");
    }
  };

  const saveSettings = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim() || "Poki friend";
    const nextRoom =
      String(data.get("room") ?? "")
        .trim()
        .toUpperCase() || "POKI-LOCAL";
    const pin = String(data.get("pin") ?? "").trim();
    if (pin) {
      const nextHash = await hashText(pin);
      localStorage.setItem(SECRET_KEY, nextHash);
      setUnlockHash(nextHash);
    }
    const nextProfile = { ...profile, name };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
    localStorage.setItem(ROOM_KEY, nextRoom);
    setProfile(nextProfile);
    setRoom(nextRoom);
    setShowSettings(false);
  };

  const sendMessage = (message: Message) => {
    setMessages((current) =>
      current.some((item) => item.id === message.id)
        ? current
        : [...current, message],
    );
    socketRef.current?.send(
      JSON.stringify({ type: "message", senderId: deviceId.current, message }),
    );
  };

  const sendText = () => {
    const text = messageText.trim();
    if (!text) return;
    sendMessage({
      id: crypto.randomUUID(),
      senderId: deviceId.current,
      text,
      kind: "text",
      createdAt: Date.now(),
      status: online ? "sent" : "pending",
    });
    setMessageText("");
  };

  const selectMedia = async (file: File) => {
    const kind: MessageKind = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("video/")
        ? "video"
        : "audio";
    const id = crypto.randomUUID();
    await saveAttachment({ id, blob: file, name: file.name, kind });
    setAttachmentUrls((current) => ({
      ...current,
      [id]: URL.createObjectURL(file),
    }));
    sendMessage({
      id: crypto.randomUUID(),
      senderId: deviceId.current,
      kind,
      attachmentId: id,
      attachmentName: file.name,
      createdAt: Date.now(),
      status: online ? "sent" : "pending",
    });
  };

  const lockChat = () => {
    setView("calculator");
    setMessages(readMessages());
  };

  return (
    <main className="poki-shell">
      <AnimatePresence mode="wait">
        {view === "calculator" ? (
          <CalculatorScreen
            key="calculator"
            expression={expression}
            onKey={handleCalculatorKey}
            onSettings={() => setShowSettings(true)}
            hasPin={Boolean(unlockHash)}
          />
        ) : (
          <ChatScreen
            key="chat"
            messages={messages}
            messageText={messageText}
            setMessageText={setMessageText}
            online={online}
            peerName={peerName}
            profileName={profile.name ?? "Poki friend"}
            room={room}
            connectionError={connectionError}
            urls={attachmentUrls}
            onBack={lockChat}
            onSend={sendText}
            onMedia={() => fileInputRef.current?.click()}
          />
        )}
      </AnimatePresence>
      <input
        ref={fileInputRef}
        className="hidden-input"
        type="file"
        accept="image/*,video/*,audio/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void selectMedia(file);
          event.target.value = "";
        }}
      />
      {showSettings && (
        <SettingsModal
          profile={profile}
          room={room}
          hasPin={Boolean(unlockHash)}
          onClose={() => setShowSettings(false)}
          onSave={saveSettings}
        />
      )}
    </main>
  );
}

function CalculatorScreen({
  expression,
  onKey,
  onSettings,
  hasPin,
}: {
  expression: string;
  onKey: (key: string) => void;
  onSettings: () => void;
  hasPin: boolean;
}) {
  return (
    <motion.section
      className="calculator-card"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
    >
      <header className="calculator-topbar">
        <div className="calculator-brand">
          <div className="brand-mark">p</div>
          <div>
            <span className="eyebrow">Poki utility</span>
            <strong>Calculator</strong>
          </div>
        </div>
        <button
          className="icon-button"
          aria-label="Open settings"
          onClick={onSettings}
        >
          <Settings size={18} />
        </button>
      </header>
      <div className="calculator-display">
        <span className="display-label">
          {hasPin ? "Ready" : "Set a private unlock code in settings"}
        </span>
        <strong>{expression || "0"}</strong>
      </div>
      <div className="calculator-grid">
        {calculatorKeys.map((key) => (
          <motion.button
            whileTap={{ scale: 0.93 }}
            key={key}
            className={`calc-key ${key === "=" ? "calc-key--equals" : ""} ${["÷", "×", "−", "+", "%"].includes(key) ? "calc-key--operator" : ""} ${["C", "⌫"].includes(key) ? "calc-key--muted" : ""}`}
            onClick={() => void onKey(key)}
          >
            {key === "⌫" ? <Delete size={20} /> : key}
          </motion.button>
        ))}
      </div>
      <footer className="calculator-footer">
        <LockKeyhole size={13} /> Private mode · local-first
      </footer>
    </motion.section>
  );
}

function ChatScreen({
  messages,
  messageText,
  setMessageText,
  online,
  peerName,
  profileName,
  room,
  connectionError,
  urls,
  onBack,
  onSend,
  onMedia,
}: {
  messages: Message[];
  messageText: string;
  setMessageText: (value: string) => void;
  online: boolean;
  peerName: string;
  profileName: string;
  room: string;
  connectionError: string;
  urls: Record<string, string>;
  onBack: () => void;
  onSend: () => void;
  onMedia: () => void;
}) {
  const deviceId = localStorage.getItem(DEVICE_KEY);
  return (
    <motion.section
      className="chat-card"
      initial={{ opacity: 0, x: 22 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -22 }}
    >
      <header className="chat-header">
        <button className="icon-button" aria-label="Lock Poki" onClick={onBack}>
          <ArrowLeft size={19} />
        </button>
        <div className="avatar">{peerName.slice(0, 1).toUpperCase()}</div>
        <div className="chat-person">
          <strong>{peerName}</strong>
          <span className={online ? "online-text" : "offline-text"}>
            <i /> {online ? "Online now" : "Offline · saved here"}
          </span>
        </div>
        <button className="icon-button" aria-label="More options">
          <MoreHorizontal size={20} />
        </button>
      </header>
      <div className="room-strip">
        <Wifi size={13} /> Private room <b>{room}</b>
        <span>Only two devices</span>
      </div>
      {connectionError && (
        <div className="room-connection-error">{connectionError}</div>
      )}
      <div className="messages-list">
        {messages.length === 0 ? (
          <div className="empty-chat">
            <div className="empty-lock">
              <ShieldCheck size={25} />
            </div>
            <h2>A quiet beginning</h2>
            <p>
              Messages and media stay on your devices. Say something when you
              are ready.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              own={message.senderId === deviceId}
              url={
                message.attachmentId ? urls[message.attachmentId] : undefined
              }
            />
          ))
        )}
      </div>
      <div className="composer">
        <button
          className="composer-button"
          aria-label="Attach media"
          onClick={onMedia}
        >
          <Plus size={20} />
        </button>
        <input
          value={messageText}
          onChange={(event) => setMessageText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSend();
          }}
          placeholder="Write something private..."
        />
        <button
          className="composer-button composer-button--smile"
          aria-label="Add emoji"
        >
          <Smile size={19} />
        </button>
        {messageText.trim() ? (
          <button
            className="send-button"
            aria-label="Send message"
            onClick={onSend}
          >
            <Send size={17} />
          </button>
        ) : (
          <button className="send-button" aria-label="Record audio">
            <Mic size={18} />
          </button>
        )}
      </div>
      <footer className="chat-footer">
        <LockKeyhole size={12} /> {profileName} · messages are saved locally
        first
      </footer>
    </motion.section>
  );
}

function MessageBubble({
  message,
  own,
  url,
}: {
  message: Message;
  own: boolean;
  url?: string;
}) {
  return (
    <motion.div
      className={`message-row ${own ? "message-row--own" : ""}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className={`message-bubble ${own ? "message-bubble--own" : ""}`}>
        {message.kind === "text" ? (
          <p>{message.text}</p>
        ) : url ? (
          message.kind === "image" ? (
            <img src={url} alt={message.attachmentName ?? "Shared image"} />
          ) : message.kind === "video" ? (
            <video controls src={url} />
          ) : (
            <audio controls src={url} />
          )
        ) : (
          <div className="attachment-pending">
            <Paperclip size={15} />{" "}
            {message.attachmentName ?? "Attachment saved locally"}
          </div>
        )}
        <div className="message-meta">
          <span>
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {own &&
            (message.status === "delivered" ? (
              <CheckCheck size={14} />
            ) : message.status === "sent" ? (
              <Check size={14} />
            ) : (
              <span className="pending-dot">·</span>
            ))}
        </div>
      </div>
    </motion.div>
  );
}

function SettingsModal({
  profile,
  room,
  hasPin,
  onClose,
  onSave,
}: {
  profile: { name?: string };
  room: string;
  hasPin: boolean;
  onClose: () => void;
  onSave: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClose}
    >
      <motion.form
        className="settings-modal"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={onSave}
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="eyebrow">Poki setup</span>
            <h2>Private settings</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <label>
          Display name
          <input
            name="name"
            defaultValue={profile.name ?? ""}
            placeholder="Your name"
          />
        </label>
        <label>
          Private room code
          <input
            name="room"
            defaultValue={room}
            placeholder="Share this with one person"
          />
        </label>
        <label>
          Calculator unlock code
          <input
            name="pin"
            inputMode="numeric"
            pattern="[0-9]{4,12}"
            placeholder={
              hasPin ? "Leave blank to keep current" : "4–12 numbers"
            }
          />
        </label>
        <p className="security-note">
          <ShieldCheck size={16} /> Only a SHA-256 hash of the unlock code is
          stored. The code itself is never saved.
        </p>
        <button className="primary-button" type="submit">
          <Unlock size={16} /> Save private settings
        </button>
      </motion.form>
    </motion.div>
  );
}

export default App;
