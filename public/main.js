<!-- KEEPING ALL EXISTING JS EXACTLY THE SAME BELOW -->
<script>
/* ---------- ORIGINAL FUNCTIONAL SCRIPT (unchanged) ---------- */

// -------------------- SOCKET.IO --------------------
const socket = io();
let attendance = {};
const activeBody = document.querySelector("#active tbody");
const historyDiv = document.querySelector("#history");
const vcAlert = document.getElementById("vcAlert");

// -------------------- VC ALERT --------------------
function showVCAlert(message, type) {
  vcAlert.textContent = message;
  vcAlert.style.color = type === "join" ? "#2ea043" : "#da3633";
  vcAlert.style.display = "block";
  setTimeout(() => { vcAlert.style.display = "none"; }, 5000);
}

// -------------------- ACTIVE VC --------------------
function updateActive() {
  activeBody.innerHTML = "";
  const now = new Date();
  Object.entries(attendance.active || {}).forEach(([user, info]) => {
    const joined = new Date(info.joinedAt || Date.now());
    const durationSec = Math.floor((now - joined)/1000);
    const durationText = formatDuration(durationSec);
    const muteIcon = info.selfMute || info.serverMute ? "🔇" : "🎤";
    const deafIcon = info.selfDeaf || info.serverDeaf ? "🔕" : "👂";
    const statusText = `<span class="status-icons">${muteIcon} ${deafIcon}</span>`;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${user}</td><td>${info.channel || "Unknown"}</td><td>${statusText}</td><td>${durationText}</td>`;
    activeBody.appendChild(tr);
  });
}

function updateHistory() {
  historyDiv.innerHTML = "";
  (attendance.history || []).slice(0,20).forEach(h => {
    const div = document.createElement("div");
    const time = new Date(h.time).toLocaleTimeString();
    const typeClass = h.type === "join" ? "joined" : "left";
    const action = h.type === "join" ? "joined" : "left";
    div.innerHTML = `<span class="${typeClass}">${h.user}</span> ${action} <b>${h.channel}</b> at ${time}`;
    historyDiv.appendChild(div);
  });
}

function formatDuration(sec) {
  const h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60), s=sec%60;
  return `${h.toString().padStart(2,"0")}:${m.toString().padStart(2,"0")}:${s.toString().padStart(2,"0")}`;
}

setInterval(updateActive, 1000);

socket.on("connect", () => console.log("✅ Connected to server"));
socket.on("update", (data) => {
  const oldHistory = attendance.history || [];
  attendance = data;
  updateActive();
  updateHistory();

  // -------------------- VC ALERT (Updated to avoid refresh repeats + smooth display) --------------------
  let lastDisplayedTime = localStorage.getItem("lastDisplayedTime") || 0;
  const last = attendance.history[0];
  if(last && last.time > lastDisplayedTime) {
    const now = Date.now();
    // Only show alerts if event is very recent (5 seconds)
    if(now - last.time <= 5000) {
      showVCAlert(`${last.user} ${last.type === "join" ? "joined" : "left"} ${last.channel}`, last.type);
    }
    lastDisplayedTime = last.time;
    localStorage.setItem("lastDisplayedTime", lastDisplayedTime);
  }
});

// -------------------- IMAGE UPLOADER --------------------
const imageInput = document.getElementById("imageInput");
const imageTableBody = document.querySelector("#imageTable tbody");
const notification = document.getElementById("notification");
const messageInput = document.getElementById("imageMessage");
let uploadedImages = JSON.parse(localStorage.getItem("uploadedImages") || "[]");
renderImageTable();

function uploadImages() {
  const files = Array.from(imageInput.files);
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedImages.push({ name:file.name, dataURL:e.target.result, status:"Pending" });
      saveAndRender();
    };
    reader.readAsDataURL(file);
  });
  imageInput.value = "";
}

function renderImageTable() {
  imageTableBody.innerHTML = "";
  uploadedImages.forEach(img => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><img src="${img.dataURL}" style="max-width:50px;max-height:50px;"></td><td>${img.name}</td><td>${img.status}</td>`;
    imageTableBody.appendChild(tr);
  });
}

function saveAndRender() {
  localStorage.setItem("uploadedImages", JSON.stringify(uploadedImages));
  renderImageTable();
}

function clearImageTable() {
  uploadedImages = [];
  saveAndRender();
  notification.style.display = "none";
  messageInput.value = "";
}

