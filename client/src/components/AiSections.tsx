import { useEffect, useRef, useState } from "react";
import { RefreshCw, SendHorizontal, Sparkles } from "lucide-react";
import { api, type AiResult, type ChatTurn } from "@/lib/api";
import { ChartEmpty, Panel, SkeletonLines } from "@/components/Panel";

// Shared state shape: the taste-profile check decides whether ANY AI
// section renders — if GROQ_API_KEY isn't configured server-side, all
// three sections stay hidden with no error shown to visitors.
interface TasteProfileResponse {
  profile?: string;
  cached?: boolean;
  error?: string;
}

// One shared request per page load: useAiVisibility and AiProfilePanel
// both need the taste-profile response, so they share a single promise.
// A failed attempt clears itself so "Try again" / reload can re-request —
// only a 501 (feature genuinely not configured) is treated as permanent.
let aiInitialCheck: Promise<AiResult<TasteProfileResponse>> | null = null;

function ensureAiCheck() {
  if (!aiInitialCheck) {
    aiInitialCheck = api.aiTasteProfile();
    aiInitialCheck.then(
      (result) => {
        if (!result.ok) aiInitialCheck = null;
      },
      () => {
        aiInitialCheck = null;
      }
    );
  }
  return aiInitialCheck;
}

function useAiConfigured(): boolean | null {
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureAiCheck().then((result) => {
      if (cancelled) return;
      // Hide everything only when the feature is truly not configured;
      // transient Groq/network failures keep the panels visible with a
      // retry state instead.
      setConfigured(result.ok || result.status !== 501);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return configured;
}

// The AI's written voice — deliberately quiet: no borders or badges, just
// comfortable editorial measure so it reads like content, not UI.
function AiText({ text }: { text: string }) {
  return (
    <p className="max-w-[62ch] whitespace-pre-wrap text-[15px] leading-[1.7] text-white/85">
      {text}
    </p>
  );
}

// Compact typing indicator for chat bubbles.
function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1" aria-label="AI is thinking">
      {[0, 1, 2].map((i) => (
        <span
          className="size-1.5 rounded-full bg-white/50"
          key={i}
          style={{ animation: `typing-dot 1.2s ease-in-out ${i * 0.15}s infinite` }}
        />
      ))}
    </span>
  );
}

// Icon-only regenerate control, shown in the panel header opposite the
// title so both AI panels' buttons align regardless of text length.
function RegenerateButton({
  loading,
  isError,
  onClick,
}: {
  loading: boolean;
  isError: boolean;
  onClick: () => void;
}) {
  const label = loading ? "Thinking…" : isError ? "Try again" : "Regenerate";
  return (
    <button
      aria-label={label}
      className="flex size-7 shrink-0 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white disabled:pointer-events-none disabled:opacity-40"
      disabled={loading}
      onClick={onClick}
      title={label}
      type="button"
    >
      <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
    </button>
  );
}

export function AiProfilePanel({ visible }: { visible: boolean }) {
  const [profile, setProfile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setError(false);
    // First load shares the same request useAiVisibility made (cached in
    // ensureAiCheck) — no duplicate network call.
    ensureAiCheck().then((result) => {
      if (result.ok && result.data.error) {
        setError(true);
      } else if (result.ok) {
        setProfile(result.data.profile ?? null);
      } else {
        // Transient failure (500/429/network) — surface the retry state.
        setError(true);
      }
      setLoading(false);
    });
  }, [visible]);

  async function regenerate() {
    setLoading(true);
    setError(false);
    const result = await api.aiTasteProfile(true);
    if (!result.ok || result.data.error) setError(true);
    else setProfile(result.data.profile ?? null);
    setLoading(false);
  }

  if (!visible) return null;

  return (
    <Panel
      action={<RegenerateButton isError={error} loading={loading} onClick={regenerate} />}
      note="AI's take on your music taste, based on your top artists & genres"
      title="AI Taste Profile"
    >
      {loading ? (
        <div className="pt-1">
          <SkeletonLines rows={3} />
        </div>
      ) : error ? (
        <ChartEmpty icon={Sparkles}>
          Couldn't generate a taste profile right now — try again in a moment.
        </ChartEmpty>
      ) : (
        <AiText text={profile ?? ""} />
      )}
    </Panel>
  );
}

