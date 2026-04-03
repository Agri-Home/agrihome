/**
 * Next.js standalone output does not copy `.next/static` or `public` into
 * `.next/standalone`. Without them, `node .next/standalone/server.js` starts
 * but the app has no client JS or public files.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");
const staticSrc = path.join(root, ".next", "static");
const staticDest = path.join(standalone, ".next", "static");
const publicSrc = path.join(root, "public");
const publicDest = path.join(standalone, "public");

if (!fs.existsSync(standalone)) {
  process.exit(0);
}

if (fs.existsSync(staticSrc)) {
  fs.mkdirSync(path.dirname(staticDest), { recursive: true });
  fs.rmSync(staticDest, { recursive: true, force: true });
  fs.cpSync(staticSrc, staticDest, { recursive: true });
  console.log("Standalone: copied .next/static");
} else {
  console.warn("Standalone: .next/static missing — run next build first");
}

if (fs.existsSync(publicSrc)) {
  fs.rmSync(publicDest, { recursive: true, force: true });
  fs.cpSync(publicSrc, publicDest, { recursive: true });
  console.log("Standalone: copied public/");
}
