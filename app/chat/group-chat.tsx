"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createClient } from "@/lib/supabase/client";

type Message = {
  id: string;
  sender_member_id: string;
  body: string;
  created_at: string;
};
type Member = { id: string; full_name: string };
type Submission = { messageId: string; body: string };
const fields = "id, sender_member_id, body, created_at";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mergeMessages(current: Message[], incoming: Message[]) {
  const items = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) items.set(message.id, message);
  return [...items.values()].sort(
    (a, b) =>
      a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
}
function timestamp(value: string) {
  return new Date(value).toLocaleString("en-KE", {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function GroupChat({
  initialMessages,
  members,
  currentMemberId,
}: {
  initialMessages: Message[];
  members: Member[];
  currentMemberId: string;
}) {
  const [supabase] = useState(() => createClient());
  const [messages, setMessages] = useState(() =>
    mergeMessages([], initialMessages),
  );
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [readError, setReadError] = useState("");
  const [liveStatus, setLiveStatus] = useState("Connecting…");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(initialMessages.length === 50);
  const requestRef = useRef<Submission | null>(null);
  const busyRef = useRef(false);
  const olderBusyRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const wasNearBottomRef = useRef(true);
  const storageKey = `psi-chat-pending-${currentMemberId}`;
  const memberNames = new Map(
    members.map((member) => [member.id, member.full_name]),
  );

  function clearPending() {
    requestRef.current = null;
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* Storage may be disabled. */
    }
  }

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const pending = JSON.parse(saved);
        if (
          typeof pending.messageId === "string" &&
          uuidPattern.test(pending.messageId) &&
          typeof pending.body === "string" &&
          pending.body.trim() &&
          [...pending.body].length <= 2000
        ) {
          requestRef.current = pending;
          setBody(pending.body);
          setLocked(true);
          setNotice(
            "A previous send needs confirmation. Retry the same message; it will not create another copy.",
          );
        } else sessionStorage.removeItem(storageKey);
      }
    } catch {
      /* Continue without local retry persistence. */
    }
    setReady(true);
  }, [storageKey]);

  const refreshRecent = useCallback(async () => {
    try {
      const { data, error: queryError } = await supabase
        .from("group_messages")
        .select(fields)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(50);
      if (queryError) throw queryError;
      setMessages((current) => mergeMessages(current, data ?? []));
      setReadError("");
    } catch {
      setReadError(
        "Messages could not be refreshed. Check your connection or sign-in and try again.",
      );
    }
  }, [supabase]);

  useEffect(() => {
    let mounted = true;
    const channel = supabase
      .channel(`psi-group-chat-${currentMemberId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages" },
        (payload) => {
          if (mounted)
            setMessages((current) =>
              mergeMessages(current, [payload.new as Message]),
            );
        },
      )
      .subscribe((status) => {
        if (!mounted) return;
        if (status === "SUBSCRIBED") {
          setLiveStatus("Live updates connected");
          void refreshRecent();
        } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          setLiveStatus("Live updates unavailable · checking every 15 seconds");
        }
      });
    const timer = window.setInterval(() => {
      void refreshRecent();
    }, 15000);
    void refreshRecent();
    return () => {
      mounted = false;
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [supabase, currentMemberId, refreshRecent]);

  useEffect(() => {
    const list = listRef.current;
    if (list && wasNearBottomRef.current) list.scrollTop = list.scrollHeight;
  }, [messages]);

  async function loadOlder() {
    if (olderBusyRef.current || messages.length === 0) return;
    olderBusyRef.current = true;
    setLoadingOlder(true);
    try {
      const oldest = messages[0];
      const cursor = `created_at.lt.${oldest.created_at},and(created_at.eq.${oldest.created_at},id.lt.${oldest.id})`;
      const { data, error: queryError } = await supabase
        .from("group_messages")
        .select(fields)
        .or(cursor)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(50);
      if (queryError) throw queryError;
      wasNearBottomRef.current = false;
      setMessages((current) => mergeMessages(current, data ?? []));
      setHasOlder((data?.length ?? 0) === 50);
      setReadError("");
    } catch {
      setReadError("Older messages could not be loaded. Try again.");
    } finally {
      olderBusyRef.current = false;
      setLoadingOlder(false);
    }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busyRef.current) return;
    if (!requestRef.current) {
      const text = body.trim();
      if (!text || [...text].length > 2000) {
        setError("Enter a message between 1 and 2000 characters.");
        return;
      }
      requestRef.current = { messageId: crypto.randomUUID(), body: text };
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(requestRef.current));
      } catch {
        // Keep the in-memory request ID if browser storage is unavailable.
      }
    }
    busyRef.current = true;
    setLoading(true);
    setLocked(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestRef.current),
      });
      if (
        !(response.headers.get("content-type") ?? "").includes(
          "application/json",
        )
      ) {
        throw new Error(
          `The chat API returned a non-JSON response (HTTP ${response.status}). Check app/api/chat/messages/route.ts. Retry the same message after fixing it.`,
        );
      }
      const result = await response.json();
      if (!response.ok || !result.success) {
        if (result.canEdit === true) {
          clearPending();
          setLocked(false);
        }
        throw new Error(
          result.error || "The result is uncertain. Retry the same message.",
        );
      }
      clearPending();
      setLocked(false);
      setBody("");
      wasNearBottomRef.current = true;
      setMessages((current) =>
        mergeMessages(current, [result.message as Message]),
      );
      setNotice(
        result.alreadySent
          ? "Message already sent. No duplicate was added."
          : "Message sent.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The result is uncertain. Retry the same message.",
      );
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-gray-50 px-5 py-3">
        <p className="text-xs text-gray-600">{liveStatus}</p>
        <button
          type="button"
          onClick={() => void refreshRecent()}
          className="text-sm font-semibold text-gray-700 underline"
        >
          Refresh Messages
        </button>
      </div>
      {readError && (
        <p role="alert" className="px-5 py-3 text-sm text-amber-800">
          {readError}
        </p>
      )}
      <div
        ref={listRef}
        onScroll={() => {
          const list = listRef.current;
          if (list)
            wasNearBottomRef.current =
              list.scrollHeight - list.scrollTop - list.clientHeight < 100;
        }}
        className="h-[55vh] min-h-64 overflow-y-auto p-4 sm:p-6"
      >
        {hasOlder && messages.length > 0 && (
          <div className="mb-5 text-center">
            <button
              type="button"
              disabled={loadingOlder}
              onClick={() => void loadOlder()}
              className="text-sm font-semibold text-gray-600 underline disabled:opacity-50"
            >
              {loadingOlder ? "Loading…" : "Load Older Messages"}
            </button>
          </div>
        )}
        {messages.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">
            No messages yet. Start a group discussion.
          </p>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => {
              const own = message.sender_member_id === currentMemberId;
              return (
                <article
                  key={message.id}
                  className={`flex ${own ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[90%] rounded-xl px-4 py-3 sm:max-w-[80%] ${own ? "bg-blue-50" : "bg-gray-100"}`}
                  >
                    <p className="text-sm font-semibold text-gray-900">
                      {memberNames.get(message.sender_member_id) ??
                        "PSI Member"}
                      {own ? " · You" : ""}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-800">
                      {message.body}
                    </p>
                    <p className="mt-2 text-xs text-gray-500">
                      {timestamp(message.created_at)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
      <form onSubmit={send} className="border-t p-4 sm:p-5">
        {notice && (
          <p role="status" className="mb-3 text-sm text-green-800">
            {notice}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </p>
        )}
        {locked && !loading && (
          <p className="mb-3 text-sm text-amber-800">
            Keep the same message and retry. The submission ID prevents another
            copy. If browser storage is unavailable, keep this tab open.
          </p>
        )}
        <label
          htmlFor="chat-message"
          className="mb-2 block text-sm font-medium text-gray-700"
        >
          Your Message
        </label>
        <textarea
          id="chat-message"
          rows={3}
          required
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={!ready || loading || locked}
          placeholder="Discuss a group issue…"
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500 disabled:bg-gray-50"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            {[...body].length}/2000 · Visible to all active members
          </p>
          <button
            type="submit"
            disabled={!ready || loading}
            className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {loading
              ? "Sending…"
              : locked
                ? "Retry Same Message"
                : "Send Message"}
          </button>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Be respectful. Do not share passwords, invitation links, or private
          financial details. Editing, deletion, and moderation controls are not
          included in this first version.
        </p>
      </form>
    </section>
  );
}
