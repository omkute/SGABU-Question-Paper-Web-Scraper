// scrape_robust.js dowloaded all pdf from one DIR 
import axios from "axios";
import * as fse from "fs-extra";
import * as fs from "fs";
import path from "path";
import * as cheerio from "cheerio";

const BASE_PAGE = "https://www.sgbaukrc.ac.in/index.php/question-papers";
const SITE_ORIGIN = "https://www.sgbaukrc.ac.in";
const ROOT_DIR = "question-papers/2024-Papers"; // starting remote folder
const DOWNLOAD_DIR = path.resolve("./downloads");
const LOGS_DIR = path.resolve("./logs");

// ==================== HELPERS ====================

function sanitizeName(name) {
  return name
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 200);
}

function remotePathToLocalFolder(remoteDirPath) {
  const rootSegments = ROOT_DIR.split("/").filter(Boolean);
  const segs = remoteDirPath.split("/").filter(Boolean);
  let relative = segs.slice(rootSegments.length);
  if (relative.length === 0) relative = ["root"];
  const safeSegs = relative.map(sanitizeName);
  return path.join(DOWNLOAD_DIR, ...safeSegs);
}

async function fetchDirHtml(dirPath) {
  const params = { sflaction: "dir", sflDir: dirPath, _: Date.now() };
  const resp = await axios.get(BASE_PAGE, { params, timeout: 20000 });
  return resp.data;
}

// ✅ Fixed: Handle both absolute and relative URLs
function buildFileUrl(remoteDirPath, href) {
  // If href is already an absolute URL, extract just the filename
  // and treat it as relative (server returns incomplete URLs)
  if (href.startsWith('http://') || href.startsWith('https://')) {
    try {
      const urlObj = new URL(href);
      // Extract just the filename from the URL path
      const filename = path.basename(urlObj.pathname);
      // Now treat it as a relative path
      href = filename;
    } catch (e) {
      console.warn(`⚠ URL parsing failed for: ${href}`);
      return href;
    }
  }

  // ensure SITE_ORIGIN has no trailing slash
  const origin = SITE_ORIGIN.replace(/\/+$/, "");

  // clean href and remoteDirPath
  const cleanHref = (href || "").replace(/^\.\//, "").replace(/^\/+/, "").trim();
  const cleanRemote = (remoteDirPath || "").replace(/^\/+|\/+$/g, "").trim();

  // join using posix to keep forward slashes (safe for URLs)
  const joined = path.posix.join(cleanRemote, cleanHref);

  // split into segments and normalize each:
  // - decodeURIComponent to undo any accidental double-encoding like %2520 -> %20
  // - then encodeURIComponent to get a single correct encoding
  const segments = joined.split("/").map((seg) => {
    if (!seg) return ""; // keep empty segments if any
    // try decode first; if it fails, fall back to raw segment
    let decoded;
    try {
      decoded = decodeURIComponent(seg);
    } catch (e) {
      decoded = seg;
    }
    return encodeURIComponent(decoded);
  });

  // re-join segments into a path (encodeURIComponent uses %20 etc.)
  const encodedPath = segments.join("/");

  // finally return absolute URL, preserving the "question-papers/..." prefix if present
  // (no extra encodeURI here — we've already encoded segments)
  return `${origin}/${encodedPath}`;
}

// ==================== DOWNLOAD ====================

async function downloadFile(url, dest, retries = 3) {
  await fse.ensureDir(path.dirname(dest));

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const r = await axios.get(url, { responseType: "stream", timeout: 30000 });
      const writer = fs.createWriteStream(dest);
      r.data.pipe(writer);
      await new Promise((res, rej) => {
        writer.on("finish", res);
        writer.on("error", rej);
      });
      console.log(`✅ Saved: ${dest}`);
      return true;
    } catch (err) {
      console.warn(`⚠ Attempt ${attempt} failed for ${url}: ${err.message}`);
      if (attempt < retries) await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.error(`❌ Failed after retries: ${url}`);
  await fse.appendFile("skipped.csv", `"${url}","${dest}"\n`);
  return false;
}

// ==================== LOGGING ====================

async function logFolder(remoteDirPath, files) {
  await fse.ensureDir(LOGS_DIR);

  const relativeDir = remoteDirPath.replace(ROOT_DIR, "").replace(/^\/+/, "") || "root";
  const logFilePath = path.join(LOGS_DIR, `${sanitizeName(relativeDir)}.md`);

  const header = `# 📁 ${remoteDirPath}\n\n| File Name | URL |\n|------------|-----|\n`;
  const rows = files
    .map(
      (f) =>
        `| ${path.basename(f.dest)} | [🔗 Open File](${f.url}) |`
    )
    .join("\n");

  const content = `${header}${rows || "_No files found_"}\n\n---\n`;
  await fse.writeFile(logFilePath, content);
  console.log(`🧾 Logged structure for: ${remoteDirPath}`);
}

// ==================== SCRAPER ====================

async function scrapeDirectory(remoteDirPath) {
  console.log("📁 Scraping:", remoteDirPath);
  let html;

  try {
    html = await fetchDirHtml(remoteDirPath);
  } catch (e) {
    console.error("❌ Failed to fetch directory:", remoteDirPath, e.message);
    await fse.appendFile("skipped.csv", `"FETCH_ERR","${remoteDirPath}","${e.message}"\n`);
    return;
  }

  const $ = cheerio.load(html);
  const items = $(".sfl_item");
  const currentLocalFolder = remotePathToLocalFolder(remoteDirPath);
  await fse.ensureDir(currentLocalFolder);

  const loggedFiles = [];

  for (let i = 0; i < items.length; i++) {
    const el = items[i];
    const a = $(el).find("a").first();
    if (!a.length) continue;

    const href = (a.attr("href") || "").trim();
    const rel = (a.attr("rel") || "").trim();
    const text = a.text().trim();

    // Handle subdirectories
    if (rel && href.includes("javascript")) {
      await scrapeDirectory(rel);
      continue;
    }

    // Handle PDF files
    const pdfPath = rel && /\.pdf$/i.test(rel) ? rel : href;
    if (pdfPath && /\.pdf(\?.*)?$/i.test(pdfPath)) {
      // Debug logging
      console.log(`🔍 DEBUG - href: ${href}`);
      console.log(`🔍 DEBUG - rel: ${rel}`);
      console.log(`🔍 DEBUG - pdfPath: ${pdfPath}`);
      
      const fileUrl = buildFileUrl(remoteDirPath, pdfPath);
      console.log(`🔍 DEBUG - Final URL: ${fileUrl}`);
      
      const baseName = sanitizeName(path.basename(fileUrl));
      const dest = path.join(currentLocalFolder, baseName);

      await downloadFile(fileUrl, dest);
      loggedFiles.push({ url: fileUrl, dest });
      continue;
    }

    // Detect folders via directory icon or text
    const imgSrc = $(el).find("img").attr("src") || "";
    if (imgSrc.includes("directory.png") || /directory/i.test(text)) {
      const guessed = `${remoteDirPath}/${text}`;
      console.log(`📂 Found subdirectory: ${guessed}`);
      await scrapeDirectory(guessed);
      continue;
    }
  }

  // Log structure for current folder
  await logFolder(remoteDirPath, loggedFiles);
}

// ==================== MAIN ====================

(async () => {
  await fse.ensureDir(DOWNLOAD_DIR);
  await fse.ensureDir(LOGS_DIR);
  console.log("🚀 Starting scrape...");
  await scrapeDirectory(ROOT_DIR);
  console.log("✅ Done!");
})();