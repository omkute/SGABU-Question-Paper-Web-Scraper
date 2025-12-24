It looks like you want to generate a clean, professional `README.md` for your scraping script. I have organized it to highlight the **robustness** of your code (especially that tricky URL handling) and the **automated logging** features.

---

# 📚 SGBAU Question Paper Scraper

A robust **Node.js** utility designed to recursively crawl, log, and download academic question papers from the SGBAU KRC portal. This scraper handles deep directory nesting, complex URL encoding, and provides detailed logging for every file processed.

---

## 🚀 Features

* **Recursive Tree Traversal:** Automatically discovers and enters subdirectories to map out the entire server structure.
* **Smart URL Normalization:** Features a custom URL builder that handles absolute/relative paths and corrects double-encoding issues (e.g., `%2520` vs `%20`).
* **Resilient Downloading:** Built-in retry logic (3 attempts) with timeout handling to manage server instability.
* **Automated Documentation:** Generates a structured Markdown log for every folder, creating a digital "table of contents" for your downloads.
* **Safe File Naming:** Sanitizes filenames to remove illegal characters and prevent directory traversal issues.

---

## 🛠️ Setup & Installation

1. **Dependencies:** Ensure you have [Node.js](https://nodejs.org/) installed.
2. **Install Packages:**
```bash
npm install axios fs-extra cheerio

```


3. **Configuration:**
The script is pre-configured to target the 2024 papers. You can modify these constants at the top of `scrape_robust.js`:
* `ROOT_DIR`: The starting directory on the server.
* `DOWNLOAD_DIR`: Where you want the files saved locally.



---

## 📂 Output Structure

The script organizes data into three main areas:

| Path | Purpose |
| --- | --- |
| **`/downloads`** | PDF files mirrored in their original folder hierarchy. |
| **`/logs`** | `.md` files containing a table of filenames and their source URLs. |
| **`skipped.csv`** | A log of any files that failed to download after all retries. |

---

## ⚙️ How It Works

1. **Fetch:** It requests the HTML for the specified directory using the `sflDir` parameter.
2. **Parse:** Uses `Cheerio` to identify `<a>` tags and distinguish between PDF files and subdirectories.
3. **Normalize:** The `buildFileUrl` helper ensures the remote path is correctly encoded for the browser.
4. **Download:** Downloads the stream directly to the local disk using `fs-extra`.
5. **Recurse:** If a directory is found, the script calls itself to dive deeper into the structure.

---

## 🛡️ Best Practices Included

* **Asynchronous Flow:** Uses `async/await` throughout to prevent blocking the event loop.
* **Error Boundaries:** Prevents the entire script from crashing if a single directory fetch fails.
* **Memory Efficient:** Uses streams for file writing to keep memory usage low, even for large PDFs.

Would you like me to help you create a `package.json` file with a pre-configured `start` script for this project?