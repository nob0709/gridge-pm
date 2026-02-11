import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { supabase } from "./supabase";

const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const addBiz = (d, n) => { let r = new Date(d), a = 0, dir = n >= 0 ? 1 : -1; while (a < Math.abs(n)) { r.setDate(r.getDate() + dir); if (r.getDay() !== 0 && r.getDay() !== 6) a++; } return r; };
const diffD = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
const isWE = d => { const x = new Date(d); return x.getDay() === 0 || x.getDay() === 6; };
const fmtD = d => { const x = new Date(d); return (x.getMonth()+1)+"/"+x.getDate(); };
const fmtDF = d => { const x = new Date(d); return x.getFullYear()+"/"+(x.getMonth()+1)+"/"+x.getDate(); };
const fmtISO = d => { const x = new Date(d); return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0"); };
const same = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const getMon = d => { const x = new Date(d); const day = x.getDay(); x.setDate(x.getDate() - day + (day === 0 ? -6 : 1)); return x; };
const DN = ["日","月","火","水","木","金","土"];
const MN = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v));
const timeNow = () => { const d = new Date(); return d.getHours()+":"+String(d.getMinutes()).padStart(2,"0"); };

const TEAM = [
  { id:"shimizu",name:"清水",role:"営業・全体統括",color:"#6366f1",hpw:40,av:"清" },
  { id:"imashige",name:"今重",role:"コンテンツ・企画",color:"#f59e0b",hpw:40,av:"今" },
  { id:"fujii",name:"藤井",role:"デザイン・撮影",color:"#10b981",hpw:40,av:"藤" },
  { id:"nishitani",name:"西谷",role:"エンジニアリング",color:"#ef4444",hpw:40,av:"西" },
  { id:"honda",name:"本田",role:"ディレクター(パート)",color:"#8b5cf6",hpw:20,av:"本" },
];
const PH = {
  sales:{l:"営業・ヒアリング",c:"#6366f1"},kickoff:{l:"キックオフ",c:"#8b5cf6"},wire:{l:"ワイヤーフレーム",c:"#f59e0b"},writing:{l:"ライティング",c:"#f97316"},design:{l:"デザイン",c:"#10b981"},photo:{l:"撮影",c:"#14b8a6"},coding:{l:"コーディング",c:"#ef4444"},test:{l:"テスト・検証",c:"#ec4899"},delivery:{l:"納品",c:"#06b6d4"},review:{l:"お客様確認",c:"#64748b"},ad:{l:"広告運用",c:"#7c3aed"},
};
const PH_KEYS = Object.keys(PH);
const TASK_STATUS = [
  {id:"inbox",label:"インボックス",color:"#6b7280"},
  {id:"todo",label:"未着手",color:"#f59e0b"},
  {id:"in_progress",label:"進行中",color:"#3b82f6"},
  {id:"review",label:"確認中",color:"#8b5cf6"},
  {id:"done",label:"完了",color:"#10b981"},
];
const TEMPLATES = [
  {id:"web",name:"Web制作（HP）",icon:"🌐",tasks:[
    {name:"ヒアリング",phase:"sales",s:0,e:1},
    {name:"ワイヤーフレーム",phase:"wire",s:2,e:6},
    {name:"ライティング",phase:"writing",s:5,e:9},
    {name:"デザイン",phase:"design",s:7,e:16},
    {name:"撮影",phase:"photo",s:10,e:11},
    {name:"コーディング",phase:"coding",s:17,e:28},
    {name:"テスト・検証",phase:"test",s:29,e:31},
    {name:"納品",phase:"delivery",s:32,e:32,type:"milestone"},
  ]},
  {id:"lp",name:"LP制作",icon:"📄",tasks:[
    {name:"ワイヤーフレーム",phase:"wire",s:0,e:3},
    {name:"デザイン",phase:"design",s:4,e:9},
    {name:"コーディング",phase:"coding",s:10,e:16},
    {name:"納品",phase:"delivery",s:17,e:17,type:"milestone"},
  ]},
  {id:"ad",name:"広告運用",icon:"📊",tasks:[
    {name:"広告設計",phase:"ad",s:0,e:3},
    {name:"クリエイティブ制作",phase:"design",s:4,e:8},
    {name:"運用開始",phase:"ad",s:9,e:9,type:"milestone"},
  ]},
];
const MIN_DW = 1.5, MAX_DW = 60, DEFAULT_DW = 40;
const getZL = dw => dw >= 25 ? "day" : dw >= 8 ? "week" : "month";
const getZLbl = dw => ({day:"日",week:"週",month:"月"})[getZL(dw)] || "月";

const genProjects = () => {
  const td = new Date(); td.setHours(0,0,0,0);
  const cp = (id,nm,cl,st,off,ts) => ({ id,name:nm,client:cl,status:st,collapsed:id>5,
    tasks:ts.map((t,i)=>({...t,id:id+"-"+i,projectId:id,start:addBiz(td,off+t.s),end:addBiz(td,off+t.e),done:false,taskStatus:"todo",desc:"",comments:[],estimatedHours:null})) });
  return [
    cp(1,"シゲトウ組 HP制作","シゲトウ組","active",-5,[{name:"ワイヤーフレーム作成",phase:"wire",assignee:"imashige",s:0,e:4},{name:"ワイヤー確認",phase:"review",assignee:"shimizu",s:5,e:5,type:"milestone"},{name:"ライティング",phase:"writing",assignee:"imashige",s:6,e:10},{name:"デザイン制作",phase:"design",assignee:"fujii",s:8,e:17},{name:"撮影",phase:"photo",assignee:"fujii",s:11,e:12},{name:"デザイン確認",phase:"review",assignee:"shimizu",s:18,e:18,type:"milestone"},{name:"コーディング",phase:"coding",assignee:"nishitani",s:19,e:28},{name:"テスト検証",phase:"test",assignee:"nishitani",s:29,e:31},{name:"納品",phase:"delivery",assignee:"shimizu",s:32,e:32,type:"milestone"}]),
    cp(2,"両備ホームズ 広告運用","両備ホームズ","active",-10,[{name:"岡山エリア広告設計",phase:"ad",assignee:"shimizu",s:0,e:3},{name:"高松エリア広告設計",phase:"ad",assignee:"shimizu",s:2,e:5},{name:"クリエイティブ制作",phase:"design",assignee:"fujii",s:4,e:8},{name:"月次レポート",phase:"review",assignee:"shimizu",s:20,e:20,type:"milestone"}]),
    cp(3,"山田工務店 LP制作","山田工務店","active",3,[{name:"ヒアリング・企画",phase:"sales",assignee:"shimizu",s:0,e:1},{name:"ワイヤーフレーム",phase:"wire",assignee:"imashige",s:2,e:5},{name:"デザイン",phase:"design",assignee:"fujii",s:6,e:11},{name:"コーディング",phase:"coding",assignee:"nishitani",s:12,e:18},{name:"納品",phase:"delivery",assignee:"shimizu",s:19,e:19,type:"milestone"}]),
    cp(4,"ABC不動産 採用サイト","ABC不動産","active",-3,[{name:"キックオフ",phase:"kickoff",assignee:"shimizu",s:0,e:0,type:"milestone"},{name:"ワイヤー・構成",phase:"wire",assignee:"imashige",s:1,e:6},{name:"ライティング",phase:"writing",assignee:"imashige",s:5,e:10},{name:"デザイン",phase:"design",assignee:"fujii",s:7,e:16},{name:"撮影(社員)",phase:"photo",assignee:"fujii",s:9,e:10},{name:"クライアント確認",phase:"review",assignee:"shimizu",s:17,e:18,type:"milestone"},{name:"コーディング",phase:"coding",assignee:"nishitani",s:19,e:30},{name:"納品・公開",phase:"delivery",assignee:"shimizu",s:31,e:31,type:"milestone"}]),
    cp(5,"さくら歯科 リニューアル","さくら歯科","planning",10,[{name:"ヒアリング",phase:"sales",assignee:"shimizu",s:0,e:1},{name:"ワイヤー",phase:"wire",assignee:"imashige",s:3,e:7},{name:"デザイン",phase:"design",assignee:"fujii",s:8,e:15},{name:"コーディング",phase:"coding",assignee:"nishitani",s:16,e:24},{name:"納品",phase:"delivery",assignee:"shimizu",s:25,e:25,type:"milestone"}]),
    cp(6,"岡山商工会 ECサイト","岡山商工会","active",-8,[{name:"ワイヤー",phase:"wire",assignee:"imashige",s:0,e:5},{name:"デザイン",phase:"design",assignee:"fujii",s:6,e:14},{name:"コーディング",phase:"coding",assignee:"nishitani",s:15,e:28},{name:"納品",phase:"delivery",assignee:"shimizu",s:29,e:29,type:"milestone"}]),
    cp(7,"グリーンファーム LP","グリーンファーム","active",0,[{name:"ワイヤー",phase:"wire",assignee:"imashige",s:0,e:3},{name:"デザイン",phase:"design",assignee:"fujii",s:4,e:8},{name:"コーディング",phase:"coding",assignee:"nishitani",s:9,e:14},{name:"納品",phase:"delivery",assignee:"shimizu",s:15,e:15,type:"milestone"}]),
    cp(8,"丸善建設 コーポレート","丸善建設","planning",15,[{name:"ヒアリング",phase:"sales",assignee:"shimizu",s:0,e:1},{name:"ワイヤー",phase:"wire",assignee:"imashige",s:3,e:8},{name:"デザイン",phase:"design",assignee:"fujii",s:9,e:18},{name:"コーディング",phase:"coding",assignee:"nishitani",s:19,e:30},{name:"納品",phase:"delivery",assignee:"shimizu",s:31,e:31,type:"milestone"}]),
    cp(9,"ひまわり保育園 HP","ひまわり保育園","active",-15,[{name:"ワイヤー",phase:"wire",assignee:"imashige",s:0,e:4},{name:"デザイン",phase:"design",assignee:"fujii",s:5,e:12},{name:"コーディング",phase:"coding",assignee:"nishitani",s:13,e:22},{name:"テスト",phase:"test",assignee:"nishitani",s:23,e:25},{name:"納品",phase:"delivery",assignee:"shimizu",s:26,e:26,type:"milestone"}]),
    cp(10,"瀬戸内マリーナ 予約サイト","瀬戸内マリーナ","active",-2,[{name:"ワイヤー",phase:"wire",assignee:"imashige",s:0,e:5},{name:"デザイン",phase:"design",assignee:"fujii",s:6,e:14},{name:"コーディング",phase:"coding",assignee:"nishitani",s:15,e:26},{name:"納品",phase:"delivery",assignee:"shimizu",s:27,e:27,type:"milestone"}]),
    cp(11,"おかやま信金 採用LP","おかやま信金","planning",20,[{name:"ヒアリング",phase:"sales",assignee:"shimizu",s:0,e:1},{name:"ワイヤー",phase:"wire",assignee:"imashige",s:3,e:6},{name:"デザイン",phase:"design",assignee:"fujii",s:7,e:12},{name:"コーディング",phase:"coding",assignee:"nishitani",s:13,e:18},{name:"納品",phase:"delivery",assignee:"shimizu",s:19,e:19,type:"milestone"}]),
    cp(12,"備前焼ギャラリー EC","備前焼ギャラリー","active",-12,[{name:"ワイヤー",phase:"wire",assignee:"imashige",s:0,e:5},{name:"撮影",phase:"photo",assignee:"fujii",s:3,e:5},{name:"デザイン",phase:"design",assignee:"fujii",s:6,e:14},{name:"コーディング",phase:"coding",assignee:"nishitani",s:15,e:25},{name:"納品",phase:"delivery",assignee:"shimizu",s:26,e:26,type:"milestone"}]),
  ];
};

