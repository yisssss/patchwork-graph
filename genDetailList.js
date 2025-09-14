import fs from "fs";
import path from "path";

const root = "public/detailpage";
const files = [];

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else {
      // ✅ public/ 잘라내고, 경로 구분자는 / 로 통일
      files.push(p.replace(/^public[\\/]/, "").replace(/\\/g, "/"));
    }
  }
}
walk(root);

fs.writeFileSync("public/etc/detail-files.json", JSON.stringify(files, null, 2));
console.log("✅ detail-files.json created:", files.length, "files");
