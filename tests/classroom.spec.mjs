import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { mkdirSync } from "node:fs";

async function loginAndCreate(page) {
  await page.goto("/teacher");
  await page.getByLabel("Mật khẩu giáo viên").fill("UI-test-password-2026");
  await page.getByRole("button", { name: "Vào góc giáo viên" }).click();
  await page.getByLabel("Tên phòng mới").fill("Lớp 1.4 · Hôm nay con thế nào?");
  await page.getByRole("button", { name: "Tạo phòng tương tác" }).click();
  await expect(
    page.getByRole("heading", { name: "Thiết kế 3 nút" }),
  ).toBeVisible();
  return page.url().split("/").at(-1);
}
const makePNG = () =>
  sharp({
    create: {
      width: 160,
      height: 100,
      channels: 4,
      background: { r: 252, g: 114, b: 154, alpha: 0.55 },
    },
  })
    .png()
    .toBuffer();

test("đủ 3 kiểu nút; dán ảnh/chữ thật; lưu/reload; thiết bị độc lập; bấm nhanh, echo, trình chiếu, reset", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const roomId = await loginAndCreate(page);
  await page.getByLabel("Nội dung chữ").fill("Con thích\nrất nhiều");
  await page.getByRole("tab", { name: "2 Nút 2" }).click();
  await page.getByRole("button", { name: "Chỉ ảnh", exact: true }).click();
  const bytes = await makePNG();
  await page
    .getByLabel("Chọn tệp ảnh")
    .setInputFiles({
      name: "anh-thu.png",
      mimeType: "image/png",
      buffer: bytes,
    });
  await expect(page.getByAltText("Ảnh đang chọn")).toBeVisible();
  await page.getByRole("tab", { name: "3 Nút 3" }).click();
  await page.getByRole("button", { name: "Chữ & ảnh", exact: true }).click();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate(async (base64) => {
    const blob = new Blob(
      [Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))],
      { type: "image/png" },
    );
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  }, bytes.toString("base64"));
  await page.getByRole("group", { name: "Vùng dán hoặc thả ảnh" }).click();
  await page.keyboard.press("Control+V");
  await expect(page.getByAltText("Ảnh đang chọn")).toBeVisible();
  await page.evaluate(() => navigator.clipboard.writeText("Cùng học nhé!"));
  const textarea = page.getByLabel("Nội dung chữ");
  await textarea.fill("");
  await textarea.focus();
  await page.keyboard.press("Control+V");
  await expect(textarea).toHaveValue("Cùng học nhé!");
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(
    page.getByText("Đã lưu thành công. Học sinh đã nhận nội dung mới."),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Nội dung chữ")).toHaveValue(
    "Con thích\nrất nhiều",
  );
  mkdirSync("test-results/screenshots", { recursive: true });
  await page.screenshot({
    path: "test-results/screenshots/teacher-desktop.png",
    fullPage: true,
  });
  const studentContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const student = await studentContext.newPage();
  const projector = await studentContext.newPage();
  await student.goto(`/s/${roomId}`);
  await projector.goto(`/projector/${roomId}`);
  await expect(student.locator("button[data-emotion]")).toHaveCount(3);
  await expect(student.locator("button")).toHaveCount(3);
  await expect(student.locator('[data-emotion="1"] img')).toBeVisible();
  await expect(student.locator('[data-emotion="2"]')).toContainText(
    "Cùng học nhé!",
  );
  await expect(
    projector.getByText("Đang nhận cảm xúc của cả lớp"),
  ).toBeVisible();
  await expect(projector.locator(".emotion-dock")).toHaveCount(0);
  await expect(projector.locator("[data-emotion]")).toHaveCount(0);
  for (let i = 0; i < 10; i++)
    await student.locator('[data-emotion="0"]').click();
  await expect(page.locator('[data-count="0"]')).toHaveText("10");
  await expect(student.locator(".flight-layer")).toHaveAttribute(
    "data-created",
    "10",
  );
  await expect(projector.locator(".flight-layer")).toHaveAttribute(
    "data-created",
    "10",
  );
  await expect(page.locator(".flight-layer")).toHaveAttribute("data-created", "10");
  await student.screenshot({
    path: "test-results/screenshots/student-mobile.png",
  });
  const geometry = await student.evaluate(() => ({
    w: innerWidth,
    h: innerHeight,
    sw: document.documentElement.scrollWidth,
    sh: document.documentElement.scrollHeight,
    buttons: [...document.querySelectorAll("[data-emotion]")].map((b) => ({
      x: b.getBoundingClientRect().x,
      right: b.getBoundingClientRect().right,
      top: b.getBoundingClientRect().top,
      bottom: b.getBoundingClientRect().bottom,
    })),
  }));
  expect(geometry.sw).toBeLessThanOrEqual(geometry.w);
  expect(geometry.sh).toBeLessThanOrEqual(geometry.h);
  for (const b of geometry.buttons) {
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.right).toBeLessThanOrEqual(geometry.w);
    expect(b.bottom).toBeLessThanOrEqual(geometry.h);
  }
  await expect(student.locator("[data-flight]")).toHaveCount(0, {
    timeout: 6500,
  });
  const security = await student.evaluate(
    async (roomId) =>
      (
        await fetch(`/api/teacher/rooms/${roomId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "X-Sky-Request": "1" },
          body: "{}",
        })
      ).status,
    roomId,
  );
  expect(security).toBe(401);
  await page.getByLabel("Nội dung chữ").fill("Con hiểu rồi!");
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(student.locator('[data-emotion="0"]')).toContainText(
    "Con hiểu rồi!",
  );
  await page.getByRole("button", { name: "Đặt lại", exact: true }).click();
  await page.getByRole("button", { name: "Giữ nguyên" }).click();
  await expect(page.locator('[data-count="0"]')).toHaveText("10");
  await page.getByRole("button", { name: "Đặt lại", exact: true }).click();
  await page.getByRole("button", { name: "Đặt cả ba về 0" }).click();
  await expect(page.locator('[data-count="0"]')).toHaveText("0");
  await student.locator('[data-emotion="2"]').click();
  await expect(page.locator('[data-count="2"]')).toHaveText("1");
  await studentContext.close();
});

test("tìm và nhập ảnh thật từ Wikimedia; nguồn lưu bền vững", async ({
  page,
}) => {
  test.setTimeout(100000);
  await loginAndCreate(page);
  await page.getByRole("button", { name: "Chữ & ảnh", exact: true }).click();
  await page
    .getByRole("button", { name: "Tìm ảnh trên mạng", exact: true })
    .click();
  await page.getByLabel("Từ khóa tìm ảnh").fill("sunflower");
  await page.getByRole("button", { name: "Tìm ảnh", exact: true }).click();
  await expect(page.locator(".search-result").first()).toBeVisible({
    timeout: 30000,
  });
  await page.locator(".search-thumbnail").first().click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 55000 });
  await expect(page.getByAltText("Ảnh đang chọn")).toBeVisible();
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(
    page.getByText("Đã lưu thành công. Học sinh đã nhận nội dung mới."),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByAltText("Ảnh đang chọn")).toBeVisible();
  await expect(page.getByRole("link", { name: "Nguồn ảnh" })).toBeVisible();
});

test("kéo thả, xóa/thay ảnh, chữ HTML hiển thị nguyên văn và bố cục ngang điện thoại", async ({
  page,
  browser,
}) => {
  const roomId = await loginAndCreate(page);
  await page.getByRole("button", { name: "Chữ & ảnh", exact: true }).click();
  const base64 = (await makePNG()).toString("base64");
  const dataTransfer = await page.evaluateHandle((base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], "drop.png", { type: "image/png" }));
    return dt;
  }, base64);
  await page
    .getByRole("group", { name: "Vùng dán hoặc thả ảnh" })
    .dispatchEvent("drop", { dataTransfer });
  await expect(page.getByAltText("Ảnh đang chọn")).toBeVisible();
  await page.getByRole("button", { name: "Xóa ảnh", exact: true }).click();
  await expect(page.getByAltText("Ảnh đang chọn")).toHaveCount(0);
  await page
    .getByLabel("Chọn tệp ảnh")
    .setInputFiles({
      name: "replace.png",
      mimeType: "image/png",
      buffer: Buffer.from(base64, "base64"),
    });
  await expect(page.getByAltText("Ảnh đang chọn")).toBeVisible();
  const text = "<img src=x onerror=alert(1)>\nAn toàn";
  await page.getByLabel("Nội dung chữ").fill(text);
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(
    page.getByText("Đã lưu thành công. Học sinh đã nhận nội dung mới."),
  ).toBeVisible();
  const context = await browser.newContext({
    viewport: { width: 740, height: 360 },
  });
  const student = await context.newPage();
  let dialogs = 0;
  student.on("dialog", async (d) => {
    dialogs++;
    await d.dismiss();
  });
  await student.goto(`/s/${roomId}`);
  await expect(student.locator('[data-emotion="0"]')).toContainText(text);
  expect(dialogs).toBe(0);
  const dimensions = await student.evaluate(() => ({
    scroll: document.documentElement.scrollHeight,
    h: innerHeight,
    last: document.querySelector('[data-emotion="2"]').getBoundingClientRect()
      .bottom,
  }));
  expect(dimensions.scroll).toBe(dimensions.h);
  expect(dimensions.last).toBeLessThan(dimensions.h);
  await student.screenshot({
    path: "test-results/screenshots/student-landscape.png",
  });
  await context.close();
});

test("trình chiếu không có nút cảm xúc; nhiều học sinh; cụm không khung, đầy đủ nội dung và bay rải khắp màn hình", async ({ page, browser }) => {
  const roomId = await loginAndCreate(page);
  const content = "Mỗi ngày đến lớp\nlà một ngày vui!\nCon thích học cùng bạn.";
  await page.getByLabel("Nội dung chữ").fill(content);
  await page.getByRole("tab", { name: "2 Nút 2" }).click();
  await page.getByRole("button", { name: "Chỉ ảnh", exact: true }).click();
  const bytes = await makePNG();
  await page.getByLabel("Chọn tệp ảnh").setInputFiles({ name: "anh-ngang.png", mimeType: "image/png", buffer: bytes });
  await expect(page.getByAltText("Ảnh đang chọn")).toBeVisible();
  await page.getByRole("tab", { name: "3 Nút 3" }).click();
  await page.getByRole("button", { name: "Chữ & ảnh", exact: true }).click();
  await page.getByLabel("Chọn tệp ảnh").setInputFiles({ name: "anh-va-chu.png", mimeType: "image/png", buffer: bytes });
  await expect(page.getByAltText("Ảnh đang chọn")).toBeVisible();
  await page.getByLabel("Nội dung chữ").fill("Con thích\nhọc cùng bạn!");
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(page.getByText("Đã lưu thành công. Học sinh đã nhận nội dung mới.")).toBeVisible();
  const projector = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  await projector.goto(`/projector/${roomId}`);
  await expect(projector.getByText("Đang nhận cảm xúc của cả lớp")).toBeVisible();
  await expect(projector.locator(".emotion-dock, [data-emotion]")).toHaveCount(0);
  await projector.getByRole("button", { name: "Toàn màn hình", exact: true }).click();
  await expect.poll(() => projector.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await projector.getByRole("button", { name: "Thoát toàn màn hình", exact: true }).click();
  await expect.poll(() => projector.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext({ viewport: { width: 390, height: 844 } })));
  const students = await Promise.all(contexts.map(context => context.newPage()));
  await Promise.all(students.map(async student => {
    await student.goto(`/s/${roomId}`);
    await expect(student.getByText("Con có thể bấm nhiều lần nhé!")).toBeVisible();
    await expect(student.locator("button")).toHaveCount(3);
    await student.evaluate(() => document.fonts.ready);
  }));
  // Mỗi máy gửi 10 lượt, cùng lúc; mỗi máy chỉ hiển thị mỗi sự kiện một lần.
  await Promise.all(students.map((student, index) => student.locator(`[data-emotion="${index}"]`).evaluate(button => { for (let i = 0; i < 10; i++) button.click(); })));
  for (const screen of [...students, projector]) {
    await expect(screen.locator(".flight-layer")).toHaveAttribute("data-created", "30");
  }
  for (let i = 0; i < 3; i++) await expect(page.locator(`[data-count="${i}"]`)).toHaveText("10");
  await expect(projector.locator('[data-flight][data-button="0"] span').first()).toHaveText(content);
  await expect(projector.locator('[data-flight][data-button="2"]').first()).toContainText("Con thích\nhọc cùng bạn!");
  // Dừng tạm trong phép kiểm tra để đo trọn quỹ đạo, gồm cả hai mép màn hình.
  for (const screen of [students[0], projector]) {
    const measurements = await screen.evaluate(() => {
      const layer = document.querySelector(".flight-layer").getBoundingClientRect();
      const starts = [];
      const problems = [];
      for (const el of document.querySelectorAll("[data-flight]")) {
        const animation = el.getAnimations()[0];
        if (!animation) { problems.push("missing animation"); continue; }
        animation.pause();
        const style = getComputedStyle(el);
        if (style.backgroundColor !== "rgba(0, 0, 0, 0)" || style.borderTopWidth !== "0px" || style.paddingTop !== "0px" || style.boxShadow !== "none") problems.push("visible frame");
        if (style.pointerEvents !== "none") problems.push("blocks input");
        const img = el.querySelector("img");
        if (img && Math.abs(img.width / img.height - img.naturalWidth / img.naturalHeight) > 0.03) problems.push("image distorted");
        const duration = animation.effect.getTiming().duration;
        for (const progress of [0, 0.25, 0.5, 0.75, 0.95]) {
          animation.currentTime = progress * duration;
          const box = el.getBoundingClientRect();
          if (progress === 0) starts.push([box.x, box.y]);
          if (box.left < layer.left - 1 || box.right > layer.right + 1 || box.top < layer.top - 1 || box.bottom > layer.bottom + 1) problems.push("clipped content");
        }
        animation.currentTime = duration * 0.2;
        animation.play();
      }
      return { problems, uniqueX: new Set(starts.map(p => Math.round(p[0]))).size, uniqueY: new Set(starts.map(p => Math.round(p[1]))).size };
    });
    expect(measurements.problems).toEqual([]);
    expect(measurements.uniqueX).toBeGreaterThan(5);
    expect(measurements.uniqueY).toBeGreaterThan(5);
  }
  await expect(projector.locator("[data-flight]")).toHaveCount(0, { timeout: 6500 });
  await expect(students[0].locator("[data-flight]")).toHaveCount(0, { timeout: 6500 });
  await Promise.all(contexts.map(context => context.close()));
  await projector.close();
});
