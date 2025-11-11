// ================= SOCKET.IO =================
const socket = io();
let attendance = {};
const activeBody = document.querySelector("#active tbody");
const historyDiv = document.querySelector("#history");
const vcAlert = document.getElementById("vcAlert");

// -------- VC ALERT --------
function showVCAlert(message, type) {
  vcAlert.textContent = message;
  vcAlert.style.color = type === "join" ? "#2ea043" : "#da3633";
  vcAlert.style.display = "block";
  setTimeout(() => (vcAlert.style.display = "none"), 5000);
}

// -------- ACTIVE VC --------
function updateActive() {
  activeBody.innerHTML = "";
  const now = new Date();
  Object.entries(attendance.active || {}).forEach(([user, info]) => {
    const joined = new Date(info.joinedAt || Date.now());
    const durationSec = Math.floor((now - joined) / 1000);
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
  (attendance.history || []).slice(0, 20).forEach((h) => {
    const div = document.createElement("div");
    const time = new Date(h.time).toLocaleTimeString();
    const typeClass = h.type === "join" ? "joined" : "left";
    const action = h.type === "join" ? "joined" : "left";
    div.innerHTML = `<span class="${typeClass}">${h.user}</span> ${action} <b>${h.channel}</b> at ${time}`;
    historyDiv.appendChild(div);
  });
}

function formatDuration(sec) {
  const h = Math.floor(sec / 3600),
    m = Math.floor((sec % 3600) / 60),
    s = sec % 60;
  return `${h.toString().padStart(2, "0")}:${m
    .toString()
    .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

setInterval(updateActive, 1000);

socket.on("connect", () => console.log("✅ Connected to server"));
socket.on("update", (data) => {
  attendance = data;
  updateActive();
  updateHistory();

  // smooth VC alert
  const last = attendance.history?.[0];
  if (last) {
    const shown = +localStorage.getItem("lastDisplayedTime") || 0;
    if (last.time > shown && Date.now() - last.time < 5000) {
      showVCAlert(
        `${last.user} ${last.type === "join" ? "joined" : "left"} ${last.channel}`,
        last.type
      );
      localStorage.setItem("lastDisplayedTime", last.time);
    }
  }
});

// ================= IMAGE UPLOADER =================
const imageInput = document.getElementById("imageInput");
const imageTableBody = document.querySelector("#imageTable tbody");
const notification = document.getElementById("notification");
const messageInput = document.getElementById("imageMessage");
let uploadedImages = JSON.parse(localStorage.getItem("uploadedImages") || "[]");
renderImageTable();

function uploadImages() {
  const files = Array.from(imageInput.files);
  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedImages.push({
        name: file.name,
        dataURL: e.target.result,
        status: "Pending",
      });
      saveAndRender();
    };
    reader.readAsDataURL(file);
  });
  imageInput.value = "";
}

function renderImageTable() {
  imageTableBody.innerHTML = "";
  uploadedImages.forEach((img) => {
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
  uploadedImages.push({
    name: `VC_Attendance_${Date.now()}.png`,
    dataURL,
    status: "Pending",
  });
  saveAndRender();
}

async function sendImagesToDiscord() {
  if (uploadedImages.length === 0) return alert("No images to send!");
  const message =
    messageInput.value.trim() || "Attendance Today has been uploaded!";
  await captureVCPannel();
  fetch("https://vc-attendance.onrender.com/upload-images", {
    method: "POST",
    body: JSON.stringify({ images: uploadedImages, message }),
    headers: { "Content-Type": "application/json" },
  })
    .then((r) => r.json())
    .then((res) => {
      if (res.success) {
        uploadedImages.forEach((i) => (i.status = "Sent"));
        saveAndRender();
        notification.style.display = "block";
        setTimeout(() => clearImageTable(), 15000);
      } else alert("Failed to send images.");
    })
    .catch(console.error);
}

function toggleHistoryPanel() {
  historyDiv.style.display =
    historyDiv.style.display === "none" ? "block" : "none";
}

// ================= ADMIN LOGIN =================
// ================= ADMIN LOGIN =================
const adminBtn = document.getElementById("adminBtn");
const adminPassword = document.getElementById("adminPassword");
const logoutBtn = document.getElementById("logoutBtn");
const imagePanel = document.getElementById("imagePanel");
const adminStatus = document.getElementById("adminStatus");
let adminLoggedIn = localStorage.getItem("adminLoggedIn") === "true";

// when DOM is fully ready
document.addEventListener("DOMContentLoaded", () => {
  updateAdminUI();
});

function updateAdminStatus() {
  adminStatus.style.display = adminLoggedIn ? "inline-block" : "none";
}

// Hide/show all admin-only panels
function toggleAdminPanels(show) {
  const ids = [
    annInput, annSave, annClear,
    marketExcel, marketLink, marketImport, marketClear,
    ssInput, ssUpload, ssClear,
    refInput, refAdd
  ];
  ids.forEach((el) => {
    if (el) el.style.display = show ? "block" : "none";
  });
}

function updateAdminUI() {
  if (adminLoggedIn) {
    imagePanel.style.display = "block";
    logoutBtn.style.display = "inline-block";
    adminBtn.style.display = "none";
    adminPassword.style.display = "none";
    toggleAdminPanels(true);
  } else {
    imagePanel.style.display = "none";
    logoutBtn.style.display = "none";
    adminBtn.style.display = "inline-block";
    adminPassword.style.display = "none";
    toggleAdminPanels(false);
  }
  updateAdminStatus();
}

// show password input
adminBtn.addEventListener("click", () => {
  adminPassword.style.display = "inline-block";
  adminPassword.focus();
});

// when pressing enter in password
adminPassword.addEventListener("keyup", (e) => {
  if (e.key === "Enter") {
    if (adminPassword.value === "0212") {
      adminLoggedIn = true;
      localStorage.setItem("adminLoggedIn", "true");
      adminPassword.value = "";
      updateAdminUI();
    } else {
      alert("❌ Incorrect password");
    }
  }
});

// logout button
logoutBtn.addEventListener("click", () => {
  adminLoggedIn = false;
  localStorage.setItem("adminLoggedIn", "false");
  updateAdminUI();
});


// ================= MAIN PANEL (Announcement / Market / References) =================
const annInput = document.getElementById("announcementInput");
const annSave = document.getElementById("saveAnnouncementBtn");
const annClear = document.getElementById("clearAnnouncementBtn");
const annDisplay = document.getElementById("announcementDisplay");

const marketExcel = document.getElementById("marketExcelInput");
const marketLink = document.getElementById("marketLinkInput");
const marketImport = document.getElementById("importMarketBtn");
const marketClear = document.getElementById("clearMarketBtn");
const marketTableBody = document.querySelector("#marketTable tbody");

const ssInput = document.getElementById("marketScreensInput");
const ssUpload = document.getElementById("uploadMarketScreensBtn");
const ssClear = document.getElementById("clearMarketScreensBtn");
const ssTableBody = document.querySelector("#screenshotTable tbody");

const refInput = document.getElementById("refLinkInput");
const refAdd = document.getElementById("addRefBtn");
const refList = document.getElementById("refLinksList");

function toggleAdminPanels(show) {
  const ids = [
    annInput,
    annSave,
    annClear,
    marketExcel,
    marketLink,
    marketImport,
    marketClear,
    ssInput,
    ssUpload,
    ssClear,
    refInput,
    refAdd,
  ];
  ids.forEach((el) => {
    if (el) el.style.display = show ? "block" : "none";
  });
}

// -------- Announcement --------
annSave?.addEventListener("click", () => {
  const text = annInput.value.trim();
  if (text) {
    localStorage.setItem("announcement", text);
    annDisplay.textContent = text;
    annInput.value = "";
  }
});
annClear?.addEventListener("click", () => {
  localStorage.removeItem("announcement");
  annDisplay.textContent = "";
});
(function loadAnnouncement() {
  const text = localStorage.getItem("announcement");
  if (text) annDisplay.textContent = text;
})();

// -------- Market Import --------
marketImport?.addEventListener("click", () => {
  const file = marketExcel.files[0];
  if (!file) return alert("Please upload an Excel file.");
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet);
    localStorage.setItem("marketData", JSON.stringify(json));
    loadMarketTable();
  };
  reader.readAsArrayBuffer(file);
});
marketClear?.addEventListener("click", () => {
  localStorage.removeItem("marketData");
  marketTableBody.innerHTML = "";
});
function loadMarketTable() {
  const data = JSON.parse(localStorage.getItem("marketData") || "[]");
  marketTableBody.innerHTML = "";
  data.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r.Date || ""}</td><td>${r.Item || ""}</td><td>${r.Price || ""}</td>`;
    marketTableBody.appendChild(tr);
  });
}
loadMarketTable();