export function AiRecapPanel({ visible }: { visible: boolean }) {
  const [recap, setRecap] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setError(false);
    api.aiRecap().then((result) => {
      if (!result.ok || result.data.error) setError(true);
      else setRecap(result.data.recap ?? null);
      setLoading(false);
    });
  }, [visible]);

  async function regenerate() {
    setLoading(true);
    setError(false);
    const result = await api.aiRecap(true);
    if (!result.ok || result.data.error) setError(true);
    else setRecap(result.data.recap ?? null);
    setLoading(false);
  }

  if (!visible) return null;

  return (
    <Panel
      action={<RegenerateButton isError={error} loading={loading} onClick={regenerate} />}
      note="A written recap of your last ~50 plays"
      title="AI Recap"
    >
      {loading ? (
        <div className="pt-1">
          <SkeletonLines rows={3} />
        </div>
      ) : error || !recap ? (
        <ChartEmpty icon={Sparkles}>
          Couldn't generate a recap right now — try again in a moment.
        </ChartEmpty>
      ) : (
        <AiText text={recap} />
      )}
    </Panel>
  );
}

// Conversation history lives only in component state — resets on page
// reload. Sent back to the server on every message since the AI has no
// memory between calls.
const SUGGESTIONS = [
  "What's my most niche genre?",
  "Which artist do I lean on too much?",
  "Summarize my week in listening",
];

export function AiChatPanel({ visible }: { visible: boolean }) {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, thinking]);

  if (!visible) return null;

  async function sendMessage(message: string) {
    if (!message || thinking) return;

    const historyBeforeThisMessage = [...messages];
    const next: ChatTurn[] = [...messages, { role: "user", content: message }];
    setMessages(next);
    setInput("");
    setThinking(true);

    const data = await api.aiChat(message, historyBeforeThisMessage);

    setThinking(false);
    if (!data.ok || data.data.error || !data.data.reply) {
      setMessages([
        ...next,
        { role: "assistant", content: "Sorry, something went wrong answering that — try again." },
      ]);
    } else {
      setMessages([...next, { role: "assistant", content: data.data.reply }]);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    await sendMessage(input.trim());
  }

  return (
    <Panel title="Ask About Your Stats" note="Chat with AI about your own listening data — it only knows what's on this dashboard" wide>
      <div className="flex max-h-80 min-h-40 flex-col gap-3 overflow-y-auto pr-1" ref={scrollRef}>
        {messages.length === 0 && !thinking && (
          <div className="my-auto flex flex-col items-center gap-2.5 py-4">
            <span className="text-sm text-muted-foreground">Try asking</span>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs text-white/70 transition-colors hover:border-primary/50 hover:text-white"
                  key={suggestion}
                  onClick={() => sendMessage(suggestion)}
                  type="button"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div
              className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm font-medium text-black"
              key={i}
            >
              {m.content}
            </div>
          ) : (
            <div className="mr-auto flex max-w-[85%] items-start gap-2.5" key={i}>
              <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15">
                <Sparkles aria-hidden="true" className="size-3 text-primary" />
              </span>
              <div className="rounded-2xl rounded-tl-md bg-white/[0.04] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-white/90">
                {m.content}
              </div>
            </div>
          )
        )}
        {thinking && (
          <div className="mr-auto flex items-start gap-2.5">
            <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15">
              <Sparkles aria-hidden="true" className="size-3 text-primary" />
            </span>
            <div className="rounded-2xl rounded-tl-md bg-white/[0.04] px-4 py-2">
              <TypingDots />
            </div>
          </div>
        )}
      </div>

      <form className="mt-4 flex gap-2" onSubmit={send}>
        <input
          autoComplete="off"
          className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.05] px-5 py-2.5 text-sm text-white placeholder:text-white/35 outline-none transition-colors focus:border-primary/60 disabled:opacity-50"
          disabled={thinking}
          maxLength={500}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your stats…"
          value={input}
        />
        <button
          className="flex shrink-0 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-black transition-all duration-200 hover:brightness-110 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
          disabled={thinking || input.trim().length === 0}
          type="submit"
        >
          Send
          <SendHorizontal className="size-4" />
        </button>
      </form>
    </Panel>
  );
}

export function useAiVisibility() {
  const configured = useAiConfigured();
  // null = still checking; false = not configured; true = show everything.
  return configured === true;
}
