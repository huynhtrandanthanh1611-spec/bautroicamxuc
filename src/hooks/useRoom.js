import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { api, uuid } from "../api";

// Bản sao hiển thị ngay trên máy học sinh; ID được ghi trước khi gửi để bỏ qua echo.
export function useRoom(roomId, role, onReaction) {
  const [room, setRoom] = useState(null);
  const [counts, setCounts] = useState({
    values: [0, 0, 0],
    seq: -1,
    epoch: 0,
  });
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [notice, setNotice] = useState("");
  const socketRef = useRef(null);
  const callbackRef = useRef(onReaction);
  callbackRef.current = onReaction;
  const pending = useRef(new Map());
  const seen = useRef(new Map());
  const epoch = useRef(0);
  const flushRef = useRef(() => {});

  useEffect(() => {
    let live = true;
    let ready = false;
    let noticeTimer;
    pending.current.clear();
    seen.current.clear();
    epoch.current = 0;
    setRoom(null);
    setError("");
    setCounts({ values: [0, 0, 0], seq: -1, epoch: 0 });
    const key = `sky-pending:${roomId}`;
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) || "[]");
      if (role === "student")
        for (const item of saved) {
          if (Date.now() - item.createdAt < 300000) {
            pending.current.set(item.eventId, { ...item, sending: false });
            seen.current.set(item.eventId, Date.now());
          }
        }
    } catch {
      /* Chế độ riêng tư có thể chặn sessionStorage. */
    }
    function persist() {
      if (!live) return;
      setPendingCount(pending.current.size);
      try {
        sessionStorage.setItem(
          key,
          JSON.stringify(
            [...pending.current.values()].map(
              ({ sending, nextAt, ...item }) => item,
            ),
          ),
        );
      } catch {
        /* Không ảnh hưởng tương tác trực tiếp. */
      }
    }
    function notify(message) {
      setNotice(message);
      clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => live && setNotice(""), 7000);
    }
    function acceptRoom(next) {
      epoch.current = Math.max(epoch.current, next.epoch);
      setRoom((current) =>
        !current || next.version >= current.version
          ? { ...next, epoch: epoch.current }
          : current,
      );
      setError("");
    }
    function acceptCounts(next) {
      setCounts((current) => (next.seq >= current.seq ? next : current));
    }
    api(
      role === "teacher"
        ? `/api/teacher/rooms/${roomId}`
        : `/api/rooms/${roomId}`,
    )
      .then((result) => {
        if (!live) return;
        acceptRoom(result);
        if (result.counts) acceptCounts(result.counts);
      })
      .catch((err) => live && setError(err.message));
    const socket = io({
      autoConnect: false,
      auth: { roomId, role },
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;
    function flush() {
      persist();
      if (!socket.connected || !ready) return;
      const now = Date.now();
      let sent = 0;
      for (const [id, item] of pending.current) {
        if (now - item.createdAt > 300000 || item.epoch !== epoch.current) {
          pending.current.delete(id);
          notify("Một số lượt chờ đã hết hạn hoặc bộ đếm đã được đặt lại.");
          continue;
        }
        if (item.sending || (item.nextAt || 0) > now || sent >= 20) continue;
        sent++;
        item.sending = true;
        socket
          .timeout(6000)
          .emit(
            "react",
            { eventId: id, buttonIndex: item.buttonIndex, epoch: item.epoch },
            (err, result) => {
              if (!live || !pending.current.has(id)) return;
              if (err || result?.retry) {
                item.sending = false;
                item.nextAt = Date.now() + 1000;
              } else {
                pending.current.delete(id);
                if (!result?.ok)
                  notify(result?.error || "Lượt bấm chưa gửi được.");
              }
              persist();
            },
          );
      }
      for (const [id, time] of seen.current)
        if (now - time > 600000) seen.current.delete(id);
      persist();
    }
    flushRef.current = flush;
    socket.on("ready", (data) => {
      ready = true;
      setConnected(true);
      acceptRoom(data.room);
      if (data.counts) acceptCounts(data.counts);
      flush();
    });
    socket.on("disconnect", () => {
      ready = false;
      setConnected(false);
      for (const item of pending.current.values()) item.sending = false;
    });
    socket.on("connect_error", (err) => {
      setConnected(false);
      if (err.message.includes("phòng") || err.message.includes("giáo viên"))
        setError(err.message);
    });
    socket.on("room:updated", acceptRoom);
    socket.on("counts", acceptCounts);
    socket.on("epoch", (next) => {
      epoch.current = next;
      setRoom((current) => (current ? { ...current, epoch: next } : current));
      flush();
    });
    socket.on("reaction", (event) => {
      if (seen.current.has(event.eventId)) return;
      seen.current.set(event.eventId, Date.now());
      callbackRef.current?.(event);
    });
    socket.connect();
    const interval = setInterval(flush, 800);
    persist();
    return () => {
      live = false;
      clearInterval(interval);
      clearTimeout(noticeTimer);
      socket.disconnect();
      socketRef.current = null;
      flushRef.current = () => {};
    };
  }, [roomId, role]);

  const send = useCallback((buttonIndex) => {
    if (pending.current.size >= 500) {
      setNotice("Đang chờ mạng để gửi các lượt bấm. Con chờ một chút nhé.");
      return;
    }
    const eventId = uuid();
    seen.current.set(eventId, Date.now());
    pending.current.set(eventId, {
      eventId,
      buttonIndex,
      epoch: epoch.current,
      createdAt: Date.now(),
      sending: false,
    });
    flushRef.current();
  }, []);
  return { room, counts, connected, error, pendingCount, notice, send };
}
