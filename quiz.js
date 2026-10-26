import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.1/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, isSupabaseConfigured, keyLooksSecret } from "./supabase-config.js";
const $=id=>document.getElementById(id);
const raw=[
["GENERAL KNOWLEDGE","Which country is called the Land of the Rising Sun?","Japan",["China","Thailand","South Korea"],"easy"],
["SCIENCE","Which planet is famous for its rings?","Saturn",["Jupiter","Neptune","Mars"],"easy"],
["GAMING","Which company created Mario?","Nintendo",["Sega","Sony","Capcom"],"easy"],
["MOVIES & TV","What is the cowboy called in Toy Story?","Woody",["Buzz","Rex","Andy"],"easy"],
["SPORTS","How many players from one football team start on the pitch?","11",["10","9","12"],"easy"],
["RIDDLES","What has keys but cannot open locks?","A piano",["A map","A clock","A book"],"easy"],
["TECH","What does CPU stand for?","Central Processing Unit",["Computer Power Utility","Core Program Upload","Central Performance User"],"easy"],
["GENERAL KNOWLEDGE","What is the largest ocean on Earth?","Pacific Ocean",["Atlantic Ocean","Indian Ocean","Arctic Ocean"],"easy"],
["SCIENCE","Which gas do plants absorb for photosynthesis?","Carbon dioxide",["Oxygen","Nitrogen","Hydrogen"],"easy"],
["GAMING","In Minecraft, what is a Nether portal frame made from?","Obsidian",["Bedrock","Granite","Quartz"],"easy"],
["MOVIES & TV","What is the wizard school in Harry Potter called?","Hogwarts",["Nevermore","Narnia Academy","Xavier's School"],"easy"],
["SPORTS","In cricket, a boundary after the ball bounces scores how many runs?","4",["2","3","6"],"easy"],
["RIDDLES","What gets wetter as it dries?","A towel",["A sponge","A cloud","A river"],"easy"],
["GENERAL KNOWLEDGE","What is the capital of Canada?","Ottawa",["Toronto","Vancouver","Montreal"],"medium"],
["SCIENCE","What is the chemical symbol for gold?","Au",["Ag","Gd","Go"],"medium"],
["GAMING","In Pokémon, which type is super effective against Water?","Electric",["Fire","Rock","Ground"],"medium"],
["MOVIES & TV","Which franchise features the Force?","Star Wars",["Star Trek","Dune","Avatar"],"medium"],
["RIDDLES","I speak without a mouth and hear without ears. What am I?","An echo",["A radio","The wind","A shadow"],"medium"],
["TECH","Which language is used to style web pages?","CSS",["HTML","SQL","Python"],"medium"],
["GENERAL KNOWLEDGE","What is the world's smallest independent country by area?","Vatican City",["Monaco","San Marino","Liechtenstein"],"medium"],
["SCIENCE","What is the approximate speed of light in a vacuum?","300,000 km/s",["30,000 km/s","3 million km/s","150,000 km/s"],"medium"],
["GAMING","What is Link's kingdom called in The Legend of Zelda?","Hyrule",["Midgar","Lordran","Tamriel"],"medium"],
["MOVIES & TV","What is Thor's hammer called in Marvel stories?","Mjolnir",["Stormbreaker","Gungnir","Excalibur"],"medium"],
["SPORTS","Which country won the first men's FIFA World Cup in 1930?","Uruguay",["Brazil","Italy","Argentina"],"medium"],
["RIDDLES","What travels around the world while staying in one corner?","A postage stamp",["A compass","A coin","A passport"],"medium"],
["TECH","Which format commonly stores web API data as key-value pairs?","JSON",["JPEG","MP3","CSS"],"medium"],
["SCIENCE","Which particle has a negative electric charge?","Electron",["Proton","Neutron","Photon"],"medium"],
["GENERAL KNOWLEDGE","Which language has the most native speakers worldwide?","Mandarin Chinese",["English","Spanish","Hindi"],"hard"],
["SCIENCE","What is the SI unit of electrical resistance?","Ohm",["Volt","Ampere","Watt"],"medium"],
["GAMING","In chess, which piece can jump over other pieces?","Knight",["Bishop","Rook","Queen"],"medium"],
["SPORTS","What flag signals the end of a Formula 1 race?","Chequered flag",["Yellow flag","Blue flag","Red flag"],"easy"],
["RIDDLES","A farmer has 17 sheep and all but 9 run away. How many remain?","9",["8","17","0"],"medium"],
["SCIENCE","What is the process called when a solid changes directly into a gas?","Sublimation",["Condensation","Deposition","Melting"],"hard"],
["GENERAL KNOWLEDGE","Which continent lies in all four hemispheres?","Africa",["Asia","South America","Europe"],"hard"],
["GAMING","Which studio developed Elden Ring?","FromSoftware",["Capcom","Naughty Dog","CD Projekt Red"],"hard"],
["MOVIES & TV","What is the continent called where King's Landing is located in Game of Thrones?","Westeros",["Essos","Sothoryos","Valyria"],"medium"],
["SPORTS","How many total squares are on a chessboard counting every size?","204",["64","128","256"],"hard"],
["RIDDLES","You overtake the person in second place. What place are you in?","Second",["First","Third","Last"],"medium"],
["TECH","Which protocol encrypts communication to websites?","HTTPS",["FTP","HTTP","SMTP"],"medium"],
["SCIENCE","Which element has atomic number 6?","Carbon",["Oxygen","Nitrogen","Silicon"],"medium"],
["GENERAL KNOWLEDGE","What is the currency of South Korea?","Won",["Yen","Yuan","Baht"],"medium"],
["GAMING","Which game series features Raccoon City?","Resident Evil",["Silent Hill","Fallout","The Last of Us"],"medium"],
["SPORTS","In cricket, what is a batter's score of zero called?","Duck",["Goose","Blank","Maiden"],"easy"],
["SCIENCE","Which cell structure is commonly called the powerhouse of the cell?","Mitochondrion",["Ribosome","Nucleus","Golgi apparatus"],"easy"],
["RIDDLES","If two's company and three's a crowd, what are four and five?","Nine",["A crowd","Forty-five","Two groups"],"easy"],
["TECH","What does RAM provide to a computer while programs run?","Temporary working memory",["Permanent file storage","Internet access","Graphics output only"],"easy"],
["GENERAL KNOWLEDGE","Which sea is defined by ocean currents rather than land boundaries?","Sargasso Sea",["Coral Sea","Baltic Sea","Arabian Sea"],"hard"],
["GAMING","What is the maximum number of players supported in a standard modern Among Us lobby?","15",["10","12","20"],"medium"],
["RIDDLES","What has cities but no houses, forests but no trees and water but no fish?","A map",["A dream","A globe","A painting"],"medium"],
["TECH","Which data structure follows first-in, first-out order?","Queue",["Stack","Tree","Graph"],"hard"],
["SCIENCE","Which planet has a day longer than its year?","Venus",["Mars","Earth","Jupiter"],"hard"]
];
const shuffle=a=>[...a].sort(()=>Math.random()-.5);
let sb=null,channel=null,code="",host=false,mode="solo",pid=crypto.randomUUID(),pname="Player",qs=[],idx=0,score=0,correct=0,tick=null,secs=15,locked=false;
function msg(s){$("homeMsg").textContent=s}
function show(id){["home","roomLobby","arena","finish","miniGamePanel"].forEach(x=>{const e=$(x);if(e)e.hidden=x!==id})}
function setQuestions(){qs=shuffle(raw).slice(0,10).map(q=>({category:q[0],question:q[1],answer:q[2],options:shuffle([q[2],...q[3]]),difficulty:q[4]}));idx=0;score=0;correct=0;round()}
function round(){clearInterval(tick);locked=false; if(mode==="online"){$("roomCodeBadge").hidden=false;$("visibleRoomCode").textContent=code;$("modeLabel").textContent=host?"HOST BATTLE":"FRIEND BATTLE"}else{$("roomCodeBadge").hidden=true;$("modeLabel").textContent="SOLO RUN"}secs=15;let q=qs[idx];$("roundNum").textContent=idx+1;$("timer").textContent=secs;$("category").textContent=q.category;$("questionCount").textContent="QUESTION "+(idx+1)+"/10";$("questionText").textContent=q.question;$("score").textContent=score;$("feedback").textContent="Choose wisely.";$("progressBar").style.width=(idx/10*100)+"%";$("nextBtn").hidden=true;let root=$("answers");root.replaceChildren();q.options.forEach((v,i)=>{let b=document.createElement("button");b.className="answer-option";let span=document.createElement("span");span.className="letter";span.textContent=String.fromCharCode(65+i);b.append(span,document.createTextNode(v));b.onclick=()=>answer(v,b);root.append(b)});show("arena");tick=setInterval(()=>{secs--;$("timer").textContent=secs;if(secs<=0)answer(null,null)},1000);if(mode==="online"&&host)send({type:"question",idx,q:{category:q.category,question:q.question,options:q.options,answer:q.answer}})}
function answer(v,b){if(locked)return;locked=true;clearInterval(tick);let q=qs[idx],ok=v===q.answer;if(ok){let points=100+secs*10;score+=points;correct++;$("feedback").textContent="⚡ Correct! +"+points}else $("feedback").textContent=v===null?"⏱ Time! Answer: "+q.answer:"Not quite! Answer: "+q.answer;[...$("answers").children].forEach(x=>{x.disabled=true;let text=x.textContent.slice(1).trim();if(text===q.answer)x.classList.add("correct");else if(x===b)x.classList.add("wrong")});$("score").textContent=score;$("progressBar").style.width=((idx+1)/10*100)+"%";$("nextBtn").hidden=false;$("nextBtn").textContent=idx===9?"See results →":"Next question →";if(mode==="online")send({type:"answer",pid,name:pname,score,correct,idx})}
function next(){if(!locked)return;if(idx<9){idx++;round()}else finish()}
function finish(){clearInterval(tick);if(mode==="online"&&host)send({type:"finished",pid,name:pname,score});show("finish");$("finalScore").textContent=score;$("correctCount").textContent=correct+"/10";$("finishTitle").textContent=correct>=8?"Quiz Legend!":correct>=5?"Nice run!":"Keep grinding!";$("finishSummary").textContent="You scored "+score+" points and got "+correct+" out of 10 correct.";$("finishMessage").textContent=mode==="online"?"Your score has been shared with the room.":"Play again for a fresh random set."}
function send(payload){if(channel)channel.send({type:"broadcast",event:"quiz",payload})}
async function room(c,isHost){if(!sb){msg("Online battle is unavailable. Solo mode still works.");return}code=c;host=isHost;mode="online";channel=sb.channel("quizbattle:"+c,{config:{broadcast:{self:false}}});channel.on("broadcast",{event:"quiz"},({payload:p})=>{if(p.pid===pid)return;if(p.type==="hello"){$("battleScores").hidden=false;$("battleScores").textContent=p.name+" joined!";$("roomPlayers").textContent=p.name+" has joined the room."; $("startBattleBtn").disabled=!host;$("startBattleBtn").textContent=host?"Start Battle →":"Waiting for host to start…";}
if(p.type==="chat")addChat(p.name,p.text,false);
if(p.type==="start"&&!host){$("roomLobbyMsg").textContent="Host is starting the battle…"}
if(p.type==="question"&&!host){idx=p.idx;qs[idx]={...p.q};locked=false;clearInterval(tick);$("modeLabel").textContent="ROOM "+code;$("roundNum").textContent=idx+1;$("questionCount").textContent="QUESTION "+(idx+1)+"/10";$("category").textContent=p.q.category;$("questionText").textContent=p.q.question;$("feedback").textContent="Choose quickly!";$("timer").textContent="15";$("score").textContent=score;$("nextBtn").hidden=true;let root=$("answers");root.replaceChildren();p.q.options.forEach((v,i)=>{let b=document.createElement("button");b.className="answer-option";let s=document.createElement("span");s.className="letter";s.textContent=String.fromCharCode(65+i);b.append(s,document.createTextNode(v));b.onclick=()=>{if(locked)return;locked=true;clearInterval(tick);let q=qs[idx],ok=v===q.answer;if(ok){let pts=100+15*10;score+=pts;correct++;$("feedback").textContent="⚡ Correct! +"+pts}else $("feedback").textContent="Answer: "+q.answer;[...root.children].forEach(x=>{x.disabled=true;if(x.textContent.slice(1).trim()===q.answer)x.classList.add("correct");else if(x===b)x.classList.add("wrong")});$("score").textContent=score;$("progressBar").style.width=((idx+1)/10*100)+"%";$("nextBtn").hidden=true;$("feedback").textContent += " Waiting for host…";send({type:"answer",pid,name:pname,answer:v,score,correct,idx})};root.append(b)});show("arena")}if(p.type==="answer"&&host){$("battleScores").hidden=false;$("battleScores").textContent=p.name+" scored "+(p.score||0)+" points so far."}if(p.type==="finished"&&!host){show("finish");$("finalScore").textContent=score;$("correctCount").textContent=correct+"/10";$("finishTitle").textContent="Battle complete!";$("finishSummary").textContent="Your score: "+score+" points."; $("finishMessage").textContent="The host has finished the quiz."}});let connected=await new Promise(resolve=>{let settled=false;const done=ok=>{if(!settled){settled=true;clearTimeout(wait);resolve(ok)}};const wait=setTimeout(()=>done(false),10000);channel.subscribe(status=>{if(status==="SUBSCRIBED")done(true);else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"||status==="CLOSED")done(false)})});if(!connected){msg("Could not connect to Supabase Realtime. Check internet and project Realtime status.");return}send({type:"hello",pid,name:pname});$("lobbyRoomCode").textContent=c;$("roomChatMessages").replaceChildren();$("roomPlayers").textContent=isHost?"Room created. Waiting for your friend to join…":"Connected to room. Waiting for host."; $("startBattleBtn").disabled=true;$("startBattleBtn").textContent=isHost?"Waiting for friend…":"Waiting for host to start…";$("roomLobbyMsg").textContent=isHost?"Share the room code with your friend.":"You joined successfully.";show("roomLobby");msg("");}
$("soloBtn").onclick=()=>{pname=$("playerName").value.trim().slice(0,18)||"Player";mode="solo";setQuestions()};
$("createBtn").onclick=()=>{pname=$("playerName").value.trim().slice(0,18)||"Player";room(randomCode(),true)};
function randomCode(){return Math.random().toString(36).slice(2,7).toUpperCase()}
$("joinBtn").onclick=()=>{pname=$("playerName").value.trim().slice(0,18)||"Player";let c=$("roomInput").value.trim().toUpperCase();if(c.length!==5){msg("Enter the 5-character room code.");return}room(c,false)};
$("startBattleBtn").onclick=()=>{if(!host)return;$("roomLobbyMsg").textContent="Battle started!";send({type:"start",pid,name:pname});setQuestions()};
function addChat(name,textValue,local){const line=document.createElement("div");line.className="room-chat-line";const who=document.createElement("b");who.textContent=name+": ";line.append(who,document.createTextNode(textValue));$("roomChatMessages").append(line);$("roomChatMessages").scrollTop=$("roomChatMessages").scrollHeight;if(local)send({type:"chat",pid,name,text:textValue})}
$("roomChatForm").onsubmit=e=>{e.preventDefault();const input=$("roomChatInput"),value=input.value.trim();if(!value)return;addChat(pname,value,true);input.value=""};
$("copyRoomCode").onclick=async()=>{try{await navigator.clipboard.writeText(code);$("roomLobbyMsg").textContent="Room code copied!"}catch{$("roomLobbyMsg").textContent="Your room code is "+code}};
$("leaveRoomBtn").onclick=()=>{if(channel&&sb)sb.removeChannel(channel);channel=null;mode="solo";host=false;code="";show("home");msg("You left the room.")};
$("nextBtn").onclick=next;$("againBtn").onclick=()=>{mode="solo";if(channel){sb.removeChannel(channel);channel=null}setQuestions()};
if(isSupabaseConfigured()&&!keyLooksSecret())sb=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);else{$("createBtn").disabled=true;$("joinBtn").disabled=true;msg("Online mode needs Supabase configured. Solo quiz is ready.")}

// ---- Quick solo mini-games (Quiz Battle multiplayer controls are hidden; Tic-Tac-Toe multiplayer remains on index.html) ----
const miniContent=$("miniGameContent");
let miniSecret=0, miniTries=0, miniStart=0, miniTimer=null, miniSequence=[], miniInput=[], miniRound=0, miniLocked=false;
function miniBase(title,status){clearTimeout(miniTimer);$("miniGameTitle").textContent=title;$("miniGameStatus").textContent=status;miniContent.replaceChildren();show("miniGamePanel")}
function miniButton(label,action,cls="btn btn-secondary"){const b=document.createElement("button");b.className=cls;b.type="button";b.textContent=label;b.addEventListener("click",action);return b}
function startMini(type){
 if(type==="reaction"){
  miniBase("Reaction Test","Wait for the green signal, then tap as quickly as possible.");
  const target=miniButton("Wait for green…",()=>{}, "reaction-target");target.disabled=true;miniContent.append(target);
  miniTimer=setTimeout(()=>{target.disabled=false;target.textContent="TAP NOW!";target.dataset.ready="yes";target.classList.add("ready");miniStart=performance.now();target.onclick=()=>{if(target.dataset.ready!=="yes")return;target.dataset.ready="no";const ms=Math.round(performance.now()-miniStart);target.textContent=ms+" ms";$("miniGameStatus").textContent=ms<250?"Lightning fast!":ms<400?"Nice reflexes!":"Try again to beat your time.";miniContent.append(miniButton("Try again",()=>startMini("reaction"),"btn btn-primary"))}},1200+Math.random()*2500);
  target.onclick=()=>{if(!target.disabled&&target.dataset.ready!=="yes"){$("miniGameStatus").textContent="Too early! Try again.";clearTimeout(miniTimer);miniContent.append(miniButton("Retry",()=>startMini("reaction"),"btn btn-primary"))}};
 }else if(type==="number"){
  miniSecret=1+Math.floor(Math.random()*100);miniTries=0;miniBase("Number Guess","I picked a number from 1 to 100. Find it in as few tries as possible.");
  const input=document.createElement("input");input.type="number";input.min="1";input.max="100";input.placeholder="Enter 1–100";input.className="quiz-input";
  const result=document.createElement("p");result.className="quiz-message";
  const guess=miniButton("Guess",()=>{const n=Number(input.value);if(!Number.isInteger(n)||n<1||n>100){result.textContent="Enter a whole number from 1 to 100.";return}miniTries++;if(n===miniSecret){result.textContent="You got it in "+miniTries+" tries!";$("miniGameStatus").textContent="Winner!";guess.disabled=true}else result.textContent=n<miniSecret?"Too low — try higher.":"Too high — try lower.";input.value="";input.focus() },"btn btn-primary");
  miniContent.append(input,guess,result,miniButton("New number",()=>startMini("number")));
 }else if(type==="rps"){
  miniBase("Rock Paper Scissors","Choose one. First to beat the computer wins this round.");
  const result=document.createElement("p");result.className="quiz-message";let wins=0,losses=0;
  const update=choice=>{const options=["Rock","Paper","Scissors"],bot=options[Math.floor(Math.random()*3)];let outcome=choice===bot?"Draw!":(choice==="Rock"&&bot==="Scissors"||choice==="Paper"&&bot==="Rock"||choice==="Scissors"&&bot==="Paper")?"You win!":"Computer wins!";if(outcome==="You win!")wins++;if(outcome==="Computer wins!")losses++;result.textContent="You: "+choice+" · Computer: "+bot+" — "+outcome+" (You "+wins+" : "+losses+")"};
  const row=document.createElement("div");row.className="mini-choice-row";["Rock ✊","Paper ✋","Scissors ✌️"].forEach(label=>row.append(miniButton(label,()=>update(label.split(" ")[0]))));miniContent.append(row,result,miniButton("Reset score",()=>startMini("rps")));
 }else if(type==="memory"){
  miniRound=0;miniSequence=[];miniInput=[];miniLocked=false;miniBase("Memory Lights","Watch the sequence, then repeat it in the same order.");
  const board=document.createElement("div");board.className="memory-board";
  const status=document.createElement("p");status.className="quiz-message";
  const colors=["CYAN","PINK","LIME","GOLD"];
  const paint=()=>{board.replaceChildren();colors.forEach((c,i)=>{const b=miniButton(c,()=>pick(i),"memory-tile tile-"+i);b.disabled=miniLocked;board.append(b)})};
  const pick=i=>{if(miniLocked)return;miniInput.push(i);if(miniInput[miniInput.length-1]!==miniSequence[miniInput.length-1]){miniLocked=true;status.textContent="Not quite — you reached level "+miniRound+".";miniContent.append(miniButton("Play again",()=>startMini("memory"),"btn btn-primary"));return}if(miniInput.length===miniSequence.length){miniRound++;status.textContent="Great! Level "+miniRound+" — next sequence…";miniLocked=true;miniTimer=setTimeout(nextSeq,650)}};
  const nextSeq=()=>{miniSequence.push(Math.floor(Math.random()*4));miniInput=[];miniLocked=true;paint();let k=0;const flash=()=>{if(k>=miniSequence.length){miniLocked=false;paint();status.textContent="Your turn — repeat "+miniSequence.length+" lights.";return}const tile=board.children[miniSequence[k]];tile.classList.add("flash");miniTimer=setTimeout(()=>{tile.classList.remove("flash");k++;miniTimer=setTimeout(flash,180)},380)};flash()};
  miniContent.append(board,status);nextSeq();
 }
}
document.querySelectorAll("[data-mini]").forEach(b=>b.addEventListener("click",()=>startMini(b.dataset.mini)));
$("miniGameBack").addEventListener("click",()=>{clearTimeout(miniTimer);show("home")});
