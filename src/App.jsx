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
  // 社内メンバー
  { id:"shimizu",name:"清水",role:"営業・全体統括",color:"#6366f1",hpw:40,av:"清",type:"internal" },
  { id:"imashige",name:"今重",role:"コンテンツ・企画",color:"#f59e0b",hpw:40,av:"今",type:"internal" },
  { id:"fujii",name:"藤井",role:"デザイン・撮影",color:"#10b981",hpw:40,av:"藤",type:"internal" },
  { id:"nishitani",name:"西谷",role:"エンジニアリング",color:"#ef4444",hpw:40,av:"西",type:"internal" },
  { id:"honda",name:"本田",role:"ディレクター(パート)",color:"#8b5cf6",hpw:20,av:"本",type:"internal" },
  { id:"nakata",name:"中田",role:"デザイン",color:"#ec4899",hpw:40,av:"中",type:"internal" },
  // 社外メンバー
  { id:"okada",name:"岡田",role:"プランナー",color:"#0ea5e9",hpw:20,av:"岡",type:"external" },
  { id:"client",name:"クライアント",role:"お客様",color:"#64748b",hpw:0,av:"客",type:"external" },
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
  {id:"blank",name:"空のプロジェクト",icon:"📁",tasks:[]},
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
function TaskPanel({ task, project, projectTasks, projects, setProjects, onClose, members }) {
  const [comment, setComment] = useState("");
  const endRef = useRef(null);
  const mem = members.find(x => x.id === task.assignee);
  const ph = PH[task.phase] || { l:"?", c:"#666" };
  const up = useCallback((f, v) => setProjects(ps => ps.map(p => ({ ...p, tasks: p.tasks.map(t => t.id === task.id ? { ...t, [f]: v } : t) }))), [task.id, setProjects]);
  const otherTasks = projectTasks.filter(t => t.id !== task.id); // 自分以外のタスク
  // プロジェクト移動
  const moveToProject = useCallback((newProjectId) => {
    if (newProjectId === task.projectId) return;
    setProjects(ps => ps.map(p => {
      if (p.id === task.projectId) {
        // 元のプロジェクトからタスクを削除
        return { ...p, tasks: p.tasks.filter(t => t.id !== task.id) };
      }
      if (p.id === newProjectId) {
        // 新しいプロジェクトにタスクを追加
        return { ...p, tasks: [...p.tasks, { ...task, projectId: newProjectId, dependencies: [] }] };
      }
      return p;
    }));
  }, [task, setProjects]);
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
          <div><label style={lab}>タスク名</label><input value={task.name} onChange={e=>up("name",e.target.value)} style={inp} autoFocus/></div>
          <div><label style={lab}>プロジェクト</label><select value={task.projectId} onChange={e=>moveToProject(parseInt(e.target.value))} style={sel}>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div><label style={lab}>担当者</label>
            <div style={{ position:"relative" }}>
              <select value={task.assignee||""} onChange={e=>up("assignee",e.target.value||null)} style={sel}><option value="">未設定</option>{members.map(m=><option key={m.id} value={m.id}>{m.name} - {m.role}</option>)}</select>
              {mem&&<div style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", width:20, height:20, borderRadius:"50%", background:mem.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, fontWeight:700, color:"#fff", pointerEvents:"none" }}>{mem.av}</div>}
            </div>
          </div>
          <div><label style={lab}>フェーズ</label><select value={task.phase} onChange={e=>up("phase",e.target.value)} style={sel}>{PH_KEYS.map(k=><option key={k} value={k}>{PH[k].l}</option>)}</select></div>
          <div><label style={lab}>ステータス</label><select value={task.taskStatus||"todo"} onChange={e=>{up("taskStatus",e.target.value);if(e.target.value==="done")up("done",true);else up("done",false)}} style={sel}>{TASK_STATUS.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
          <div><label style={lab}>タイプ</label><select value={task.type||"task"} onChange={e=>{const v=e.target.value;up("type",v==="task"?undefined:v);if(v==="milestone")up("end",task.start)}} style={sel}><option value="task">通常タスク</option><option value="milestone">マイルストーン</option></select></div>
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
          <div>
            <label style={lab}>依存タスク（このタスクの前に完了が必要）</label>
            {otherTasks.length>0?<div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:120,overflowY:"auto",padding:4,background:"#f9fafb",borderRadius:6}}>
              {otherTasks.map(t=>{const isDep=(task.dependencies||[]).includes(t.id);return(
                <label key={t.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:4,cursor:"pointer",background:isDep?"rgba(99,102,241,.1)":"transparent"}} onClick={()=>{const deps=task.dependencies||[];up("dependencies",isDep?deps.filter(d=>d!==t.id):[...deps,t.id])}}>
                  <div style={{width:16,height:16,borderRadius:4,border:isDep?"none":"1.5px solid #d1d5db",background:isDep?"#6366f1":"#fff",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:10,flexShrink:0}}>{isDep&&"✓"}</div>
                  <span style={{fontSize:12,color:"#374151",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.type==="milestone"?"◆ ":""}{t.name||"無題"}</span>
                </label>
              )})}
            </div>:<div style={{fontSize:12,color:"#9ca3af",padding:8}}>他にタスクがありません</div>}
            {(task.dependencies||[]).length>0&&<div style={{fontSize:10,color:"#6366f1",marginTop:6}}>{(task.dependencies||[]).length}件の依存タスク</div>}
          </div>
          <div><label style={lab}>説明・メモ</label><textarea value={task.desc||""} onChange={e=>up("desc",e.target.value)} placeholder="タスクの詳細、注意事項など..." rows={4} style={{...inp,resize:"vertical",lineHeight:1.6}}/></div>
        </div>
        <div style={{ marginTop:24 }}>
          <div style={{ fontSize:11, fontWeight:600, color:"#6b7280", marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>コメント{task.comments&&task.comments.length>0&&<span style={{ background:"#6366f1", color:"#fff", borderRadius:10, padding:"1px 7px", fontSize:10 }}>{task.comments.length}</span>}</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>
            {(!task.comments||task.comments.length===0)&&<div style={{ padding:16, textAlign:"center", color:"#6b7280", fontSize:12, background:"#f9fafb", borderRadius:8 }}>まだコメントはありません</div>}
            {(task.comments||[]).map(c => { const a = members.find(x=>x.id===c.author)||members[0]; return (
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

// Calendar - 週/月表示、月曜始まり、ドラッグ移動対応
function CalView({ projects, setProjects, today, onOpen, members, filterA, filterS }) {
  const [calMode, setCalMode] = useState("month"); // "day" or "week" or "month"
  const [offset, setOffset] = useState(0); // 日/週/月のオフセット（日・週表示用）
  const [monthRange, setMonthRange] = useState({ start: -2, end: 4 }); // 月表示用：相対月範囲
  const [monthOffset, setMonthOffset] = useState(0); // 月表示用：現在表示中の月オフセット
  const [drag, setDrag] = useState(null);
  const DN_MON = ["月", "火", "水", "木", "金", "土", "日"];

  const tasks = useMemo(() => {
    const arr = [];
    projects
      .filter(p => !filterS || p.status === filterS)
      .forEach(p => p.tasks
        .filter(t => {
          if (!filterA) return true;
          if (filterA === "unassigned") return !t.assignee;
          return t.assignee === filterA;
        })
        .forEach(t => arr.push({ ...t, projectName: p.name, projectId: p.id })));
    return arr;
  }, [projects, filterA, filterS]);

  const getMonday = (d) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return date;
  };

  const getDayIdx = (d) => {
    const day = d.getDay();
    return day === 0 ? 6 : day - 1;
  };

  // 現在表示中の日付（日表示用）
  const currentDay = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return d;
  }, [today, offset]);

  // 現在表示中の週
  const currentWeek = useMemo(() => {
    const mon = getMonday(today);
    mon.setDate(mon.getDate() + offset * 7);
    const week = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      week.push(d);
    }
    return week;
  }, [today, offset]);

  // 現在表示中の月
  const currentMonth = useMemo(() => {
    const d = new Date(today);
    d.setMonth(d.getMonth() + offset);
    d.setDate(1);
    return d;
  }, [today, offset]);

  // ヘッダーラベル
  const headerLabel = useMemo(() => {
    if (calMode === "day") {
      const d = currentDay;
      const dayName = DN_MON[getDayIdx(d)];
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${dayName}）`;
    } else if (calMode === "week") {
      const ws = currentWeek[0], we = currentWeek[6];
      return `${ws.getMonth() + 1}/${ws.getDate()} 〜 ${we.getMonth() + 1}/${we.getDate()}`;
    } else {
      // 月表示用：monthOffsetを使用
      const d = new Date(today);
      d.setMonth(d.getMonth() + monthOffset);
      return `${d.getFullYear()}年${d.getMonth() + 1}月`;
    }
  }, [calMode, currentDay, currentWeek, today, monthOffset]);

  // 月表示用の週配列を生成（複数月対応）
  const weeksData = useMemo(() => {
    if (calMode === "day") return [];
    if (calMode === "week") return [{ week: currentWeek, monthOffset: 0, isFirstWeekOfMonth: false }];
    // 月表示：複数月の週を生成
    const result = [];
    for (let m = monthRange.start; m <= monthRange.end; m++) {
      const d = new Date(today);
      d.setMonth(d.getMonth() + m);
      const year = d.getFullYear();
      const month = d.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const mon = getMonday(firstDay);
      const c = new Date(mon);
      let isFirst = true;
      while (c <= lastDay || c.getDay() !== 1) {
        const week = [];
        for (let i = 0; i < 7; i++) { week.push(new Date(c)); c.setDate(c.getDate() + 1); }
        result.push({ week, monthOffset: m, monthLabel: `${year}年${month + 1}月`, isFirstWeekOfMonth: isFirst });
        isFirst = false;
        if (c > lastDay && c.getDay() === 1) break;
      }
    }
    return result;
  }, [calMode, currentWeek, today, monthRange]);
  const weeks = useMemo(() => weeksData.map(w => w.week), [weeksData]);

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
        const startDay = ts < ws ? 0 : getDayIdx(ts);
        const endDay = te > we ? 6 : getDayIdx(te);
        return { ...t, startDay, endDay, span: endDay - startDay + 1 };
      });
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
  const initialScrollDone = useRef(false);
  useEffect(() => {
    if (scrollRef.current && calMode === "month" && !initialScrollDone.current) {
      const todayWeekIdx = weeks.findIndex(w => w.some(d => same(d, today)));
      if (todayWeekIdx > 0) {
        scrollRef.current.scrollTop = todayWeekIdx * 140 - 100;
        initialScrollDone.current = true;
      }
    }
  }, [weeks, today, calMode]);

  // 無限スクロール：端に近づいたら月を追加
  const handleMonthScroll = useCallback((e) => {
    if (calMode !== "month") return;
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    // 上端に近づいたら過去の月を追加
    if (scrollTop < 300) {
      setMonthRange(r => ({ ...r, start: r.start - 2 }));
    }
    // 下端に近づいたら未来の月を追加
    if (scrollHeight - scrollTop - clientHeight < 300) {
      setMonthRange(r => ({ ...r, end: r.end + 2 }));
    }
  }, [calMode]);

  // ドラッグでタスク移動・リサイズ
  const handleDragStart = (e, t, weekStart, type = "move") => {
    e.stopPropagation();
    e.preventDefault();
    const rect = e.currentTarget.closest("[data-week-row]")?.getBoundingClientRect() || e.currentTarget.parentElement.getBoundingClientRect();
    setDrag({ taskId: t.id, projectId: t.projectId, startX: e.clientX, cellWidth: rect.width / 7, origStart: new Date(t.start), origEnd: new Date(t.end), weekStart, type });
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (e) => {
      const dx = e.clientX - drag.startX;
      const dayShift = Math.round(dx / drag.cellWidth);
      if (dayShift === 0) return;
      setProjects(ps => ps.map(p => ({
        ...p,
        tasks: p.tasks.map(t => {
          if (t.id !== drag.taskId) return t;
          const newStart = new Date(drag.origStart);
          const newEnd = new Date(drag.origEnd);
          if (drag.type === "resize-left") {
            newStart.setDate(newStart.getDate() + dayShift);
            if (newStart > newEnd) return t; // 開始が終了を超えないように
          } else if (drag.type === "resize-right") {
            newEnd.setDate(newEnd.getDate() + dayShift);
            if (newEnd < newStart) return t; // 終了が開始を超えないように
          } else {
            newStart.setDate(newStart.getDate() + dayShift);
            newEnd.setDate(newEnd.getDate() + dayShift);
          }
          return { ...t, start: newStart, end: newEnd };
        })
      })));
    };
    const onUp = () => setDrag(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [drag, setProjects]);

  const ROW_H = calMode === "week" ? 28 : 22, ROW_GAP = 2, DATE_H = calMode === "week" ? 40 : 28;

  const scrollToMonth = useCallback((targetOffset) => {
    if (scrollRef.current) {
      const targetWeekIdx = weeksData.findIndex(w => w.monthOffset === targetOffset && w.isFirstWeekOfMonth);
      if (targetWeekIdx >= 0) {
        // 月ヘッダーの高さ(44px)も考慮してスクロール位置を計算
        let scrollPos = 0;
        for (let i = 0; i < targetWeekIdx; i++) {
          scrollPos += 140; // 週の高さ
          if (weeksData[i].isFirstWeekOfMonth) scrollPos += 44; // 月ヘッダーの高さ
        }
        scrollRef.current.scrollTo({ top: scrollPos, behavior: "smooth" });
      }
    }
  }, [weeksData]);

  const goToday = () => {
    if (calMode === "month") {
      setMonthOffset(0);
      scrollToMonth(0);
    } else {
      setOffset(0);
    }
  };
  const goPrev = () => {
    if (calMode === "month") {
      const newOffset = monthOffset - 1;
      // 範囲を拡張する必要があるかチェック
      if (newOffset < monthRange.start) {
        setMonthRange(r => ({ ...r, start: r.start - 2 }));
      }
      setMonthOffset(newOffset);
      setTimeout(() => scrollToMonth(newOffset), 50);
    } else {
      setOffset(o => o - 1);
    }
  };
  const goNext = () => {
    if (calMode === "month") {
      const newOffset = monthOffset + 1;
      // 範囲を拡張する必要があるかチェック
      if (newOffset > monthRange.end) {
        setMonthRange(r => ({ ...r, end: r.end + 2 }));
      }
      setMonthOffset(newOffset);
      setTimeout(() => scrollToMonth(newOffset), 50);
    } else {
      setOffset(o => o + 1);
    }
  };
  const changeMode = (mode) => { setCalMode(mode); setOffset(0); setMonthOffset(0); initialScrollDone.current = false; };

  // 日表示用：その日のタスク
  const dayTasks = useMemo(() => {
    if (calMode !== "day") return [];
    return tasks.filter(t => {
      const ts = new Date(t.start), te = new Date(t.end);
      ts.setHours(0,0,0,0); te.setHours(0,0,0,0);
      const cd = new Date(currentDay); cd.setHours(0,0,0,0);
      return ts <= cd && te >= cd;
    });
  }, [calMode, tasks, currentDay]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f8f7f4", overflow: "hidden" }}>
      {/* ヘッダー */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "#fff", borderBottom: "1px solid #e5e7eb", flexShrink: 0 }}>
        {/* 左: ナビゲーション */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={goPrev} style={{ width: 28, height: 28, border: "1px solid #e5e7eb", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "#4b5563" }}>{"‹"}</button>
          <button onClick={goToday} style={{ padding: "6px 14px", border: "1px solid #e5e7eb", borderRadius: 6, background: "#6366f1", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>今日</button>
          <button onClick={goNext} style={{ width: 28, height: 28, border: "1px solid #e5e7eb", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "#4b5563" }}>{"›"}</button>
          <span style={{ marginLeft: 12, fontSize: 14, fontWeight: 600, color: "#1f2937" }}>{headerLabel}</span>
        </div>
        {/* 右: 日/週/月 切り替え */}
        <div style={{ display: "flex", border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden" }}>
          {["day", "week", "month"].map((mode, i) => (
            <button key={mode} onClick={() => changeMode(mode)} style={{ padding: "6px 16px", border: "none", borderLeft: i > 0 ? "1px solid #e5e7eb" : "none", background: calMode === mode ? "#ef4444" : "#fff", color: calMode === mode ? "#fff" : "#4b5563", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
              {mode === "day" ? "日" : mode === "week" ? "週" : "月"}
            </button>
          ))}
        </div>
      </div>
      {/* 日表示 */}
      {calMode === "day" && (
        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb", minHeight: 400 }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb", background: same(currentDay, today) ? "rgba(99,102,241,.06)" : "#f9fafb" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#1f2937" }}>{dayTasks.length}件のタスク</span>
            </div>
            <div style={{ padding: 8 }}>
              {dayTasks.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>この日のタスクはありません</div>}
              {dayTasks.map(t => {
                const mem = members.find(m => m.id === t.assignee);
                const barColor = mem?.color || "#9ca3af";
                return (
                  <div key={t.id} onClick={() => onOpen(t)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", marginBottom: 8, background: barColor + "10", borderLeft: `4px solid ${barColor}`, borderRadius: 6, cursor: "pointer" }}>
                    {mem && <div style={{ width: 28, height: 28, borderRadius: "50%", background: barColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "#fff" }}>{mem.av}</div>}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1f2937", textDecoration: t.done ? "line-through" : "none", opacity: t.done ? 0.5 : 1 }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>{t.projectName}</div>
                    </div>
                    <div style={{ fontSize: 10, color: "#9ca3af" }}>{fmtD(t.start)} 〜 {fmtD(t.end)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {/* 週/月表示 */}
      {calMode !== "day" && (
        <React.Fragment>
          {/* 曜日ヘッダー */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: "1px solid #e5e7eb", background: "#fff", flexShrink: 0 }}>
            {DN_MON.map((d, i) => <div key={d} style={{ padding: calMode === "week" ? 12 : 10, textAlign: "center", fontSize: 11, fontWeight: 600, color: i >= 5 ? "#9ca3af" : "#6b7280" }}>{d}</div>)}
          </div>
          <div style={{ flex: 1, overflow: "auto" }} ref={scrollRef} onScroll={handleMonthScroll}>
            {weeksData.map((wd, wi) => {
              const week = wd.week;
              const rows = weekTasks[wi] || [];
              const contentH = calMode === "week" ? Math.max(rows.length * (ROW_H + ROW_GAP) + 16, 200) : Math.max(rows.length * (ROW_H + ROW_GAP) + 8, 60);
              return (
                <React.Fragment key={wi}>
                  {/* 月ヘッダー */}
                  {calMode === "month" && wd.isFirstWeekOfMonth && (
                    <div style={{ padding: "12px 16px", background: "#f3f4f6", borderBottom: "1px solid #e5e7eb", fontSize: 14, fontWeight: 700, color: "#1f2937", position: "sticky", top: 0, zIndex: 5 }}>{wd.monthLabel}</div>
                  )}
                  <div data-week-row="true" style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: "1px solid #e5e7eb", position: "relative", minHeight: calMode === "week" ? "calc(100vh - 160px)" : undefined }}>
                    {week.map((d, di) => {
                      const isT = same(d, today);
                      const isWeekend = di >= 5;
                      return (
                        <div key={di} style={{ minHeight: DATE_H + contentH, background: isT ? "rgba(239,68,68,.08)" : (isWeekend ? "#f9fafb" : "#fff"), borderRight: di < 6 ? "1px solid #f3f4f6" : "none" }}>
                          <div style={{ padding: calMode === "week" ? "8px 10px" : "4px 6px", height: DATE_H, display: "flex", alignItems: calMode === "week" ? "flex-start" : "center", flexDirection: calMode === "week" ? "column" : "row", gap: 4 }}>
                            {calMode === "month" && d.getDate() === 1 && <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 500 }}>{d.getMonth() + 1}月</span>}
                            <div style={isT ? { color: "#fff", fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, background: "#ef4444", borderRadius: "50%", fontSize: 12 } : { fontSize: calMode === "week" ? 14 : 12, fontWeight: 500, color: "#4b5563" }}>{d.getDate()}</div>
                            {calMode === "week" && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{MN[d.getMonth()]}</div>}
                          </div>
                        </div>
                      );
                    })}
                    {/* タスクバー */}
                    {rows.map((row, ri) => row.map(t => {
                      const mem = members.find(m => m.id === t.assignee);
                      const barColor = mem?.color || "#9ca3af";
                      const left = `calc(${t.startDay} * 100% / 7 + 4px)`;
                      const width = `calc(${t.span} * 100% / 7 - 8px)`;
                      const isDragging = drag?.taskId === t.id;
                      return (
                        <div key={t.id + "-" + wi} style={{ position: "absolute", top: DATE_H + ri * (ROW_H + ROW_GAP) + 4, left, width, height: ROW_H, borderRadius: 4, background: barColor, color: "#fff", fontSize: calMode === "week" ? 11 : 10, fontWeight: 500, display: "flex", alignItems: "center", boxShadow: isDragging ? "0 4px 12px rgba(0,0,0,.2)" : "0 1px 2px rgba(0,0,0,.1)", opacity: t.done ? 0.5 : 1, zIndex: isDragging ? 10 : 2, transform: isDragging ? "scale(1.02)" : "none" }}>
                        {/* 左リサイズハンドル */}
                        <div onMouseDown={(e) => handleDragStart(e, t, week[0], "resize-left")} style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 8, cursor: "ew-resize", borderRadius: "4px 0 0 4px" }} />
                        {/* メインエリア（移動用） */}
                        <div onMouseDown={(e) => handleDragStart(e, t, week[0], "move")} onClick={() => !drag && onOpen(t)} style={{ flex: 1, padding: "0 10px", cursor: isDragging ? "grabbing" : "grab", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", display: "flex", alignItems: "center" }}>
                          {mem && <span style={{ marginRight: 4, opacity: 0.9 }}>{mem.av}</span>}{t.name}<span style={{ marginLeft: 6, opacity: 0.7 }}>{t.projectName}</span>
                        </div>
                        {/* 右リサイズハンドル */}
                        <div onMouseDown={(e) => handleDragStart(e, t, week[0], "resize-right")} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 8, cursor: "ew-resize", borderRadius: "0 4px 4px 0" }} />
                      </div>
                      );
                    }))}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

// Kanban View
function KanbanView({ projects, setProjects, onOpen, members }) {
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
                const mem = members.find(m => m.id === task.assignee);
                const st = TASK_STATUS.find(s => s.id === (task.taskStatus || "todo"));
                const days = diffD(task.start, task.end) + 1;
                const hours = task.estimatedHours != null ? task.estimatedHours : days * 8;
                const hasEst = task.estimatedHours != null;
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
                      <span style={{ fontSize: 10, color: hasEst ? "#6366f1" : "#9ca3af", fontWeight: hasEst ? 500 : 400 }}>{hours}h</span>
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

// List View - Notion風リスト表示
function ListView({ projects, setProjects, onOpen, members }) {
  const [listMode, setListMode] = useState("project"); // "project" or "status"
  const [collapsed, setCollapsed] = useState({});

  const allTasks = useMemo(() => {
    const tasks = [];
    projects.forEach(p => p.tasks.forEach(t => tasks.push({ ...t, projectName: p.name, projectId: p.id })));
    return tasks.sort((a, b) => new Date(a.start) - new Date(b.start));
  }, [projects]);

  const groups = useMemo(() => {
    if (listMode === "project") {
      return projects.map(p => ({
        id: p.id,
        label: p.name,
        color: "#6366f1",
        tasks: [...p.tasks].sort((a, b) => new Date(a.start) - new Date(b.start)).map(t => ({ ...t, projectName: p.name, projectId: p.id }))
      }));
    } else {
      return TASK_STATUS.map(s => ({
        id: s.id,
        label: s.label,
        color: s.color,
        tasks: allTasks.filter(t => (t.taskStatus || "todo") === s.id)
      }));
    }
  }, [projects, allTasks, listMode]);

  const toggleGroup = (id) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  const updateTask = (taskId, field, value) => {
    setProjects(ps => ps.map(p => ({
      ...p,
      tasks: p.tasks.map(t => t.id === taskId ? { ...t, [field]: value, ...(field === "taskStatus" && value === "done" ? { done: true } : {}), ...(field === "taskStatus" && value !== "done" ? { done: false } : {}) } : t)
    })));
  };

  const thStyle = { padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#6b7280", background: "#f9fafb", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, zIndex: 1 };
  const tdStyle = { padding: "10px 12px", fontSize: 12, color: "#374151", borderBottom: "1px solid #f3f4f6", verticalAlign: "middle" };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f8f7f4" }}>
      <div style={{ padding: "12px 20px", borderBottom: "1px solid #e5e7eb", background: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, color: "#6b7280" }}>グループ:</span>
        <div style={{ display: "flex", gap: 2, background: "#f3f4f6", borderRadius: 6, padding: 2 }}>
          <button onClick={() => setListMode("project")} style={{ padding: "4px 12px", borderRadius: 4, fontSize: 11, fontWeight: 500, cursor: "pointer", border: "none", background: listMode === "project" ? "#fff" : "transparent", color: listMode === "project" ? "#1f2937" : "#6b7280", boxShadow: listMode === "project" ? "0 1px 2px rgba(0,0,0,.1)" : "none" }}>プロジェクト別</button>
          <button onClick={() => setListMode("status")} style={{ padding: "4px 12px", borderRadius: 4, fontSize: 11, fontWeight: 500, cursor: "pointer", border: "none", background: listMode === "status" ? "#fff" : "transparent", color: listMode === "status" ? "#1f2937" : "#6b7280", boxShadow: listMode === "status" ? "0 1px 2px rgba(0,0,0,.1)" : "none" }}>ステータス別</button>
        </div>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#6b7280" }}>{allTasks.length} タスク</span>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
        {groups.map(group => (
          <div key={group.id} style={{ marginBottom: 16, background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <div onClick={() => toggleGroup(group.id)} style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", background: "#fafafa", borderBottom: collapsed[group.id] ? "none" : "1px solid #e5e7eb" }}>
              <span style={{ fontSize: 10, color: "#9ca3af", transform: collapsed[group.id] ? "rotate(0deg)" : "rotate(90deg)", transition: "transform .15s" }}>{"▶"}</span>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: group.color }} />
              <span style={{ fontWeight: 600, fontSize: 13, color: "#1f2937" }}>{group.label}</span>
              <span style={{ fontSize: 11, color: "#6b7280", background: "#f3f4f6", borderRadius: 10, padding: "2px 8px" }}>{group.tasks.length}</span>
            </div>
            {!collapsed[group.id] && group.tasks.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: 32 }}></th>
                    <th style={thStyle}>タスク名</th>
                    {listMode === "status" && <th style={{ ...thStyle, width: 140 }}>プロジェクト</th>}
                    <th style={{ ...thStyle, width: 100 }}>担当者</th>
                    <th style={{ ...thStyle, width: 100 }}>フェーズ</th>
                    {listMode === "project" && <th style={{ ...thStyle, width: 100 }}>ステータス</th>}
                    <th style={{ ...thStyle, width: 160 }}>期間</th>
                    <th style={{ ...thStyle, width: 80 }}>工数</th>
                  </tr>
                </thead>
                <tbody>
                  {group.tasks.map(task => {
                    const ph = PH[task.phase] || { c: "#666", l: "?" };
                    const mem = members.find(m => m.id === task.assignee);
                    const st = TASK_STATUS.find(s => s.id === (task.taskStatus || "todo"));
                    const days = diffD(task.start, task.end) + 1;
                    const hours = task.estimatedHours != null ? task.estimatedHours : days * 8;
                    const hasEst = task.estimatedHours != null;
                    return (
                      <tr key={task.id} style={{ cursor: "pointer" }} onClick={() => onOpen(task)} onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={tdStyle} onClick={e => { e.stopPropagation(); updateTask(task.id, "done", !task.done); }}>
                          <div style={{ width: 18, height: 18, borderRadius: 4, border: task.done ? "none" : "2px solid #d1d5db", background: task.done ? "#10b981" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, cursor: "pointer" }}>{task.done && "✓"}</div>
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 500, color: task.done ? "#9ca3af" : "#1f2937", textDecoration: task.done ? "line-through" : "none" }}>{task.name || "新規タスク"}</td>
                        {listMode === "status" && <td style={{ ...tdStyle, color: "#6b7280" }}>{task.projectName}</td>}
                        <td style={tdStyle}>
                          {mem ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 22, height: 22, borderRadius: "50%", background: mem.color, color: "#fff", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600 }}>{mem.av}</div>
                              <span style={{ fontSize: 11 }}>{mem.name}</span>
                            </div>
                          ) : <span style={{ color: "#9ca3af", fontSize: 11 }}>未設定</span>}
                        </td>
                        <td style={tdStyle}><span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, background: ph.c + "18", color: ph.c, fontWeight: 500 }}>{ph.l}</span></td>
                        {listMode === "project" && <td style={tdStyle}><span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, background: st?.color + "18", color: st?.color, fontWeight: 500 }}>{st?.label}</span></td>}
                        <td style={{ ...tdStyle, fontSize: 11, color: "#6b7280" }}>{fmtD(task.start)} 〜 {fmtD(task.end)} <span style={{ color: "#9ca3af" }}>({days}日)</span></td>
                        <td style={{ ...tdStyle, fontSize: 11, color: hasEst ? "#6366f1" : "#6b7280", fontWeight: hasEst ? 500 : 400 }}>{hours}h</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {!collapsed[group.id] && group.tasks.length === 0 && <div style={{ padding: 20, textAlign: "center", color: "#9ca3af", fontSize: 12 }}>タスクなし</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// Member Management Modal
function MemberModal({ members, setMembers, onClose }) {
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ id: "", name: "", role: "", color: "#6366f1", hpw: 40, av: "", type: "internal" });
  const colors = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#0ea5e9", "#64748b", "#14b8a6", "#f97316"];

  const startEdit = (m) => {
    setEditingId(m.id);
    setForm({ ...m });
  };

  const startNew = (type) => {
    const newId = "member_" + Date.now();
    setEditingId("new");
    setForm({ id: newId, name: "", role: "", color: colors[members.length % colors.length], hpw: type === "internal" ? 40 : 20, av: "", type });
  };

  const save = () => {
    if (!form.name.trim()) return;
    const newMember = { ...form, av: form.av || form.name.slice(0, 1) };
    if (editingId === "new") {
      setMembers([...members, newMember]);
    } else {
      setMembers(members.map(m => m.id === editingId ? newMember : m));
    }
    setEditingId(null);
  };

  const remove = (id) => {
    if (!confirm("このメンバーを削除しますか？")) return;
    setMembers(members.filter(m => m.id !== id));
  };

  const cancel = () => setEditingId(null);

  const inp = { width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", color: "#1f2937", fontSize: 13, fontFamily: "inherit", outline: "none" };
  const lab = { fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" };

  const internalMembers = members.filter(m => m.type === "internal");
  const externalMembers = members.filter(m => m.type === "external");

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 12, width: 600, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 48px rgba(0,0,0,.2)" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#1f2937" }}>👥 メンバー管理</div>
          <button onClick={onClose} style={{ width: 28, height: 28, border: "none", background: "#f3f4f6", borderRadius: 6, cursor: "pointer", color: "#6b7280", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          {/* 社内メンバー */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1f2937" }}>社内メンバー</div>
              <button onClick={() => startNew("internal")} style={{ padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: "pointer", border: "1px solid #6366f1", background: "#6366f1", color: "#fff" }}>+ 追加</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {internalMembers.map(m => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#f9fafb", borderRadius: 8, border: editingId === m.id ? "2px solid #6366f1" : "1px solid #e5e7eb" }}>
                  {editingId === m.id ? (
                    <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 12, alignItems: "end" }}>
                      <div><label style={lab}>名前</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inp} autoFocus /></div>
                      <div><label style={lab}>役割</label><input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={inp} /></div>
                      <div><label style={lab}>週時間</label><input type="number" value={form.hpw} onChange={e => setForm({ ...form, hpw: parseInt(e.target.value) || 0 })} style={{ ...inp, width: 60 }} /></div>
                      <div><label style={lab}>色</label><div style={{ display: "flex", gap: 4 }}>{colors.map(c => <div key={c} onClick={() => setForm({ ...form, color: c })} style={{ width: 20, height: 20, borderRadius: "50%", background: c, cursor: "pointer", border: form.color === c ? "2px solid #1f2937" : "2px solid transparent" }} />)}</div></div>
                      <div style={{ gridColumn: "span 4", display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                        <button onClick={cancel} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 11, cursor: "pointer", border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280" }}>キャンセル</button>
                        <button onClick={save} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: "pointer", border: "none", background: "#6366f1", color: "#fff" }}>保存</button>
                      </div>
                    </div>
                  ) : (
                    <React.Fragment>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: m.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "#fff", flexShrink: 0 }}>{m.av}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#1f2937" }}>{m.name}</div>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>{m.role} ・ {m.hpw}h/週</div>
                      </div>
                      <button onClick={() => startEdit(m)} style={{ padding: "5px 10px", borderRadius: 5, fontSize: 11, cursor: "pointer", border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280" }}>編集</button>
                      <button onClick={() => remove(m.id)} style={{ padding: "5px 10px", borderRadius: 5, fontSize: 11, cursor: "pointer", border: "1px solid #fecaca", background: "#fef2f2", color: "#ef4444" }}>削除</button>
                    </React.Fragment>
                  )}
                </div>
              ))}
              {editingId === "new" && form.type === "internal" && (
                <div style={{ padding: "12px 14px", background: "#f0f9ff", borderRadius: 8, border: "2px solid #0ea5e9" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 12, alignItems: "end" }}>
                    <div><label style={lab}>名前</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inp} autoFocus /></div>
                    <div><label style={lab}>役割</label><input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={inp} /></div>
                    <div><label style={lab}>週時間</label><input type="number" value={form.hpw} onChange={e => setForm({ ...form, hpw: parseInt(e.target.value) || 0 })} style={{ ...inp, width: 60 }} /></div>
                    <div><label style={lab}>色</label><div style={{ display: "flex", gap: 4 }}>{colors.map(c => <div key={c} onClick={() => setForm({ ...form, color: c })} style={{ width: 20, height: 20, borderRadius: "50%", background: c, cursor: "pointer", border: form.color === c ? "2px solid #1f2937" : "2px solid transparent" }} />)}</div></div>
                    <div style={{ gridColumn: "span 4", display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                      <button onClick={cancel} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 11, cursor: "pointer", border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280" }}>キャンセル</button>
                      <button onClick={save} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: "pointer", border: "none", background: "#6366f1", color: "#fff" }}>追加</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 社外メンバー */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0ea5e9" }}>社外パートナー</div>
              <button onClick={() => startNew("external")} style={{ padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: "pointer", border: "1px solid #0ea5e9", background: "#0ea5e9", color: "#fff" }}>+ 追加</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {externalMembers.map(m => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#f0f9ff", borderRadius: 8, border: editingId === m.id ? "2px solid #0ea5e9" : "1px solid #bae6fd" }}>
                  {editingId === m.id ? (
                    <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 12, alignItems: "end" }}>
                      <div><label style={lab}>名前</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inp} autoFocus /></div>
                      <div><label style={lab}>役割</label><input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={inp} /></div>
                      <div><label style={lab}>週時間</label><input type="number" value={form.hpw} onChange={e => setForm({ ...form, hpw: parseInt(e.target.value) || 0 })} style={{ ...inp, width: 60 }} /></div>
                      <div><label style={lab}>色</label><div style={{ display: "flex", gap: 4 }}>{colors.map(c => <div key={c} onClick={() => setForm({ ...form, color: c })} style={{ width: 20, height: 20, borderRadius: "50%", background: c, cursor: "pointer", border: form.color === c ? "2px solid #1f2937" : "2px solid transparent" }} />)}</div></div>
                      <div style={{ gridColumn: "span 4", display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                        <button onClick={cancel} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 11, cursor: "pointer", border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280" }}>キャンセル</button>
                        <button onClick={save} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: "pointer", border: "none", background: "#0ea5e9", color: "#fff" }}>保存</button>
                      </div>
                    </div>
                  ) : (
                    <React.Fragment>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: m.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "#fff", flexShrink: 0 }}>{m.av}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#1f2937" }}>{m.name}</div>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>{m.role} ・ {m.hpw}h/週</div>
                      </div>
                      <button onClick={() => startEdit(m)} style={{ padding: "5px 10px", borderRadius: 5, fontSize: 11, cursor: "pointer", border: "1px solid #bae6fd", background: "#fff", color: "#0ea5e9" }}>編集</button>
                      <button onClick={() => remove(m.id)} style={{ padding: "5px 10px", borderRadius: 5, fontSize: 11, cursor: "pointer", border: "1px solid #fecaca", background: "#fef2f2", color: "#ef4444" }}>削除</button>
                    </React.Fragment>
                  )}
                </div>
              ))}
              {editingId === "new" && form.type === "external" && (
                <div style={{ padding: "12px 14px", background: "#ecfeff", borderRadius: 8, border: "2px solid #0ea5e9" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 12, alignItems: "end" }}>
                    <div><label style={lab}>名前</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inp} autoFocus /></div>
                    <div><label style={lab}>役割</label><input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={inp} /></div>
                    <div><label style={lab}>週時間</label><input type="number" value={form.hpw} onChange={e => setForm({ ...form, hpw: parseInt(e.target.value) || 0 })} style={{ ...inp, width: 60 }} /></div>
                    <div><label style={lab}>色</label><div style={{ display: "flex", gap: 4 }}>{colors.map(c => <div key={c} onClick={() => setForm({ ...form, color: c })} style={{ width: 20, height: 20, borderRadius: "50%", background: c, cursor: "pointer", border: form.color === c ? "2px solid #1f2937" : "2px solid transparent" }} />)}</div></div>
                    <div style={{ gridColumn: "span 4", display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                      <button onClick={cancel} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 11, cursor: "pointer", border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280" }}>キャンセル</button>
                      <button onClick={save} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: "pointer", border: "none", background: "#0ea5e9", color: "#fff" }}>追加</button>
                    </div>
                  </div>
                </div>
              )}
              {externalMembers.length === 0 && editingId !== "new" && (
                <div style={{ padding: 16, textAlign: "center", color: "#9ca3af", fontSize: 12, background: "#f9fafb", borderRadius: 8 }}>社外パートナーはまだ登録されていません</div>
              )}
            </div>
          </div>
        </div>

        <div style={{ padding: "16px 24px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 20px", borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: "pointer", border: "none", background: "#6366f1", color: "#fff" }}>閉じる</button>
        </div>
      </div>
    </div>
  );
}

// Main
export default function App() {
  const [projects, setProjectsRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Undo/Redo履歴管理
  const historyRef = useRef([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoRef = useRef(false);
  const MAX_HISTORY = 50;

  // 履歴付きsetProjects
  const setProjects = useCallback((updater) => {
    setProjectsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      // Undo/Redo操作中は履歴に追加しない
      if (!isUndoRedoRef.current && JSON.stringify(prev) !== JSON.stringify(next)) {
        // 現在位置より後の履歴を削除（setHistoryIndexを使うため外で処理）
        setTimeout(() => {
          setHistoryIndex(idx => {
            historyRef.current = historyRef.current.slice(0, idx + 1);
            historyRef.current.push(JSON.parse(JSON.stringify(next)));
            if (historyRef.current.length > MAX_HISTORY) {
              historyRef.current.shift();
              return idx;
            } else {
              return idx + 1;
            }
          });
        }, 0);
      }
      return next;
    });
  }, []);

  // Undo
  const undo = useCallback(() => {
    setHistoryIndex(idx => {
      if (idx > 0) {
        isUndoRedoRef.current = true;
        const newIdx = idx - 1;
        setProjectsRaw(JSON.parse(JSON.stringify(historyRef.current[newIdx])));
        setTimeout(() => { isUndoRedoRef.current = false; }, 0);
        return newIdx;
      }
      return idx;
    });
  }, []);

  // Redo
  const redo = useCallback(() => {
    setHistoryIndex(idx => {
      if (idx < historyRef.current.length - 1) {
        isUndoRedoRef.current = true;
        const newIdx = idx + 1;
        setProjectsRaw(JSON.parse(JSON.stringify(historyRef.current[newIdx])));
        setTimeout(() => { isUndoRedoRef.current = false; }, 0);
        return newIdx;
      }
      return idx;
    });
  }, []);

  // Undo/Redo可能かどうか
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < historyRef.current.length - 1;
  const [view, setView] = useState("gantt");
  const [dayWidth, setDayWidth] = useState(DEFAULT_DW);
  const [filterA, setFilterA] = useState(null);
  const [filterS, setFilterS] = useState(null);
  const [showCap, setShowCap] = useState(true);
  const [capMode, setCapMode] = useState("week"); // "day" or "week" or "month" - zoomLevelに連動
  const [capOffset, setCapOffset] = useState(0); // 0=今日/今週/今月, 1=明日/来週/来月, -1=昨日/先週/先月
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
  const [dragTaskId, setDragTaskId] = useState(null); // サイドバーでタスクをドラッグ中
  const [dragTaskFromProjId, setDragTaskFromProjId] = useState(null); // ドラッグ中のタスクの元プロジェクト
  const [ctxMenu, setCtxMenu] = useState(null); // {x, y, type: 'project'|'task', id, projectId?}
  const [delConfirm, setDelConfirm] = useState(null); // {type: 'project'|'task', id, projectId?, name}
  const [showAddMenu, setShowAddMenu] = useState(false); // 右上の追加ボタンのドロップダウン
  const [showTaskModal, setShowTaskModal] = useState(false); // 新規タスク作成モーダル
  const [taskModalProjectId, setTaskModalProjectId] = useState(null); // タスク作成先のプロジェクトID
  const [editingProjectId, setEditingProjectId] = useState(null); // プロジェクト名編集中のID
  const [showImportModal, setShowImportModal] = useState(false); // テキストインポートモーダル
  const [importText, setImportText] = useState(""); // インポートするテキスト
  const [importProjectName, setImportProjectName] = useState(""); // インポート先プロジェクト名
  const [depDrag, setDepDrag] = useState(null); // 依存関係ドラッグ {fromTaskId, fromProjectId, mouseX, mouseY}
  const [showExtDropdown, setShowExtDropdown] = useState(false); // 社外メンバードロップダウン表示
  const [showMemberModal, setShowMemberModal] = useState(false); // メンバー管理モーダル
  const [teamMembers, setTeamMembers] = useState(TEAM); // メンバーリスト（編集可能）
  const [editingMember, setEditingMember] = useState(null); // 編集中のメンバー
  const headerRef=useRef(null), sideRef=useRef(null), ganttRef=useRef(null), bodyRef=useRef(null), barRects=useRef({});
  const today = useMemo(()=>{const d=new Date();d.setHours(0,0,0,0);return d},[]);
  const DW = dayWidth;
  const zoomLevel = getZL(DW);

  // zoomLevelに連動してcapModeを変更
  useEffect(() => {
    setCapMode(zoomLevel);
    setCapOffset(0);
  }, [zoomLevel]);

  // 前回保存時の状態を追跡（削除検知用）
  const prevProjectIdsRef = useRef(new Set());
  const prevTaskIdsRef = useRef(new Set());
  const prevMemberIdsRef = useRef(new Set());
  const dbLoadedRef = useRef(false);

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

      // メンバーを読み込み
      const { data: membersData, error: mError } = await supabase
        .from('members')
        .select('*')
        .order('sort_order', { ascending: true });
      if (mError) throw mError;

      // メンバーデータがあればセット、なければデフォルトのTEAMを使用
      if (membersData && membersData.length > 0) {
        const mappedMembers = membersData.map(m => ({
          id: m.id,
          name: m.name,
          role: m.role || '',
          color: m.color || '#6366f1',
          hpw: m.hpw || 40,
          av: m.av || m.name.slice(0, 1),
          type: m.type || 'internal',
        }));
        setTeamMembers(mappedMembers);
        prevMemberIdsRef.current = new Set(mappedMembers.map(m => m.id));
      } else {
        // DBにメンバーがない場合はデフォルトTEAMを使用し、IDを記録
        prevMemberIdsRef.current = new Set(TEAM.map(m => m.id));
      }

      if (projectsData.length === 0 && tasksData.length === 0) {
        // DBが本当に空の場合のみデモデータ（初回セットアップ）
        console.log('DB is empty, initializing with demo data');
        const demoData = genProjects();
        setProjects(demoData);
        // デモデータのIDを記録
        prevProjectIdsRef.current = new Set(demoData.map(p => p.id));
        prevTaskIdsRef.current = new Set(demoData.flatMap(p => p.tasks.map(t => t.id)));
      } else {
        // DBからデータをマッピング
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
              dependencies: t.dependencies || [],
            }))
        }));
        setProjects(mapped);
        // 現在のIDを記録
        prevProjectIdsRef.current = new Set(mapped.map(p => p.id));
        prevTaskIdsRef.current = new Set(mapped.flatMap(p => p.tasks.map(t => t.id)));
      }
      dbLoadedRef.current = true;
    } catch (err) {
      console.error('Load error:', err);
      // エラー時は既存のローカルデータを維持（デモデータで上書きしない）
      // 初回ロードでエラーの場合のみデモデータを表示
      if (!dbLoadedRef.current && projects.length === 0) {
        console.log('Initial load failed, showing demo data (not saved)');
        setProjects(genProjects());
      }
    }
    setLoading(false);
  }, []);

  // 保存エラー状態
  const [saveError, setSaveError] = useState(null);

  // Upsert方式でデータを保存
  const saveToDB = useCallback(async () => {
    if (!dbLoadedRef.current) {
      console.log('Skip save: DB not loaded yet');
      return;
    }
    console.log('Saving to DB...', { projectCount: projects.length, taskCount: projects.reduce((a,p)=>a+p.tasks.length,0) });
    setSaving(true);
    setSaveError(null);
    try {
      // 現在のIDセットを取得
      const currentProjectIds = new Set(projects.map(p => p.id));
      const currentTaskIds = new Set(projects.flatMap(p => p.tasks.map(t => t.id)));

      // 削除されたプロジェクトを検出
      const deletedProjectIds = [...prevProjectIdsRef.current].filter(id => !currentProjectIds.has(id));
      // 削除されたタスクを検出
      const deletedTaskIds = [...prevTaskIdsRef.current].filter(id => !currentTaskIds.has(id));

      // 削除されたタスクをDBから削除
      if (deletedTaskIds.length > 0) {
        console.log('Deleting tasks:', deletedTaskIds);
        const { error } = await supabase.from('tasks').delete().in('id', deletedTaskIds);
        if (error) console.error('Task delete error:', error);
      }

      // 削除されたプロジェクトをDBから削除
      if (deletedProjectIds.length > 0) {
        console.log('Deleting projects:', deletedProjectIds);
        const { error } = await supabase.from('projects').delete().in('id', deletedProjectIds);
        if (error) console.error('Project delete error:', error);
      }

      // プロジェクトをupsert
      const projectsToUpsert = projects.map((p, i) => ({
        id: p.id,
        name: p.name,
        client: p.client || '',
        status: p.status || 'planning',
        collapsed: p.collapsed || false,
        sort_order: i,
      }));
      if (projectsToUpsert.length > 0) {
        console.log('Upserting projects:', projectsToUpsert.length);
        const { error: pError } = await supabase
          .from('projects')
          .upsert(projectsToUpsert, { onConflict: 'id' });
        if (pError) {
          console.error('Project upsert error:', pError);
          throw pError;
        }
      }

      // タスクをupsert（dependenciesはDBカラム追加後に有効化）
      const tasksToUpsert = projects.flatMap(p =>
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
          dependencies: t.dependencies || [],
        }))
      );
      if (tasksToUpsert.length > 0) {
        console.log('Upserting tasks:', tasksToUpsert.length);
        const { error: tError } = await supabase
          .from('tasks')
          .upsert(tasksToUpsert, { onConflict: 'id' });
        if (tError) {
          console.error('Task upsert error:', tError);
          throw tError;
        }
      }

      // メンバーを保存
      const currentMemberIds = new Set(teamMembers.map(m => m.id));
      const deletedMemberIds = [...prevMemberIdsRef.current].filter(id => !currentMemberIds.has(id));

      // 削除されたメンバーをDBから削除
      if (deletedMemberIds.length > 0) {
        console.log('Deleting members:', deletedMemberIds);
        const { error } = await supabase.from('members').delete().in('id', deletedMemberIds);
        if (error) console.error('Member delete error:', error);
      }

      // メンバーをupsert
      const membersToUpsert = teamMembers.map((m, i) => ({
        id: m.id,
        name: m.name,
        role: m.role || '',
        color: m.color || '#6366f1',
        hpw: m.hpw || 40,
        av: m.av || m.name.slice(0, 1),
        type: m.type || 'internal',
        sort_order: i,
      }));
      if (membersToUpsert.length > 0) {
        console.log('Upserting members:', membersToUpsert.length);
        const { error: mError } = await supabase
          .from('members')
          .upsert(membersToUpsert, { onConflict: 'id' });
        if (mError) {
          console.error('Member upsert error:', mError);
          throw mError;
        }
      }

      // 保存成功したら現在のIDを記録
      prevProjectIdsRef.current = currentProjectIds;
      prevTaskIdsRef.current = currentTaskIds;
      prevMemberIdsRef.current = currentMemberIds;
      console.log('Save completed successfully');

    } catch (err) {
      console.error('Save error:', err);
      setSaveError(err.message || 'Save failed');
      // 保存エラー時はローカルデータは維持（ユーザーの作業を失わない）
    }
    setSaving(false);
  }, [projects, teamMembers]);

  // Load on mount
  useEffect(() => {
    loadFromDB();
  }, []);

  // Auto-save with debounce
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (loading || !dbLoadedRef.current) return; // DBロード完了前は保存しない

    const timer = setTimeout(() => {
      saveToDB();
    }, 1500);

    return () => clearTimeout(timer);
  }, [projects, teamMembers, saveToDB]);

  const openTask = useMemo(()=>{if(!openTid)return null;for(const p of projects)for(const t of p.tasks)if(t.id===openTid)return{task:t,project:p.name,projectTasks:p.tasks};return null},[openTid,projects]);

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

  // Move task(s) to another project - 複数タスク対応
  const moveTaskToProject = useCallback((taskIds, toProjectId) => {
    const idsToMove = Array.isArray(taskIds) ? taskIds : [taskIds];
    setProjects(ps => {
      // 移動対象のタスクを収集
      const tasksToMove = [];
      ps.forEach(p => {
        p.tasks.forEach(t => {
          if (idsToMove.includes(t.id) && p.id !== toProjectId) {
            tasksToMove.push({ ...t, projectId: toProjectId, dependencies: [] });
          }
        });
      });
      if (tasksToMove.length === 0) return ps;

      return ps.map(p => {
        // 移動元から削除
        const filtered = p.tasks.filter(t => !idsToMove.includes(t.id) || p.id === toProjectId);
        // 移動先に追加
        if (p.id === toProjectId) {
          return { ...p, tasks: [...filtered, ...tasksToMove] };
        }
        return { ...p, tasks: filtered };
      });
    });
  }, []);

  // Delete project
  const deleteProject = useCallback((pid) => {
    const proj = projects.find(p => p.id === pid);
    setDelConfirm({ type: 'project', id: pid, name: proj?.name || '案件' });
    setCtxMenu(null);
  }, [projects]);

  // Delete task(s) - 複数選択対応
  const deleteTask = useCallback((taskId, projectId) => {
    // 複数選択されている場合は全て削除対象にする
    if (selIds.size > 1 && selIds.has(taskId)) {
      // 選択中のタスク情報を収集
      const taskInfos = [];
      projects.forEach(p => {
        p.tasks.forEach(t => {
          if (selIds.has(t.id)) {
            taskInfos.push({ id: t.id, projectId: p.id, name: t.name });
          }
        });
      });
      setDelConfirm({ type: 'tasks', taskIds: Array.from(selIds), taskInfos, count: selIds.size });
    } else {
      const proj = projects.find(p => p.id === projectId);
      const task = proj?.tasks.find(t => t.id === taskId);
      setDelConfirm({ type: 'task', id: taskId, projectId, name: task?.name || 'タスク' });
    }
    setCtxMenu(null);
  }, [projects, selIds]);

  // Delete selected tasks (Deleteキー用)
  const deleteSelectedTasks = useCallback(() => {
    if (selIds.size === 0) return;
    const taskInfos = [];
    projects.forEach(p => {
      p.tasks.forEach(t => {
        if (selIds.has(t.id)) {
          taskInfos.push({ id: t.id, projectId: p.id, name: t.name });
        }
      });
    });
    if (taskInfos.length === 1) {
      setDelConfirm({ type: 'task', id: taskInfos[0].id, projectId: taskInfos[0].projectId, name: taskInfos[0].name || 'タスク' });
    } else if (taskInfos.length > 1) {
      setDelConfirm({ type: 'tasks', taskIds: taskInfos.map(t => t.id), taskInfos, count: taskInfos.length });
    }
  }, [projects, selIds]);

  // Execute delete confirmation
  const confirmDelete = useCallback(() => {
    if (!delConfirm) return;
    if (delConfirm.type === 'project') {
      setProjects(ps => ps.filter(p => p.id !== delConfirm.id));
    } else if (delConfirm.type === 'tasks') {
      // 複数タスク削除
      const idsToDelete = new Set(delConfirm.taskIds);
      setProjects(ps => ps.map(p => ({
        ...p,
        tasks: p.tasks.filter(t => !idsToDelete.has(t.id))
      })));
      setSelIds(new Set()); // 選択解除
    } else {
      setProjects(ps => ps.map(p =>
        p.id === delConfirm.projectId ? { ...p, tasks: p.tasks.filter(t => t.id !== delConfirm.id) } : p
      ));
    }
    setDelConfirm(null);
  }, [delConfirm]);

  // Duplicate task(s) - 複数選択対応
  const duplicateTask = useCallback((taskId, projectId, targetIds = null) => {
    // targetIdsが渡された場合は複数複製
    const idsTodup = targetIds || [taskId];

    setProjects(ps => {
      // 各プロジェクトごとに処理
      return ps.map(p => {
        const tasksInProj = p.tasks.filter(t => idsTodup.includes(t.id));
        if (tasksInProj.length === 0) return p;

        const newTasks = [...p.tasks];
        // 各タスクを複製（逆順で挿入して順序を保持）
        tasksInProj.reverse().forEach(task => {
          const newTask = {
            ...task,
            id: "t" + Date.now() + Math.random().toString(36).substr(2, 5),
            name: task.name + " (コピー)",
            done: false,
            dependencies: [],
          };
          const idx = newTasks.findIndex(t => t.id === task.id);
          newTasks.splice(idx + 1, 0, newTask);
        });
        return { ...p, tasks: newTasks };
      });
    });
    setCtxMenu(null);
  }, []);

  // Duplicate project
  const duplicateProject = useCallback((projectId) => {
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;
    const newProjId = "p" + Date.now();
    const newProj = {
      ...proj,
      id: newProjId,
      name: proj.name + " (コピー)",
      tasks: proj.tasks.map(t => ({
        ...t,
        id: "t" + Date.now() + Math.random().toString(36).substr(2, 5),
        done: false,
        dependencies: [], // 依存関係はリセット
      })),
    };
    setProjects(ps => {
      const idx = ps.findIndex(p => p.id === projectId);
      const newPs = [...ps];
      newPs.splice(idx + 1, 0, newProj);
      return newPs;
    });
    setCtxMenu(null);
  }, [projects]);

  // Context menu handler
  const handleContextMenu = useCallback((e, type, id, projectId) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, type, id, projectId });
  }, []);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setCtxMenu(null);
    if (ctxMenu) window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [ctxMenu]);

  const dateRange = useMemo(()=>{let mn=new Date(today);mn.setDate(mn.getDate()-60);let mx=new Date(today);mx.setDate(mx.getDate()+120);projects.forEach(p=>p.tasks.forEach(t=>{if(new Date(t.start)<mn)mn=new Date(t.start);if(new Date(t.end)>mx)mx=new Date(t.end)}));mn.setDate(mn.getDate()-14);mx.setDate(mx.getDate()+14);const d=[],c=new Date(mn);while(c<=mx){d.push(new Date(c));c.setDate(c.getDate()+1)}return d},[projects,today]);
  const totalWidth = dateRange.length*DW;
  const getPos = useCallback(date=>{const dt=new Date(date);dt.setHours(0,0,0,0);return diffD(dateRange[0],dt)*DW},[dateRange,DW]);
  const todayPos = useMemo(()=>getPos(today),[getPos,today]);

  const filtered = useMemo(()=>projects.map(p=>({...p,tasks:p.tasks.filter(t=>{if(!filterA)return true;if(filterA==="unassigned")return !t.assignee;return t.assignee===filterA})})).filter(p=>{if(filterS&&p.status!==filterS)return false;if(filterA&&p.tasks.length===0)return false;return true}),[projects,filterA,filterS]);
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
    if(view==="timeline"){const rows=[];teamMembers.forEach(m=>{const mt=[];filtered.forEach(p=>p.tasks.forEach(t=>{if(t.assignee===m.id)mt.push({...t,projName:p.name})}));if(mt.length>0){mt.sort(sortByStart);rows.push({type:"member",member:m,count:mt.length});mt.forEach(t=>rows.push({type:"task",task:t,project:{name:t.projName}}))}});return rows}
    const r=[];filtered.forEach(p=>{r.push({type:"project",project:p});if(!p.collapsed)[...p.tasks].sort(sortByStart).forEach(t=>r.push({type:"task",task:t,project:p}))});return r;
  },[filtered,view,teamMembers]);

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
    // 作成後すぐに名前を編集できるようにする
    setTimeout(()=>setEditingProjectId(newId),50);
  },[today]);

  // テキストからインポート
  const importFromText = useCallback(() => {
    if (!importText.trim() || !importProjectName.trim()) return;
    const lines = importText.trim().split('\n');
    const tasks = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();
      if (!line) { i++; continue; }
      // 日付行をパース
      const dateMatch = line.match(/^(\d{4}\/\d{2}\/\d{2})(?:\s*-\s*(\d{4}\/\d{2}\/\d{2}))?$/);
      if (dateMatch) {
        const startDate = new Date(dateMatch[1].replace(/\//g, '-'));
        const endDate = dateMatch[2] ? new Date(dateMatch[2].replace(/\//g, '-')) : startDate;
        i++;
        if (i < lines.length) {
          let taskName = lines[i].trim();
          const isClient = taskName.startsWith('(') && taskName.endsWith(')');
          const isMilestone = taskName.includes('〆');
          if (isClient) taskName = taskName.slice(1, -1); // ()を除去
          taskName = taskName.replace(/^〆/, '').trim(); // 〆を除去
          tasks.push({ name: taskName, start: startDate, end: endDate, isMilestone, isClient });
        }
      }
      i++;
    }
    if (tasks.length === 0) return;
    const newId = Date.now();
    const newProj = {
      id: newId,
      name: importProjectName,
      client: "",
      status: "active",
      collapsed: false,
      tasks: tasks.map((t, idx) => ({
        id: newId + "-" + idx,
        projectId: newId,
        name: t.name,
        phase: "design",
        assignee: t.isClient ? "client" : null,
        start: t.start,
        end: t.end,
        done: false,
        taskStatus: "todo",
        desc: "",
        comments: [],
        estimatedHours: null,
        type: t.isMilestone ? "milestone" : undefined,
        dependencies: [],
      })),
    };
    setProjects(ps => [newProj, ...ps]);
    setShowImportModal(false);
    setImportText("");
    setImportProjectName("");
  }, [importText, importProjectName]);

  // Drag
  const startDrag = useCallback((e,task,type)=>{if(e.button!==0)return;e.stopPropagation();e.preventDefault();let active=new Set(selIds);if(!active.has(task.id)){active=new Set([task.id]);setSelIds(active)}const od={};projects.forEach(p=>p.tasks.forEach(t=>{if(active.has(t.id))od[t.id]={start:new Date(t.start),end:new Date(t.end),projectId:t.projectId}}));setDrag({task,type:type||"move",startX:e.clientX,startY:e.clientY,active,od});setDragShift(0)},[selIds,projects]);
  useEffect(()=>{if(!drag)return;
    // 依存関係で連動するタスクを取得
    const getDependentTasks = (taskIds, allTasks) => {
      const result = new Set(taskIds);
      let changed = true;
      while(changed) {
        changed = false;
        allTasks.forEach(t => {
          if(!result.has(t.id) && t.dependencies?.some(d => result.has(d))) {
            result.add(t.id);
            changed = true;
          }
        });
      }
      return result;
    };
    const allTasks = [];
    projects.forEach(p => p.tasks.forEach(t => allTasks.push(t)));
    const depTasks = drag.type==="move" ? getDependentTasks(Array.from(drag.active), allTasks) : new Set();
    let lastY=drag.startY;
    const onM=e=>{lastY=e.clientY;const ds=Math.round((e.clientX-drag.startX)/DW);setDragShift(ds);if(ds!==0)setDragPos({x:e.clientX+16,y:e.clientY-28});else setDragPos(null);setProjects(p=>p.map(pr=>({...pr,tasks:pr.tasks.map(t=>{const o=drag.od[t.id];if(o){if(drag.type==="move")return{...t,start:addDays(o.start,ds),end:addDays(o.end,ds)};if(drag.type==="resize-right"&&t.id===drag.task.id){const ne=addDays(o.end,ds);return ne>=t.start?{...t,end:ne}:t}if(drag.type==="resize-left"&&t.id===drag.task.id){const ns=addDays(o.start,ds);return ns<=t.end?{...t,start:ns}:t}}else if(drag.type==="move"&&depTasks.has(t.id)&&ds>0){return{...t,start:addDays(t.start,ds),end:addDays(t.end,ds)}}return t})})))};
    const onU=e=>{
      // Y軸方向の移動で別のプロジェクトに移動（複数タスク対応）
      if(drag.type==="move"&&drag.active.size>=1&&ganttRef.current&&bodyRef.current){
        const ganttRect=ganttRef.current.getBoundingClientRect();
        const headerHeight=zoomLevel==="day"?60:72;
        const relY=lastY-ganttRect.top+ganttRef.current.scrollTop-headerHeight;
        let curY=0;let targetProjId=null;
        for(const row of rowList){
          const h=row.type==="project"||row.type==="member"?44:36;
          if(relY>=curY&&relY<curY+h){
            if(row.type==="project")targetProjId=row.project.id;
            else if(row.type==="task")targetProjId=row.project?.id;
            break;
          }
          curY+=h;
        }
        const taskIds=Array.from(drag.active);
        // 移動元とは別のプロジェクトに移動する場合
        const hasMovement=taskIds.some(tid=>drag.od[tid]?.projectId&&drag.od[tid].projectId!==targetProjId);
        if(targetProjId&&hasMovement){
          moveTaskToProject(taskIds,targetProjId);
        }
      }
      setDrag(null);setDragShift(0);setDragPos(null);
    };
    window.addEventListener("mousemove",onM);window.addEventListener("mouseup",onU);return()=>{window.removeEventListener("mousemove",onM);window.removeEventListener("mouseup",onU)}},[drag,DW,projects,rowList,moveTaskToProject]);

  // Zoom - 非passiveリスナーでブラウザズームを無効化（Mac trackpad対応）
  const handleWheel = useCallback(e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();const g=ganttRef.current;if(!g)return;const rect=g.getBoundingClientRect(),mx=e.clientX-rect.left,sl=g.scrollLeft,md=(sl+mx)/DW;const f=e.deltaY<0?1.15:0.87;const nDW=clamp(DW*f,MIN_DW,MAX_DW);setDayWidth(nDW);requestAnimationFrame(()=>{if(ganttRef.current)ganttRef.current.scrollLeft=md*nDW-mx})},[DW]);
  useEffect(()=>{const g=ganttRef.current;if(!g)return;
    const hw=e=>{if(e.ctrlKey||e.metaKey)e.preventDefault()};
    const hg=e=>e.preventDefault(); // Safari gesture events
    g.addEventListener("wheel",hw,{passive:false});
    g.addEventListener("gesturestart",hg,{passive:false});
    g.addEventListener("gesturechange",hg,{passive:false});
    g.addEventListener("gestureend",hg,{passive:false});
    return()=>{g.removeEventListener("wheel",hw);g.removeEventListener("gesturestart",hg);g.removeEventListener("gesturechange",hg);g.removeEventListener("gestureend",hg)};
  },[]);
  // ドキュメントレベルでCtrl+ホイールをブロック（ガントエリア上のみ）
  useEffect(()=>{
    const hw=e=>{if((e.ctrlKey||e.metaKey)&&ganttRef.current?.contains(e.target))e.preventDefault()};
    const hg=e=>{if(ganttRef.current?.contains(e.target))e.preventDefault()};
    document.addEventListener("wheel",hw,{passive:false});
    document.addEventListener("gesturestart",hg,{passive:false});
    document.addEventListener("gesturechange",hg,{passive:false});
    return()=>{document.removeEventListener("wheel",hw);document.removeEventListener("gesturestart",hg);document.removeEventListener("gesturechange",hg)};
  },[]);

  // Marquee
  const handleMStart = useCallback(e=>{if(e.target.closest("[data-bar]"))return;if(e.button!==0)return;const cont=bodyRef.current;if(!cont)return;const gantt=ganttRef.current;if(!gantt)return;const rect=cont.getBoundingClientRect();const scrollX=gantt.scrollLeft,scrollY=gantt.scrollTop;setMarquee({sx:e.clientX-rect.left,sy:e.clientY-rect.top,cx:e.clientX-rect.left,cy:e.clientY-rect.top,scrollX,scrollY});setMActive(true);if(!(e.shiftKey||e.metaKey||e.ctrlKey))setSelIds(new Set())},[]);

  // Double-click to create new task
  const handleBodyDblClick = useCallback(e=>{
    if(e.target.closest("[data-bar]"))return;
    if(view==="timeline")return; // timeline view not supported yet
    const cont=bodyRef.current;if(!cont)return;
    const gantt=ganttRef.current;if(!gantt)return;
    // bodyRefの位置を基準に座標を計算
    const bodyRect=cont.getBoundingClientRect();
    const x=e.clientX-bodyRect.left;
    const y=e.clientY-bodyRect.top+gantt.scrollTop;
    // Find which project row was clicked
    let rowY=0,targetProj=null,clickedRow=null;
    for(const row of rowList){
      const h=row.type==="project"||row.type==="member"?44:36;
      if(y>=rowY&&y<rowY+h){
        clickedRow=row;
        if(row.type==="project")targetProj=row.project;
        else if(row.type==="task")targetProj=row.project;
        break;
      }
      rowY+=h;
      // プロジェクト行を通過するたびに記録（折りたたまれている場合のフォールバック用）
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

  // ドラッグで新規タスク作成
  const createTaskFromDrag = useCallback((mx1,my1,mx2,my2,scrollX,scrollY)=>{
    if(view==="timeline")return;
    // bodyRect.leftは既に水平スクロールを反映しているのでscrollXは不要
    // 垂直方向はscrollYを追加（handleBodyDblClickと同じ）
    const x1=mx1,x2=mx2,y=my1+scrollY;
    // プロジェクト行を特定
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
    // 日付範囲を計算
    const startIdx=Math.floor(x1/DW),endIdx=Math.floor(x2/DW);
    const startDate=dateRange[startIdx],endDate=dateRange[endIdx];
    if(!startDate||!endDate)return;
    // 新規タスク作成
    const newId=targetProj.id+"-"+Date.now();
    const newTask={id:newId,projectId:targetProj.id,name:"",phase:"wire",assignee:null,start:new Date(startDate),end:new Date(endDate),done:false,taskStatus:"inbox",desc:"",comments:[],estimatedHours:null};
    setProjects(ps=>ps.map(p=>p.id===targetProj.id?{...p,tasks:[...p.tasks,newTask],collapsed:false}:p));
    setOpenTid(newId);
  },[view,rowList,DW,dateRange]);

  useEffect(()=>{if(!mActive||!marquee)return;let lastCx=marquee.cx,lastCy=marquee.cy;const onM=e=>{const cont=bodyRef.current;if(!cont)return;const rect=cont.getBoundingClientRect();const x=e.clientX-rect.left,y=e.clientY-rect.top;lastCx=x;lastCy=y;setMarquee(prev=>prev?{...prev,cx:x,cy:y}:null);const rects=barRects.current;const mx1=Math.min(marquee.sx,x),my1=Math.min(marquee.sy,y),mx2=Math.max(marquee.sx,x),my2=Math.max(marquee.sy,y);const hit=new Set();for(const tid of Object.keys(rects)){const br=rects[tid];if(br.left<mx2&&br.right>mx1&&br.top<my2&&br.bottom>my1)hit.add(tid)}setSelIds(hit)};const onU=()=>{
    // ドラッグ終了時：選択タスクがなく、一定の幅があれば新規タスク作成
    const mx1=Math.min(marquee.sx,lastCx),my1=Math.min(marquee.sy,lastCy),mx2=Math.max(marquee.sx,lastCx),my2=Math.max(marquee.sy,lastCy);
    const dragW=mx2-mx1;
    // selIdsの現在値を直接チェック（クロージャー問題を回避）
    setSelIds(currentSel=>{
      if(currentSel.size===0&&dragW>10){
        createTaskFromDrag(mx1,my1,mx2,my2,marquee.scrollX||0,marquee.scrollY||0);
      }
      return currentSel;
    });
    setMActive(false);setMarquee(null);
  };window.addEventListener("mousemove",onM);window.addEventListener("mouseup",onU);return()=>{window.removeEventListener("mousemove",onM);window.removeEventListener("mouseup",onU)}},[mActive,marquee,createTaskFromDrag]);

  // 依存関係ドラッグ
  useEffect(()=>{if(!depDrag)return;
    const onM=e=>setDepDrag(prev=>prev?{...prev,mouseX:e.clientX,mouseY:e.clientY}:null);
    const onU=e=>{
      // barRectsを使ってドロップ先のタスクを探す
      const body=bodyRef.current;const gantt=ganttRef.current;
      if(body&&gantt){
        const bodyRect=body.getBoundingClientRect();
        const mx=e.clientX-bodyRect.left;
        const my=e.clientY-bodyRect.top+gantt.scrollTop;
        const rects=barRects.current;
        for(const tid of Object.keys(rects)){
          const br=rects[tid];
          if(mx>=br.left&&mx<=br.right&&my>=br.top&&my<=br.bottom){
            // このタスクにドロップ
            if(tid!==depDrag.fromTaskId){
              // 同じプロジェクト内か確認
              let sameProject=false;
              projects.forEach(p=>{
                const hasFrom=p.tasks.some(t=>t.id===depDrag.fromTaskId);
                const hasTo=p.tasks.some(t=>t.id===tid);
                if(hasFrom&&hasTo)sameProject=true;
              });
              if(sameProject){
                setProjects(ps=>ps.map(p=>({...p,tasks:p.tasks.map(t=>{
                  if(t.id===tid){
                    const deps=t.dependencies||[];
                    if(!deps.includes(depDrag.fromTaskId))return{...t,dependencies:[...deps,depDrag.fromTaskId]};
                  }
                  return t;
                })})));
              }
            }
            break;
          }
        }
      }
      setDepDrag(null);
    };
    window.addEventListener("mousemove",onM);window.addEventListener("mouseup",onU);
    return()=>{window.removeEventListener("mousemove",onM);window.removeEventListener("mouseup",onU)};
  },[depDrag,projects]);

  const initialScrollRef=useRef(false);
  useEffect(()=>{if(!initialScrollRef.current&&ganttRef.current&&todayPos>0){initialScrollRef.current=true;setTimeout(()=>{if(ganttRef.current)ganttRef.current.scrollLeft=Math.max(0,todayPos-300)},100)}},[todayPos]);
  useEffect(()=>{const h=e=>{
    if(e.key==="Escape"){if(openTid)setOpenTid(null);else clearSel()}
    if((e.key==="Delete"||e.key==="Backspace")&&selIds.size>0&&!openTid&&document.activeElement.tagName!=="INPUT"&&document.activeElement.tagName!=="TEXTAREA"){e.preventDefault();deleteSelectedTasks()}
    // Undo/Redo (Cmd+Z / Cmd+Shift+Z on Mac, Ctrl+Z / Ctrl+Shift+Z on Windows)
    if((e.metaKey||e.ctrlKey)&&e.key==="z"&&document.activeElement.tagName!=="INPUT"&&document.activeElement.tagName!=="TEXTAREA"){e.preventDefault();if(e.shiftKey){redo()}else{undo()}}
  };window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h)},[clearSel,openTid,selIds,deleteSelectedTasks,undo,redo]);
  // グローバルクリックでドロップダウンを閉じる
  useEffect(()=>{if(!showAddMenu)return;const h=()=>setShowAddMenu(false);setTimeout(()=>window.addEventListener("click",h),0);return()=>window.removeEventListener("click",h)},[showAddMenu]);
  useEffect(()=>{if(!showExtDropdown)return;const h=()=>setShowExtDropdown(false);setTimeout(()=>window.addEventListener("click",h),0);return()=>window.removeEventListener("click",h)},[showExtDropdown]);

  const capPeriod = useMemo(()=>{
    if(capMode==="day"){
      const ws=addDays(today,capOffset);
      const we=ws;
      const label=capOffset===0?"今日":capOffset>0?(capOffset===1?"明日":capOffset+"日後"):(capOffset===-1?"昨日":Math.abs(capOffset)+"日前");
      const dn=["日","月","火","水","木","金","土"][ws.getDay()];
      return{start:ws,end:we,label,dateLabel:(ws.getMonth()+1)+"/"+ws.getDate()+"("+dn+")"};
    }else if(capMode==="week"){
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
    const workDaysInPeriod=capMode==="day"?1:(capMode==="week"?5:Math.round((we-ws)/(864e5*7)*5));
    return teamMembers.map(m=>{
      const mt=[];
      const hpPeriod=capMode==="day"?Math.round(m.hpw/5):(capMode==="week"?m.hpw:Math.round(m.hpw*workDaysInPeriod/5));
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
  },[projects,capPeriod,capMode,teamMembers]);

  // ヘッダー表示用：各期間（週/月）のキャパシティ計算
  const headerCapacities = useMemo(()=>{
    if(zoomLevel==="day")return{}; // 日表示では使わない
    const caps={};
    // 社内メンバーのみのキャパシティを計算
    const internalTeam=teamMembers.filter(m=>m.type==="internal");
    const totalWeeklyHours=internalTeam.reduce((s,m)=>s+m.hpw,0);

    headerRows.bot.forEach(col=>{
      let weekStart,weekEnd;
      if(zoomLevel==="week"){
        weekStart=new Date(col.key);
        weekEnd=addDays(weekStart,4);
      }else{
        // 月表示
        const parts=col.key.split("-");
        weekStart=new Date(parseInt(parts[0]),parseInt(parts[1]),1);
        weekEnd=new Date(parseInt(parts[0]),parseInt(parts[1])+1,0);
      }

      const workDaysInPeriod=zoomLevel==="week"?5:Math.round((weekEnd-weekStart)/(864e5*7)*5);
      const periodCapacity=zoomLevel==="week"?totalWeeklyHours:Math.round(totalWeeklyHours*workDaysInPeriod/5);

      let totalWorkload=0;
      internalTeam.forEach(m=>{
        projects.forEach(p=>p.tasks.forEach(t=>{
          if(t.assignee===m.id&&t.type!=="milestone"){
            const s=new Date(t.start),e=new Date(t.end);
            if(s<=weekEnd&&e>=weekStart){
              const os=s>weekStart?s:weekStart,oe=e<weekEnd?e:weekEnd;
              let dInPeriod=0;
              const cur=new Date(os);
              while(cur<=oe){if(cur.getDay()!==0&&cur.getDay()!==6)dInPeriod++;cur.setDate(cur.getDate()+1)}
              const totalDays=diffD(t.start,t.end)+1;
              const hours=t.estimatedHours!=null?t.estimatedHours*(dInPeriod/(totalDays*5/7)):dInPeriod*8;
              totalWorkload+=hours;
            }
          }
        }));
      });

      const util=periodCapacity>0?Math.round(totalWorkload/periodCapacity*100):0;
      caps[col.key]={workload:Math.round(totalWorkload),capacity:periodCapacity,util};
    });
    return caps;
  },[headerRows.bot,projects,zoomLevel,teamMembers]);

  // メンバーごとの週別ワークロード計算（メンバービュー用）
  const memberWorkloads = useMemo(()=>{
    if(view!=="timeline")return{};
    const result={};

    // 日表示の場合は週単位でグループ化
    if(zoomLevel==="day"){
      // 週ごとにまとめる
      const weekGroups={};
      let left=0;
      headerRows.bot.forEach(col=>{
        const d=dateRange[headerRows.bot.indexOf(col)];
        if(!d)return;
        const mon=getMon(d);
        const wk=mon.toDateString();
        if(!weekGroups[wk]){
          weekGroups[wk]={start:mon,end:addDays(mon,4),left,width:0,days:[]};
        }
        weekGroups[wk].width+=DW;
        weekGroups[wk].days.push(d);
        left+=DW;
      });

      teamMembers.forEach(m=>{
        result[m.id]={};
        const weeklyCapacity=m.hpw;
        Object.entries(weekGroups).forEach(([wk,g])=>{
          let workload=0;
          projects.forEach(p=>p.tasks.forEach(t=>{
            if(t.assignee===m.id&&t.type!=="milestone"){
              const s=new Date(t.start),e=new Date(t.end);
              if(s<=g.end&&e>=g.start){
                const os=s>g.start?s:g.start,oe=e<g.end?e:g.end;
                let dInPeriod=0;
                const cur=new Date(os);
                while(cur<=oe){if(cur.getDay()!==0&&cur.getDay()!==6)dInPeriod++;cur.setDate(cur.getDate()+1)}
                const totalDays=diffD(t.start,t.end)+1;
                const hours=t.estimatedHours!=null?t.estimatedHours*(dInPeriod/(totalDays*5/7)):dInPeriod*8;
                workload+=hours;
              }
            }
          }));
          const util=weeklyCapacity>0?Math.round(workload/weeklyCapacity*100):0;
          result[m.id][wk]={workload:Math.round(workload*10)/10,capacity:weeklyCapacity,util,left:g.left,width:g.width};
        });
      });
    }else{
      // 週/月表示
      teamMembers.forEach(m=>{
        result[m.id]={};
        const weeklyCapacity=m.hpw;
        headerRows.bot.forEach(col=>{
          let periodStart,periodEnd;
          if(zoomLevel==="week"){
            periodStart=new Date(col.key);
            periodEnd=addDays(periodStart,4);
          }else{
            const parts=col.key.split("-");
            periodStart=new Date(parseInt(parts[0]),parseInt(parts[1]),1);
            periodEnd=new Date(parseInt(parts[0]),parseInt(parts[1])+1,0);
          }

          const workDaysInPeriod=zoomLevel==="week"?5:Math.round((periodEnd-periodStart)/(864e5*7)*5);
          const periodCapacity=zoomLevel==="week"?weeklyCapacity:Math.round(weeklyCapacity*workDaysInPeriod/5);

          let workload=0;
          projects.forEach(p=>p.tasks.forEach(t=>{
            if(t.assignee===m.id&&t.type!=="milestone"){
              const s=new Date(t.start),e=new Date(t.end);
              if(s<=periodEnd&&e>=periodStart){
                const os=s>periodStart?s:periodStart,oe=e<periodEnd?e:periodEnd;
                let dInPeriod=0;
                const cur=new Date(os);
                while(cur<=oe){if(cur.getDay()!==0&&cur.getDay()!==6)dInPeriod++;cur.setDate(cur.getDate()+1)}
                const totalDays=diffD(t.start,t.end)+1;
                const hours=t.estimatedHours!=null?t.estimatedHours*(dInPeriod/(totalDays*5/7)):dInPeriod*8;
                workload+=hours;
              }
            }
          }));

          const util=periodCapacity>0?Math.round(workload/periodCapacity*100):0;
          result[m.id][col.key]={workload:Math.round(workload*10)/10,capacity:periodCapacity,util,left:0,width:col.width};
        });

        // 列の位置を計算
        let left=0;
        headerRows.bot.forEach(col=>{
          if(result[m.id][col.key]){
            result[m.id][col.key].left=left;
          }
          left+=col.width;
        });
      });
    }
    return result;
  },[view,zoomLevel,headerRows.bot,projects,dateRange,DW,teamMembers]);

  useEffect(()=>{const pos={};let rowY=0;rowList.forEach(row=>{if(row.type==="project"||row.type==="member"){rowY+=44;return}const t=row.task;const left=getPos(t.start),right=getPos(t.end)+DW;if(t.type==="milestone")pos[t.id]={left,right:left+24,top:rowY+6,bottom:rowY+30};else pos[t.id]={left,right,top:rowY+7,bottom:rowY+29};rowY+=36});barRects.current=pos},[rowList,getPos,DW]);

  const mRect=marquee?{left:Math.min(marquee.sx,marquee.cx),top:Math.min(marquee.sy,marquee.cy),width:Math.abs(marquee.cx-marquee.sx),height:Math.abs(marquee.cy-marquee.sy)}:null;

  // 依存関係の線を計算
  const depLines = useMemo(()=>{
    const lines=[];
    const taskPos={}; // タスクIDごとの位置
    let rowY=0;
    rowList.forEach(row=>{
      if(row.type==="project"||row.type==="member"){rowY+=44;return}
      const t=row.task;
      const left=getPos(t.start),right=getPos(t.end)+DW;
      const centerY=rowY+(t.type==="milestone"?18:18);
      taskPos[t.id]={left,right:t.type==="milestone"?left+14:right,centerY};
      rowY+=36;
    });
    // 依存関係の線を生成
    rowList.forEach(row=>{
      if(row.type!=="task")return;
      const t=row.task;
      const deps=t.dependencies||[];
      deps.forEach(depId=>{
        const from=taskPos[depId];
        const to=taskPos[t.id];
        if(from&&to){
          lines.push({fromX:from.right,fromY:from.centerY,toX:to.left,toY:to.centerY,id:depId+"-"+t.id});
        }
      });
    });
    return lines;
  },[rowList,getPos,DW]);

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
            <button style={ST.tab(view==="kanban")} onClick={()=>setView("kanban")}>{"▣ カンバン"}</button>
            <button style={ST.tab(view==="list")} onClick={()=>setView("list")}>{"≡ リスト"}</button>
          </div>
          {isGL&&<React.Fragment>
            <button onClick={()=>{if(ganttRef.current)ganttRef.current.scrollLeft=Math.max(0,todayPos-ganttRef.current.clientWidth/2)}} style={{marginLeft:12,padding:"6px 14px",borderRadius:6,fontSize:12,fontWeight:600,cursor:"pointer",border:"1px solid #6366f1",background:"#6366f1",color:"#fff",boxShadow:"0 1px 3px rgba(99,102,241,.3)"}}>{"📍 今日"}</button>
            <div style={{display:"flex",gap:2,background:"#f3f4f6",borderRadius:8,padding:3,marginLeft:8}}>
              <button style={{...ST.tab(zoomLevel==="day"),fontSize:11}} onClick={()=>setDayWidth(40)}>日</button>
              <button style={{...ST.tab(zoomLevel==="week"),fontSize:11}} onClick={()=>setDayWidth(16)}>週</button>
              <button style={{...ST.tab(zoomLevel==="month"),fontSize:11}} onClick={()=>setDayWidth(5)}>月</button>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:4,marginLeft:8}}>
              <span style={{fontSize:13,color:"#6b7280",cursor:"pointer",padding:"2px 6px",borderRadius:4}} onClick={()=>setDayWidth(clamp(DW*0.7,MIN_DW,MAX_DW))} onMouseEnter={e=>e.currentTarget.style.background="#f3f4f6"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{"−"}</span>
              <input type="range" min={Math.log(MIN_DW)} max={Math.log(MAX_DW)} step={0.01} value={Math.log(DW)} onChange={e=>setDayWidth(Math.exp(parseFloat(e.target.value)))} style={{width:60,accentColor:"#6366f1",cursor:"pointer"}}/>
              <span style={{fontSize:13,color:"#6b7280",cursor:"pointer",padding:"2px 6px",borderRadius:4}} onClick={()=>setDayWidth(clamp(DW*1.4,MIN_DW,MAX_DW))} onMouseEnter={e=>e.currentTarget.style.background="#f3f4f6"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{"＋"}</span>
            </div>
          </React.Fragment>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <button style={{...ST.btnI,...(showCap?{background:"rgba(99,102,241,.08)",borderColor:"#6366f1",color:"#6366f1"}:{})}} onClick={()=>setShowCap(!showCap)}>{"👥"}</button>
          <div style={{position:"relative"}}>
            <button style={ST.btnP} onClick={()=>setShowAddMenu(!showAddMenu)}>{"＋ 新規作成"}<span style={{marginLeft:4,fontSize:8}}>{"▼"}</span></button>
            {showAddMenu&&<div style={{position:"absolute",top:"100%",right:0,marginTop:4,background:"#fff",border:"1px solid #e5e7eb",borderRadius:8,boxShadow:"0 4px 16px rgba(0,0,0,.15)",zIndex:1000,minWidth:160,padding:4}}>
              <button onClick={()=>{setShowNewModal(true);setShowAddMenu(false)}} style={{width:"100%",padding:"10px 12px",border:"none",background:"transparent",textAlign:"left",cursor:"pointer",fontSize:13,borderRadius:4,display:"flex",alignItems:"center",gap:10}} onMouseEnter={e=>e.currentTarget.style.background="#f3f4f6"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <span style={{fontSize:16}}>{"📁"}</span><span>新規プロジェクト</span>
              </button>
              <button onClick={()=>{setShowTaskModal(true);setShowAddMenu(false)}} style={{width:"100%",padding:"10px 12px",border:"none",background:"transparent",textAlign:"left",cursor:"pointer",fontSize:13,borderRadius:4,display:"flex",alignItems:"center",gap:10}} onMouseEnter={e=>e.currentTarget.style.background="#f3f4f6"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <span style={{fontSize:16}}>{"✏️"}</span><span>新規タスク</span>
              </button>
              <div style={{height:1,background:"#e5e7eb",margin:"4px 0"}}/>
              <button onClick={()=>{setShowImportModal(true);setShowAddMenu(false)}} style={{width:"100%",padding:"10px 12px",border:"none",background:"transparent",textAlign:"left",cursor:"pointer",fontSize:13,borderRadius:4,display:"flex",alignItems:"center",gap:10}} onMouseEnter={e=>e.currentTarget.style.background="#f3f4f6"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <span style={{fontSize:16}}>{"📋"}</span><span>テキストからインポート</span>
              </button>
            </div>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:2,marginRight:8}}>
            <button onClick={undo} disabled={!canUndo} title="元に戻す (Cmd+Z)" style={{...ST.btnI,padding:"4px 8px",opacity:canUndo?1:0.4,cursor:canUndo?"pointer":"not-allowed"}}>{"↩"}</button>
            <button onClick={redo} disabled={!canRedo} title="やり直す (Cmd+Shift+Z)" style={{...ST.btnI,padding:"4px 8px",opacity:canRedo?1:0.4,cursor:canRedo?"pointer":"not-allowed"}}>{"↪"}</button>
          </div>
          {saving&&<span style={{fontSize:11,color:"#6b7280",display:"flex",alignItems:"center",gap:4}}>保存中...</span>}
          {saveError&&<span style={{fontSize:11,color:"#ef4444",display:"flex",alignItems:"center",gap:4}} title={saveError}>⚠️ 保存エラー</span>}
          {!saving&&!saveError&&dbLoadedRef.current&&<span style={{fontSize:11,color:"#10b981",display:"flex",alignItems:"center",gap:4}}>✓ 保存済み</span>}
        </div>
      </div>

      <div style={ST.fbar}>
        <span style={{fontSize:11,color:"#6b7280",marginRight:4}}>担当:</span>
        <button style={ST.chip(!filterA)} onClick={()=>setFilterA(null)}>全員</button>
        {teamMembers.filter(m=>m.type==="internal").map(m=><button key={m.id} style={ST.chip(filterA===m.id,m.color)} onClick={()=>setFilterA(filterA===m.id?null:m.id)}>{m.name}</button>)}
        <div style={{width:1,height:20,background:"#e5e7eb",margin:"0 4px"}}/>
        <div style={{position:"relative"}}>
          <button
            style={{...ST.chip(teamMembers.some(m=>m.type==="external"&&filterA===m.id),"#0ea5e9"),borderStyle:"dashed",display:"flex",alignItems:"center",gap:4}}
            onClick={()=>setShowExtDropdown(!showExtDropdown)}
          >
            {teamMembers.find(m=>m.type==="external"&&filterA===m.id)?.name||"社外"}
            <span style={{fontSize:8,transform:showExtDropdown?"rotate(180deg)":"none",transition:"transform 0.2s"}}>▼</span>
          </button>
          {showExtDropdown&&<div style={{position:"absolute",top:"100%",left:0,marginTop:4,background:"#fff",borderRadius:8,boxShadow:"0 4px 16px rgba(0,0,0,.15)",border:"1px solid #e5e7eb",zIndex:100,minWidth:140,overflow:"hidden"}}>
            {teamMembers.filter(m=>m.type==="external").map(m=>
              <button key={m.id} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",width:"100%",border:"none",background:filterA===m.id?"rgba(14,165,233,.1)":"transparent",cursor:"pointer",fontSize:12,color:"#374151",textAlign:"left"}} onClick={()=>{setFilterA(filterA===m.id?null:m.id);setShowExtDropdown(false)}}>
                <div style={{width:20,height:20,borderRadius:"50%",background:m.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:600,color:"#fff"}}>{m.av}</div>
                <span style={{flex:1}}>{m.name}</span>
                {filterA===m.id&&<span style={{color:"#0ea5e9",fontSize:10}}>✓</span>}
              </button>
            )}
            {teamMembers.filter(m=>m.type==="external").length===0&&<div style={{padding:"10px 14px",fontSize:11,color:"#9ca3af"}}>社外メンバーなし</div>}
          </div>}
        </div>
        <div style={{width:1,height:20,background:"#e5e7eb",margin:"0 4px"}}/>
        <button style={{...ST.chip(filterA==="unassigned","#9ca3af"),borderStyle:"dotted"}} onClick={()=>setFilterA(filterA==="unassigned"?null:"unassigned")}>未確定</button>
        <div style={{width:1,height:20,background:"#e5e7eb"}}/>
        <span style={{fontSize:11,color:"#6b7280",marginRight:4}}>状態:</span>
        <button style={ST.chip(!filterS)} onClick={()=>setFilterS(null)}>すべて</button>
        <button style={ST.chip(filterS==="active")} onClick={()=>setFilterS(filterS==="active"?null:"active")}>進行中</button>
        <button style={ST.chip(filterS==="planning")} onClick={()=>setFilterS(filterS==="planning"?null:"planning")}>計画中</button>
        <div style={{marginLeft:"auto"}}/>
        <button style={{...ST.btnI,display:"flex",alignItems:"center",gap:4}} onClick={()=>setShowMemberModal(true)}>
          <span style={{fontSize:12}}>👥</span>
          <span>メンバー管理</span>
        </button>
      </div>

      {isGL&&<div style={ST.sbar(selCount>0)}>
        {selCount>0?<React.Fragment><span style={{fontWeight:700,fontSize:14}}>{selCount}</span><span>件選択中</span><button style={ST.sbtn} onClick={clearSel}>選択解除 (Esc)</button><button style={ST.sbtn} onClick={selectAll}>すべて選択</button><span style={{fontSize:11,color:"#6b7280",marginLeft:"auto"}}>ドラッグで一括移動 ・ 空白をドラッグで範囲選択</span></React.Fragment>
        :<React.Fragment><span style={{color:"#6b7280"}}>タスクを選択してください</span><span style={{fontSize:11,color:"#6b7280",marginLeft:"auto"}}>Ctrl+スクロールで拡大縮小 ・ ダブルクリックでタスク詳細</span></React.Fragment>}
      </div>}

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        {view==="calendar"?<CalView projects={projects} setProjects={setProjects} today={today} onOpen={t=>setOpenTid(t.id)} members={teamMembers} filterA={filterA} filterS={filterS}/>:view==="kanban"?<KanbanView projects={projects} setProjects={setProjects} onOpen={t=>setOpenTid(t.id)} members={teamMembers}/>:view==="list"?<ListView projects={projects} setProjects={setProjects} onOpen={t=>setOpenTid(t.id)} members={teamMembers}/>:(
          <React.Fragment>
            <div style={ST.side}>
              <div style={{padding:"16px",fontSize:11,fontWeight:600,color:"#6b7280",borderBottom:"1px solid #e5e7eb",height:60,boxSizing:"border-box",display:"flex",alignItems:"center"}}>{view==="timeline"?"メンバー別":"案件一覧"} ({filtered.length})</div>
              <div style={{flex:1,overflowY:"auto"}} ref={sideRef} onScroll={e=>{if(ganttRef.current)ganttRef.current.scrollTop=e.target.scrollTop}}>
                {rowList.map(row=>{
                  if(row.type==="project"){const p=row.project;const isDragOver=(dragOverProjId===p.id&&dragProjId!==p.id)||(dragTaskId&&dragOverProjId===p.id&&dragTaskFromProjId!==p.id);const isEditing=editingProjectId===p.id;return(<div key={"p-"+p.id} draggable={!isEditing} onDragStart={()=>setDragProjId(p.id)} onDragEnd={()=>{if(dragProjId&&dragOverProjId)moveProject(dragProjId,dragOverProjId);setDragProjId(null);setDragOverProjId(null);if(dragTaskId&&dragOverProjId&&dragTaskFromProjId!==dragOverProjId){moveTaskToProject([dragTaskId],dragOverProjId)}setDragTaskId(null);setDragTaskFromProjId(null)}} onDragOver={e=>{e.preventDefault();setDragOverProjId(p.id)}} onDragLeave={()=>setDragOverProjId(null)} onContextMenu={e=>handleContextMenu(e,'project',p.id)} onDoubleClick={()=>setEditingProjectId(p.id)} style={{...ST.prow(true),opacity:dragProjId===p.id?0.5:1,background:isDragOver?"rgba(99,102,241,.15)":"#f9fafb",borderTop:isDragOver?"2px solid #6366f1":"none"}}><div style={{width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",cursor:"grab",color:"#9ca3af",fontSize:10,flexShrink:0}}>{"⋮⋮"}</div><div style={ST.tog(!p.collapsed)} onClick={()=>togProj(p.id)}>{"▶"}</div><div style={{width:7,height:7,borderRadius:"50%",flexShrink:0,background:p.status==="active"?"#10b981":"#f59e0b"}}/>{isEditing?<input autoFocus value={p.name} onChange={e=>setProjects(ps=>ps.map(x=>x.id===p.id?{...x,name:e.target.value}:x))} onBlur={()=>setEditingProjectId(null)} onKeyDown={e=>{if(e.key==="Enter"||e.key==="Escape")setEditingProjectId(null)}} onClick={e=>e.stopPropagation()} style={{flex:1,padding:"2px 6px",fontSize:13,fontWeight:600,border:"1px solid #6366f1",borderRadius:4,outline:"none",background:"#fff"}}/>:<div style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",cursor:"pointer"}} onClick={()=>selProject(p.id)}>{p.name}</div>}<span style={{fontSize:10,color:"#6b7280"}}>{p.tasks.length}</span></div>)}
                  if(row.type==="member"){const m=row.member;return(<div key={"m-"+m.id} style={{...ST.prow(true),gap:8}}><div style={ST.tav(m.color)}>{m.av}</div><div style={{flex:1}}>{m.name}</div><span style={{fontSize:10,color:"#6b7280"}}>{row.count}</span></div>)}
                  const t=row.task;const m=teamMembers.find(x=>x.id===t.assignee);const isSel=selIds.has(t.id);const pName=row.project?.name||"";const isDraggingTask=dragTaskId===t.id;
                  return(<div key={"t-"+t.id} draggable onDragStart={e=>{e.stopPropagation();setDragTaskId(t.id);setDragTaskFromProjId(row.project?.id)}} onDragEnd={()=>{if(dragTaskId&&dragOverProjId&&dragTaskFromProjId!==dragOverProjId){moveTaskToProject([dragTaskId],dragOverProjId)}setDragTaskId(null);setDragTaskFromProjId(null);setDragOverProjId(null)}} style={{...ST.prow(false),paddingLeft:36,...(isSel?{background:"rgba(99,102,241,.08)"}:{}),opacity:isDraggingTask?0.5:1,cursor:"grab"}} onClick={e=>toggleSel(t.id,e)} onDoubleClick={()=>setOpenTid(t.id)} onContextMenu={e=>handleContextMenu(e,'task',t.id,row.project?.id)}>
                    {t.done&&<span style={{color:"#10b981",fontSize:10,flexShrink:0}}>{"✓"}</span>}
                    <div style={{width:6,height:6,borderRadius:2,flexShrink:0,background:PH[t.phase]?.c}}/>
                    <div style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textDecoration:t.done?"line-through":"none",opacity:t.done?0.5:1}}>{t.name||"新規タスク"}{view==="timeline"&&<span style={{color:"#9ca3af",marginLeft:6}}>{pName}</span>}</div>
                    {view!=="timeline"&&m&&<div style={ST.tav(m.color)}>{m.av}</div>}
                  </div>);
                })}
              </div>
            </div>

            <div style={{display:"flex",flexDirection:"column",flex:1,overflow:"hidden",background:"#f8f7f4"}}>
              <div ref={headerRef} style={{flexShrink:0,overflow:"hidden",height:zoomLevel==="day"?60:72}}>
                <div style={{display:"flex"}}>{headerRows.top.map((g,i)=><div key={i} style={{fontSize:11,fontWeight:600,color:"#6b7280",padding:"6px 0 2px 8px",borderBottom:"1px solid #e5e7eb",background:"#fff",width:g.width,minWidth:g.width,overflow:"hidden",whiteSpace:"nowrap"}}>{g.width>40?g.label:""}</div>)}</div>
                <div style={{display:"flex"}}>{headerRows.bot.map((col,i)=>{
                  const cap=zoomLevel!=="day"?headerCapacities[col.key]:null;
                  const capColor=cap?(cap.util>100?"#ef4444":cap.util>80?"#f59e0b":"#10b981"):"#10b981";
                  return(<div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",fontSize:zoomLevel==="day"?10:11,color:col.isToday?"#6366f1":"#6b7280",fontWeight:col.isToday?700:400,padding:zoomLevel==="day"?"2px 0 6px":"4px 2px 2px",borderRight:"1px solid #e5e7eb",flexShrink:0,width:col.width,minWidth:col.width,boxSizing:"border-box",background:col.isWE?"#f9fafb":"#fff",opacity:col.isWE&&!col.isToday?0.6:1,overflow:"hidden"}}>
                    {zoomLevel==="day"?<React.Fragment><span style={{fontSize:9,marginBottom:1}}>{col.sub}</span><span style={{fontSize:11,fontWeight:500}}>{col.label}</span></React.Fragment>
                    :<React.Fragment>
                      <span style={{fontSize:10,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:2}}>{col.width>20?col.label:""}</span>
                      {cap&&col.width>=40&&<div style={{width:"calc(100% - 8px)",height:10,background:"#e5e7eb",borderRadius:2,overflow:"hidden",position:"relative"}} title={`${cap.workload}h / ${cap.capacity}h (${cap.util}%)`}>
                        <div style={{position:"absolute",left:0,top:0,bottom:0,width:Math.min(100,cap.util)+"%",background:capColor,borderRadius:2,transition:"width 0.3s"}}/>
                        {col.width>=60&&<span style={{position:"absolute",left:"50%",top:0,transform:"translateX(-50%)",fontSize:8,fontWeight:600,color:cap.util>50?"#fff":"#6b7280",lineHeight:"10px"}}>{cap.util}%</span>}
                      </div>}
                      {cap&&col.width<40&&col.width>=20&&<div style={{width:6,height:6,borderRadius:"50%",background:capColor}} title={`${cap.util}%`}/>}
                    </React.Fragment>}
                  </div>);
                })}</div>
              </div>
              <div style={{flex:1,overflow:"auto",position:"relative"}} ref={ganttRef} onWheel={handleWheel} onScroll={e=>{if(headerRef.current)headerRef.current.scrollLeft=e.target.scrollLeft;if(sideRef.current)sideRef.current.scrollTop=e.target.scrollTop}}>
                <div ref={bodyRef} style={{width:totalWidth,position:"relative",cursor:mActive?"crosshair":"default"}} onMouseDown={handleMStart} onDoubleClick={handleBodyDblClick}>
                  <div style={{position:"absolute",top:0,bottom:0,width:2,background:"#6366f1",zIndex:4,opacity:0.8,pointerEvents:"none",left:todayPos+DW/2}}/>
                  {zoomLevel==="day"&&<div style={{position:"absolute",top:0,left:0,right:0,bottom:0,display:"flex",pointerEvents:"none"}}>{dateRange.map((d,i)=><div key={i} style={{width:DW,minWidth:DW,boxSizing:"border-box",borderRight:"1px solid #e5e7eb",background:isWE(d)?"#f9fafb":"transparent"}}/>)}</div>}
                  {mActive&&mRect&&mRect.width>3&&<div style={{position:"absolute",border:"1.5px dashed #6366f1",background:"rgba(99,102,241,.06)",zIndex:20,pointerEvents:"none",borderRadius:3,left:mRect.left,top:mRect.top,width:mRect.width,height:mRect.height}}/>}
                  {depLines.length>0&&<svg style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:2}}>
                    <defs><marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#9ca3af"/></marker></defs>
                    {depLines.map(l=>{
                      const midX=(l.fromX+l.toX)/2;
                      const path=l.fromX<l.toX-10
                        ?`M${l.fromX},${l.fromY} C${midX},${l.fromY} ${midX},${l.toY} ${l.toX},${l.toY}`
                        :`M${l.fromX},${l.fromY} L${l.fromX+15},${l.fromY} L${l.fromX+15},${l.toY>l.fromY?l.fromY+20:l.fromY-20} L${l.toX-15},${l.toY>l.fromY?l.fromY+20:l.fromY-20} L${l.toX-15},${l.toY} L${l.toX},${l.toY}`;
                      return<path key={l.id} d={path} fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="4,2" markerEnd="url(#arrowhead)"/>;
                    })}
                  </svg>}
                  {rowList.map(row=>{
                    if(row.type==="project")return<div key={"gr-"+row.project?.id} style={{display:"flex",position:"relative",height:44,borderBottom:"1px solid #e5e7eb",background:"#fafafa"}}/>;
                    if(row.type==="member"){
                      const m=row.member;
                      const mw=memberWorkloads[m.id]||{};
                      const maxUtil=Math.max(100,...Object.values(mw).map(w=>w.util||0));
                      return(<div key={"gr-"+m.id} style={{display:"flex",position:"relative",height:44,borderBottom:"1px solid #e5e7eb",background:"#fafafa",alignItems:"flex-end"}}>
                        {Object.entries(mw).map(([key,w])=>{
                          const barHeight=maxUtil>0?Math.max(2,(w.util/maxUtil)*32):0;
                          const capColor=w.util>100?"#ef4444":w.util>80?"#f59e0b":m.color||"#10b981";
                          return(<div key={key} style={{position:"absolute",left:w.left,width:w.width,bottom:4,display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                            <div style={{width:"calc(100% - 4px)",height:barHeight,background:capColor,opacity:0.6,borderRadius:"2px 2px 0 0"}} title={`${w.workload}h / ${w.capacity}h (${w.util}%)`}/>
                            {w.width>=50&&<span style={{fontSize:8,color:w.util>100?"#ef4444":w.util>80?"#f59e0b":"#6b7280",fontWeight:w.util>80?600:400}}>{w.workload}h</span>}
                          </div>);
                        })}
                      </div>);
                    }
                    const t=row.task,left=getPos(t.start),right=getPos(t.end)+DW,width=Math.max(4,right-left);
                    const ph=PH[t.phase]||{c:"#666"};const isMs=t.type==="milestone";const mem=teamMembers.find(x=>x.id===t.assignee);
                    const barColor=mem?.color||"#9ca3af"; // 担当者の色、未設定はグレー
                    const isSel=selIds.has(t.id);const isDrg=drag&&drag.active&&drag.active.has(t.id);
                    const ds=t.done?{opacity:0.4,filter:"grayscale(50%)"}:{};const pName=row.project?.name||"";
                    const barDays=diffD(t.start,t.end)+1;
                    const hasEst=t.estimatedHours!=null&&t.type!=="milestone";
                    const estRatio=hasEst?Math.min(1,(t.estimatedHours/8)/barDays):1;
                    const filledW=hasEst?Math.max(4,width*estRatio):width;
                    return(<div key={"gr-"+t.id} style={{display:"flex",position:"relative",height:36}}>
                      {isMs?(<div data-bar="1" style={{...ST.ms(left),...ds,top:10}} onMouseDown={e=>startDrag(e,t)} onClick={e=>{e.stopPropagation();toggleSel(t.id,e)}} onMouseEnter={e=>!drag&&setTip({x:e.clientX,y:e.clientY,task:t,project:pName})} onMouseLeave={()=>setTip(null)} onDoubleClick={()=>setOpenTid(t.id)} onContextMenu={e=>handleContextMenu(e,'task',t.id,row.project?.id)}><div style={ST.md(barColor,isSel)}/>{DW>=20&&<span style={{fontSize:10,fontWeight:500,color:"#4b5563",whiteSpace:"nowrap"}}>{t.done?"✓ ":""}{t.name||"新規タスク"}<span style={{color:"#9ca3af",marginLeft:12}}>{pName}</span></span>}</div>)
                      :(<div data-bar="1" data-taskid={t.id} data-projectid={row.project?.id} style={{...ST.bar(left,width,hasEst?barColor+"40":barColor,isSel,isDrg),...ds,height:22,top:7,overflow:"visible"}} onMouseDown={e=>startDrag(e,t)} onClick={e=>{e.stopPropagation();toggleSel(t.id,e)}} onMouseEnter={e=>!drag&&!depDrag&&setTip({x:e.clientX,y:e.clientY,task:t,project:pName})} onMouseLeave={()=>setTip(null)} onDoubleClick={()=>setOpenTid(t.id)} onContextMenu={e=>handleContextMenu(e,'task',t.id,row.project?.id)}>
                        {hasEst&&<div style={{position:"absolute",left:0,top:0,bottom:0,width:filledW,background:barColor,borderRadius:estRatio>=1?"5px":"5px 0 0 5px"}}/>}
                        <div style={ST.rh("l")} onMouseDown={e=>startDrag(e,t,"resize-left")}/>
                        {width>30&&<span style={{pointerEvents:"none",whiteSpace:"nowrap",position:"relative",zIndex:1}}>{t.done&&<span style={{marginRight:4}}>{"✓"}</span>}{mem&&view!=="timeline"&&<span style={{opacity:0.8,marginRight:4}}>{mem.av}</span>}{t.name||"新規タスク"}</span>}
                        <div style={ST.rh("r")} onMouseDown={e=>startDrag(e,t,"resize-right")}/>
                        <div onMouseDown={e=>{e.stopPropagation();setDepDrag({fromTaskId:t.id,fromProjectId:row.project?.id,fromX:left+width,fromY:0,mouseX:e.clientX,mouseY:e.clientY})}} style={{position:"absolute",right:-6,top:"50%",transform:"translateY(-50%)",width:10,height:10,borderRadius:"50%",background:"#6366f1",border:"2px solid #fff",cursor:"crosshair",boxShadow:"0 1px 3px rgba(0,0,0,.2)",zIndex:10,opacity:0.7}} onMouseEnter={e=>e.currentTarget.style.opacity="1"} onMouseLeave={e=>e.currentTarget.style.opacity="0.7"}/>
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
                <div style={{padding:"4px 10px",borderRadius:6,fontSize:10,fontWeight:500,background:"#e5e7eb",color:"#1f2937"}}>{capMode==="day"?"日":capMode==="week"?"週":"月"}表示</div>
              </div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <button style={{width:24,height:24,border:"1px solid #e5e7eb",borderRadius:4,background:"#fff",cursor:"pointer",fontSize:11,color:"#6b7280",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setCapOffset(o=>o-1)}>{"◀"}</button>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:12,fontWeight:600,color:"#1f2937"}}>{capPeriod.label}のキャパシティ</div>
                  <div style={{fontSize:10,color:"#6b7280",marginTop:2}}>{capPeriod.dateLabel}</div>
                </div>
                <button style={{width:24,height:24,border:"1px solid #e5e7eb",borderRadius:4,background:"#fff",cursor:"pointer",fontSize:11,color:"#6b7280",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setCapOffset(o=>o+1)}>{"▶"}</button>
              </div>
              {capOffset!==0&&<button style={{marginTop:8,width:"100%",padding:"4px 8px",border:"1px solid #e5e7eb",borderRadius:4,background:"#fff",cursor:"pointer",fontSize:10,color:"#6366f1"}} onClick={()=>setCapOffset(0)}>{capMode==="day"?"今日":capMode==="week"?"今週":"今月"}に戻る</button>}
            </div>
            <div style={{padding:"8px 16px",background:"#f9fafb",borderBottom:"1px solid #e5e7eb",fontSize:11,fontWeight:600,color:"#6b7280"}}>社内メンバー</div>
            {capData.filter(m=>m.type==="internal").map(m=>(
              <div key={m.id} style={{padding:"12px 16px",borderBottom:"1px solid #e5e7eb"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><div style={{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",flexShrink:0,background:m.color}}>{m.av}</div><div><div style={{fontSize:13,fontWeight:500,color:"#1f2937"}}>{m.name}</div><div style={{fontSize:10,color:"#6b7280"}}>{m.role}</div></div></div>
                <div style={{height:6,background:"#e5e7eb",borderRadius:3,overflow:"hidden",marginBottom:4}}><div style={{height:"100%",borderRadius:3,width:m.util+"%",background:m.util>90?"#ef4444":m.util>70?"#f59e0b":"#10b981"}}/></div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#6b7280"}}><span>{m.totalHours}h / {m.hpPeriod}h</span><span style={{color:m.util>90?"#ef4444":m.util>70?"#f59e0b":"#10b981",fontWeight:600}}>{m.util}%</span></div>
                <div style={{marginTop:8}}>{m.tasks.map((t,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"3px 0",fontSize:11,color:"#4b5563"}}><div style={{width:5,height:5,borderRadius:2,flexShrink:0,background:t.color}}/><span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</span><span style={{color:"#6b7280",flexShrink:0}}>{t.hours}h</span></div>))}{m.tasks.length===0&&<div style={{fontSize:11,color:"#6b7280",padding:"4px 0"}}>タスクなし</div>}</div>
              </div>
            ))}
            {capData.some(m=>m.type==="external")&&<React.Fragment>
              <div style={{padding:"8px 16px",background:"#f0f9ff",borderBottom:"1px solid #e5e7eb",fontSize:11,fontWeight:600,color:"#0ea5e9"}}>社外パートナー</div>
              {capData.filter(m=>m.type==="external").map(m=>(
                <div key={m.id} style={{padding:"12px 16px",borderBottom:"1px solid #e5e7eb"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><div style={{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",flexShrink:0,background:m.color,border:"2px dashed #fff",boxShadow:"0 0 0 2px "+m.color}}>{m.av}</div><div><div style={{fontSize:13,fontWeight:500,color:"#1f2937"}}>{m.name}</div><div style={{fontSize:10,color:"#6b7280"}}>{m.role}</div></div></div>
                  <div style={{height:6,background:"#e5e7eb",borderRadius:3,overflow:"hidden",marginBottom:4}}><div style={{height:"100%",borderRadius:3,width:m.util+"%",background:m.util>90?"#ef4444":m.util>70?"#f59e0b":"#10b981"}}/></div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#6b7280"}}><span>{m.totalHours}h / {m.hpPeriod}h</span><span style={{color:m.util>90?"#ef4444":m.util>70?"#f59e0b":"#10b981",fontWeight:600}}>{m.util}%</span></div>
                  <div style={{marginTop:8}}>{m.tasks.map((t,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"3px 0",fontSize:11,color:"#4b5563"}}><div style={{width:5,height:5,borderRadius:2,flexShrink:0,background:t.color}}/><span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</span><span style={{color:"#6b7280",flexShrink:0}}>{t.hours}h</span></div>))}{m.tasks.length===0&&<div style={{fontSize:11,color:"#6b7280",padding:"4px 0"}}>タスクなし</div>}</div>
                </div>
              ))}
            </React.Fragment>}
          </div>
        )}
      </div>

      {openTask&&<TaskPanel task={openTask.task} project={openTask.project} projectTasks={openTask.projectTasks} projects={projects} setProjects={setProjects} onClose={()=>setOpenTid(null)} members={teamMembers}/>}
      {openTask&&<div onClick={()=>setOpenTid(null)} style={{position:"fixed",top:0,left:0,right:440,bottom:0,zIndex:999,background:"rgba(0,0,0,.1)"}}/>}

      {dragPos&&dragShift!==0&&<div style={{position:"fixed",background:"#fff",border:"1px solid #6366f1",borderRadius:6,padding:"6px 12px",zIndex:200,pointerEvents:"none",fontSize:12,fontWeight:600,color:"#6366f1",boxShadow:"0 4px 12px rgba(0,0,0,.15)",whiteSpace:"nowrap",left:dragPos.x,top:dragPos.y}}>{dragShift>0?"+"+dragShift+"日 →":dragShift+"日 ←"}{selCount>1?" ("+selCount+"件)":""}</div>}

      {tip&&!drag&&(()=>{const days=diffD(tip.task.start,tip.task.end)+1;const defH=days*8;const hasEst=tip.task.estimatedHours!=null&&tip.task.type!=="milestone";return(
      <div style={{position:"fixed",background:"#fff",border:"1px solid #e5e7eb",borderRadius:8,padding:"10px 14px",zIndex:100,pointerEvents:"none",boxShadow:"0 4px 12px rgba(0,0,0,.1)",minWidth:180,left:tip.x+24,top:tip.y+24}}>
        <div style={{fontSize:12,fontWeight:600,marginBottom:4,color:"#1f2937"}}>{tip.task.name}</div>
        <div style={{fontSize:11,color:"#6b7280",marginBottom:2}}>{"📁 "}{tip.project}</div>
        <div style={{fontSize:11,color:"#6b7280",marginBottom:2}}>{"📅 "}{fmtDF(tip.task.start)}{" → "}{fmtDF(tip.task.end)}</div>
        <div style={{fontSize:11,color:"#6b7280",marginBottom:2}}>{"👤 "}{teamMembers.find(x=>x.id===tip.task.assignee)?.name}</div>
        {tip.task.type!=="milestone"&&<div style={{fontSize:11,color:hasEst?"#6366f1":"#6b7280",marginBottom:2}}>{hasEst?("⏱ 見積もり: "+tip.task.estimatedHours+"h（バー: "+days+"日間）"):("⏱ "+days+"日間（"+defH+"h）")}</div>}
        <div style={{fontSize:11,color:"#6b7280",display:"flex",alignItems:"center",gap:4,marginTop:2}}><div style={{width:6,height:6,borderRadius:2,background:PH[tip.task.phase]?.c}}/>{PH[tip.task.phase]?.l}</div>
      </div>)})()}

      {ctxMenu&&(()=>{
        const menuHeight=ctxMenu.type==="project"?220:400;
        const menuWidth=160;
        const adjustedY=ctxMenu.y+menuHeight>window.innerHeight?Math.max(8,window.innerHeight-menuHeight-8):ctxMenu.y;
        const adjustedX=ctxMenu.x+menuWidth>window.innerWidth?Math.max(8,window.innerWidth-menuWidth-8):ctxMenu.x;
        return<div style={{position:"fixed",left:adjustedX,top:adjustedY,background:"#fff",border:"1px solid #e5e7eb",borderRadius:8,boxShadow:"0 4px 16px rgba(0,0,0,.15)",zIndex:2000,minWidth:140,padding:4}}>
          {ctxMenu.type==="project"&&<React.Fragment>
            <button onClick={()=>{const newId=ctxMenu.id+"-"+Date.now();const newTask={id:newId,projectId:ctxMenu.id,name:"",phase:"wire",assignee:null,start:today,end:addDays(today,2),done:false,taskStatus:"inbox",desc:"",comments:[],estimatedHours:null};setProjects(ps=>ps.map(p=>p.id===ctxMenu.id?{...p,tasks:[...p.tasks,newTask],collapsed:false}:p));setOpenTid(newId);setCtxMenu(null)}} style={{width:"100%",padding:"8px 12px",border:"none",background:"transparent",textAlign:"left",cursor:"pointer",fontSize:12,borderRadius:4,display:"flex",alignItems:"center",gap:8}} onMouseEnter={e=>e.currentTarget.style.background="#f3f4f6"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{"＋ タスクを追加"}</button>
            <button onClick={()=>{setShowNewModal(true);setCtxMenu(null)}} style={{width:"100%",padding:"8px 12px",border:"none",background:"transparent",textAlign:"left",cursor:"pointer",fontSize:12,borderRadius:4,display:"flex",alignItems:"center",gap:8}} onMouseEnter={e=>e.currentTarget.style.background="#f3f4f6"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{"📁 プロジェクトを追加"}</button>
            <div style={{height:1,background:"#e5e7eb",margin:"4px 0"}}/>
            <button onClick={()=>{const p=projects.find(x=>x.id===ctxMenu.id);if(p){const name=prompt('案件名を入力',p.name);if(name){setProjects(ps=>ps.map(x=>x.id===ctxMenu.id?{...x,name}:x))}}setCtxMenu(null)}} style={{width:"100%",padding:"8px 12px",border:"none",background:"transparent",textAlign:"left",cursor:"pointer",fontSize:12,borderRadius:4,display:"flex",alignItems:"center",gap:8}} onMouseEnter={e=>e.currentTarget.style.background="#f3f4f6"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{"✏️ 名前を編集"}</button>
            <button onClick={()=>duplicateProject(ctxMenu.id)} style={{width:"100%",padding:"8px 12px",border:"none",background:"transparent",textAlign:"left",cursor:"pointer",fontSize:12,borderRadius:4,display:"flex",alignItems:"center",gap:8}} onMouseEnter={e=>e.currentTarget.style.background="#f3f4f6"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{"📋 複製"}</button>
            <div style={{height:1,background:"#e5e7eb",margin:"4px 0"}}/>
            <button onClick={()=>deleteProject(ctxMenu.id)} style={{width:"100%",padding:"8px 12px",border:"none",background:"transparent",textAlign:"left",cursor:"pointer",fontSize:12,borderRadius:4,display:"flex",alignItems:"center",gap:8,color:"#ef4444"}} onMouseEnter={e=>e.currentTarget.style.background="#fef2f2"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{"🗑 削除"}</button>
          </React.Fragment>}
          {ctxMenu.type==="task"&&(()=>{const task=projects.flatMap(p=>p.tasks).find(t=>t.id===ctxMenu.id);const isMilestone=task?.type==="milestone";const targetIds=selIds.has(ctxMenu.id)&&selIds.size>1?Array.from(selIds):[ctxMenu.id];const isMulti=targetIds.length>1;return<React.Fragment>
            {isMulti&&<div style={{padding:"6px 12px",fontSize:11,fontWeight:600,color:"#6366f1",background:"rgba(99,102,241,.08)",borderRadius:4,marginBottom:4}}>{targetIds.length}件選択中</div>}
            <button onClick={()=>{const newId=ctxMenu.projectId+"-"+Date.now();const newTask={id:newId,projectId:ctxMenu.projectId,name:"",phase:"wire",assignee:null,start:today,end:addDays(today,2),done:false,taskStatus:"inbox",desc:"",comments:[],estimatedHours:null};setProjects(ps=>ps.map(p=>p.id===ctxMenu.projectId?{...p,tasks:[...p.tasks,newTask]}:p));setOpenTid(newId);setCtxMenu(null)}} style={{width:"100%",padding:"8px 12px",border:"none",background:"transparent",textAlign:"left",cursor:"pointer",fontSize:12,borderRadius:4,display:"flex",alignItems:"center",gap:8}} onMouseEnter={e=>e.currentTarget.style.background="#f3f4f6"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{"＋ タスクを追加"}</button>
            {!isMulti&&<button onClick={()=>{setOpenTid(ctxMenu.id);setCtxMenu(null)}} style={{width:"100%",padding:"8px 12px",border:"none",background:"transparent",textAlign:"left",cursor:"pointer",fontSize:12,borderRadius:4,display:"flex",alignItems:"center",gap:8}} onMouseEnter={e=>e.currentTarget.style.background="#f3f4f6"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{"✏️ 編集"}</button>}
            <button onClick={()=>duplicateTask(ctxMenu.id,ctxMenu.projectId,isMulti?targetIds:null)} style={{width:"100%",padding:"8px 12px",border:"none",background:"transparent",textAlign:"left",cursor:"pointer",fontSize:12,borderRadius:4,display:"flex",alignItems:"center",gap:8}} onMouseEnter={e=>e.currentTarget.style.background="#f3f4f6"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{"📋 複製"}{isMulti&&<span style={{fontSize:10,color:"#6366f1"}}>({targetIds.length}件)</span>}</button>
            <div style={{position:"relative"}} onMouseEnter={e=>e.currentTarget.querySelector('.submenu-assignee').style.display='block'} onMouseLeave={e=>e.currentTarget.querySelector('.submenu-assignee').style.display='none'}>
              <button style={{width:"100%",padding:"8px 12px",border:"none",background:"transparent",textAlign:"left",cursor:"pointer",fontSize:12,borderRadius:4,display:"flex",alignItems:"center",gap:8,justifyContent:"space-between"}} onMouseEnter={e=>e.currentTarget.style.background="#f3f4f6"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{"👤 担当変更"}{isMulti&&<span style={{fontSize:10,color:"#6366f1"}}>({targetIds.length}件)</span>}<span style={{fontSize:10,color:"#9ca3af",marginLeft:"auto"}}>{"▶"}</span></button>
              <div className="submenu-assignee" style={{display:"none",position:"absolute",left:"100%",top:0,background:"#fff",border:"1px solid #e5e7eb",borderRadius:8,boxShadow:"0 4px 16px rgba(0,0,0,.15)",minWidth:160,padding:4,marginLeft:4}}>
                <button onClick={()=>{setProjects(ps=>ps.map(p=>({...p,tasks:p.tasks.map(t=>targetIds.includes(t.id)?{...t,assignee:null}:t)})));setCtxMenu(null)}} style={{width:"100%",padding:"8px 12px",border:"none",background:"transparent",textAlign:"left",cursor:"pointer",fontSize:12,borderRadius:4,color:"#6b7280"}} onMouseEnter={e=>e.currentTarget.style.background="#f3f4f6"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>未設定</button>
                <div style={{height:1,background:"#e5e7eb",margin:"4px 0"}}/>
                {teamMembers.filter(m=>m.type==="internal").map(m=>(
                  <button key={m.id} onClick={()=>{setProjects(ps=>ps.map(p=>({...p,tasks:p.tasks.map(t=>targetIds.includes(t.id)?{...t,assignee:m.id}:t)})));setCtxMenu(null)}} style={{width:"100%",padding:"8px 12px",border:"none",background:"transparent",textAlign:"left",cursor:"pointer",fontSize:12,borderRadius:4,display:"flex",alignItems:"center",gap:8}} onMouseEnter={e=>e.currentTarget.style.background="#f3f4f6"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}><div style={{width:20,height:20,borderRadius:"50%",background:m.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#fff"}}>{m.av}</div>{m.name}</button>
                ))}
                <div style={{height:1,background:"#e5e7eb",margin:"4px 0"}}/>
                <div style={{padding:"4px 12px",fontSize:10,color:"#9ca3af"}}>社外</div>
                {teamMembers.filter(m=>m.type==="external").map(m=>(
                  <button key={m.id} onClick={()=>{setProjects(ps=>ps.map(p=>({...p,tasks:p.tasks.map(t=>targetIds.includes(t.id)?{...t,assignee:m.id}:t)})));setCtxMenu(null)}} style={{width:"100%",padding:"8px 12px",border:"none",background:"transparent",textAlign:"left",cursor:"pointer",fontSize:12,borderRadius:4,display:"flex",alignItems:"center",gap:8}} onMouseEnter={e=>e.currentTarget.style.background="#f3f4f6"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}><div style={{width:20,height:20,borderRadius:"50%",background:m.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#fff",border:"1px dashed #fff",boxShadow:"0 0 0 1px "+m.color}}>{m.av}</div>{m.name}</button>
                ))}
              </div>
            </div>
            <div style={{height:1,background:"#e5e7eb",margin:"4px 0"}}/>
            {isMilestone?<button onClick={()=>{setProjects(ps=>ps.map(p=>({...p,tasks:p.tasks.map(t=>t.id===ctxMenu.id?{...t,type:undefined,end:addDays(t.start,2)}:t)})));setCtxMenu(null)}} style={{width:"100%",padding:"8px 12px",border:"none",background:"transparent",textAlign:"left",cursor:"pointer",fontSize:12,borderRadius:4,display:"flex",alignItems:"center",gap:8}} onMouseEnter={e=>e.currentTarget.style.background="#f3f4f6"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{"📋 タスクに変換"}</button>
            :<button onClick={()=>{setProjects(ps=>ps.map(p=>({...p,tasks:p.tasks.map(t=>t.id===ctxMenu.id?{...t,type:"milestone",end:t.start}:t)})));setCtxMenu(null)}} style={{width:"100%",padding:"8px 12px",border:"none",background:"transparent",textAlign:"left",cursor:"pointer",fontSize:12,borderRadius:4,display:"flex",alignItems:"center",gap:8}} onMouseEnter={e=>e.currentTarget.style.background="#f3f4f6"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{"◆ マイルストーンに変換"}</button>}
            <div style={{position:"relative"}} onMouseEnter={e=>e.currentTarget.querySelector('.submenu').style.display='block'} onMouseLeave={e=>e.currentTarget.querySelector('.submenu').style.display='none'}>
              <button style={{width:"100%",padding:"8px 12px",border:"none",background:"transparent",textAlign:"left",cursor:"pointer",fontSize:12,borderRadius:4,display:"flex",alignItems:"center",gap:8,justifyContent:"space-between"}} onMouseEnter={e=>e.currentTarget.style.background="#f3f4f6"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{"📂 プロジェクト移動"}<span style={{fontSize:10,color:"#9ca3af"}}>{"▶"}</span></button>
              <div className="submenu" style={{display:"none",position:"absolute",left:"100%",top:0,background:"#fff",border:"1px solid #e5e7eb",borderRadius:8,boxShadow:"0 4px 16px rgba(0,0,0,.15)",minWidth:160,padding:4,marginLeft:4}}>
                {projects.filter(p=>p.id!==ctxMenu.projectId).map(p=>(
                  <button key={p.id} onClick={()=>{setProjects(ps=>ps.map(proj=>{if(proj.id===ctxMenu.projectId)return{...proj,tasks:proj.tasks.filter(t=>t.id!==ctxMenu.id)};if(proj.id===p.id){const taskToMove=ps.flatMap(x=>x.tasks).find(t=>t.id===ctxMenu.id);return{...proj,tasks:[...proj.tasks,{...taskToMove,projectId:p.id,dependencies:[]}]};}return proj}));setCtxMenu(null)}} style={{width:"100%",padding:"8px 12px",border:"none",background:"transparent",textAlign:"left",cursor:"pointer",fontSize:12,borderRadius:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} onMouseEnter={e=>e.currentTarget.style.background="#f3f4f6"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{p.name}</button>
                ))}
                {projects.filter(p=>p.id!==ctxMenu.projectId).length===0&&<div style={{padding:"8px 12px",fontSize:11,color:"#9ca3af"}}>他のプロジェクトがありません</div>}
              </div>
            </div>
            <div style={{height:1,background:"#e5e7eb",margin:"4px 0"}}/>
            <button onClick={()=>deleteTask(ctxMenu.id,ctxMenu.projectId)} style={{width:"100%",padding:"8px 12px",border:"none",background:"transparent",textAlign:"left",cursor:"pointer",fontSize:12,borderRadius:4,display:"flex",alignItems:"center",gap:8,color:"#ef4444"}} onMouseEnter={e=>e.currentTarget.style.background="#fef2f2"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{"🗑 削除"}</button>
          </React.Fragment>})()}
        </div>})()}

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
                  <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>{t.tasks.length===0?"ゼロから始める":t.tasks.length+"個のタスク"}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </React.Fragment>}

      {showTaskModal&&<React.Fragment>
        <div onClick={()=>{setShowTaskModal(false);setTaskModalProjectId(null)}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:1100}}/>
        <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",background:"#fff",borderRadius:12,padding:24,zIndex:1101,width:400,boxShadow:"0 20px 50px rgba(0,0,0,.2)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
            <h2 style={{fontSize:18,fontWeight:600,color:"#1f2937",margin:0}}>新規タスク作成</h2>
            <button onClick={()=>{setShowTaskModal(false);setTaskModalProjectId(null)}} style={{width:28,height:28,border:"none",background:"#f3f4f6",borderRadius:6,cursor:"pointer",color:"#6b7280",fontSize:14}}>{"✕"}</button>
          </div>
          <p style={{fontSize:13,color:"#6b7280",marginBottom:16}}>タスクを追加するプロジェクトを選択してください</p>
          <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:300,overflowY:"auto"}}>
            {projects.map(p=>(
              <button key={p.id} onClick={()=>{
                const newId=p.id+"-"+Date.now();
                const startDate=new Date(today);
                const endDate=addDays(startDate,2);
                const newTask={id:newId,projectId:p.id,name:"",phase:"wire",assignee:null,start:startDate,end:endDate,done:false,taskStatus:"inbox",desc:"",comments:[],estimatedHours:null};
                setProjects(ps=>ps.map(proj=>proj.id===p.id?{...proj,tasks:[...proj.tasks,newTask],collapsed:false}:proj));
                setOpenTid(newId);
                setShowTaskModal(false);
                setTaskModalProjectId(null);
              }} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",border:"1px solid #e5e7eb",borderRadius:8,background:"#fff",cursor:"pointer",textAlign:"left",transition:"all .15s"}} onMouseEnter={e=>e.currentTarget.style.borderColor="#6366f1"} onMouseLeave={e=>e.currentTarget.style.borderColor="#e5e7eb"}>
                <div style={{width:8,height:8,borderRadius:"50%",flexShrink:0,background:p.status==="active"?"#10b981":"#f59e0b"}}/>
                <div style={{flex:1,overflow:"hidden"}}>
                  <div style={{fontSize:14,fontWeight:500,color:"#1f2937",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                  <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>{p.tasks.length}個のタスク</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </React.Fragment>}

      {delConfirm&&<React.Fragment>
        <div onClick={()=>setDelConfirm(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:1200}}/>
        <div tabIndex={-1} ref={el=>el&&el.focus()} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();confirmDelete()}else if(e.key==="Escape")setDelConfirm(null)}} style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",background:"#fff",borderRadius:12,padding:24,zIndex:1201,width:360,boxShadow:"0 20px 50px rgba(0,0,0,.2)",outline:"none"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
            <div style={{width:40,height:40,borderRadius:"50%",background:"#fef2f2",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{"🗑"}</div>
            <div>
              <div style={{fontSize:16,fontWeight:600,color:"#1f2937"}}>{delConfirm.type==="project"?"案件を削除":delConfirm.type==="tasks"?delConfirm.count+"件のタスクを削除":"タスクを削除"}</div>
              <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>{delConfirm.type==="tasks"?delConfirm.taskInfos.slice(0,3).map(t=>t.name||"無題").join("、")+(delConfirm.count>3?" 他"+(delConfirm.count-3)+"件":""):delConfirm.name||"無題"}</div>
            </div>
          </div>
          <p style={{fontSize:13,color:"#6b7280",marginBottom:20,lineHeight:1.6}}>
            {delConfirm.type==="project"?"この案件とすべてのタスクが削除されます。":delConfirm.type==="tasks"?delConfirm.count+"件のタスクが削除されます。":"このタスクが削除されます。"}この操作は取り消せません。
          </p>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button onClick={()=>setDelConfirm(null)} style={{padding:"10px 20px",borderRadius:8,border:"1px solid #e5e7eb",background:"#fff",cursor:"pointer",fontSize:13,fontWeight:500,color:"#374151"}}>キャンセル</button>
            <button onClick={confirmDelete} style={{padding:"10px 20px",borderRadius:8,border:"none",background:"#ef4444",cursor:"pointer",fontSize:13,fontWeight:500,color:"#fff"}}>削除する</button>
          </div>
        </div>
      </React.Fragment>}

      {showImportModal&&<React.Fragment>
        <div onClick={()=>{setShowImportModal(false);setImportText("");setImportProjectName("")}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:1100}}/>
        <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",background:"#fff",borderRadius:12,padding:24,zIndex:1101,width:500,maxHeight:"80vh",boxShadow:"0 20px 50px rgba(0,0,0,.2)",display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <h2 style={{fontSize:18,fontWeight:600,color:"#1f2937",margin:0}}>テキストからインポート</h2>
            <button onClick={()=>{setShowImportModal(false);setImportText("");setImportProjectName("")}} style={{width:28,height:28,border:"none",background:"#f3f4f6",borderRadius:6,cursor:"pointer",color:"#6b7280",fontSize:14}}>{"✕"}</button>
          </div>
          <div style={{marginBottom:16}}>
            <label style={{fontSize:12,fontWeight:600,color:"#6b7280",marginBottom:4,display:"block"}}>プロジェクト名</label>
            <input value={importProjectName} onChange={e=>setImportProjectName(e.target.value)} placeholder="例: oneunity2パンフレット" style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1px solid #e5e7eb",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
          </div>
          <div style={{marginBottom:16,flex:1}}>
            <label style={{fontSize:12,fontWeight:600,color:"#6b7280",marginBottom:4,display:"block"}}>タスクテキスト</label>
            <textarea value={importText} onChange={e=>setImportText(e.target.value)} placeholder={"2026/02/20\n〆タスク名（マイルストーン）\n\n2026/02/23 - 2026/02/27\nタスク名（期間タスク）\n\n2026/03/04\n(クライアントタスク)"} style={{width:"100%",height:200,padding:"10px 12px",borderRadius:8,border:"1px solid #e5e7eb",fontSize:13,fontFamily:"monospace",outline:"none",resize:"vertical",boxSizing:"border-box",lineHeight:1.5}}/>
          </div>
          <div style={{fontSize:11,color:"#6b7280",marginBottom:16,padding:12,background:"#f9fafb",borderRadius:8}}>
            <div style={{fontWeight:600,marginBottom:4}}>フォーマット:</div>
            <div>• 〆付き → マイルストーン</div>
            <div>• ()で囲む → クライアント担当</div>
            <div>• 日付範囲(YYYY/MM/DD - YYYY/MM/DD) → 期間タスク</div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button onClick={()=>{setShowImportModal(false);setImportText("");setImportProjectName("")}} style={{padding:"10px 20px",borderRadius:8,border:"1px solid #e5e7eb",background:"#fff",cursor:"pointer",fontSize:13,fontWeight:500,color:"#374151"}}>キャンセル</button>
            <button onClick={importFromText} disabled={!importText.trim()||!importProjectName.trim()} style={{padding:"10px 20px",borderRadius:8,border:"none",background:importText.trim()&&importProjectName.trim()?"#6366f1":"#d1d5db",cursor:importText.trim()&&importProjectName.trim()?"pointer":"not-allowed",fontSize:13,fontWeight:500,color:"#fff"}}>インポート</button>
          </div>
        </div>
      </React.Fragment>}

      {showMemberModal&&<MemberModal members={teamMembers} setMembers={setTeamMembers} onClose={()=>setShowMemberModal(false)}/>}

      {depDrag&&<svg style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:2000}}>
        <defs><marker id="arrowhead-drag" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#6366f1"/></marker></defs>
        <line x1={depDrag.mouseX-((depDrag.mouseX-100)||0)*0.5} y1={depDrag.mouseY} x2={depDrag.mouseX} y2={depDrag.mouseY} stroke="#6366f1" strokeWidth="2" strokeDasharray="5,3" markerEnd="url(#arrowhead-drag)"/>
        <circle cx={depDrag.mouseX} cy={depDrag.mouseY} r="6" fill="#6366f1" opacity="0.3"/>
      </svg>}
    </div>
  );
}
