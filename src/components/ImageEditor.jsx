import { useRef, useState } from "react";
import {
  ImagePlus,
  Search,
  ClipboardPaste,
  Trash2,
  LoaderCircle,
} from "lucide-react";
import { api } from "../api";
import Modal from "./Modal";

export function ImageSearch({ roomId, onSelect, onClose }) {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [items, setItems] = useState(null);
  const [nextOffset, setNextOffset] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(null);
  const [error, setError] = useState("");
  const request = useRef(0);
  async function search(event, offset = 0) {
    event?.preventDefault();
    const term = offset ? searched : query.trim();
    if (term.length < 2) return setError("Hãy nhập ít nhất 2 ký tự.");
    const id = ++request.current;
    setLoading(true);
    setError("");
    try {
      const result = await api(
        `/api/teacher/images/search?q=${encodeURIComponent(term)}&offset=${offset}`,
      );
      if (id !== request.current) return;
      setItems((current) =>
        offset ? [...current, ...result.items] : result.items,
      );
      setNextOffset(result.nextOffset);
      setSearched(term);
    } catch (err) {
      if (id === request.current) setError(err.message);
    } finally {
      if (id === request.current) setLoading(false);
    }
  }
  async function select(item) {
    setImporting(item.pageId);
    setError("");
    try {
      const image = await api(`/api/teacher/rooms/${roomId}/import-image`, {
        method: "POST",
        body: { pageId: item.pageId },
      });
      onSelect(image);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(null);
    }
  }
  return (
    <Modal title="Tìm ảnh trên mạng" wide onClose={onClose}>
      <p className="muted">
        Ảnh từ Wikimedia Commons có giấy phép tái sử dụng. Thông tin tác giả và
        giấy phép sẽ được lưu cùng ảnh.
      </p>
      <form className="search-form" onSubmit={search}>
        <label className="sr-only" htmlFor="image-query">
          Từ khóa tìm ảnh
        </label>
        <input
          id="image-query"
          autoFocus
          placeholder="Ví dụ: hoa hướng dương, smile icon…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={100}
        />
        <button className="primary" disabled={loading || !!importing}>
          <Search size={18} />
          Tìm ảnh
        </button>
      </form>
      <p className="small-note">
        Thử từ khóa tiếng Anh nếu có ít kết quả. Giáo viên chọn ảnh phù hợp
        trước khi chia sẻ cho học sinh.
      </p>
      {error && (
        <p className="message error" role="alert">
          {error}
        </p>
      )}
      {loading && (
        <p className="loading-line" role="status">
          <LoaderCircle className="spin" size={20} /> Đang tìm ảnh thật từ
          Wikimedia…
        </p>
      )}
      {!loading && items?.length === 0 && (
        <div className="empty-search">
          Chưa có ảnh phù hợp. Hãy thử từ khóa khác hoặc xem tiếp.
        </div>
      )}
      {items && (
        <div className="search-results">
          {items.map((item) => (
            <article className="search-result" key={item.pageId}>
              <button
                className="search-thumbnail"
                onClick={() => select(item)}
                disabled={!!importing}
                aria-label={`Chọn ${item.title}`}
              >
                <img src={item.thumbnail} alt={item.title} loading="lazy" />
                {importing === item.pageId && (
                  <span className="import-overlay">
                    <LoaderCircle className="spin" />
                    Đang tải…
                  </span>
                )}
              </button>
              <p title={item.title}>{item.title}</p>
              <small>{item.license}</small>
              <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                Xem nguồn & tác giả
              </a>
            </article>
          ))}
        </div>
      )}
      {nextOffset !== null && (
        <button
          className="secondary search-more"
          disabled={loading || !!importing}
          onClick={() => search(null, nextOffset)}
        >
          Xem thêm ảnh
        </button>
      )}
    </Modal>
  );
}

export default function ImageEditor({ roomId, button, onChange, onBusy }) {
  const input = useRef();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  async function upload(file) {
    if (!file || busy) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
      return setError("Chọn ảnh PNG, JPG hoặc WebP.");
    if (file.size > 5 * 1024 * 1024)
      return setError("Ảnh quá lớn. Dung lượng tối đa là 5 MB.");
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("image", file);
      onChange(
        await api(`/api/teacher/rooms/${roomId}/images`, {
          method: "POST",
          body,
        }),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  function paste(event) {
    const item = [...(event.clipboardData?.items || [])].find(
      (item) => item.kind === "file" && item.type.startsWith("image/"),
    );
    if (!item) return; // Không preventDefault khi clipboard chỉ chứa chữ.
    event.preventDefault();
    upload(item.getAsFile());
  }
  return (
    <div className="image-editor">
      <div className="field-heading">
        <label>Hình ảnh</label>
        <span>PNG, JPG, WebP · tối đa 5 MB</span>
      </div>
      <input
        ref={input}
        className="sr-only"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          upload(e.target.files?.[0]);
          e.target.value = "";
        }}
        aria-label="Chọn tệp ảnh"
      />
      <div
        className={`paste-zone ${dragging ? "dragging" : ""}`}
        tabIndex={0}
        role="group"
        aria-label="Vùng dán hoặc thả ảnh"
        onPaste={paste}
        onClick={(e) => e.currentTarget.focus()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          upload(e.dataTransfer.files?.[0]);
        }}
      >
        {busy ? (
          <LoaderCircle className="spin" size={28} />
        ) : button.imageUrl ? (
          <img
            className="uploaded-preview"
            src={button.imageUrl}
            alt="Ảnh đang chọn"
          />
        ) : (
          <ClipboardPaste size={28} />
        )}
        <strong>
          {busy ? "Đang tải ảnh…" : "Bấm vào đây rồi nhấn Ctrl + V để dán ảnh"}
        </strong>
        <span>Mac: Cmd + V · hoặc kéo thả ảnh vào đây</span>
      </div>
      <div className="image-actions">
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => input.current.click()}
        >
          <ImagePlus size={17} />
          {button.imageUrl ? "Thay ảnh" : "Chọn tệp"}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => setSearchOpen(true)}
        >
          <Search size={17} />
          Tìm ảnh trên mạng
        </button>
      </div>
      {button.imageUrl && (
        <div className="image-details">
          <span>
            {button.credit
              ? `${button.credit.license} · ${button.credit.author}`
              : "Ảnh bạn đã tải lên · giữ nguyên tỉ lệ"}
          </span>
          <button
            className="text-button danger-text"
            type="button"
            disabled={busy}
            onClick={() =>
              onChange({ imageId: null, imageUrl: null, credit: null })
            }
          >
            <Trash2 size={15} />
            Xóa ảnh
          </button>
        </div>
      )}
      {error && (
        <p className="message error" role="alert">
          {error}
        </p>
      )}
      {searchOpen && (
        <ImageSearch
          roomId={roomId}
          onClose={() => setSearchOpen(false)}
          onSelect={onChange}
        />
      )}
    </div>
  );
}