const ST = {
  tab:on=>({padding:"6px 14px",borderRadius:6,fontSize:12,fontWeight:500,cursor:"pointer",color:on?"#1f2937":"#6b7280",border:"none",background:on?"#e5e7eb":"transparent",whiteSpace:"nowrap"}),
  btnI:{padding:"7px 8px",borderRadius:5,fontSize:12,cursor:"pointer",border:"1px solid #e5e7eb",background:"#fff",color:"#6b7280"},
  btnP:{padding:"7px 14px",borderRadius:5,fontSize:12,fontWeight:500,cursor:"pointer",border:"1px solid #6366f1",background:"#6366f1",color:"#fff",display:"flex",alignItems:"center",gap:6},
  fbar:{display:"flex",alignItems:"center",gap:8,padding:"10px 20px",borderBottom:"1px solid #e5e7eb",background:"#fff",flexShrink:0,flexWrap:"wrap"},
  chip:(on,c)=>({padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:500,cursor:"pointer",border:"1px solid "+(on?(c||"#6366f1"):"#e5e7eb"),background:on?(c?c+"18":"rgba(99,102,241,.08)"):"transparent",color:on?(c||"#6366f1"):"#6b7280"}),
  sbar:on=>({display:"flex",alignItems:"center",gap:12,padding:"8px 20px",background:on?"rgba(99,102,241,.06)":"#fff",borderBottom:"1px solid "+(on?"rgba(99,102,241,.3)":"#e5e7eb"),fontSize:12,color:"#6366f1",flexShrink:0,minHeight:38}),
  sbtn:{padding:"3px 10px",borderRadius:4,fontSize:11,fontWeight:500,cursor:"pointer",border:"1px solid rgba(99,102,241,.4)",background:"transparent",color:"#6366f1"},
  side:{width:280,minWidth:280,borderRight:"1px solid #e5e7eb",display:"flex",flexDirection:"column",background:"#fff",zIndex:10},
  prow:isH=>({display:"flex",alignItems:"center",padding:"0 10px",height:isH?44:36,cursor:"pointer",gap:6,fontSize:isH?13:12,userSelect:"none",fontWeight:isH?600:400,background:isH?"#f9fafb":"transparent",borderBottom:isH?"1px solid #e5e7eb":"none",color:isH?"#1f2937":"#4b5563"}),
  tog:open=>({width:18,height:18,display:"flex",alignItems:"center",justifyContent:"center",color:"#9ca3af",fontSize:10,transform:open?"rotate(90deg)":"none",flexShrink:0}),
  tav:c=>({width:22,height:22,borderRadius:"50%",fontSize:9,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#fff",background:c}),
  bar:(l,w,c,sel,drg)=>({position:"absolute",height:22,borderRadius:5,cursor:"grab",display:"flex",alignItems:"center",padding:"0 6px",fontSize:10,fontWeight:500,color:"#fff",zIndex:sel?5:3,overflow:"visible",whiteSpace:"nowrap",userSelect:"none",left:l,width:Math.max(w,4),top:7,background:c,outline:sel?"2px solid #6366f1":"none",outlineOffset:sel?1:0,boxShadow:sel?"0 0 8px rgba(99,102,241,.3)":(drg?"0 4px 12px rgba(0,0,0,.15)":"0 1px 3px rgba(0,0,0,.1)"),opacity:drg?0.9:1}),
  rh:side=>({position:"absolute",top:0,bottom:0,width:8,cursor:"ew-resize",[side==="l"?"left":"right"]:-2}),
  ms:l=>({position:"absolute",zIndex:3,cursor:"grab",display:"flex",alignItems:"center",gap:4,left:l,top:10}),
  md:(c,sel)=>({width:14,height:14,transform:"rotate(45deg)",borderRadius:2,border:"2px solid "+c,background:c+"30",boxShadow:sel?"0 0 0 3px rgba(99,102,241,.3)":"none"}),
  cap:{width:220,minWidth:220,borderLeft:"1px solid #e5e7eb",background:"#fff",display:"flex",flexDirection:"column",overflowY:"auto"},
};

// Task Detail Panel
function TaskPanel({ task, project, setProjects, onClose }) {
  const [comment, setComment] = useState("");
  const endRef = useRef(null);
  const mem = TEAM.find(x => x.id === task.assignee);
  const ph = PH[task.phase] || { l:"?", c:"#666" };
  const up = useCallback((f, v) => setProjects(ps => ps.map(p => ({ ...p, tasks: p.tasks.map(t => t.id === task.id ? { ...t, [f]: v } : t) }))), [task.id, setProjects]);
  const addC = () => { if (!comment.trim()) return; const c = { id: Date.now(), text: comment.trim(), author: "shimizu", time: timeNow() }; setProjects(ps => ps.map(p => ({ ...p, tasks: p.tasks.map(t => t.id === task.id ? { ...t, comments: [...(t.comments||[]), c] } : t) }))); setComment(""); setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50); };
  const inp = { width:"100%", padding:"8px 10px", borderRadius:6, border:"1px solid #e5e7eb", background:"#fff", color:"#1f2937", fontSize:13, fontFamily:"inherit", outline:"none" };
  const sel = { ...inp, cursor:"pointer" };
  const lab = { fontSize:11, fontWeight:600, color:"#6b7280", marginBottom:4, display:"block" };
  return (
    <div style={{ position:"fixed", top:0, right:0, bottom:0, width:440, background:"#fff", borderLeft:"1px solid #e5e7eb", zIndex:1000, display:"flex", flexDirection:"column", boxShadow:"-8px 0 32px rgba(0,0,0,.1)" }}>
      <div style={{ padding:"16px 20px", borderBottom:"1px solid #e5e7eb", display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
        <button onClick={() => up("done", !task.done)} style={{ width:28, height:28, borderRadius:"50%", border:task.done?"none":"2px solid #d1d5db", background:task.done?"#10b981":"transparent", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:14, flexShrink:0 }}>{task.done && "✓"}</button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:10, color:"#6b7280" }}>{project}</div>
          <div style={{ fontSize:15, fontWeight:600, color:"#1f2937", textDecoration:task.done?"line-through":"none", opacity:task.done?0.5:1 }}>{task.name||"新規タスク"}</div>
        </div>
        <button onClick={onClose} style={{ width:28, height:28, border:"none", background:"#f3f4f6", borderRadius:6, cursor:"pointer", color:"#6b7280", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>{"✕"}</button>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"0 20px 20px" }}>
        <div style={{ padding:"16px 0 12px", display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ padding:"4px 12px", borderRadius:20, fontSize:11, fontWeight:600, background:task.done?"#10b98120":ph.c+"20", color:task.done?"#10b981":ph.c }}>{task.done?"✓ 完了":ph.l}</span>
          {task.type==="milestone"&&<span style={{ padding:"4px 10px", borderRadius:20, fontSize:11, fontWeight:600, background:"#f59e0b20", color:"#f59e0b" }}>{"◆ マイルストーン"}</span>}
        </div>
        <div style={{ display:"grid", gap:16 }}>
          <div><label style={lab}>タスク名</label><input value={task.name} onChange={e=>up("name",e.target.value)} style={inp}/></div>
          <div><label style={lab}>担当者</label>
            <div style={{ position:"relative" }}>
              <select value={task.assignee||""} onChange={e=>up("assignee",e.target.value||null)} style={sel}><option value="">未設定</option>{TEAM.map(m=><option key={m.id} value={m.id}>{m.name} - {m.role}</option>)}</select>
              {mem&&<div style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", width:20, height:20, borderRadius:"50%", background:mem.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, fontWeight:700, color:"#fff", pointerEvents:"none" }}>{mem.av}</div>}
            </div>
          </div>
          <div><label style={lab}>フェーズ</label><select value={task.phase} onChange={e=>up("phase",e.target.value)} style={sel}>{PH_KEYS.map(k=><option key={k} value={k}>{PH[k].l}</option>)}</select></div>
          <div><label style={lab}>ステータス</label><select value={task.taskStatus||"todo"} onChange={e=>{up("taskStatus",e.target.value);if(e.target.value==="done")up("done",true);else up("done",false)}} style={sel}>{TASK_STATUS.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div><label style={lab}>開始日</label><input type="date" value={fmtISO(task.start)} onChange={e=>{if(e.target.value)up("start",new Date(e.target.value))}} style={inp}/></div>
            <div><label style={lab}>終了日</label><input type="date" value={fmtISO(task.end)} onChange={e=>{if(e.target.value)up("end",new Date(e.target.value))}} style={inp}/></div>
          </div>
          <div style={{ fontSize:11, color:"#6b7280" }}>{diffD(task.start,task.end)+1}日間 ({fmtDF(task.start)} → {fmtDF(task.end)})</div>
          {task.type!=="milestone"&&<div>
            <label style={lab}>見積もり工数</label>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <input type="number" step="0.5" min="0" value={task.estimatedHours!=null?task.estimatedHours:""} onChange={e=>{const v=e.target.value;up("estimatedHours",v===""?null:parseFloat(v))}} placeholder={"未入力 = "+(diffD(task.start,task.end)+1)*8+"h（バー日数×8h）"} style={{...inp,flex:1}}/>
              <span style={{ fontSize:13, color:"#6b7280", flexShrink:0 }}>h</span>
            </div>
            {task.estimatedHours!=null&&<div style={{ fontSize:10, color:"#6366f1", marginTop:4 }}>{"⏱ 実工数: "+task.estimatedHours+"h / バー: "+(diffD(task.start,task.end)+1)+"日間（"+(diffD(task.start,task.end)+1)*8+"h）"}</div>}
          </div>}
          <div><label style={lab}>説明・メモ</label><textarea value={task.desc||""} onChange={e=>up("desc",e.target.value)} placeholder="タスクの詳細、注意事項など..." rows={4} style={{...inp,resize:"vertical",lineHeight:1.6}}/></div>
        </div>
        <div style={{ marginTop:24 }}>
          <div style={{ fontSize:11, fontWeight:600, color:"#6b7280", marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>コメント{task.comments&&task.comments.length>0&&<span style={{ background:"#6366f1", color:"#fff", borderRadius:10, padding:"1px 7px", fontSize:10 }}>{task.comments.length}</span>}</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>
            {(!task.comments||task.comments.length===0)&&<div style={{ padding:16, textAlign:"center", color:"#6b7280", fontSize:12, background:"#f9fafb", borderRadius:8 }}>まだコメントはありません</div>}
            {(task.comments||[]).map(c => { const a = TEAM.find(x=>x.id===c.author)||TEAM[0]; return (
              <div key={c.id} style={{ display:"flex", gap:10, padding:10, background:"#f9fafb", borderRadius:8 }}>
                <div style={{ width:28, height:28, borderRadius:"50%", background:a.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:"#fff", flexShrink:0 }}>{a.av}</div>
                <div style={{ flex:1 }}><div style={{ display:"flex", alignItems:"baseline", gap:8 }}><span style={{ fontSize:12, fontWeight:600, color:"#1f2937" }}>{a.name}</span><span style={{ fontSize:10, color:"#6b7280" }}>{c.time}</span></div><div style={{ fontSize:13, color:"#374151", lineHeight:1.5, marginTop:2, whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{c.text}</div></div>
              </div>); })}
            <div ref={endRef}/>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <div style={{ width:28, height:28, borderRadius:"50%", background:TEAM[0].color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:"#fff", flexShrink:0, marginTop:2 }}>{TEAM[0].av}</div>
            <div style={{ flex:1, display:"flex", flexDirection:"column", gap:6 }}>
              <textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="コメントを入力..." rows={2} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();addC()}}} style={{...inp,resize:"none",lineHeight:1.5}}/>
              <div style={{ display:"flex", justifyContent:"flex-end" }}><button onClick={addC} disabled={!comment.trim()} style={{ padding:"6px 16px", borderRadius:6, fontSize:12, fontWeight:500, cursor:comment.trim()?"pointer":"default", border:"none", background:comment.trim()?"#6366f1":"#e5e7eb", color:comment.trim()?"#fff":"#9ca3af" }}>送信</button></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Calendar - 縦スクロール・バー表示（日をまたいで表示）
function CalView({ projects, today, onOpen }) {
  const tasks = useMemo(() => {
    const arr = [];
    projects.forEach(p => p.tasks.forEach(t => arr.push({ ...t, projectName: p.name })));
    return arr;
  }, [projects]);
  // 3ヶ月分の週を生成
  const weeks = useMemo(() => {
    const start = new Date(today);
    start.setDate(1);
    start.setMonth(start.getMonth() - 1);
    const sd = start.getDay();
    start.setDate(start.getDate() - sd);
    const end = new Date(today);
    end.setMonth(end.getMonth() + 2);
    end.setDate(0);
    const ws = [];
    const c = new Date(start);
    while (c <= end) {
      const week = [];
      for (let i = 0; i < 7; i++) { week.push(new Date(c)); c.setDate(c.getDate() + 1); }
      ws.push(week);
    }
    return ws;
  }, [today]);
  // 週ごとのタスクを計算
  const weekTasks = useMemo(() => {
    return weeks.map(week => {
      const ws = week[0], we = week[6];
      const wt = tasks.filter(t => {
        const ts = new Date(t.start), te = new Date(t.end);
        ts.setHours(0,0,0,0); te.setHours(0,0,0,0);
        return ts <= we && te >= ws;
      }).map(t => {
        const ts = new Date(t.start), te = new Date(t.end);
        ts.setHours(0,0,0,0); te.setHours(0,0,0,0);
        const startDay = ts < ws ? 0 : ts.getDay();
        const endDay = te > we ? 6 : te.getDay();
        return { ...t, startDay, endDay, span: endDay - startDay + 1 };
      });
      // 行の割り当て（重ならないように）
      const rows = [];
      wt.forEach(t => {
        let placed = false;
        for (let r = 0; r < rows.length; r++) {
          const canPlace = rows[r].every(ex => ex.endDay < t.startDay || ex.startDay > t.endDay);
          if (canPlace) { rows[r].push(t); placed = true; break; }
        }
        if (!placed) rows.push([t]);
      });
      return rows;
    });
  }, [weeks, tasks]);
  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) {
      const todayWeekIdx = weeks.findIndex(w => w.some(d => same(d, today)));
      if (todayWeekIdx > 0) scrollRef.current.scrollTop = todayWeekIdx * 140 - 100;
    }
  }, [weeks, today]);
  const ROW_H = 22, ROW_GAP = 2, DATE_H = 28;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f8f7f4", overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: "1px solid #e5e7eb", background: "#fff", flexShrink: 0 }}>
        {DN.map(d => <div key={d} style={{ padding: 10, textAlign: "center", fontSize: 11, fontWeight: 600, color: "#6b7280" }}>{d}</div>)}
      </div>
      <div style={{ flex: 1, overflow: "auto" }} ref={scrollRef}>
        {weeks.map((week, wi) => {
          const firstOfMonth = week.find(d => d.getDate() === 1);
          const rows = weekTasks[wi] || [];
          const contentH = Math.max(rows.length * (ROW_H + ROW_GAP) + 8, 60);
          return (
            <React.Fragment key={wi}>
              {firstOfMonth && <div style={{ padding: "8px 16px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb", fontSize: 13, fontWeight: 600, color: "#1f2937", position: "sticky", top: 0, zIndex: 5 }}>{firstOfMonth.getFullYear()}年 {MN[firstOfMonth.getMonth()]}</div>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: "1px solid #e5e7eb", position: "relative" }}>
                {week.map((d, di) => {
                  const isT = same(d, today);
                  return (
                    <div key={di} style={{ minHeight: DATE_H + contentH, background: isT ? "rgba(99,102,241,.06)" : (isWE(d) ? "#f9fafb" : "#fff"), borderRight: di < 6 ? "1px solid #f3f4f6" : "none" }}>
                      <div style={{ padding: "4px 6px", height: DATE_H, display: "flex", alignItems: "center" }}>
                        <div style={isT ? { color: "#fff", fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, background: "#6366f1", borderRadius: "50%", fontSize: 12 } : { fontSize: 12, fontWeight: 500, color: "#4b5563" }}>{d.getDate()}</div>
                      </div>
                    </div>
                  );
                })}
                {/* タスクバー */}
                {rows.map((row, ri) => row.map(t => {
                  const ph = PH[t.phase] || { c: "#666" };
                  const left = `calc(${t.startDay} * 100% / 7 + 4px)`;
                  const width = `calc(${t.span} * 100% / 7 - 8px)`;
                  return (
                    <div key={t.id + "-" + wi} onClick={() => onOpen(t)} style={{ position: "absolute", top: DATE_H + ri * (ROW_H + ROW_GAP) + 4, left, width, height: ROW_H, borderRadius: 4, background: ph.c, color: "#fff", fontSize: 10, fontWeight: 500, padding: "0 6px", display: "flex", alignItems: "center", cursor: "pointer", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", boxShadow: "0 1px 2px rgba(0,0,0,.1)", opacity: t.done ? 0.5 : 1, zIndex: 2 }}>
                      {t.name}<span style={{ marginLeft: 6, opacity: 0.7 }}>{t.projectName}</span>
                    </div>
                  );
                }))}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// Kanban View
function KanbanView({ projects, setProjects, onOpen }) {
  const [dragTask, setDragTask] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [kanbanMode, setKanbanMode] = useState("status"); // "status" or "project"

  const allTasks = useMemo(() => {
    const tasks = [];
    projects.forEach(p => p.tasks.forEach(t => tasks.push({ ...t, projectName: p.name, projectId: p.id })));
    return tasks;
  }, [projects]);

  const statusColumns = TASK_STATUS.map(s => ({
    ...s,
    type: "status",
    tasks: allTasks.filter(t => (t.taskStatus || "todo") === s.id)
  }));

  const projectColumns = projects.map(p => ({
    id: p.id,
    label: p.name,
    color: p.status === "active" ? "#10b981" : "#f59e0b",
    type: "project",
    tasks: p.tasks.map(t => ({ ...t, projectName: p.name, projectId: p.id }))
  }));

  const columns = kanbanMode === "status" ? statusColumns : projectColumns;

  const moveTask = (taskId, newStatus) => {
    setProjects(ps => ps.map(p => ({
      ...p,
      tasks: p.tasks.map(t => t.id === taskId ? { ...t, taskStatus: newStatus, done: newStatus === "done" } : t)
    })));
  };

  const handleDragStart = (e, task) => {
    setDragTask(task);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    if (dragTask && dragOverCol && kanbanMode === "status") {
      moveTask(dragTask.id, dragOverCol);
    }
    setDragTask(null);
    setDragOverCol(null);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f8f7f4" }}>
      <div style={{ padding: "12px 20px", borderBottom: "1px solid #e5e7eb", background: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, color: "#6b7280" }}>表示:</span>
        <div style={{ display: "flex", gap: 2, background: "#f3f4f6", borderRadius: 6, padding: 2 }}>
          <button onClick={() => setKanbanMode("status")} style={{ padding: "4px 12px", borderRadius: 4, fontSize: 11, fontWeight: 500, cursor: "pointer", border: "none", background: kanbanMode === "status" ? "#fff" : "transparent", color: kanbanMode === "status" ? "#1f2937" : "#6b7280", boxShadow: kanbanMode === "status" ? "0 1px 2px rgba(0,0,0,.1)" : "none" }}>ステータス別</button>
          <button onClick={() => setKanbanMode("project")} style={{ padding: "4px 12px", borderRadius: 4, fontSize: 11, fontWeight: 500, cursor: "pointer", border: "none", background: kanbanMode === "project" ? "#fff" : "transparent", color: kanbanMode === "project" ? "#1f2937" : "#6b7280", boxShadow: kanbanMode === "project" ? "0 1px 2px rgba(0,0,0,.1)" : "none" }}>プロジェクト別</button>
        </div>
        {kanbanMode === "status" && <span style={{ fontSize: 10, color: "#9ca3af", marginLeft: 8 }}>ドラッグでステータス変更</span>}
      </div>
      <div style={{ flex: 1, display: "flex", gap: 16, padding: 20, overflowX: "auto" }}>
        {columns.map(col => (
          <div
            key={col.id}
            onDragOver={e => { e.preventDefault(); if (kanbanMode === "status") setDragOverCol(col.id); }}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={handleDragEnd}
            style={{
              flex: "0 0 280px",
              background: dragOverCol === col.id ? "rgba(99,102,241,.08)" : "#fff",
              borderRadius: 12,
              border: dragOverCol === col.id ? "2px dashed #6366f1" : "1px solid #e5e7eb",
              display: "flex",
              flexDirection: "column",
              maxHeight: "100%",
            }}
          >
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: col.color }} />
              <span style={{ fontWeight: 600, fontSize: 13, color: "#1f2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{col.label}</span>
              <span style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280", background: "#f3f4f6", borderRadius: 10, padding: "2px 8px", flexShrink: 0 }}>{col.tasks.length}</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
              {col.tasks.map(task => {
                const ph = PH[task.phase] || { c: "#666", l: "?" };
                const mem = TEAM.find(m => m.id === task.assignee);
                const st = TASK_STATUS.find(s => s.id === (task.taskStatus || "todo"));
                return (
                  <div
                    key={task.id}
                    draggable={kanbanMode === "status"}
                    onDragStart={e => handleDragStart(e, task)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onOpen(task)}
                    style={{
                      padding: 12,
                      background: dragTask?.id === task.id ? "#f3f4f6" : "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      cursor: kanbanMode === "status" ? "grab" : "pointer",
                      opacity: dragTask?.id === task.id ? 0.5 : 1,
                      boxShadow: "0 1px 3px rgba(0,0,0,.05)",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#1f2937", marginBottom: 8 }}>{task.name || "新規タスク"}</div>
                    {kanbanMode === "status" && <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>{task.projectName}</div>}
                    {kanbanMode === "project" && st && <div style={{ fontSize: 10, color: st.color, marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 6, height: 6, borderRadius: "50%", background: st.color }} />{st.label}</div>}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: ph.c + "20", color: ph.c }}>{ph.l}</span>
                      {mem && <div style={{ width: 20, height: 20, borderRadius: "50%", background: mem.color, color: "#fff", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>{mem.av}</div>}
                      <span style={{ marginLeft: "auto", fontSize: 10, color: "#9ca3af" }}>{fmtD(task.start)}〜{fmtD(task.end)}</span>
                    </div>
                  </div>
                );
              })}
              {col.tasks.length === 0 && <div style={{ padding: 16, textAlign: "center", color: "#9ca3af", fontSize: 12 }}>タスクなし</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Main
export default function App() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState("gantt");
  const [dayWidth, setDayWidth] = useState(DEFAULT_DW);
  const [filterA, setFilterA] = useState(null);
  const [filterS, setFilterS] = useState(null);
  const [showCap, setShowCap] = useState(true);
  const [capMode, setCapMode] = useState("week"); // "week" or "month"
  const [capOffset, setCapOffset] = useState(0); // 0=今週/今月, 1=来週/来月, -1=先週/先月
  const [openTid, setOpenTid] = useState(null);
  const [tip, setTip] = useState(null);
  const [drag, setDrag] = useState(null);
  const [dragShift, setDragShift] = useState(0);
  const [dragPos, setDragPos] = useState(null);
  const [selIds, setSelIds] = useState(()=>new Set());
  const [marquee, setMarquee] = useState(null);
  const [mActive, setMActive] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [lastSelId, setLastSelId] = useState(null);
  const [dragProjId, setDragProjId] = useState(null);
  const [dragOverProjId, setDragOverProjId] = useState(null);
  const headerRef=useRef(null), sideRef=useRef(null), ganttRef=useRef(null), bodyRef=useRef(null), barRects=useRef({});
  const today = useMemo(()=>{const d=new Date();d.setHours(0,0,0,0);return d},[]);
  const DW = dayWidth;
  const zoomLevel = getZL(DW);

  // Load data from Supabase
  const loadFromDB = useCallback(async () => {
    setLoading(true);
    try {
      const { data: projectsData, error: pError } = await supabase
        .from('projects')
        .select('*')
        .order('sort_order', { ascending: true });
      if (pError) throw pError;

      const { data: tasksData, error: tError } = await supabase
        .from('tasks')
        .select('*');
      if (tError) throw tError;

      if (projectsData.length === 0) {
        // DB is empty, use demo data
        setProjects(genProjects());
      } else {
        // Map DB data to app format
        const mapped = projectsData.map(p => ({
          id: p.id,
          name: p.name,
          client: p.client || '',
          status: p.status || 'planning',
          collapsed: p.collapsed || false,
          tasks: tasksData
            .filter(t => t.project_id === p.id)
            .map(t => ({
              id: t.id,
              projectId: t.project_id,
              name: t.name || '',
              phase: t.phase || 'wire',
              assignee: t.assignee,
              start: new Date(t.start_date),
              end: new Date(t.end_date),
              done: t.done || false,
              taskStatus: t.task_status || 'todo',
              desc: t.description || '',
              comments: t.comments || [],
              estimatedHours: t.estimated_hours,
              type: t.task_type,
            }))
        }));
        setProjects(mapped);
      }
    } catch (err) {
      console.error('Load error:', err);
      setProjects(genProjects());
    }
    setLoading(false);
  }, []);

  // Save data to Supabase
  const saveToDB = useCallback(async () => {
    setSaving(true);
    try {
      // Delete existing data
      await supabase.from('tasks').delete().neq('id', '');
      await supabase.from('projects').delete().neq('id', 0);

      // Insert projects
      const projectsToInsert = projects.map((p, i) => ({
        id: p.id,
        name: p.name,
        client: p.client || '',
        status: p.status || 'planning',
        collapsed: p.collapsed || false,
        sort_order: i,
      }));
      const { error: pError } = await supabase.from('projects').insert(projectsToInsert);
      if (pError) throw pError;

      // Insert tasks
      const tasksToInsert = projects.flatMap(p =>
        p.tasks.map(t => ({
          id: t.id,
          project_id: p.id,
          name: t.name || '',
          phase: t.phase || 'wire',
          assignee: t.assignee,
          start_date: fmtISO(t.start),
          end_date: fmtISO(t.end),
          done: t.done || false,
          task_status: t.taskStatus || 'todo',
          description: t.desc || '',
          comments: t.comments || [],
          estimated_hours: t.estimatedHours,
          task_type: t.type,
        }))
      );
      if (tasksToInsert.length > 0) {
        const { error: tError } = await supabase.from('tasks').insert(tasksToInsert);
        if (tError) throw tError;
      }
      alert('保存しました');
    } catch (err) {
      console.error('Save error:', err);
      alert('保存に失敗しました: ' + err.message);
    }
    setSaving(false);
  }, [projects]);

  // Load on mount
  useEffect(() => {
    loadFromDB();
  }, []);

  const openTask = useMemo(()=>{if(!openTid)return null;for(const p of projects)for(const t of p.tasks)if(t.id===openTid)return{task:t,project:p.name};return null},[openTid,projects]);

  const selProject = useCallback(pid=>{const p=projects.find(x=>x.id===pid);if(!p)return;const ids=p.tasks.map(t=>t.id);setSelIds(prev=>{const allIn=ids.every(id=>prev.has(id));const n=new Set();if(!allIn)ids.forEach(id=>n.add(id));return n})},[projects]);
  const clearSel = useCallback(()=>setSelIds(new Set()),[]);
  const moveProject = useCallback((fromId,toId)=>{
    if(fromId===toId)return;
    setProjects(ps=>{
      const arr=[...ps];
      const fromIdx=arr.findIndex(p=>p.id===fromId);
      const toIdx=arr.findIndex(p=>p.id===toId);
      if(fromIdx===-1||toIdx===-1)return ps;
      const [moved]=arr.splice(fromIdx,1);
      arr.splice(toIdx,0,moved);
      return arr;
    });
  },[]);

  const dateRange = useMemo(()=>{let mn=new Date(today);mn.setDate(mn.getDate()-60);let mx=new Date(today);mx.setDate(mx.getDate()+120);projects.forEach(p=>p.tasks.forEach(t=>{if(new Date(t.start)<mn)mn=new Date(t.start);if(new Date(t.end)>mx)mx=new Date(t.end)}));mn.setDate(mn.getDate()-14);mx.setDate(mx.getDate()+14);const d=[],c=new Date(mn);while(c<=mx){d.push(new Date(c));c.setDate(c.getDate()+1)}return d},[projects,today]);
  const totalWidth = dateRange.length*DW;
  const getPos = useCallback(date=>{const dt=new Date(date);dt.setHours(0,0,0,0);return diffD(dateRange[0],dt)*DW},[dateRange,DW]);
  const todayPos = useMemo(()=>getPos(today),[getPos,today]);

  const filtered = useMemo(()=>projects.map(p=>({...p,tasks:p.tasks.filter(t=>!filterA||t.assignee===filterA)})).filter(p=>{if(filterS&&p.status!==filterS)return false;if(filterA&&p.tasks.length===0)return false;return true}),[projects,filterA,filterS]);
  const togProj = useCallback(id=>setProjects(p=>p.map(x=>x.id===id?{...x,collapsed:!x.collapsed}:x)),[]);
  const selectAll = useCallback(()=>{const a=new Set();filtered.forEach(p=>p.tasks.forEach(t=>a.add(t.id)));setSelIds(a)},[filtered]);

  const headerRows = useMemo(()=>{
    const top=[],bot=[];
    if(zoomLevel==="day"){let cm=null;dateRange.forEach(d=>{const k=d.getFullYear()+"-"+d.getMonth();if(!cm||cm.key!==k){cm={key:k,label:d.getFullYear()+"年 "+MN[d.getMonth()],count:0};top.push(cm)}cm.count++;bot.push({label:d.getDate().toString(),sub:DN[d.getDay()],isWE:isWE(d),isToday:same(d,today),width:DW})});top.forEach(g=>{g.width=g.count*DW})}
    else if(zoomLevel==="week"){let cm=null,cw=null;dateRange.forEach(d=>{const mk=d.getFullYear()+"-"+d.getMonth();if(!cm||cm.key!==mk){cm={key:mk,label:MN[d.getMonth()],count:0};top.push(cm)}cm.count++;const wk=getMon(d),wkk=wk.toDateString();if(!cw||cw.key!==wkk){cw={key:wkk,label:fmtD(wk)+"〜",isToday:false,days:0};bot.push(cw)}cw.days++;if(same(d,today))cw.isToday=true});top.forEach(g=>{g.width=g.count*DW});bot.forEach(w=>{w.width=w.days*DW})}
    else{let cy=null,cm=null;dateRange.forEach(d=>{const yk=d.getFullYear().toString();if(!cy||cy.key!==yk){cy={key:yk,label:yk+"年",count:0};top.push(cy)}cy.count++;const mk=d.getFullYear()+"-"+d.getMonth();if(!cm||cm.key!==mk){cm={key:mk,label:MN[d.getMonth()],isToday:false,days:0};bot.push(cm)}cm.days++;if(same(d,today))cm.isToday=true});top.forEach(g=>{g.width=g.count*DW});bot.forEach(m=>{m.width=m.days*DW})}
    return{top,bot};
  },[dateRange,DW,zoomLevel,today]);

  const rowList = useMemo(()=>{
    const sortByStart=(a,b)=>new Date(a.start)-new Date(b.start);
    if(view==="timeline"){const rows=[];TEAM.forEach(m=>{const mt=[];filtered.forEach(p=>p.tasks.forEach(t=>{if(t.assignee===m.id)mt.push({...t,projName:p.name})}));if(mt.length>0){mt.sort(sortByStart);rows.push({type:"member",member:m,count:mt.length});mt.forEach(t=>rows.push({type:"task",task:t,project:{name:t.projName}}))}});return rows}
    const r=[];filtered.forEach(p=>{r.push({type:"project",project:p});if(!p.collapsed)[...p.tasks].sort(sortByStart).forEach(t=>r.push({type:"task",task:t,project:p}))});return r;
  },[filtered,view]);

  // Toggle selection with Shift range support
  const toggleSel = useCallback((id,e)=>{
    if(e&&e.shiftKey&&lastSelId){
      // Shift+クリックで範囲選択
      const taskIds=rowList.filter(r=>r.type==="task").map(r=>r.task.id);
      const idx1=taskIds.indexOf(lastSelId);
      const idx2=taskIds.indexOf(id);
      if(idx1!==-1&&idx2!==-1){
        const [start,end]=[Math.min(idx1,idx2),Math.max(idx1,idx2)];
        const rangeIds=taskIds.slice(start,end+1);
        setSelIds(prev=>{const n=new Set(prev);rangeIds.forEach(tid=>n.add(tid));return n});
        return;
      }
    }
    if(e&&(e.metaKey||e.ctrlKey)){
      setSelIds(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n});
    }else{
      setSelIds(p=>(p.has(id)&&p.size===1)?new Set():new Set([id]));
    }
    setLastSelId(id);
  },[lastSelId,rowList]);

  // Create project from template
  const createFromTemplate = useCallback((tmpl)=>{
    const newId=Date.now();
    const newProj={
      id:newId,
      name:"新規案件",
      client:"",
      status:"planning",
      collapsed:false,
      tasks:tmpl.tasks.map((t,i)=>({
        ...t,
        id:newId+"-"+i,
        projectId:newId,
        assignee:null,
        start:addBiz(today,t.s),
        end:addBiz(today,t.e),
        done:false,
        taskStatus:"todo",
        desc:"",
        comments:[],
        estimatedHours:null,
      })),
    };
    setProjects(ps=>[newProj,...ps]);
    setShowNewModal(false);
  },[today]);

  // Drag
  const startDrag = useCallback((e,task,type)=>{e.stopPropagation();e.preventDefault();let active=new Set(selIds);if(!active.has(task.id)){active=new Set([task.id]);setSelIds(active)}const od={};projects.forEach(p=>p.tasks.forEach(t=>{if(active.has(t.id))od[t.id]={start:new Date(t.start),end:new Date(t.end)}}));setDrag({task,type:type||"move",startX:e.clientX,active,od});setDragShift(0)},[selIds,projects]);
  useEffect(()=>{if(!drag)return;const onM=e=>{const ds=Math.round((e.clientX-drag.startX)/DW);setDragShift(ds);if(ds!==0)setDragPos({x:e.clientX+16,y:e.clientY-28});else setDragPos(null);setProjects(p=>p.map(pr=>({...pr,tasks:pr.tasks.map(t=>{const o=drag.od[t.id];if(!o)return t;if(drag.type==="move")return{...t,start:addDays(o.start,ds),end:addDays(o.end,ds)};if(drag.type==="resize-right"&&t.id===drag.task.id){const ne=addDays(o.end,ds);return ne>=t.start?{...t,end:ne}:t}if(drag.type==="resize-left"&&t.id===drag.task.id){const ns=addDays(o.start,ds);return ns<=t.end?{...t,start:ns}:t}return t})})))};const onU=()=>{setDrag(null);setDragShift(0);setDragPos(null)};window.addEventListener("mousemove",onM);window.addEventListener("mouseup",onU);return()=>{window.removeEventListener("mousemove",onM);window.removeEventListener("mouseup",onU)}},[drag,DW]);

  // Zoom
  const handleWheel = useCallback(e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();const g=ganttRef.current;if(!g)return;const rect=g.getBoundingClientRect(),mx=e.clientX-rect.left,sl=g.scrollLeft,md=(sl+mx)/DW;const f=e.deltaY<0?1.15:0.87;const nDW=clamp(DW*f,MIN_DW,MAX_DW);setDayWidth(nDW);requestAnimationFrame(()=>{if(ganttRef.current)ganttRef.current.scrollLeft=md*nDW-mx})},[DW]);

  // Marquee
  const handleMStart = useCallback(e=>{if(e.target.closest("[data-bar]"))return;if(e.button!==0)return;const cont=bodyRef.current;if(!cont)return;const rect=cont.getBoundingClientRect();setMarquee({sx:e.clientX-rect.left,sy:e.clientY-rect.top,cx:e.clientX-rect.left,cy:e.clientY-rect.top});setMActive(true);if(!(e.shiftKey||e.metaKey||e.ctrlKey))setSelIds(new Set())},[]);

  // Double-click to create new task
  const handleBodyDblClick = useCallback(e=>{
    if(e.target.closest("[data-bar]"))return;
    if(view==="timeline")return; // timeline view not supported yet
    const cont=bodyRef.current;if(!cont)return;
    const rect=cont.getBoundingClientRect();
    const x=e.clientX-rect.left+ganttRef.current.scrollLeft;
    const y=e.clientY-rect.top+ganttRef.current.scrollTop;
    // Find which project row was clicked
    let rowY=0,targetProj=null;
    for(const row of rowList){
      const h=row.type==="project"||row.type==="member"?44:36;
      if(y>=rowY&&y<rowY+h){
        if(row.type==="project")targetProj=row.project;
        else if(row.type==="task")targetProj=row.project;
        break;
      }
      rowY+=h;
      if(row.type==="project")targetProj=row.project;
    }
    if(!targetProj)return;
    // Calculate clicked date
    const dayIndex=Math.floor(x/DW);
    const clickedDate=dateRange[dayIndex];
    if(!clickedDate)return;
    // Create new task
    const newId=targetProj.id+"-"+Date.now();
    const startDate=new Date(clickedDate);
    const endDate=addDays(startDate,2);
    const newTask={id:newId,projectId:targetProj.id,name:"",phase:"wire",assignee:null,start:startDate,end:endDate,done:false,taskStatus:"inbox",desc:"",comments:[],estimatedHours:null};
    setProjects(ps=>ps.map(p=>p.id===targetProj.id?{...p,tasks:[...p.tasks,newTask],collapsed:false}:p));
    setOpenTid(newId);
  },[view,rowList,DW,dateRange]);
  useEffect(()=>{if(!mActive||!marquee)return;const onM=e=>{const cont=bodyRef.current;if(!cont)return;const rect=cont.getBoundingClientRect();const x=e.clientX-rect.left,y=e.clientY-rect.top;setMarquee(prev=>prev?{...prev,cx:x,cy:y}:null);const rects=barRects.current;const mx1=Math.min(marquee.sx,x),my1=Math.min(marquee.sy,y),mx2=Math.max(marquee.sx,x),my2=Math.max(marquee.sy,y);const hit=new Set();for(const tid of Object.keys(rects)){const br=rects[tid];if(br.left<mx2&&br.right>mx1&&br.top<my2&&br.bottom>my1)hit.add(tid)}setSelIds(hit)};const onU=()=>{setMActive(false);setMarquee(null)};window.addEventListener("mousemove",onM);window.addEventListener("mouseup",onU);return()=>{window.removeEventListener("mousemove",onM);window.removeEventListener("mouseup",onU)}},[mActive,marquee]);

  useEffect(()=>{setTimeout(()=>{if(ganttRef.current)ganttRef.current.scrollLeft=Math.max(0,todayPos-300)},100)},[todayPos,view]);
  useEffect(()=>{const h=e=>{if(e.key==="Escape"){if(openTid)setOpenTid(null);else clearSel()}};window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h)},[clearSel,openTid]);

  const capPeriod = useMemo(()=>{
    if(capMode==="week"){
      const baseWeek=getMon(today);
      const ws=addDays(baseWeek,capOffset*7);
      const we=addDays(ws,4);
      const label=capOffset===0?"今週":capOffset>0?(capOffset===1?"来週":capOffset+"週間後"):(capOffset===-1?"先週":Math.abs(capOffset)+"週間前");
      return{start:ws,end:we,label,dateLabel:fmtD(ws)+" 〜 "+fmtD(we)};
    }else{
      const baseMonth=new Date(today.getFullYear(),today.getMonth()+capOffset,1);
      const ws=baseMonth;
      const we=new Date(baseMonth.getFullYear(),baseMonth.getMonth()+1,0);
      const label=capOffset===0?"今月":capOffset>0?(capOffset===1?"来月":capOffset+"ヶ月後"):(capOffset===-1?"先月":Math.abs(capOffset)+"ヶ月前");
      return{start:ws,end:we,label,dateLabel:(ws.getMonth()+1)+"月"};
    }
  },[today,capMode,capOffset]);
  const capData = useMemo(()=>{
    const ws=capPeriod.start,we=capPeriod.end;
    const workDaysInPeriod=capMode==="week"?5:Math.round((we-ws)/(864e5*7)*5);
    return TEAM.map(m=>{
      const mt=[];
      const hpPeriod=capMode==="week"?m.hpw:Math.round(m.hpw*workDaysInPeriod/5);
      projects.forEach(p=>p.tasks.forEach(t=>{
        if(t.assignee===m.id&&t.type!=="milestone"){
          const s=new Date(t.start),e=new Date(t.end);
          if(s<=we&&e>=ws){
            const os=s>ws?s:ws,oe=e<we?e:we;
            let dInPeriod=0;
            const cur=new Date(os);
            while(cur<=oe){if(cur.getDay()!==0&&cur.getDay()!==6)dInPeriod++;cur.setDate(cur.getDate()+1)}
            const totalDays=diffD(t.start,t.end)+1;
            const hours=t.estimatedHours!=null?Math.round(t.estimatedHours*(dInPeriod/(totalDays*5/7))*10)/10:dInPeriod*8;
            mt.push({name:t.name,hours:Math.round(hours*10)/10,color:PH[t.phase]?.c||"#666",hasEst:t.estimatedHours!=null});
          }
        }
      }));
      const th=mt.reduce((s,t)=>s+t.hours,0);
      return{...m,tasks:mt,totalHours:Math.round(th*10)/10,util:Math.min(100,Math.round(th/hpPeriod*100)),hpPeriod};
    });
  },[projects,capPeriod,capMode]);

  useEffect(()=>{const pos={};let rowY=0;rowList.forEach(row=>{if(row.type==="project"||row.type==="member"){rowY+=44;return}const t=row.task;const left=getPos(t.start),right=getPos(t.end)+DW;if(t.type==="milestone")pos[t.id]={left,right:left+24,top:rowY+6,bottom:rowY+30};else pos[t.id]={left,right,top:rowY+7,bottom:rowY+29};rowY+=36});barRects.current=pos},[rowList,getPos,DW]);

  const mRect=marquee?{left:Math.min(marquee.sx,marquee.cx),top:Math.min(marquee.sy,marquee.cy),width:Math.abs(marquee.cx-marquee.sx),height:Math.abs(marquee.cy-marquee.sy)}:null;
  const selCount=selIds.size;
  const isGL=view==="gantt"||view==="timeline";
  const presets=[{l:"日",dw:40},{l:"週",dw:16},{l:"月",dw:5},{l:"四半期",dw:2},{l:"年",dw:1.5}];

  if (loading) {
    return (
      <div style={{width:"100vw",height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f8f7f4",fontFamily:"'Noto Sans JP',sans-serif"}}>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:24,marginBottom:16}}>読み込み中...</div>
          <div style={{color:"#6b7280"}}>Supabaseからデータを取得しています</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{width:"100vw",height:"100vh",display:"flex",flexDirection:"column",background:"#f8f7f4",overflow:"hidden",fontFamily:"'Noto Sans JP',sans-serif",color:"#1f2937"}}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 20px",height:56,borderBottom:"1px solid #e5e7eb",background:"#fff",flexShrink:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:30,height:30,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,color:"#fff"}}>G</div><span style={{fontSize:15,fontWeight:600,color:"#1f2937"}}>Gridge Projects</span></div>
          <div style={{display:"flex",gap:2,background:"#f3f4f6",borderRadius:8,padding:3}}>
            <button style={ST.tab(view==="gantt")} onClick={()=>setView("gantt")}>{"▤ ガント"}</button>
            <button style={ST.tab(view==="timeline")} onClick={()=>setView("timeline")}>{"👤 メンバー"}</button>
            <button style={ST.tab(view==="calendar")} onClick={()=>setView("calendar")}>{"▦ カレンダー"}</button>
            <button style={ST.tab(view==="kanban")} onClick={()=>setView("kanban")}>{"▤ カンバン"}</button>
          </div>
          {isGL&&<div style={{display:"flex",alignItems:"center",gap:8,marginLeft:8}}>
            <div style={{display:"flex",gap:2,background:"#f3f4f6",borderRadius:6,padding:2}}>{presets.map(p=><button key={p.l} style={{padding:"4px 8px",borderRadius:4,fontSize:10,fontWeight:500,cursor:"pointer",color:Math.abs(dayWidth-p.dw)<1?"#1f2937":"#6b7280",border:"none",background:Math.abs(dayWidth-p.dw)<1?"#e5e7eb":"transparent"}} onClick={()=>setDayWidth(p.dw)}>{p.l}</button>)}</div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:11,color:"#6b7280",cursor:"pointer"}} onClick={()=>setDayWidth(clamp(DW*0.7,MIN_DW,MAX_DW))}>{"−"}</span>
              <input type="range" min={Math.log(MIN_DW)} max={Math.log(MAX_DW)} step={0.01} value={Math.log(DW)} onChange={e=>setDayWidth(Math.exp(parseFloat(e.target.value)))} style={{width:80,accentColor:"#6366f1",cursor:"pointer"}}/>
              <span style={{fontSize:11,color:"#6b7280",cursor:"pointer"}} onClick={()=>setDayWidth(clamp(DW*1.4,MIN_DW,MAX_DW))}>{"＋"}</span>
              <span style={{fontSize:10,color:"#6b7280",minWidth:24}}>{getZLbl(DW)}</span>
            </div>
          </div>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <button style={{...ST.btnI,...(showCap?{background:"rgba(99,102,241,.08)",borderColor:"#6366f1",color:"#6366f1"}:{})}} onClick={()=>setShowCap(!showCap)}>{"👥"}</button>
          <button style={ST.btnP} onClick={()=>setShowNewModal(true)}>{"＋ 新規案件"}</button>
          <button style={{...ST.btnI,background:saving?"#f3f4f6":"#fff"}} onClick={saveToDB} disabled={saving}>{saving?"保存中...":"💾 保存"}</button>
        </div>
      </div>

      <div style={ST.fbar}>
        <span style={{fontSize:11,color:"#6b7280",marginRight:4}}>担当:</span>
        <button style={ST.chip(!filterA)} onClick={()=>setFilterA(null)}>全員</button>
        {TEAM.map(m=><button key={m.id} style={ST.chip(filterA===m.id,m.color)} onClick={()=>setFilterA(filterA===m.id?null:m.id)}>{m.name}</button>)}
        <div style={{width:1,height:20,background:"#e5e7eb"}}/>
        <span style={{fontSize:11,color:"#6b7280",marginRight:4}}>状態:</span>
        <button style={ST.chip(!filterS)} onClick={()=>setFilterS(null)}>すべて</button>
        <button style={ST.chip(filterS==="active")} onClick={()=>setFilterS(filterS==="active"?null:"active")}>進行中</button>
        <button style={ST.chip(filterS==="planning")} onClick={()=>setFilterS(filterS==="planning"?null:"planning")}>計画中</button>
      </div>

      {isGL&&<div style={ST.sbar(selCount>0)}>
        {selCount>0?<React.Fragment><span style={{fontWeight:700,fontSize:14}}>{selCount}</span><span>件選択中</span><button style={ST.sbtn} onClick={clearSel}>選択解除 (Esc)</button><button style={ST.sbtn} onClick={selectAll}>すべて選択</button><span style={{fontSize:11,color:"#6b7280",marginLeft:"auto"}}>ドラッグで一括移動 ・ 空白をドラッグで範囲選択</span></React.Fragment>
        :<React.Fragment><span style={{color:"#6b7280"}}>タスクを選択してください</span><span style={{fontSize:11,color:"#6b7280",marginLeft:"auto"}}>Ctrl+スクロールで拡大縮小 ・ ダブルクリックでタスク詳細</span></React.Fragment>}
      </div>}

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        {view==="calendar"?<CalView projects={projects} today={today} onOpen={t=>setOpenTid(t.id)}/>:view==="kanban"?<KanbanView projects={projects} setProjects={setProjects} onOpen={t=>setOpenTid(t.id)}/>:(
          <React.Fragment>
            <div style={ST.side}>
              <div style={{padding:"12px 16px",fontSize:11,fontWeight:600,color:"#6b7280",borderBottom:"1px solid #e5e7eb"}}>{view==="timeline"?"メンバー別":"案件一覧"} ({filtered.length})</div>
              <div style={{flex:1,overflowY:"auto"}} ref={sideRef} onScroll={e=>{if(ganttRef.current)ganttRef.current.scrollTop=e.target.scrollTop}}>
                {rowList.map(row=>{
                  if(row.type==="project"){const p=row.project;const isDragOver=dragOverProjId===p.id&&dragProjId!==p.id;return(<div key={"p-"+p.id} draggable onDragStart={()=>setDragProjId(p.id)} onDragEnd={()=>{if(dragProjId&&dragOverProjId)moveProject(dragProjId,dragOverProjId);setDragProjId(null);setDragOverProjId(null)}} onDragOver={e=>{e.preventDefault();setDragOverProjId(p.id)}} onDragLeave={()=>setDragOverProjId(null)} style={{...ST.prow(true),opacity:dragProjId===p.id?0.5:1,background:isDragOver?"rgba(99,102,241,.15)":"#f9fafb",borderTop:isDragOver?"2px solid #6366f1":"none"}}><div style={{width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",cursor:"grab",color:"#9ca3af",fontSize:10,flexShrink:0}}>{"⋮⋮"}</div><div style={ST.tog(!p.collapsed)} onClick={()=>togProj(p.id)}>{"▶"}</div><div style={{width:7,height:7,borderRadius:"50%",flexShrink:0,background:p.status==="active"?"#10b981":"#f59e0b"}}/><div style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",cursor:"pointer"}} onClick={()=>selProject(p.id)}>{p.name}</div><span style={{fontSize:10,color:"#6b7280"}}>{p.tasks.length}</span></div>)}
                  if(row.type==="member"){const m=row.member;return(<div key={"m-"+m.id} style={{...ST.prow(true),gap:8}}><div style={ST.tav(m.color)}>{m.av}</div><div style={{flex:1}}>{m.name}</div><span style={{fontSize:10,color:"#6b7280"}}>{row.count}</span></div>)}
                  const t=row.task;const m=TEAM.find(x=>x.id===t.assignee);const isSel=selIds.has(t.id);const pName=row.project?.name||"";
                  return(<div key={"t-"+t.id} style={{...ST.prow(false),paddingLeft:36,...(isSel?{background:"rgba(99,102,241,.08)"}:{})}} onClick={e=>toggleSel(t.id,e)} onDoubleClick={()=>setOpenTid(t.id)}>
                    {t.done&&<span style={{color:"#10b981",fontSize:10,flexShrink:0}}>{"✓"}</span>}
                    <div style={{width:6,height:6,borderRadius:2,flexShrink:0,background:PH[t.phase]?.c}}/>
                    <div style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textDecoration:t.done?"line-through":"none",opacity:t.done?0.5:1}}>{t.name||"新規タスク"}{view==="timeline"&&<span style={{color:"#9ca3af",marginLeft:6}}>{pName}</span>}</div>
                    {view!=="timeline"&&m&&<div style={ST.tav(m.color)}>{m.av}</div>}
                  </div>);
                })}
              </div>
            </div>

            <div style={{display:"flex",flexDirection:"column",flex:1,overflow:"hidden",background:"#f8f7f4"}}>
              <div ref={headerRef} style={{flexShrink:0,overflow:"hidden"}}>
                <div style={{display:"flex"}}>{headerRows.top.map((g,i)=><div key={i} style={{fontSize:11,fontWeight:600,color:"#6b7280",padding:"6px 0 2px 8px",borderBottom:"1px solid #e5e7eb",background:"#fff",width:g.width,minWidth:g.width,overflow:"hidden",whiteSpace:"nowrap"}}>{g.width>40?g.label:""}</div>)}</div>
                <div style={{display:"flex"}}>{headerRows.bot.map((col,i)=>(<div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontSize:zoomLevel==="day"?10:11,color:col.isToday?"#6366f1":"#6b7280",fontWeight:col.isToday?700:400,padding:zoomLevel==="day"?"2px 0 6px":"6px 2px",borderRight:"1px solid #e5e7eb",flexShrink:0,width:col.width,minWidth:col.width,background:col.isWE?"#f9fafb":"#fff",opacity:col.isWE&&!col.isToday?0.6:1,overflow:"hidden"}}>{zoomLevel==="day"?<React.Fragment><span style={{fontSize:9,marginBottom:1}}>{col.sub}</span><span style={{fontSize:11,fontWeight:500}}>{col.label}</span></React.Fragment>:<span style={{fontSize:11,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{col.width>20?col.label:""}</span>}</div>))}</div>
              </div>
              <div style={{flex:1,overflow:"auto",position:"relative"}} ref={ganttRef} onWheel={handleWheel} onScroll={e=>{if(headerRef.current)headerRef.current.scrollLeft=e.target.scrollLeft;if(sideRef.current)sideRef.current.scrollTop=e.target.scrollTop}}>
                <div ref={bodyRef} style={{width:totalWidth,position:"relative",cursor:mActive?"crosshair":"default"}} onMouseDown={handleMStart} onDoubleClick={handleBodyDblClick}>
                  <div style={{position:"absolute",top:0,bottom:0,width:2,background:"#6366f1",zIndex:4,opacity:0.8,pointerEvents:"none",left:todayPos+DW/2}}/>
                  {zoomLevel==="day"&&<div style={{position:"absolute",top:0,left:0,right:0,bottom:0,display:"flex",pointerEvents:"none"}}>{dateRange.map((d,i)=><div key={i} style={{width:DW,minWidth:DW,borderRight:"1px solid #e5e7eb",background:isWE(d)?"#f9fafb":"transparent"}}/>)}</div>}
                  {mActive&&mRect&&mRect.width>3&&<div style={{position:"absolute",border:"1.5px dashed #6366f1",background:"rgba(99,102,241,.06)",zIndex:20,pointerEvents:"none",borderRadius:3,left:mRect.left,top:mRect.top,width:mRect.width,height:mRect.height}}/>}
                  {rowList.map(row=>{
                    if(row.type==="project"||row.type==="member")return<div key={"gr-"+(row.project?.id||row.member?.id)} style={{display:"flex",position:"relative",height:44,borderBottom:"1px solid #e5e7eb",background:"#fafafa"}}/>;
                    const t=row.task,left=getPos(t.start),right=getPos(t.end)+DW,width=right-left;
                    const ph=PH[t.phase]||{c:"#666"};const isMs=t.type==="milestone";const mem=TEAM.find(x=>x.id===t.assignee);
                    const isSel=selIds.has(t.id);const isDrg=drag&&drag.active&&drag.active.has(t.id);
                    const ds=t.done?{opacity:0.4,filter:"grayscale(50%)"}:{};const pName=row.project?.name||"";
                    const barDays=diffD(t.start,t.end)+1;
                    const hasEst=t.estimatedHours!=null&&t.type!=="milestone";
                    const estRatio=hasEst?Math.min(1,(t.estimatedHours/8)/barDays):1;
                    const filledW=hasEst?Math.max(4,width*estRatio):width;
                    return(<div key={"gr-"+t.id} style={{display:"flex",position:"relative",height:36}}>
                      {isMs?(<div data-bar="1" style={{...ST.ms(left),...ds,top:10}} onMouseDown={e=>startDrag(e,t)} onClick={e=>{e.stopPropagation();toggleSel(t.id,e)}} onMouseEnter={e=>!drag&&setTip({x:e.clientX,y:e.clientY,task:t,project:pName})} onMouseLeave={()=>setTip(null)} onDoubleClick={()=>setOpenTid(t.id)}><div style={ST.md(ph.c,isSel)}/>{DW>=20&&<span style={{fontSize:10,fontWeight:500,color:"#4b5563",whiteSpace:"nowrap"}}>{t.done?"✓ ":""}{t.name||"新規タスク"}<span style={{color:"#9ca3af",marginLeft:12}}>{pName}</span></span>}</div>)
                      :(<div data-bar="1" style={{...ST.bar(left,width,hasEst?ph.c+"40":ph.c,isSel,isDrg),...ds,height:22,top:7,overflow:"visible"}} onMouseDown={e=>startDrag(e,t)} onClick={e=>{e.stopPropagation();toggleSel(t.id,e)}} onMouseEnter={e=>!drag&&setTip({x:e.clientX,y:e.clientY,task:t,project:pName})} onMouseLeave={()=>setTip(null)} onDoubleClick={()=>setOpenTid(t.id)}>
                        {hasEst&&<div style={{position:"absolute",left:0,top:0,bottom:0,width:filledW,background:ph.c,borderRadius:estRatio>=1?"5px":"5px 0 0 5px"}}/>}
                        <div style={ST.rh("l")} onMouseDown={e=>startDrag(e,t,"resize-left")}/>
                        {width>30&&<span style={{pointerEvents:"none",whiteSpace:"nowrap",position:"relative",zIndex:1}}>{t.done&&<span style={{marginRight:4}}>{"✓"}</span>}{mem&&view!=="timeline"&&<span style={{opacity:0.8,marginRight:4}}>{mem.av}</span>}{t.name||"新規タスク"}</span>}
                        <div style={ST.rh("r")} onMouseDown={e=>startDrag(e,t,"resize-right")}/>
                      </div>)}
                      {!isMs&&<span style={{position:"absolute",left:left+width+12,top:10,fontSize:10,color:"#9ca3af",whiteSpace:"nowrap",pointerEvents:"none"}}>{pName}</span>}
                    </div>);
                  })}
                </div>
              </div>
            </div>
          </React.Fragment>
        )}

        {showCap&&!openTask&&(
          <div style={ST.cap}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #e5e7eb"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                <div style={{display:"flex",gap:2,background:"#f3f4f6",borderRadius:6,padding:2}}>
                  <button style={{padding:"4px 10px",borderRadius:4,fontSize:10,fontWeight:500,cursor:"pointer",border:"none",background:capMode==="week"?"#e5e7eb":"transparent",color:capMode==="week"?"#1f2937":"#6b7280"}} onClick={()=>{setCapMode("week");setCapOffset(0)}}>週</button>
                  <button style={{padding:"4px 10px",borderRadius:4,fontSize:10,fontWeight:500,cursor:"pointer",border:"none",background:capMode==="month"?"#e5e7eb":"transparent",color:capMode==="month"?"#1f2937":"#6b7280"}} onClick={()=>{setCapMode("month");setCapOffset(0)}}>月</button>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <button style={{width:24,height:24,border:"1px solid #e5e7eb",borderRadius:4,background:"#fff",cursor:"pointer",fontSize:11,color:"#6b7280",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setCapOffset(o=>o-1)}>{"◀"}</button>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:12,fontWeight:600,color:"#1f2937"}}>{capPeriod.label}のキャパシティ</div>
                  <div style={{fontSize:10,color:"#6b7280",marginTop:2}}>{capPeriod.dateLabel}</div>
                </div>
                <button style={{width:24,height:24,border:"1px solid #e5e7eb",borderRadius:4,background:"#fff",cursor:"pointer",fontSize:11,color:"#6b7280",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setCapOffset(o=>o+1)}>{"▶"}</button>
              </div>
              {capOffset!==0&&<button style={{marginTop:8,width:"100%",padding:"4px 8px",border:"1px solid #e5e7eb",borderRadius:4,background:"#fff",cursor:"pointer",fontSize:10,color:"#6366f1"}} onClick={()=>setCapOffset(0)}>{capMode==="week"?"今週":"今月"}に戻る</button>}
            </div>
            {capData.map(m=>(
              <div key={m.id} style={{padding:"12px 16px",borderBottom:"1px solid #e5e7eb"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><div style={{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",flexShrink:0,background:m.color}}>{m.av}</div><div><div style={{fontSize:13,fontWeight:500,color:"#1f2937"}}>{m.name}</div><div style={{fontSize:10,color:"#6b7280"}}>{m.role}</div></div></div>
                <div style={{height:6,background:"#e5e7eb",borderRadius:3,overflow:"hidden",marginBottom:4}}><div style={{height:"100%",borderRadius:3,width:m.util+"%",background:m.util>90?"#ef4444":m.util>70?"#f59e0b":"#10b981"}}/></div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#6b7280"}}><span>{m.totalHours}h / {m.hpPeriod}h</span><span style={{color:m.util>90?"#ef4444":m.util>70?"#f59e0b":"#10b981",fontWeight:600}}>{m.util}%</span></div>
                <div style={{marginTop:8}}>{m.tasks.map((t,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"3px 0",fontSize:11,color:"#4b5563"}}><div style={{width:5,height:5,borderRadius:2,flexShrink:0,background:t.color}}/><span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</span><span style={{color:"#6b7280",flexShrink:0}}>{t.hours}h</span></div>))}{m.tasks.length===0&&<div style={{fontSize:11,color:"#6b7280",padding:"4px 0"}}>タスクなし</div>}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {openTask&&<TaskPanel task={openTask.task} project={openTask.project} setProjects={setProjects} onClose={()=>setOpenTid(null)}/>}
      {openTask&&<div onClick={()=>setOpenTid(null)} style={{position:"fixed",top:0,left:0,right:440,bottom:0,zIndex:999,background:"rgba(0,0,0,.1)"}}/>}

      {dragPos&&dragShift!==0&&<div style={{position:"fixed",background:"#fff",border:"1px solid #6366f1",borderRadius:6,padding:"6px 12px",zIndex:200,pointerEvents:"none",fontSize:12,fontWeight:600,color:"#6366f1",boxShadow:"0 4px 12px rgba(0,0,0,.15)",whiteSpace:"nowrap",left:dragPos.x,top:dragPos.y}}>{dragShift>0?"+"+dragShift+"日 →":dragShift+"日 ←"}{selCount>1?" ("+selCount+"件)":""}</div>}

      {tip&&!drag&&(()=>{const days=diffD(tip.task.start,tip.task.end)+1;const defH=days*8;const hasEst=tip.task.estimatedHours!=null&&tip.task.type!=="milestone";return(
      <div style={{position:"fixed",background:"#fff",border:"1px solid #e5e7eb",borderRadius:8,padding:"10px 14px",zIndex:100,pointerEvents:"none",boxShadow:"0 4px 12px rgba(0,0,0,.1)",minWidth:180,left:tip.x+12,top:tip.y-10}}>
        <div style={{fontSize:12,fontWeight:600,marginBottom:4,color:"#1f2937"}}>{tip.task.name}</div>
        <div style={{fontSize:11,color:"#6b7280",marginBottom:2}}>{"📁 "}{tip.project}</div>
        <div style={{fontSize:11,color:"#6b7280",marginBottom:2}}>{"📅 "}{fmtDF(tip.task.start)}{" → "}{fmtDF(tip.task.end)}</div>
        <div style={{fontSize:11,color:"#6b7280",marginBottom:2}}>{"👤 "}{TEAM.find(x=>x.id===tip.task.assignee)?.name}</div>
        {tip.task.type!=="milestone"&&<div style={{fontSize:11,color:hasEst?"#6366f1":"#6b7280",marginBottom:2}}>{hasEst?("⏱ 見積もり: "+tip.task.estimatedHours+"h（バー: "+days+"日間）"):("⏱ "+days+"日間（"+defH+"h）")}</div>}
        <div style={{fontSize:11,color:"#6b7280",display:"flex",alignItems:"center",gap:4,marginTop:2}}><div style={{width:6,height:6,borderRadius:2,background:PH[tip.task.phase]?.c}}/>{PH[tip.task.phase]?.l}</div>
      </div>)})()}

      {showNewModal&&<React.Fragment>
        <div onClick={()=>setShowNewModal(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:1100}}/>
        <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",background:"#fff",borderRadius:12,padding:24,zIndex:1101,width:400,boxShadow:"0 20px 50px rgba(0,0,0,.2)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
            <h2 style={{fontSize:18,fontWeight:600,color:"#1f2937",margin:0}}>新規プロジェクト作成</h2>
            <button onClick={()=>setShowNewModal(false)} style={{width:28,height:28,border:"none",background:"#f3f4f6",borderRadius:6,cursor:"pointer",color:"#6b7280",fontSize:14}}>{"✕"}</button>
          </div>
          <p style={{fontSize:13,color:"#6b7280",marginBottom:16}}>テンプレートを選択してください</p>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {TEMPLATES.map(t=>(
              <button key={t.id} onClick={()=>createFromTemplate(t)} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",border:"1px solid #e5e7eb",borderRadius:8,background:"#fff",cursor:"pointer",textAlign:"left",transition:"all .15s"}} onMouseEnter={e=>e.currentTarget.style.borderColor="#6366f1"} onMouseLeave={e=>e.currentTarget.style.borderColor="#e5e7eb"}>
                <span style={{fontSize:24}}>{t.icon}</span>
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:"#1f2937"}}>{t.name}</div>
                  <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>{t.tasks.length}個のタスク</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </React.Fragment>}
    </div>
  );
}
