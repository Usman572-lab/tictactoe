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
function show(id){["home","arena","finish"].forEach(x=>$(x).hidden=x!==id)}
function setQuestions(){qs=shuffle(raw).slice(0,10).map(q=>({category:q[0],question:q[1],answer:q[2],options:shuffle([q[2],...q[3]]),difficulty:q[4]}));idx=0;score=0;correct=0;round()}
function round(){clearInterval(tick);locked=false; if(mode==="online"){$("roomCodeBadge").hidden=false;$("visibleRoomCode").textContent=code;$("modeLabel").textContent=host?"HOST BATTLE":"FRIEND BATTLE"}else{$("roomCodeBadge").hidden=true;$("modeLabel").textContent="SOLO RUN"}secs=15;let q=qs[idx];$("roundNum").textContent=idx+1;$("timer").textContent=secs;$("category").textContent=q.category;$("questionCount").textContent="QUESTION "+(idx+1)+"/10";$("questionText").textContent=q.question;$("score").textContent=score;$("feedback").textContent="Choose wisely.";$("progressBar").style.width=(idx/10*100)+"%";$("nextBtn").hidden=true;let root=$("answers");root.replaceChildren();q.options.forEach((v,i)=>{let b=document.createElement("button");b.className="answer-option";let span=document.createElement("span");span.className="letter";span.textContent=String.fromCharCode(65+i);b.append(span,document.createTextNode(v));b.onclick=()=>answer(v,b);root.append(b)});show("arena");tick=setInterval(()=>{secs--;$("timer").textContent=secs;if(secs<=0)answer(null,null)},1000);if(mode==="online"&&host)send({type:"question",idx,q:{category:q.category,question:q.question,options:q.options,answer:q.answer}})}
function answer(v,b){if(locked)return;locked=true;clearInterval(tick);let q=qs[idx],ok=v===q.answer;if(ok){let points=100+secs*10;score+=points;correct++;$("feedback").textContent="⚡ Correct! +"+points}else $("feedback").textContent=v===null?"⏱ Time! Answer: "+q.answer:"Not quite! Answer: "+q.answer;[...$("answers").children].forEach(x=>{x.disabled=true;let text=x.textContent.slice(1).trim();if(text===q.answer)x.classList.add("correct");else if(x===b)x.classList.add("wrong")});$("score").textContent=score;$("progressBar").style.width=((idx+1)/10*100)+"%";$("nextBtn").hidden=false;$("nextBtn").textContent=idx===9?"See results →":"Next question →";if(mode==="online")send({type:"answer",pid,name:pname,score,correct,idx})}
function next(){if(!locked)return;if(idx<9){idx++;round()}else finish()}
function finish(){clearInterval(tick);show("finish");$("finalScore").textContent=score;$("correctCount").textContent=correct+"/10";$("finishTitle").textContent=correct>=8?"Quiz Legend!":correct>=5?"Nice run!":"Keep grinding!";$("finishSummary").textContent="You scored "+score+" points and got "+correct+" out of 10 correct.";$("finishMessage").textContent=mode==="online"?"Your score has been shared with the room.":"Play again for a fresh random set."}
function send(payload){if(channel)channel.send({type:"broadcast",event:"quiz",payload})}
async function room(c,isHost){if(!sb){msg("Online battle is unavailable. Solo mode still works.");return}code=c;host=isHost;mode="online";channel=sb.channel("quizbattle:"+c,{config:{broadcast:{self:false}}});channel.on("broadcast",{event:"quiz"},({payload:p})=>{if(p.pid===pid)return;if(p.type==="hello"){$("battleScores").hidden=false;$("battleScores").textContent=p.name+" joined!";send({type:"hello",pid,name:pname})}if(p.type==="question"&&!host){idx=p.idx;qs[idx]={...p.q};locked=false;clearInterval(tick);$("modeLabel").textContent="ROOM "+code;$("roundNum").textContent=idx+1;$("questionCount").textContent="QUESTION "+(idx+1)+"/10";$("category").textContent=p.q.category;$("questionText").textContent=p.q.question;$("feedback").textContent="Choose quickly!";$("timer").textContent="15";$("score").textContent=score;$("nextBtn").hidden=true;let root=$("answers");root.replaceChildren();p.q.options.forEach((v,i)=>{let b=document.createElement("button");b.className="answer-option";let s=document.createElement("span");s.className="letter";s.textContent=String.fromCharCode(65+i);b.append(s,document.createTextNode(v));b.onclick=()=>{if(locked)return;locked=true;clearInterval(tick);let q=qs[idx],ok=v===q.answer;if(ok){let pts=100+15*10;score+=pts;correct++;$("feedback").textContent="⚡ Correct! +"+pts}else $("feedback").textContent="Answer: "+q.answer;[...root.children].forEach(x=>{x.disabled=true;if(x.textContent.slice(1).trim()===q.answer)x.classList.add("correct");else if(x===b)x.classList.add("wrong")});$("score").textContent=score;$("progressBar").style.width=((idx+1)/10*100)+"%";$("nextBtn").hidden=true;$("feedback").textContent += " Waiting for host…";send({type:"answer",pid,name:pname,answer:v,score,correct,idx})};root.append(b)});show("arena")}if(p.type==="answer"&&host){$("battleScores").hidden=false;$("battleScores").textContent=p.name+" scored "+(p.score||0)+" points so far."}if(p.type==="finished"&&!host){show("finish");$("finalScore").textContent=score;$("correctCount").textContent=correct+"/10";$("finishTitle").textContent="Battle complete!";$("finishSummary").textContent="Your score: "+score+" points."; $("finishMessage").textContent="The host has finished the quiz."}});let status=await channel.subscribe();if(status!=="SUBSCRIBED"){msg("Could not connect. Check Supabase Realtime settings.");return}send({type:"hello",pid,name:pname});$("roomCodeBadge").hidden=false;$("visibleRoomCode").textContent=c;$("modeLabel").textContent=isHost?"HOST BATTLE":"FRIEND BATTLE";if(isHost){msg("Room "+c+" created. Share the code with your friend.");setQuestions()}else{msg("Joined room "+c+". Waiting for host question.");show("arena");$("questionText").textContent="Waiting for host to start…"}}
$("soloBtn").onclick=()=>{pname=$("playerName").value.trim().slice(0,18)||"Player";mode="solo";setQuestions()};
$("createBtn").onclick=()=>{pname=$("playerName").value.trim().slice(0,18)||"Player";room(randomCode(),true)};
function randomCode(){return Math.random().toString(36).slice(2,7).toUpperCase()}
$("joinBtn").onclick=()=>{pname=$("playerName").value.trim().slice(0,18)||"Player";let c=$("roomInput").value.trim().toUpperCase();if(c.length!==5){msg("Enter the 5-character room code.");return}room(c,false)};
$("nextBtn").onclick=next;$("againBtn").onclick=()=>{mode="solo";if(channel){sb.removeChannel(channel);channel=null}setQuestions()};
if(isSupabaseConfigured()&&!keyLooksSecret())sb=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);else{$("createBtn").disabled=true;$("joinBtn").disabled=true;msg("Online mode needs Supabase configured. Solo quiz is ready.")}