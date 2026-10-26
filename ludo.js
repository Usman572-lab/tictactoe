import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.1/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, isSupabaseConfigured, keyLooksSecret } from "./supabase-config.js";
const $=id=>document.getElementById(id);
const COLORS=["red","green","yellow","blue"], NAMES=["Red","Green","Yellow","Blue"], STARTS=[0,13,26,39], SAFE=[0,8,13,21,26,34,39,47];
const TRACK=[[0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7],[1,7],[2,7],[3,7],[4,7],[5,7],[6,7],[7,7],[7,6],[7,5],[7,4],[7,3],[7,2],[7,1],[7,0],[6,0],[5,0],[4,0],[3,0],[2,0],[1,0],[1,1],[1,2],[1,3],[1,4],[1,5],[1,6],[2,6],[3,6],[4,6],[5,6],[6,6],[6,5],[6,4],[6,3],[6,2],[6,1],[5,1],[4,1],[3,1],[2,1],[2,2],[2,3],[2,4],[2,5]];
let sb=null, uid=null, room=null, channel=null, seat=-1, busy=false, feedbackTimer=null;
const initialState=()=>({turn:0,die:0,rolled:false,tokens:[[-1,-1,-1,-1],[-1,-1,-1,-1],[-1,-1,-1,-1],[-1,-1,-1,-1]],winner:null,lastMessage:"Roll a six to bring a token out."});
function message(t){$("ludoMessage").textContent=t||"";}
function feedback(t){$("ludoFeedback").textContent=t||"";}
function net(t){$("ludoNet").dataset.state=t;$("ludoNetText").textContent=t==="online"?"Online":t==="offline"?"Offline":"Connecting";}
function toast(t){const e=$("ludoToast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),2600);}
function stateOf(r){return r?.state&&Array.isArray(r.state.tokens)?r.state:initialState();}
function mySeat(r){if(r.host_id===uid)return 0;const p=(r.players||[]).find(x=>x.id===uid);return p?Number(p.seat):-1;}
function allPlayers(r){return [{id:r.host_id,seat:0,name:"Host"},...(r.players||[])].sort((a,b)=>a.seat-b.seat);}
function setView(game){$("ludoLobby").hidden=game;$("ludoGame").hidden=!game;}
function normalize(v){return String(v||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6);}
function pathFor(seat,pos){if(pos<0)return null;if(pos>=57)return {home:true,index:pos};return {track:(STARTS[seat]+pos)%52};}
function trackCellIndex(track){return track;}
function buildBoard(){
 const board=$("ludoBoard");board.textContent="";
 // 52 track cells in a clean 8-column loop; corners are home pads and center is the finish.
 const cells=[];
 for(let i=0;i<56;i++){const c=document.createElement("div");c.className="ludo-cell";c.dataset.cell=String(i);cells.push(c);board.append(c);}
 // Four colored home pads at the corners; track cells remain individually addressable.
 [0,1,2,3].forEach(s=>{for(let t=0;t<4;t++){const pad=document.createElement("div");pad.className="ludo-cell home-"+COLORS[s];pad.dataset.base=s+"-"+t;board.append(pad);}});
 const center=document.createElement("div");center.className="ludo-cell center";center.textContent="★";board.append(center);
 return {cells,board};
}
let boardUI=null;
function tokenButton(s,t,pos){
 const b=document.createElement("button");b.type="button";b.className="ludo-token "+COLORS[s];b.textContent=String(t+1);b.title=NAMES[s]+" token "+(t+1);b.disabled=true;b.addEventListener("click",()=>moveToken(s,t));return b;
}
function render(){
 if(!room)return;const st=stateOf(room), players=allPlayers(room), count=players.length;
 $("ludoRoomCode").textContent=room.code;$("ludoPlayerCount").textContent=count+" / 4 PLAYERS";
 const active=players.find(p=>p.seat===st.turn), mine=seat===st.turn, hasRoom=count>=2;
 $("ludoStatus").dataset.kind=hasRoom?"ok":"wait";$("ludoStatusText").textContent=count<4?"Share the code to invite up to "+(4-count)+" more player"+(4-count===1?"":"s"):"All seats filled";
 $("ludoTurn").textContent=st.winner!==null?NAMES[st.winner]+" wins!":active?NAMES[active.seat]+"'s turn":"Waiting…";
 $("ludoTurn").style.color=active?["#ff3d6e","#32e98b","#ffbd35","#00cfff"][active.seat]:"";
 $("ludoDie").textContent=st.die?["","⚀","⚁","⚂","⚃","⚄","⚅"][st.die]:"⚄";
 $("ludoRoll").disabled=!mine||!hasRoom||st.rolled||st.winner!==null||busy;
 $("ludoHint").textContent=!hasRoom?"Need at least 2 players to start.":st.winner!==null?"Game finished — create a new room to play again.":mine?(st.rolled?"Choose a highlighted token to move.":"It's your turn — roll the dice."):"Waiting for "+(active?.name||"the next player")+".";
 $("ludoPlayers").textContent="";
 players.forEach(p=>{const card=document.createElement("div");card.className="ludo-player-card"+(p.seat===st.turn&&st.winner===null?" active":"");const dot=document.createElement("i");dot.className="ludo-player-dot";dot.style.background=["#ff3d6e","#32e98b","#ffbd35","#00cfff"][p.seat];const wrap=document.createElement("div"),name=document.createElement("div"),meta=document.createElement("span");name.className="ludo-player-name";name.textContent=p.name+(p.id===uid?" (you)":"");meta.className="ludo-player-meta";meta.textContent=NAMES[p.seat]+" · "+st.tokens[p.seat].filter(x=>x===57).length+"/4 home";wrap.append(name,meta);card.append(dot,wrap);$("ludoPlayers").append(card);});
 const {cells}=boardUI;cells.forEach((c,i)=>{c.textContent="";c.className="ludo-cell track"+(SAFE.includes(i)?" safe":"");});
 document.querySelectorAll("[data-base]").forEach(c=>c.textContent=""); 
 // The visual path uses 52 indexed spaces plus four spare corners; home tokens are in their base pads.
 st.tokens.forEach((arr,s)=>arr.forEach((pos,t)=>{const b=tokenButton(s,t,pos);b.disabled=!(mine&&st.rolled&&s===seat&&legal(s,t,st));const loc=pathFor(s,pos);let target;if(pos<0)target=document.querySelector('[data-base="'+s+'-'+t+'"]');else if(pos>=57)target=$("ludoBoard").children[56];else target=cells[loc.track%52];if(target)target.append(b);}));
}
function legal(s,t,st){const p=st.tokens[s][t];return p<57&&(p===-1?st.die===6:p+st.die<=57);}
function nextSeat(s){const players=allPlayers(room).map(p=>p.seat);for(let i=1;i<=4;i++){const n=(s+i)%4;if(players.includes(n))return n;}return s;}
async function saveState(st){if(!room||busy)return;busy=true;try{const {data,error}=await sb.rpc("ludo_save_state",{p_code:room.code,p_state:st});if(error)throw error;const r=Array.isArray(data)?data[0]:data;if(r){room=r;render();}}catch(e){console.error(e);feedback("Sync failed: "+(e.message||"check Ludo SQL setup"));}finally{busy=false;render();}}
async function roll(){if(!room||busy)return;const st=structuredClone(stateOf(room));if(seat!==st.turn||st.rolled||st.winner!==null)return;st.die=1+Math.floor(Math.random()*6);st.rolled=true;st.lastMessage=NAMES[seat]+" rolled "+st.die+".";const any=st.tokens[seat].some((p)=>p<57&&(p===-1?st.die===6:p+st.die<=57));if(!any){st.rolled=false;st.turn=nextSeat(st.turn);st.lastMessage="No legal move. Turn passed."; }feedback(st.lastMessage);await saveState(st);}
async function moveToken(s,t){if(!room||busy)return;const st=structuredClone(stateOf(room));if(seat!==st.turn||!st.rolled||s!==seat||!legal(s,t,st))return;const rolledValue=st.die;let p=st.tokens[s][t];p=p===-1?0:p+rolledValue;st.tokens[s][t]=p;let captured=0;if(p<52){const track=(STARTS[s]+p)%52;if(!SAFE.includes(track)){for(let o=0;o<4;o++){if(o===s)continue;for(let k=0;k<4;k++){const op=st.tokens[o][k];if(op>=0&&op<52&&(STARTS[o]+op)%52===track){st.tokens[o][k]=-1;captured++;}}}}}if(st.tokens[s].every(x=>x===57))st.winner=s; // token reaches 57 below
 st.rolled=false;st.die=0;
 if(st.winner===null&&(rolledValue===6||captured>0)){st.lastMessage=captured?"Capture! Roll again.":"Six! Roll again.";}else{st.turn=nextSeat(s);st.lastMessage=captured?"Captured "+captured+" token(s).":NAMES[s]+" moved a token.";}
 feedback(st.lastMessage);await saveState(st);}
async function createRoom(){try{busy=true;$("ludoCreate").disabled=true;const {data,error}=await sb.rpc("ludo_create_room");if(error)throw error;room=Array.isArray(data)?data[0]:data;seat=0;joinRealtime();setView(true);render();message("");}catch(e){message("Couldn't create room: "+e.message);}finally{busy=false;$("ludoCreate").disabled=false;}}
async function joinRoom(code){code=normalize(code);if(code.length!==6){message("Enter the 6-character room code.");return;}try{busy=true;$("ludoJoin").disabled=true;const {data,error}=await sb.rpc("ludo_join_room",{p_code:code});if(error)throw error;room=Array.isArray(data)?data[0]:data;seat=mySeat(room);if(seat<0)throw new Error("Room membership could not be confirmed.");joinRealtime();setView(true);render();message("");}catch(e){message(e.message==="room_full"?"This room already has four players.":e.message==="room_not_found"?"Ludo room not found. Check the code.":"Couldn't join: "+e.message);}finally{busy=false;$("ludoJoin").disabled=false;}}
function joinRealtime(){if(channel)sb.removeChannel(channel);channel=sb.channel("ludo-live:"+room.code).on("postgres_changes",{event:"UPDATE",schema:"public",table:"ludo_rooms",filter:"code=eq."+room.code},payload=>{if(payload.new&&payload.new.version>room.version){room=payload.new;seat=mySeat(room);render();}}).subscribe();localStorage.setItem("ludo.lastRoom",room.code);}
async function leave(){if(!room)return;try{await sb.rpc("ludo_leave_room",{p_code:room.code});}catch(e){console.warn(e);}if(channel)await sb.removeChannel(channel);channel=null;room=null;seat=-1;localStorage.removeItem("ludo.lastRoom");setView(false);}
async function copy(text){try{await navigator.clipboard.writeText(text);toast("Copied!");}catch{toast("Copy failed — select the room code.");}}
$("ludoCreate").addEventListener("click",createRoom);
$("ludoJoinForm").addEventListener("submit",e=>{e.preventDefault();joinRoom($("ludoCode").value);});
$("ludoCode").addEventListener("input",e=>e.target.value=normalize(e.target.value));
$("ludoRoll").addEventListener("click",roll);$("ludoLeave").addEventListener("click",leave);
$("ludoCopyCode").addEventListener("click",()=>room&&copy(room.code));
$("ludoCopyLink").addEventListener("click",()=>{if(room){const u=new URL(location.href);u.search="?room="+room.code;copy(u.toString());}});
async function main(){buildBoard();if(!isSupabaseConfigured()||keyLooksSecret()){net("offline");message("Supabase config is not ready. Open the main TicTacToe site setup first.");return;}try{sb=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});let {data}=await sb.auth.getSession();let user=data.session?.user;if(!user){const r=await sb.auth.signInAnonymously();if(r.error)throw r.error;user=r.data.user;}uid=user.id;net("online");$("ludoCreate").disabled=false;$("ludoJoin").disabled=false;const code=new URLSearchParams(location.search).get("room");if(code){$("ludoCode").value=normalize(code);message("Invite code filled in. Press Join room.");}}catch(e){net("offline");message("Supabase sign-in failed: "+e.message);}}
main();