// -------- Market Screenshots --------
ssUpload?.addEventListener("click", () => {
  const files = [...ssInput.files];
  if (!files.length) return;
  const stored = JSON.parse(localStorage.getItem("marketScreens") || "[]");
  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      stored.push(e.target.result);
      localStorage.setItem("marketScreens", JSON.stringify(stored));
      loadMarketScreens();
    };
    reader.readAsDataURL(file);
  });
});
ssClear?.addEventListener("click", () => {
  localStorage.removeItem("marketScreens");
  ssTableBody.innerHTML = "";
});
function loadMarketScreens() {
  const imgs = JSON.parse(localStorage.getItem("marketScreens") || "[]");
  ssTableBody.innerHTML = "";
  imgs.forEach((src) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><img src="${src}" style="width:60px"></td><td>Saved</td>`;
    ssTableBody.appendChild(tr);
  });
}
loadMarketScreens();

// -------- Reference Links --------
refAdd?.addEventListener("click", () => {
  const val = refInput.value.trim();
  if (val) {
    const links = JSON.parse(localStorage.getItem("refLinks") || "[]");
    links.push(val);
    localStorage.setItem("refLinks", JSON.stringify(links));
    refInput.value = "";
    loadRefLinks();
  }
});
function loadRefLinks() {
  const links = JSON.parse(localStorage.getItem("refLinks") || "[]");
  refList.innerHTML = "";
  links.forEach((url) => {
    const li = document.createElement("li");
    li.innerHTML = `<a href="${url}" target="_blank">${url}</a>`;
    refList.appendChild(li);
  });
}
loadRefLinks();