async function captureVCPannel() {
  const panel = document.querySelector(".panel:first-child");
  const canvas = await html2canvas(panel);
  const dataURL = canvas.toDataURL("image/png");
  uploadedImages.push({ name:`VC_Attendance_${Date.now()}.png`, dataURL, status:"Pending" });
  saveAndRender();
}

async function sendImagesToDiscord() {
  if(uploadedImages.length===0) return alert("No images to send!");
  const message = messageInput.value.trim() || "Attendance Today has been uploaded!";
  await captureVCPannel();
  fetch("https://vc-attendance.onrender.com/upload-images", {
    method:"POST",
    body: JSON.stringify({ images: uploadedImages, message }),
    headers: { "Content-Type":"application/json" }
  }).then(res=>res.json()).then(res=>{
    if(res.success){
      uploadedImages.forEach(img=>img.status="Sent");
      saveAndRender();
      notification.style.display="block";
      setTimeout(()=>clearImageTable(),15000);
    } else alert("Failed to send images.");
  }).catch(err=>console.error(err));
}

function toggleHistoryPanel() {
  historyDiv.style.display = historyDiv.style.display === "none" ? "block" : "none";
}

// -------------------- ADMIN LOGIN --------------------
const adminBtn = document.getElementById("adminBtn");
const adminPassword = document.getElementById("adminPassword");
const logoutBtn = document.getElementById("logoutBtn");
const imagePanel = document.getElementById("imagePanel");
const adminStatus = document.getElementById("adminStatus");
let adminLoggedIn = localStorage.getItem("adminLoggedIn") === "true";

function updateAdminStatus(){
  adminStatus.style.display = adminLoggedIn ? "inline-block" : "none";
}

function showPasswordInput(){
  adminPassword.style.display="inline-block";
  adminPassword.focus();
  setTimeout(()=>{ adminPassword.style.display="none"; }, 10000);
}

adminBtn.addEventListener("click", ()=>{ showPasswordInput(); });

adminPassword.addEventListener("keyup", e=>{
  if(e.key === "Enter" && adminPassword.value === "0212"){
    adminLoggedIn = true;
    localStorage.setItem("adminLoggedIn", "true");
    imagePanel.style.display="block";
    logoutBtn.style.display="inline-block";
    adminBtn.style.display="none";
    adminPassword.style.display="none";
    updateAdminStatus();
  }
});

if(adminLoggedIn){
  imagePanel.style.display="block";
  logoutBtn.style.display="inline-block";
  adminBtn.style.display="none";
  updateAdminStatus();
}

logoutBtn.addEventListener("click", ()=>{
  adminLoggedIn = false;
  localStorage.setItem("adminLoggedIn","false");
  imagePanel.style.display="none";
  logoutBtn.style.display="none";
  adminBtn.style.display="inline-block";
  updateAdminStatus();
});
</script>

<!-- ---------- NEW: Main Panel behavior (announcement, market parsing, screenshots, references) ---------- -->
<script>
/*
  This script adds the admin-only Main Panel features:
  - Announcement (textarea → persisted to localStorage)
  - Market Excel import (.xlsx/.xls/.csv) or link import, parsed to Date/Item/Price, saved in localStorage
  - Market screenshots (side-by-side) persisted to localStorage
  - Reference links list persisted to localStorage
  It relies on the existing adminLoggedIn variable and admin login flow above.
*/

// LocalStorage keys
const LS_ANN = "zyg_announcement";
const LS_MARKET = "zyg_market";
const LS_MARKET_SCREENS = "zyg_market_screens";
const LS_REFS = "zyg_refs";

// DOM refs
const announcementInput = document.getElementById("announcementInput");
const saveAnnouncementBtn = document.getElementById("saveAnnouncementBtn");
const clearAnnouncementBtn = document.getElementById("clearAnnouncementBtn");
const announcementView = document.getElementById("announcementView");

const marketExcelInput = document.getElementById("marketExcelInput");
const marketLinkInput = document.getElementById("marketLinkInput");
const importMarketBtn = document.getElementById("importMarketBtn");
const clearMarketBtn = document.getElementById("clearMarketBtn");
const marketTableBody = document.querySelector("#marketTable tbody");

const marketScreensInput = document.getElementById("marketScreensInput");
const uploadMarketScreensBtn = document.getElementById("uploadMarketScreensBtn");
const clearMarketScreensBtn = document.getElementById("clearMarketScreensBtn");
const marketScreensGallery = document.getElementById("marketScreensGallery");

const refLinkInput = document.getElementById("refLinkInput");
const addRefBtn = document.getElementById("addRefBtn");
const refsList = document.getElementById("refsList");

