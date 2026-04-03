const fs=require("fs");
const txt=fs.readFileSync("constants/transfer-planner-data.ts","utf8");
const lines=txt.split(/\r?\n/);
const codeRe=/\b[A-Z]{2,6}&?\s*\d{3}[A-Z]?\b/g;
const denseRe=/\b(allows|requires|equivalent|equivalency|sequence|path|route|baseline|option|track|admission|prerequisite|do not replace|does not replace|cleanest|strongest|safest|support|not required|worth finishing|head start|defaults to)\b/i;
let n=0;
const seen=new Set();
for(let i=0;i<lines.length;i++){
  const ms=[...lines[i].matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)];
  for(const m of ms){
    for(const raw of m[1].split(/(?<=[.!?])\s+/)){
      const s=raw.trim(); if(!s) continue;
      const hasDense=denseRe.test(s);
      const hasCode=(s.match(codeRe)||[]).length>=1;
      const hasSlash=s.includes(" / ");
      if(s.length>=60 && hasDense && (hasCode||hasSlash)){
        if(!seen.has(s)){seen.add(s); n++;}
      }
    }
  }
}
console.log(n);
