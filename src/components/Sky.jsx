import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useLayoutEffect,
  useState,
} from "react";
import { Cloud, Maximize, Minimize } from "lucide-react";

export function ButtonContent({ button }) {
  return (
    <>
      {button.mode !== "text" && button.imageUrl && (
        <img draggable="false" src={button.imageUrl} alt="" />
      )}
      {button.mode !== "image" && (
        <span className="emotion-label">{button.text}</span>
      )}
    </>
  );
}

export function EmotionButton({
  button,
  index,
  interactive = true,
  onClick,
  buttonRef,
}) {
  const Tag = interactive ? "button" : "div";
  const content = useRef();
  useLayoutEffect(() => {
    const node = content.current;
    const label = node?.querySelector(".emotion-label");
    if (!label) return;
    let live = true;
    const fit = () => {
      if (!live) return;
      label.style.fontSize = "";
      let size = parseFloat(getComputedStyle(label).fontSize);
      const minSize = node.closest(".sky-preview") ? 11 : 14;
      const available = node.clientHeight - (button.mode === "both" ? 38 : 0);
      while (
        (label.scrollHeight > available ||
          label.scrollWidth > node.clientWidth) &&
        size > minSize
      )
        label.style.fontSize = `${--size}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    document.fonts.ready.then(fit);
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [button.text, button.fontSize, button.mode]);
  return (
    <Tag
      ref={buttonRef}
      type={interactive ? "button" : undefined}
      data-emotion={index}
      className={`emotion-button mode-${button.mode}`}
      style={{
        backgroundColor: button.background,
        color: button.color,
        "--label-size": `${button.fontSize}px`,
      }}
      onClick={interactive ? onClick : undefined}
      aria-label={
        interactive
          ? button.mode === "image"
            ? `Gửi hình ảnh ở nút ${index + 1}`
            : button.text
          : undefined
      }
    >
      <span ref={content} className="button-content">
        <ButtonContent button={button} />
      </span>
    </Tag>
  );
}

export const Sky = forwardRef(function Sky(
  {
    room,
    onPress,
    projector = false,
    preview = false,
    connected,
    pendingCount = 0,
    notice = "",
  },
  ref,
) {
  const container = useRef();
  const flightLayer = useRef();
  const imageCache = useRef(new Map());
  const animations = useRef(new Set());
  const created = useRef(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");
  useEffect(() => {
    const urls = new Set(
      room.buttons.map((button) => button.imageUrl).filter(Boolean),
    );
    for (const url of imageCache.current.keys()) {
      if (!urls.has(url)) imageCache.current.delete(url);
    }
    for (const url of urls) {
      if (imageCache.current.has(url)) continue;
      const image = new window.Image();
      image.src = url;
      imageCache.current.set(url, image);
    }
  }, [room.buttons]);
  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    update();
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  async function toggleFullscreen() {
    setFullscreenError("");
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen)
        await document.documentElement.requestFullscreen();
      else
        setFullscreenError(
          "Trình duyệt chưa hỗ trợ nút này. Trên máy tính, thầy cô có thể nhấn F11.",
        );
    } catch {
      setFullscreenError(
        "Chưa bật được toàn màn hình. Thầy cô hãy thử lại hoặc nhấn F11 trên máy tính.",
      );
    }
  }
  const spawn = (button, index) => {
    if (!container.current || !flightLayer.current) return;
    const element = document.createElement("div");
    element.className = `flying-emotion mode-${button.mode}`;
    element.dataset.flight = "true";
    element.dataset.button = String(index);
    element.style.color = button.color;
    element.style.visibility = "hidden";
    let image;
    if (button.mode !== "text" && button.imageUrl) {
      image = document.createElement("img");
      image.alt = "";
      image.draggable = false;
      image.src = button.imageUrl;
      element.append(image);
    }
    if (button.mode !== "image") {
      const text = document.createElement("span");
      text.textContent = button.text;
      element.append(text);
    }
    flightLayer.current.append(element);
    flightLayer.current.dataset.created = String(++created.current);
    let timer;
    const entry = {
      animation: null,
      removed: false,
      remove: () => {
        if (entry.removed) return;
        entry.removed = true;
        clearTimeout(timer);
        entry.animation?.cancel();
        element.remove();
        animations.current.delete(entry);
      },
    };
    animations.current.add(entry);
    // Tính cả ảnh đang tải vào giới hạn bộ nhớ; một ảnh chậm không chặn lượt sau.
    timer = setTimeout(entry.remove, 15000);
    if (animations.current.size > 240) {
      const oldest = animations.current.values().next().value;
      oldest.remove();
    }
    function start() {
      if (entry.removed || !container.current) return;
      const { width, height } = container.current.getBoundingClientRect();
      const padding = 14;
      const maxWidth = Math.max(
        1,
        Math.min(width - padding * 2, projector ? 420 : preview ? 230 : 300),
      );
      let fontSize = Math.max(
        14,
        Math.min(
          button.fontSize * (projector ? 1.2 : 1),
          preview ? 25 : 40,
          height * 0.075,
        ),
      );
      element.style.maxWidth = `${maxWidth}px`;
      element.style.fontSize = `${fontSize}px`;
      if (image) {
        const cached = imageCache.current.get(button.imageUrl);
        const naturalWidth = image.naturalWidth || cached?.naturalWidth;
        const naturalHeight = image.naturalHeight || cached?.naturalHeight;
        if (!naturalWidth || !naturalHeight) {
          if (button.mode === "image") return entry.remove();
          image.remove();
        } else {
          const size = Math.min(
            projector ? 180 : preview ? 100 : 140,
            width * 0.32,
            height * 0.24,
          );
          const scale = Math.min(size / naturalWidth, size / naturalHeight);
          image.style.width = `${naturalWidth * scale}px`;
          image.style.height = `${naturalHeight * scale}px`;
        }
      }
      // Văn bản dài được xuống dòng, không cắt bớt hoặc thêm dấu ba chấm.
      while (element.offsetHeight > height * 0.6 && fontSize > 14) {
        element.style.fontSize = `${--fontSize}px`;
      }
      const maxX = Math.max(padding, width - element.offsetWidth - padding);
      const maxY = Math.max(padding, height - element.offsetHeight - padding);
      const random = (min, max) => min + Math.random() * Math.max(0, max - min);
      const clampX = (value) => Math.max(padding, Math.min(maxX, value));
      const startX = random(padding, maxX);
      const startY = random(Math.min(maxY, height * 0.3), maxY);
      const endY = padding;
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const reach = Math.min(200, (maxX - padding) * 0.35);
      const endX = reduced ? startX : clampX(startX + random(-reach, reach));
      const controlA = reduced ? startX : clampX(startX + random(-reach, reach));
      const controlB = reduced ? startX : clampX(endX + random(-reach, reach));
      const sway = reduced
        ? 0
        : random(-Math.min(40, reach), Math.min(40, reach));
      const frames = Array.from({ length: 25 }, (_, i) => {
        const t = i / 24;
        const inverse = 1 - t;
        const x = clampX(
          inverse ** 3 * startX +
          3 * inverse ** 2 * t * controlA +
          3 * inverse * t ** 2 * controlB +
          t ** 3 * endX +
          Math.sin(t * Math.PI * 2) * sway,
        );
        const y = startY + (endY - startY) * (0.85 * t + 0.15 * t * t);
        return {
          transform: `translate3d(${x}px, ${y}px, 0)`,
          opacity: t < 0.08 ? t / 0.08 : t > 0.78 ? (1 - t) / 0.22 : 1,
          offset: t,
        };
      });
      // Giữ toàn bộ cụm trong màn hình và mờ đi ở mép trên trước khi xóa.
      element.style.visibility = "visible";
      const duration = 3400 + Math.random() * 1600;
      entry.animation = element.animate(frames, {
        duration,
        easing: "linear",
        fill: "forwards",
      });
      entry.animation.onfinish = entry.remove;
      entry.animation.oncancel = entry.remove;
      clearTimeout(timer);
      timer = setTimeout(entry.remove, duration + 500);
    }
    const cached = image && imageCache.current.get(button.imageUrl);
    if (
      !image ||
      (cached?.complete && cached.naturalWidth) ||
      (image.complete && image.naturalWidth)
    ) start();
    else image.decode().then(start, start);
  };
  useImperativeHandle(ref, () => ({ fly: spawn }));
  useEffect(
    () => () => {
      for (const entry of [...animations.current]) {
        entry.remove();
      }
    },
    [],
  );
  const hasCredit = room.buttons.some(
    (button) => button.credit && button.mode !== "text",
  );
  return (
    <section
      ref={container}
      className={`sky ${preview ? "sky-preview" : "sky-full"} ${projector ? "sky-projector" : ""}`}
      aria-label={preview ? "Xem trước bầu trời" : "Bầu trời cảm xúc"}
    >
      <div className="cloud cloud-one" aria-hidden="true" />
      <div className="cloud cloud-two" aria-hidden="true" />
      <div className="cloud cloud-three" aria-hidden="true" />
      <div className="sky-sun" aria-hidden="true">
        ☀️
      </div>
      <header className="sky-heading">
        <div className="sky-eyebrow">
          <Cloud size={18} />{" "}
          {preview ? "GÓC XEM TRƯỚC" : "BẦU TRỜI CỦA CHÚNG MÌNH"}
        </div>
        <h1>Bầu trời cảm xúc</h1>
        <p>{room.name}</p>
      </header>
      {!projector && (
        <div className="sky-empty-hint" aria-hidden="true">
          <span>✧</span>
          <p>
            {preview
              ? "Bấm thử một nút để xem cảm xúc bay lên"
              : "Chạm một nút, gửi một cảm xúc"}
          </p>
          <span>✧</span>
        </div>
      )}
      <div className="flight-layer" ref={flightLayer} aria-hidden="true" />
      {!projector && (
        <div className="emotion-dock">
          {room.buttons.map((button, index) => (
            <EmotionButton
              key={index}
              index={index}
              button={button}
              onClick={() => {
                spawn(button, index);
                onPress?.(index);
              }}
            />
          ))}
        </div>
      )}
      <footer className="sky-footer">
        <span
          className={`connection-note ${connected === false ? "offline" : ""}`}
          role="status"
        >
          {fullscreenError ||
            notice ||
            (pendingCount
              ? `${pendingCount} lượt đang chờ gửi…`
              : connected === false
                ? "Đang kết nối lại…"
                : preview
                  ? "Bấm thử không cộng vào bộ đếm"
                  : projector
                    ? "Đang nhận cảm xúc của cả lớp"
                    : "Con có thể bấm nhiều lần nhé!")}
        </span>
        {hasCredit && (
          <a href={`/credits/${room.id}`} target="_blank" rel="noreferrer">
            Nguồn ảnh
          </a>
        )}
      </footer>
      {projector && (
        <button
          className="projector-fullscreen"
          title={fullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
          aria-label={fullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
          aria-pressed={fullscreen}
          onClick={toggleFullscreen}
        >
          {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          <span>{fullscreen ? "Thu nhỏ" : "Toàn màn hình"}</span>
        </button>
      )}
    </section>
  );
});
