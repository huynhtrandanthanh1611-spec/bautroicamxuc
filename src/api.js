export async function api(path, options = {}) {
  const form = options.body instanceof FormData;
  let response;
  try {
    response = await fetch(path, {
      credentials: "same-origin",
      ...options,
      headers: {
        "X-Sky-Request": "1",
        ...(!form && options.body
          ? { "Content-Type": "application/json" }
          : {}),
        ...options.headers,
      },
      body: options.body && !form ? JSON.stringify(options.body) : options.body,
    });
  } catch {
    throw new Error(
      "Chưa kết nối được máy chủ. Hãy kiểm tra mạng rồi thử lại.",
    );
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || "Có lỗi xảy ra. Vui lòng thử lại.");
    error.status = response.status;
    throw error;
  }
  return result;
}

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const value = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

export async function copyLink(value) {
  if (navigator.clipboard && window.isSecureContext)
    return navigator.clipboard.writeText(value);
  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  const ok = document.execCommand("copy");
  input.remove();
  if (!ok)
    throw new Error(
      "Trình duyệt chưa cho sao chép. Hãy chọn và sao chép đường link trong ô bên dưới.",
    );
}