const marketAdminControls = document.getElementById("marketAdminControls");

// Load state from localStorage
let announcement = localStorage.getItem(LS_ANN) || "";
let marketData = JSON.parse(localStorage.getItem(LS_MARKET) || "[]");
let marketScreens = JSON.parse(localStorage.getItem(LS_MARKET_SCREENS) || "[]");
let refs = JSON.parse(localStorage.getItem(LS_REFS) || "[]");

// Render functions
function renderAnnouncement(){
  announcementView.textContent = announcement || "No announcements yet.";
  // hide textarea when not admin: handled by toggleAdminElements
}
renderAnnouncement();

function renderMarketTable(){
  marketTableBody.innerHTML = "";
  marketData.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${escapeHtml(row.date)}</td><td>${escapeHtml(row.item)}</td><td>${escapeHtml(row.price)}</td>`;
    marketTableBody.appendChild(tr);
  });
}
renderMarketTable();

function renderMarketScreens(){
  marketScreensGallery.innerHTML = "";
  marketScreens.forEach((s, idx) => {
    const img = document.createElement("img");
    img.src = s.dataURL;
    img.title = s.name;
    img.dataset.idx = idx;
    marketScreensGallery.appendChild(img);

    // allow admin to delete by right-click/contextmenu
    img.addEventListener("contextmenu", (ev) => {
      ev.preventDefault();
      if(!adminLoggedIn) return;
      if(confirm("Delete this screenshot?")) {
        marketScreens.splice(idx,1);
        saveMarketScreens();
        renderMarketScreens();
      }
    });
  });
}
renderMarketScreens();

function renderRefs(){
  refsList.innerHTML = "";
  refs.forEach((r, idx) => {
    const div = document.createElement("div");
    div.style.display = "flex";
    div.style.justifyContent = "space-between";
    div.style.alignItems = "center";
    div.style.padding = "6px 0";
    div.style.borderBottom = "1px solid #21262d";
    div.innerHTML = `<a href="${escapeHtml(r.link)}" target="_blank" rel="noopener" style="color:#9fd4ff;">${escapeHtml(r.name || r.link)}</a>
      ${adminLoggedIn ? `<button data-idx="${idx}" class="delRefBtn">Remove</button>` : ""}`;
    refsList.appendChild(div);
  });

  document.querySelectorAll(".delRefBtn").forEach(btn=>{
    btn.addEventListener("click", (e) => {
      const i = Number(e.currentTarget.dataset.idx);
      if(!confirm("Remove this reference?")) return;
      refs.splice(i,1);
      saveRefs();
      renderRefs();
    });
  });
}
renderRefs();

// helpers
function saveAnnouncement(){
  localStorage.setItem(LS_ANN, announcement);
}
function saveMarket(){
  localStorage.setItem(LS_MARKET, JSON.stringify(marketData));
}
function saveMarketScreens(){
  localStorage.setItem(LS_MARKET_SCREENS, JSON.stringify(marketScreens));
}
function saveRefs(){
  localStorage.setItem(LS_REFS, JSON.stringify(refs));
}
function escapeHtml(text){
  if(!text) return "";
  return String(text).replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m];});
}

// Announcement actions
saveAnnouncementBtn.addEventListener("click", ()=>{
  announcement = (announcementInput.value || "").trim();
  saveAnnouncement();
  renderAnnouncement();
  announcementInput.value = "";
  // if non-admin view: will remain visible
});

clearAnnouncementBtn.addEventListener("click", ()=>{
  if(!confirm("Clear announcement?")) return;
  announcement = "";
  localStorage.removeItem(LS_ANN);
  renderAnnouncement();
});

// Market import: support CSV and XLSX/XLS via SheetJS
async function parseFileToRows(file){
  const name = (file.name||"").toLowerCase();
  if(name.endsWith(".csv")){
    const text = await file.text();
    return parseCSVText(text);
  } else {
    const ab = await file.arrayBuffer();
    const wb = XLSX.read(ab, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    return normalizeRows(json);
  }
}
function parseCSVText(text){
  const lines = text.split(/\r\n|\n/).filter(l=>l.trim()!=="");
  if(lines.length === 0) return [];
  const headers = lines[0].split(",").map(h=>h.trim().toLowerCase());
  const rows = lines.slice(1).map(line=>{
    const cols = line.split(",").map(c=>c.trim());
    const obj = {};
    headers.forEach((h,i)=> obj[h] = cols[i] || "");
    return obj;
  });
  return normalizeRows(rows);
}
function normalizeRows(rows){
  // Map any row object to {date, item, price}
  return rows.map(r=>{
    const keys = Object.keys(r);
    const lower = {};
    keys.forEach(k=> lower[k.toLowerCase()] = k);
    const dateKey = lower["date"] || lower["day"] || keys[0];
    const itemKey = lower["item"] || lower["name"] || keys[1];
    const priceKey = lower["price"] || lower["amount"] || keys[2];
    return {
      date: r[dateKey] !== undefined ? r[dateKey] : "",
      item: r[itemKey] !== undefined ? r[itemKey] : "",
      price: r[priceKey] !== undefined ? r[priceKey] : ""
    };
  });
}

// Handle file import
marketExcelInput.addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if(!f) return;
  try{
    const rows = await parseFileToRows(f);
    if(rows.length){
      marketData = marketData.concat(rows);
      saveMarket();
      renderMarketTable();
      alert("Imported " + rows.length + " rows into Market.");
    } else alert("No rows parsed.");
  }catch(err){
    console.error(err);
    alert("Failed to parse file.");
  }
  marketExcelInput.value = "";
});

// Import from link (fetch + parse)
importMarketBtn.addEventListener("click", async ()=>{
  const url = (marketLinkInput.value||"").trim();
  if(!url) return alert("Paste a valid link.");
  try{
    const resp = await fetch(url);
    if(!resp.ok) throw new Error("Network error");
    const ct = resp.headers.get("content-type") || "";
    if(ct.includes("text/csv") || url.toLowerCase().endsWith(".csv")){
      const text = await resp.text();
      const rows = parseCSVText(text);
      marketData = marketData.concat(rows);
    } else {
      const ab = await resp.arrayBuffer();
      const wb = XLSX.read(ab, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const rows = normalizeRows(json);
      marketData = marketData.concat(rows);
    }
    saveMarket();
    renderMarketTable();
    alert("Imported from link.");
  }catch(err){
    console.error(err);
    alert("Failed to fetch/parse the link (CORS may block some URLs).");
  }
  marketLinkInput.value = "";
});

// Clear market
clearMarketBtn.addEventListener("click", ()=>{
  if(!confirm("Clear all market data?")) return;
  marketData = [];
  saveMarket();
  renderMarketTable();
});

// Market images (screenshots for excel)
uploadMarketScreensBtn.addEventListener("click", ()=>{
  const files = Array.from(marketScreensInput.files || []);
  if(files.length === 0) return alert("No images selected.");
  files.forEach(f=>{
    const reader = new FileReader();
    reader.onload = (e) => {
      marketScreens.push({ name: f.name, dataURL: e.target.result });
      saveMarketScreens();
      renderMarketScreens();
    };
    reader.readAsDataURL(f);
  });
  marketScreensInput.value = "";
});

clearMarketScreensBtn.addEventListener("click", ()=>{
  if(!confirm("Clear all market screenshots?")) return;
  marketScreens = [];
  saveMarketScreens();
  renderMarketScreens();
});

// References
addRefBtn.addEventListener("click", ()=>{
  const url = (refLinkInput.value||"").trim();
  if(!url) return alert("Enter a link.");
  const name = url.split("/").pop() || url;
  refs.push({ link: url, name });
  saveRefs();
  renderRefs();
  refLinkInput.value = "";
});

// initial render calls done above

// Admin-only visibility: show/hide inputs/buttons depending on adminLoggedIn
function toggleAdminElements(show) {
  // announcement inputs
  announcementInput.style.display = show ? "block" : "none";
  saveAnnouncementBtn.style.display = show ? "inline-block" : "none";
  clearAnnouncementBtn.style.display = show ? "inline-block" : "none";
  // market admin
  const adminElems = [marketExcelInput, marketLinkInput, importMarketBtn, clearMarketBtn, marketScreensInput, uploadMarketScreensBtn, clearMarketScreensBtn, refLinkInput, addRefBtn];
  adminElems.forEach(el => { if(el) el.style.display = show ? "block" : "none"; });
  // also show delete controls for refs (renderRefs will add remove buttons when adminLoggedIn is true)
  renderRefs();
}

// run once to reflect current admin state
toggleAdminElements(adminLoggedIn);

// re-run toggle when admin signs in/out
// we hook into the existing admin login changes by overriding updateAdminStatus to also toggle these elements
(function wrapUpdateAdminStatus(){
  const original = updateAdminStatus;
  updateAdminStatus = function(){
    original();
    toggleAdminElements(adminLoggedIn);
  };
})();

</script>
