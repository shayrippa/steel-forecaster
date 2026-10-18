#!/bin/sh
# בונה את תיקיית dist: שלושה קבצים להדבקה בעורך Apps Script (Code.gs, Import.html, Review.html)
cd "$(dirname "$0")"
{
  echo "/** ניהול הוצאות – קובץ מאוחד (נבנה אוטומטית מתיקיית src באמצעות build.sh). לא לערוך כאן. */"
  for f in Config Util Setup Import Classify Fixed Analysis Dashboard Menu; do
    echo ""; echo "/* ===================== $f.gs ===================== */"; cat "src/$f.gs"
  done
} > dist/Code.gs
node -e '
const fs=require("fs");
const html=fs.readFileSync("src/Import.html","utf8");
const js=fs.readFileSync("src/calParser.js","utf8").replace(/\nif \(typeof module[^\n]*\n?/, "\n");
fs.writeFileSync("dist/Import.html", html.replace("/*CAL_PARSER*/", () => js));
'
cp src/Review.html dist/Review.html
cp src/appsscript.json dist/appsscript.json
echo "built dist/"
