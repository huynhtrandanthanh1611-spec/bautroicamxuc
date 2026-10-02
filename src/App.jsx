import { useEffect, useRef, useState } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  Cloud,
  Heart,
  Plus,
  LogOut,
  ArrowLeft,
  Copy,
  MonitorPlay,
  Save,
  RotateCcw,
  Type,
  Image,
  Layers,
  Check,
  LoaderCircle,
  LockKeyhole,
  Palette,
  Radio,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { api, copyLink } from "./api";
import { useRoom } from "./hooks/useRoom";
import { Sky } from "./components/Sky";
import ImageEditor from "./components/ImageEditor";
import Modal from "./components/Modal";

function Brand({ compact = false }) {
  return (
    <div className={`brand ${compact ? "compact" : ""}`}>
      <span className="brand-mark">
        <Cloud size={25} />
        <Heart size={11} fill="currentColor" />
      </span>
      <span>
        Bầu trời cảm xúc<small>Mỗi cảm xúc đều đáng yêu</small>
      </span>
    </div>
  );
}
function Loading() {
  return (
    <main className="centered">
      <LoaderCircle className="spin" />
      <p>Đang mở bầu trời…</p>
    </main>
  );
}
function ErrorPage({ message }) {
  return (
    <main className="centered">
      <Cloud size={50} />
      <h1>Chưa mở được bầu trời</h1>
      <p role="alert">{message}</p>
      <button className="primary" onClick={() => window.location.reload()}>
        Thử lại
      </button>
    </main>
  );
}

function TeacherGate({ children }) {
  const [authenticated, setAuthenticated] = useState(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/api/auth")
      .then((r) => setAuthenticated(r.authenticated))
      .catch((err) => {
        setError(err.message);
        setAuthenticated(false);
      });
  }, []);
  if (authenticated === null) return <Loading />;
  if (authenticated) return children;
  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/login", { method: "POST", body: { password } });
      setPassword("");
      setAuthenticated(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <Brand />
      <div className="login-cloud" aria-hidden="true">
        ☁️
      </div>
      <section className="login-card">
        <span className="section-tag">
          <LockKeyhole size={16} />
          GÓC GIÁO VIÊN
        </span>
        <h1>
          Mở một bầu trời
          <br />
          cho lớp mình.
        </h1>
        <p>
          Đăng nhập để tạo phòng, chọn ba nút cảm xúc và nhận những lần chạm từ
          cả lớp.
        </p>
        <form onSubmit={login}>
          <label htmlFor="teacher-password">Mật khẩu giáo viên</label>
          <input
            id="teacher-password"
            autoComplete="current-password"
            type="password"
            required
            maxLength={200}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nhập mật khẩu của bạn"
          />
          {error && (
            <p className="message error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Đang đăng nhập…" : "Vào góc giáo viên"}
          </button>
        </form>
        <p className="small-note">
          Học sinh sử dụng link riêng của phòng và không cần đăng nhập.
        </p>
      </section>
      <div className="login-emotions" aria-hidden="true">
        <span>💗</span>
        <span>🌟</span>
        <span>💭</span>
      </div>
    </main>
  );
}

