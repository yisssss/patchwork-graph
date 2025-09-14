import fs from "fs";
import path from "path";

const root = "public/detailpage";
const data = {}; // 섹션별 구조

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      walk(p);
    } else {
      // 예: public/detailpage/11/1-1.jpeg
      const rel = p.replace(/^public[\\/]/, "").replace(/\\/g, "/");
      const parts = rel.split("/"); // ["detailpage","11","1-1.jpeg"]

      const section = parts[1];     // 11
      const filename = parts[2];    // 1-1.jpeg

      const [artistWork, ext] = filename.split(".");
      // artistWork = "1-1", ext = "jpeg"

      if (!data[section]) data[section] = {};
      data[section][artistWork] = `${parts[0]}/${section}/${filename}`;
    }
  }
}
walk(root);

fs.writeFileSync("public/etc/detail-files.json", JSON.stringify(data, null, 2));
console.log("✅ detail-files.json created");
