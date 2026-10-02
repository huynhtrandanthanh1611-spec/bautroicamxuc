import sharp from "sharp";
import he from "he";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export async function normalizeImage(bytes) {
  if (!bytes?.length || bytes.length > MAX_IMAGE_BYTES)
    throw new AppError("Ảnh phải có dung lượng tối đa 5 MB.");
  try {
    const image = sharp(bytes, {
      limitInputPixels: 25000000,
      animated: false,
      failOn: "error",
    });
    const meta = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(meta.format))
      throw new AppError("Chỉ nhận ảnh PNG, JPG hoặc WebP.");
    if ((meta.pages || 1) > 1)
      throw new AppError("Vui lòng dùng ảnh tĩnh PNG, JPG hoặc WebP.");
    return await image
      .rotate()
      .resize(1280, 1280, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 90, alphaQuality: 100 })
      .toBuffer();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "Tệp ảnh bị hỏng hoặc quá lớn về kích thước (tối đa 25 triệu điểm ảnh).",
    );
  }
}

const cleanText = (value) =>
  he
    .decode(
      String(value || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " "),
    )
    .trim()
    .slice(0, 1000);
function publicHttps(value, hosts) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      hosts.includes(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function commonsItem(page) {
  const info = page.imageinfo?.[0];
  if (!info || !["image/png", "image/jpeg", "image/webp"].includes(info.mime))
    return null;
  const meta = info.extmetadata || {};
  const license = cleanText(meta.LicenseShortName?.value);
  // Chỉ chọn phạm vi công cộng, CC0, CC BY và CC BY-SA có phiên bản rõ ràng.
  // Không lấy file chỉ cấp GFDL hoặc metadata giấy phép không rõ.
  if (!/^(Public domain|CC0|CC BY(?:-SA)? [1-4]\.0)$/i.test(license))
    return null;
  const thumbnail = publicHttps(info.thumburl || info.url, [
    "upload.wikimedia.org",
    "thumb.wikimedia.org",
  ]);
  const sourceUrl = publicHttps(info.descriptionurl, ["commons.wikimedia.org"]);
  const licenseUrl = publicHttps(
    String(meta.LicenseUrl?.value || "").replace(/^http:/, "https:"),
    ["creativecommons.org", "www.creativecommons.org"],
  );
  if (!thumbnail || !sourceUrl || (license.startsWith("CC BY") && !licenseUrl))
    return null;
  return {
    pageId: page.pageid,
    title: cleanText(page.title.replace(/^File:/, "")),
    thumbnail,
    sourceUrl,
    license,
    licenseUrl,
    author: cleanText(meta.Artist?.value) || "Xem tác giả tại trang nguồn",
    attribution: cleanText(meta.Attribution?.value),
    changes: "Thu nhỏ và chuyển định dạng sang WebP; giữ nguyên tỉ lệ.",
  };
}

export function createImageService({ userAgent, fetcher = fetch } = {}) {
  const cache = new Map();
  async function request(params) {
    const query = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      prop: "imageinfo",
      iiprop: "url|extmetadata|mime",
      iiurlwidth: "960",
      iiextmetadatafilter: "Artist|Attribution|LicenseShortName|LicenseUrl",
      ...params,
    });
    try {
      const response = await fetcher(
        `https://commons.wikimedia.org/w/api.php?${query}`,
        {
          headers: {
            "User-Agent":
              userAgent || "BauTroiCamXuc/1.0 (classroom application)",
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(20000),
          redirect: "error",
        },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (result.error) throw new Error(result.error.code);
      return result;
    } catch {
      throw new AppError(
        "Chưa kết nối được Wikimedia Commons. Hãy thử lại; bạn vẫn có thể tải hoặc dán ảnh từ máy.",
        502,
      );
    }
  }
  async function search(query, offset = 0) {
    const key = `${query}:${offset}`;
    const cached = cache.get(key);
    if (cached?.until > Date.now()) return cached.data;
    const result = await request({
      generator: "search",
      gsrsearch: `${query} filetype:bitmap`,
      gsrnamespace: "6",
      gsrlimit: "20",
      gsroffset: String(offset),
    });
    const data = {
      items: (result.query?.pages || [])
        .sort((a, b) => a.index - b.index)
        .map(commonsItem)
        .filter(Boolean),
      nextOffset: result.continue?.gsroffset ?? null,
      source: "Wikimedia Commons",
    };
    if (cache.size > 100) cache.clear();
    cache.set(key, { until: Date.now() + 300000, data });
    return data;
  }
  async function importImage(pageId) {
    // Truy vấn lại metadata từ Commons. Không nhận URL/giấy phép do trình duyệt gửi lên.
    const result = await request({ pageids: String(pageId) });
    const item = commonsItem(result.query?.pages?.[0] || {});
    if (!item)
      throw new AppError(
        "Ảnh này không có định dạng hoặc giấy phép phù hợp. Vui lòng chọn ảnh khác.",
      );
    let response;
    try {
      response = await fetcher(item.thumbnail, {
        signal: AbortSignal.timeout(25000),
        redirect: "error",
        headers: { "User-Agent": userAgent || "BauTroiCamXuc/1.0" },
      });
    } catch {
      throw new AppError(
        "Không tải được ảnh từ Wikimedia. Vui lòng thử ảnh khác.",
        502,
      );
    }
    if (!response.ok)
      throw new AppError(
        "Nguồn ảnh đang bận. Vui lòng thử lại hoặc chọn ảnh khác.",
        502,
      );
    if (Number(response.headers.get("content-length")) > MAX_IMAGE_BYTES)
      throw new AppError("Ảnh trên mạng lớn hơn 5 MB. Vui lòng chọn ảnh khác.");
    const chunks = [];
    let total = 0;
    for await (const chunk of response.body) {
      total += chunk.length;
      if (total > MAX_IMAGE_BYTES)
        throw new AppError(
          "Ảnh trên mạng lớn hơn 5 MB. Vui lòng chọn ảnh khác.",
        );
      chunks.push(chunk);
    }
    return { bytes: await normalizeImage(Buffer.concat(chunks)), credit: item };
  }
  return { search, importImage };
}