function TeacherHeader({ children }) {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  async function logout() {
    try {
      await api("/api/logout", { method: "POST" });
      window.location.assign("/teacher");
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <>
      <header className="teacher-header">
        <button
          className="brand-button"
          onClick={() => navigate("/teacher")}
          aria-label="Về danh sách phòng"
        >
          <Brand compact />
        </button>
        <div className="header-actions">
          {children}
          <button
            className="icon-button"
            onClick={logout}
            aria-label="Đăng xuất"
            title="Đăng xuất"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>
      {error && (
        <p className="message error header-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

function Dashboard() {
  const [rooms, setRooms] = useState(null);
  const [name, setName] = useState("Lớp mình hôm nay");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    api("/api/teacher/rooms")
      .then(setRooms)
      .catch((err) => setError(err.message));
  }, []);
  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const room = await api("/api/teacher/rooms", {
        method: "POST",
        body: { name },
      });
      navigate(`/teacher/room/${room.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function deleteRoom() {
    if (deleting || !deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await api(`/api/teacher/rooms/${deleteTarget.id}`, {
        method: "DELETE", body: { confirm: true },
      });
      setRooms((current) => current.filter((room) => room.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      if (err.status === 404) {
        setRooms((current) => current.filter((room) => room.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }
  return (
    <div className="teacher-page">
      <TeacherHeader>
        <span className="teacher-chip">Góc giáo viên</span>
      </TeacherHeader>
      <main className="dashboard">
        <div className="dashboard-title">
          <span className="section-tag">XIN CHÀO, THẦY CÔ!</span>
          <h1>Những bầu trời của lớp mình</h1>
          <p>Tạo một phòng, chọn ba cảm xúc rồi cùng lắng nghe học sinh.</p>
        </div>
        <form className="create-room" onSubmit={create}>
          <div className="create-icon">
            <Plus size={26} />
          </div>
          <div className="create-field">
            <label htmlFor="room-name">Tên phòng mới</label>
            <input
              id="room-name"
              value={name}
              maxLength={70}
              required
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Lớp 1.4 — Hôm nay con thế nào?"
            />
          </div>
          <button className="primary" disabled={busy}>
            {busy ? "Đang tạo…" : "Tạo phòng tương tác"}
          </button>
        </form>
        {error && (
          <p className="message error" role="alert">
            {error}
          </p>
        )}
        <div className="section-heading">
          <h2>Phòng đã tạo</h2>
          <span>{rooms?.length ?? "…"} phòng</span>
        </div>
        {rooms?.length === 0 && (
          <div className="empty-rooms">
            <Cloud size={44} />
            <h3>Một bầu trời mới đang chờ</h3>
            <p>Nhập tên lớp ở trên để tạo phòng đầu tiên.</p>
          </div>
        )}
        {rooms === null && !error && (
          <p role="status">Đang tải danh sách phòng…</p>
        )}
        <div className="room-grid">
          {rooms?.map((room) => (
            <article className="room-card" key={room.id}>
            <Link
              className="room-card-link"
              to={`/teacher/room/${room.id}`}
            >
              <div className="room-mini-sky">
                <Cloud size={26} />
                <div>
                  {room.buttons.map((b, i) => (
                    <span
                      key={i}
                      style={{ background: b.background, color: b.color }}
                    >
                      {b.mode === "image" ? "Ảnh" : b.text.replace(/\n/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
              <h3>{room.name}</h3>
              <p>
                {room.counts.values
                  .reduce((a, b) => a + b, 0)
                  .toLocaleString("vi-VN")}{" "}
                lượt bấm
                <span>
                  Mở phòng <ExternalLink size={14} />
                </span>
              </p>
            </Link>
            <button type="button" className="room-delete danger-text"
              aria-label={`Xóa phòng ${room.name}`}
              onClick={() => { setDeleteError(""); setDeleteTarget(room); }}>
              <Trash2 size={16} /> Xóa phòng
            </button>
            </article>
          ))}
        </div>
      </main>
      {deleteTarget && (
        <Modal title="Xóa phòng?" onClose={() => !deleting && setDeleteTarget(null)}>
          <p>Thầy cô muốn xóa phòng <strong>{deleteTarget.name}</strong>?</p>
          <p>Nội dung, ảnh và lượt bấm của phòng sẽ bị xóa vĩnh viễn. Link học sinh và link trình chiếu của phòng sẽ ngừng hoạt động.</p>
          {deleteError && <p className="message error" role="alert">{deleteError}</p>}
          <div className="modal-actions">
            <button type="button" className="secondary" disabled={deleting}
              onClick={() => setDeleteTarget(null)}>Hủy</button>
            <button type="button" className="danger-button" disabled={deleting}
              onClick={deleteRoom}>{deleting ? "Đang xóa…" : "Xóa vĩnh viễn"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function contrastRatio(bg, fg) {
  const luminance = (value) => {
    const channels = value
      .match(/\w\w/g)
      .map((v) => parseInt(v, 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const a = luminance(bg.slice(1)),
    b = luminance(fg.slice(1));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function TeacherRoom() {
  const { roomId } = useParams();
  const sky = useRef();
  const { room, counts, connected, error } = useRoom(
    roomId,
    "teacher",
    (event) => sky.current?.fly(event.button, event.buttonIndex),
  );
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const [selected, setSelected] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  useEffect(() => {
    if (room && !dirtyRef.current) setDraft(room);
  }, [room]);
  useEffect(() => {
    const warn = (event) => {
      if (dirtyRef.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  if (error && !room) return <ErrorPage message={error} />;
  if (!draft) return <Loading />;
  const button = draft.buttons[selected];
  const link = `${window.location.origin}/s/${roomId}`;
  const changedElsewhere = room && room.version > draft.version;
  function edit(patch) {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
    setMessage(null);
  }
  function editButton(patch, index = selected) {
    setDraft((current) => ({
      ...current,
      buttons: current.buttons.map((b, i) =>
        i === index ? { ...b, ...patch } : b,
      ),
    }));
    setDirty(true);
    setMessage(null);
  }
  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const saved = await api(`/api/teacher/rooms/${roomId}`, {
        method: "PUT",
        body: {
          name: draft.name,
          buttons: draft.buttons,
          version: draft.version,
        },
      });
      dirtyRef.current = false;
      setDirty(false);
      setDraft(saved);
      setMessage({
        type: "success",
        text: "Đã lưu thành công. Học sinh đã nhận nội dung mới.",
      });
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }
  async function share() {
    try {
      await copyLink(link);
      setMessage({ type: "success", text: "Đã sao chép link học sinh." });
    } catch (err) {
      setMessage({ type: "error", text: err.message });
      setShareOpen(true);
    }
  }
  async function reset() {
    setResetting(true);
    try {
      await api(`/api/teacher/rooms/${roomId}/reset`, {
        method: "POST",
        body: { confirm: true },
      });
      setResetOpen(false);
      setMessage({ type: "success", text: "Đã đặt lại cả ba bộ đếm về 0." });
    } catch (err) {
      setMessage({ type: "error", text: err.message });
      setResetOpen(false);
    } finally {
      setResetting(false);
    }
  }
  return (
    <div className="teacher-page">
      <TeacherHeader>
        <span className={`live-badge ${connected ? "" : "disconnected"}`}>
          <span />
          {connected ? "Đã kết nối" : "Đang kết nối lại"}
        </span>
      </TeacherHeader>
      <main className="room-workspace">
        <div className="workspace-top">
          <div>
            <Link
              className="back-link"
              to="/teacher"
              onClick={(event) => {
                if (
                  dirty &&
                  !window.confirm("Bạn chưa lưu thay đổi. Rời phòng này?")
                )
                  event.preventDefault();
              }}
            >
              <ArrowLeft size={15} />
              Danh sách phòng
            </Link>
            <h1>
              Góc điều khiển cảm xúc <span>✧</span>
            </h1>
          </div>
          <div className="workspace-actions">
            <a
              className="secondary"
              href={`/projector/${roomId}`}
              target="_blank"
              rel="noreferrer"
            >
              <MonitorPlay size={18} />
              Mở trình chiếu
            </a>
            <button
              className="primary"
              onClick={share}
              disabled={dirty || saving}
            >
              <Copy size={18} />
              Sao chép link học sinh
            </button>
          </div>
        </div>
        {message && (
          <div
            className={`message ${message.type}`}
            role={message.type === "error" ? "alert" : "status"}
          >
            {message.type === "success" && <Check size={18} />} {message.text}
          </div>
        )}
        {error && (
          <p className="message error" role="alert">
            {error}
          </p>
        )}
        {changedElsewhere && (
          <div className="message error" role="alert">
            Phòng đã được thay đổi ở cửa sổ khác. Sao chép phần chữ bạn đang sửa
            nếu cần, rồi tải lại trang để nhận bản mới.
          </div>
        )}
        <div className="workspace-grid">
          <section className="editor-panel">
            <div className="panel-heading">
              <div>
                <Palette size={21} />
                <h2>Thiết kế 3 nút</h2>
              </div>
              <span>{dirty ? "Chưa lưu" : "Đã lưu"}</span>
            </div>
            <fieldset disabled={saving || uploading}>
              <label className="field-label" htmlFor="edit-room-name">
                Tên bầu trời
              </label>
              <input
                id="edit-room-name"
                value={draft.name}
                maxLength={70}
                onChange={(e) => edit({ name: e.target.value })}
              />
              <div
                className="button-tabs"
                role="tablist"
                aria-label="Chọn nút cần sửa"
              >
                {draft.buttons.map((b, i) => (
                  <button
                    key={i}
                    role="tab"
                    aria-selected={selected === i}
                    aria-controls="button-editor"
                    id={`tab-${i}`}
                    className={selected === i ? "active" : ""}
                    onClick={() => setSelected(i)}
                  >
                    <span style={{ background: b.background, color: b.color }}>
                      {i + 1}
                    </span>
                    Nút {i + 1}
                  </button>
                ))}
              </div>
              <div
                id="button-editor"
                role="tabpanel"
                aria-labelledby={`tab-${selected}`}
              >
                <label className="field-label">Kiểu hiển thị</label>
                <div className="mode-picker">
                  {[
                    ["text", Type, "Chỉ chữ"],
                    ["image", Image, "Chỉ ảnh"],
                    ["both", Layers, "Chữ & ảnh"],
                  ].map(([value, Icon, label]) => (
                    <button
                      key={value}
                      aria-pressed={button.mode === value}
                      className={button.mode === value ? "active" : ""}
                      onClick={() => editButton({ mode: value })}
                    >
                      <Icon size={18} />
                      {label}
                    </button>
                  ))}
                </div>
                {button.mode !== "image" && (
                  <div className="text-field">
                    <div className="field-heading">
                      <label htmlFor="button-text">Nội dung chữ</label>
                      <span>{button.text.length}/60</span>
                    </div>
                    <textarea
                      id="button-text"
                      rows={3}
                      maxLength={60}
                      value={button.text}
                      placeholder="Nhập cảm xúc của con…"
                      onChange={(e) => editButton({ text: e.target.value })}
                    />
                    <span className="small-note">
                      Nhấn Enter để xuống dòng · tối đa 4 dòng
                    </span>
                  </div>
                )}
                <div className="color-fields">
                  <label>
                    <span>Màu nền nút</span>
                    <span className="color-input">
                      <input
                        type="color"
                        aria-label="Màu nền nút"
                        value={button.background}
                        onChange={(e) =>
                          editButton({ background: e.target.value })
                        }
                      />
                      <span>{button.background.toUpperCase()}</span>
                    </span>
                  </label>
                  {button.mode !== "image" && (
                    <label>
                      <span>Màu chữ</span>
                      <span className="color-input">
                        <input
                          type="color"
                          aria-label="Màu chữ"
                          value={button.color}
                          onChange={(e) =>
                            editButton({ color: e.target.value })
                          }
                        />
                        <span>{button.color.toUpperCase()}</span>
                      </span>
                    </label>
                  )}
                </div>
                {button.mode !== "image" && (
                  <>
                    <div className="font-field">
                      <label htmlFor="font-size">Cỡ chữ</label>
                      <output>{button.fontSize} px</output>
                      <input
                        id="font-size"
                        type="range"
                        min="18"
                        max="36"
                        value={button.fontSize}
                        onChange={(e) =>
                          editButton({ fontSize: Number(e.target.value) })
                        }
                      />
                    </div>
                    {contrastRatio(button.background, button.color) < 4.5 && (
                      <p className="contrast-note">
                        Hai màu này hơi khó đọc. Nên chọn chữ đậm hơn hoặc nền
                        sáng hơn.
                      </p>
                    )}
                  </>
                )}
              </div>
            </fieldset>
            {button.mode !== "text" && (
              <ImageEditor
                key={selected}
                roomId={roomId}
                button={button}
                onBusy={setUploading}
                onChange={(patch) => editButton(patch, selected)}
              />
            )}
            <div className="save-area">
              <button
                className="primary save-button"
                onClick={save}
                disabled={saving || uploading || !dirty || changedElsewhere}
              >
                {saving ? (
                  <LoaderCircle size={18} className="spin" />
                ) : (
                  <Save size={18} />
                )}{" "}
                {saving ? "Đang lưu…" : "Lưu thay đổi"}
              </button>
              <p>
                {dirty
                  ? "Lưu trước khi sao chép link cho học sinh."
                  : "Nội dung đã sẵn sàng để chia sẻ."}
              </p>
            </div>
          </section>
          <div className="preview-column">
            <div className="preview-frame">
              <div className="preview-topbar">
                <span className="window-dots">
                  <i />
                  <i />
                  <i />
                </span>
                <span>Xem trước giao diện học sinh</span>
                <span className="preview-size">
                  {dirty ? "Bản đang chỉnh" : "Bản đã lưu"}
                </span>
              </div>
              <Sky ref={sky} room={draft} preview connected={connected} />
            </div>
            <section className="counts-panel">
              <div className="counts-heading">
                <div>
                  <Radio size={20} />
                  <h2>Lượt chạm của lớp</h2>
                </div>
                <button
                  className="text-button"
                  onClick={() => setResetOpen(true)}
                >
                  <RotateCcw size={16} />
                  Đặt lại
                </button>
              </div>
              <div className="counts-grid">
                {counts.values.map((value, i) => (
                  <div className="count-card" key={i}>
                    <span
                      className="count-dot"
                      style={{ background: room.buttons[i].background }}
                    />
                    <span>Nút {i + 1}</span>
                    <strong data-count={i}>
                      {value.toLocaleString("vi-VN")}
                    </strong>
                    <small>lượt bấm</small>
                  </div>
                ))}
              </div>
              <p className="small-note">
                Đếm số lần bấm, không phải số học sinh. Mỗi lần chạm đều được
                tính.
              </p>
            </section>
            <details className="quick-guide">
              <summary>Cách dùng trong lớp</summary>
              <ol>
                <li>
                  Chỉnh từng nút rồi bấm <strong>Lưu thay đổi</strong>.
                </li>
                <li>Sao chép link học sinh và gửi cho lớp.</li>
                <li>
                  Mở trình chiếu trên máy chiếu để cả lớp cùng xem cảm xúc bay
                  lên.
                </li>
              </ol>
              <label htmlFor="student-link">
                Link học sinh (không có quyền chỉnh sửa)
              </label>
              <input
                id="student-link"
                readOnly
                value={link}
                onFocus={(e) => e.target.select()}
              />
            </details>
          </div>
        </div>
      </main>
      {resetOpen && (
        <Modal
          title="Đặt lại bộ đếm?"
          onClose={() => !resetting && setResetOpen(false)}
        >
          <p>
            Cả 3 bộ đếm của phòng sẽ về <strong>0</strong>. Nội dung và hình ảnh
            của các nút vẫn được giữ lại.
          </p>
          <p className="muted">Không thể hoàn tác số lượt đã đặt lại.</p>
          <div className="modal-actions">
            <button
              className="secondary"
              disabled={resetting}
              onClick={() => setResetOpen(false)}
            >
              Giữ nguyên
            </button>
            <button className="primary" disabled={resetting} onClick={reset}>
              {resetting ? "Đang đặt lại…" : "Đặt cả ba về 0"}
            </button>
          </div>
        </Modal>
      )}
      {shareOpen && (
        <Modal title="Link học sinh" onClose={() => setShareOpen(false)}>
          <p>Chọn toàn bộ đường link dưới đây rồi sao chép.</p>
          <input
            autoFocus
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
          />
        </Modal>
      )}
    </div>
  );
}

function StudentRoom({ projector = false }) {
  const { roomId } = useParams();
  const sky = useRef();
  const { room, error, connected, pendingCount, notice, send } = useRoom(
    roomId,
    projector ? "projector" : "student",
    (event) => sky.current?.fly(event.button, event.buttonIndex),
  );
  if (!room && error) return <ErrorPage message={error} />;
  if (!room) return <Loading />;
  return (
    <Sky
      ref={sky}
      room={room}
      onPress={send}
      projector={projector}
      connected={connected}
      pendingCount={pendingCount}
      notice={notice}
    />
  );
}

function Credits() {
  const { roomId } = useParams();
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api(`/api/rooms/${roomId}`)
      .then(setRoom)
      .catch((err) => setError(err.message));
  }, [roomId]);
  if (error) return <ErrorPage message={error} />;
  if (!room) return <Loading />;
  return (
    <main className="credits-page">
      <Brand />
      <h1>Nguồn hình ảnh</h1>
      <p>{room.name}</p>
      {room.buttons.map(
        (button, index) =>
          button.credit &&
          button.mode !== "text" && (
            <article key={index}>
              <img src={button.imageUrl} alt={`Ảnh nút ${index + 1}`} />
              <div>
                <h2>{button.credit.title}</h2>
                <p>Tác giả: {button.credit.author}</p>
                {button.credit.attribution && (
                  <p>{button.credit.attribution}</p>
                )}
                <p>
                  Giấy phép:{" "}
                  {button.credit.licenseUrl ? (
                    <a
                      href={button.credit.licenseUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {button.credit.license}
                    </a>
                  ) : (
                    button.credit.license
                  )}
                </p>
                <a
                  href={button.credit.sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Trang nguồn trên Wikimedia Commons
                </a>
                <p className="small-note">{button.credit.changes}</p>
              </div>
            </article>
          ),
      )}
      <p className="muted">
        Ảnh do giáo viên tải lên do giáo viên cung cấp và kiểm tra quyền sử
        dụng.
      </p>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/teacher" replace />} />
        <Route
          path="/teacher"
          element={
            <TeacherGate>
              <Dashboard />
            </TeacherGate>
          }
        />
        <Route
          path="/teacher/room/:roomId"
          element={
            <TeacherGate>
              <TeacherRoom />
            </TeacherGate>
          }
        />
        <Route path="/s/:roomId" element={<StudentRoom />} />
        <Route path="/projector/:roomId" element={<StudentRoom projector />} />
        <Route path="/credits/:roomId" element={<Credits />} />
        <Route
          path="*"
          element={
            <ErrorPage message="Đường link chưa đúng. Hãy dùng link giáo viên đã chia sẻ." />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
