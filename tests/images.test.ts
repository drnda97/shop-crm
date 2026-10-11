import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { detectImage, makeSizes } from "@/lib/images";
import { FULL_WIDTH, hasSizes, IMAGE_WIDTHS, imageSizes, sizedSrc, srcSet } from "@/lib/media";

const photo = readFileSync("public/shop/ds-room.jpg");

describe("prepoznavanje slike", () => {
  it("tip se čita iz sadržaja", async () => {
    expect(detectImage(photo)).toBe("jpg");
    expect(detectImage(await sharp(photo).resize(40).png().toBuffer())).toBe("png");
    expect(detectImage(await sharp(photo).resize(40).webp().toBuffer())).toBe("webp");
    expect(detectImage(Buffer.from('<?xml version="1.0"?>\n<!-- logo -->\n<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe("svg");
    expect(detectImage(Buffer.from("<svg viewBox='0 0 1 1'/>"))).toBe("svg");
  });

  it("sve ostalo se odbija, i kada se zove kao slika", () => {
    expect(detectImage(Buffer.from("<html><svg></svg></html>"))).toBeNull();
    expect(detectImage(Buffer.from("GIF89a..."))).toBeNull();
    expect(detectImage(Buffer.from("<?php echo 1;"))).toBeNull();
    expect(detectImage(Buffer.alloc(0))).toBeNull();
  });
});

describe("veličine slike", () => {
  it("fotografija postaje WebP u svim širinama", async () => {
    const source = await sharp(photo).resize({ width: 3000 }).jpeg().toBuffer();
    const files = await makeSizes(source, "slika-test");
    expect(files.map((file) => file.name)).toEqual([
      "slika-test-full.webp",
      ...IMAGE_WIDTHS.map((width) => `slika-test-w${width}.webp`),
    ]);
    const meta = await Promise.all(files.map((file) => sharp(file.data).metadata()));
    expect(meta.every((item) => item.format === "webp")).toBe(true);
    expect(meta.map((item) => item.width)).toEqual([FULL_WIDTH, ...IMAGE_WIDTHS]);
    // Manje veličine su zaista manji fajlovi.
    expect(files[1].data.length).toBeLessThan(files[0].data.length / 10);
  });

  it("mala slika se ne uvećava", async () => {
    const small = await sharp(photo).resize({ width: 500 }).png().toBuffer();
    const files = await makeSizes(small, "mala");
    const widths = await Promise.all(files.map(async (file) => (await sharp(file.data).metadata()).width));
    expect(widths).toEqual([500, 320, 500, 500, 500]);
  });

  it("oštećen fajl javlja grešku", async () => {
    await expect(makeSizes(photo.subarray(0, 300), "x")).rejects.toThrow();
  });
});

describe("adrese veličina", () => {
  const src = "/media/slika-abc123-full.webp";

  it("bira najmanju veličinu koja pokriva traženu širinu", () => {
    expect(sizedSrc(src, 64)).toBe("/media/slika-abc123-w320.webp");
    expect(sizedSrc(src, 700)).toBe("/media/slika-abc123-w1024.webp");
    expect(sizedSrc(src, 2000)).toBe(src);
  });

  it("stare slike, SVG i slike teme nemaju veličine", () => {
    for (const other of ["/media/stara.jpg", "/media/stara.webp", "/media/logo.svg", "/shop/ds-hero.jpg"]) {
      expect(hasSizes(other)).toBe(false);
      expect(sizedSrc(other, 320)).toBe(other);
      expect(srcSet(other)).toBeNull();
      expect(imageSizes(other)).toBeNull();
    }
  });

  it("srcset navodi sve širine", () => {
    expect(srcSet(src)).toBe(
      "/media/slika-abc123-w320.webp 320w, /media/slika-abc123-w640.webp 640w, /media/slika-abc123-w1024.webp 1024w, /media/slika-abc123-w1600.webp 1600w, /media/slika-abc123-full.webp 2400w",
    );
    expect(imageSizes(src)?.thumb).toBe("/media/slika-abc123-w320.webp");
  });
});
