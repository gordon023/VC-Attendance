// ==================== SOCKET CONNECTION ====================
const socket = io(); // ensure your server emits voice activity

socket.on("voiceUpdate", (data) => {
  const tbody = document.querySelector("#active tbody");
  tbody.innerHTML = "";
  data.forEach((entry) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${entry.user}</td>
      <td>${entry.channel}</td>
      <td>${entry.status}</td>
      <td>${entry.duration}</td>
    `;
    tbody.appendChild(tr);
  });
});

// ==================== ADMIN LOGIN SYSTEM ====================
const adminBtn = document.getElementById("adminBtn");
const adminPassword = document.getElementById("adminPassword");
const logoutBtn = document.getElementById("logoutBtn");
const adminStatus = document.getElementById("adminStatus");

let isAdmin = localStorage.getItem("isAdmin") === "true";

// toggle UI visibility
function toggleAdminElements(show) {
  document.querySelectorAll(".hidden").forEach((el) => {
    // only show if marked as hidden and required for admin
    if (show && el.id && !["adminStatus", "adminPassword"].includes(el.id)) {
      el.classList.remove("hidden");
    }
  });
  if (show) {
    adminStatus.classList.remove("hidden");
    adminBtn.classList.add("hidden");
    adminPassword.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
  } else {
    adminStatus.classList.add("hidden");
    adminBtn.classList.remove("hidden");
    adminPassword.classList.add("hidden");
    logoutBtn.classList.add("hidden");

    // hide admin-only controls again
    document.querySelectorAll("#mainPanel input, #mainPanel textarea, #mainPanel button").forEach((el) => {
      if (el.id !== "adminBtn" && el.id !== "logoutBtn" && el.id !== "adminPassword") {
        el.classList.add("hidden");
      }
    });
  }
}

// initial visibility
toggleAdminElements(isAdmin);

// admin login
adminBtn.addEventListener("click", () => {
  adminPassword.classList.toggle("hidden");
  const val = adminPassword.value.trim();
  if (val === "1234") { // replace with your real admin password
    isAdmin = true;
    localStorage.setItem("isAdmin", "true");
    toggleAdminElements(true);
  }
});

// logout
logoutBtn.addEventListener("click", () => {
  isAdmin = false;
  localStorage.setItem("isAdmin", "false");
  toggleAdminElements(false);
});

// ==================== ANNOUNCEMENT ====================
const announcementInput = document.getElementById("announcementInput");
const announcementDisplay = document.getElementById("announcementDisplay");
const saveAnnouncementBtn = document.getElementById("saveAnnouncementBtn");
const clearAnnouncementBtn = document.getElementById("clearAnnouncementBtn");

function loadAnnouncement() {
  const text = localStorage.getItem("announcement");
  if (text) {
    announcementDisplay.textContent = text;
  }
}
loadAnnouncement();

saveAnnouncementBtn.addEventListener("click", () => {
  const text = announcementInput.value.trim();
  if (text) {
    localStorage.setItem("announcement", text);
    announcementDisplay.textContent = text;
    announcementInput.value = "";
  }
});

clearAnnouncementBtn.addEventListener("click", () => {
  localStorage.removeItem("announcement");
  announcementDisplay.textContent = "";
});

// ==================== MARKET UPLOAD ====================
const marketExcelInput = document.getElementById("marketExcelInput");
const marketLinkInput = document.getElementById("marketLinkInput");
const importMarketBtn = document.getElementById("importMarketBtn");
const clearMarketBtn = document.getElementById("clearMarketBtn");
const marketTableBody = document.querySelector("#marketTable tbody");

// load from localStorage
function loadMarketData() {
  const saved = JSON.parse(localStorage.getItem("marketData") || "[]");
  marketTableBody.innerHTML = "";
  saved.forEach((row) => addMarketRow(row.date, row.item, row.price));
}
loadMarketData();

function addMarketRow(date, item, price) {
  const tr = document.createElement("tr");
  tr.innerHTML = `<td>${date}</td><td>${item}</td><td>${price}</td>`;
  marketTableBody.appendChild(tr);
}

importMarketBtn.addEventListener("click", () => {
  const file = marketExcelInput.files[0];
  if (!file) return alert("Please upload a file.");
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet);
    localStorage.setItem("marketData", JSON.stringify(json));
    loadMarketData();
  };
  reader.readAsArrayBuffer(file);
});

clearMarketBtn.addEventListener("click", () => {
  localStorage.removeItem("marketData");
  marketTableBody.innerHTML = "";
});

// ==================== MARKET SCREENSHOTS ====================
const marketScreensInput = document.getElementById("marketScreensInput");
const uploadMarketScreensBtn = document.getElementById("uploadMarketScreensBtn");
const clearMarketScreensBtn = document.getElementById("clearMarketScreensBtn");
const screenshotTableBody = document.querySelector("#screenshotTable tbody");

function loadScreenshots() {
  const imgs = JSON.parse(localStorage.getItem("screenshots") || "[]");
  screenshotTableBody.innerHTML = "";
  imgs.forEach((src) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><img src="${src}" style="width:60px"></td><td>Saved</td><td>✅</td>`;
    screenshotTableBody.appendChild(tr);
  });
}
loadScreenshots();

uploadMarketScreensBtn.addEventListener("click", () => {
  const files = [...marketScreensInput.files];
  if (!files.length) return;
  const stored = JSON.parse(localStorage.getItem("screenshots") || "[]");
  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      stored.push(e.target.result);
      localStorage.setItem("screenshots", JSON.stringify(stored));
      loadScreenshots();
    };
    reader.readAsDataURL(file);
  });
});

clearMarketScreensBtn.addEventListener("click", () => {
  localStorage.removeItem("screenshots");
  screenshotTableBody.innerHTML = "";
});

// ==================== REFERENCE LINKS ====================
const refLinkInput = document.getElementById("refLinkInput");
const addRefBtn = document.getElementById("addRefBtn");
const refLinksList = document.getElementById("refLinksList");

function loadRefLinks() {
  const links = JSON.parse(localStorage.getItem("refLinks") || "[]");
  refLinksList.innerHTML = "";
  links.forEach((url) => {
    const li = document.createElement("li");
    li.innerHTML = `<a href="${url}" target="_blank">${url}</a>`;
    refLinksList.appendChild(li);
  });
}
loadRefLinks();

addRefBtn.addEventListener("click", () => {
  const val = refLinkInput.value.trim();
  if (val) {
    const links = JSON.parse(localStorage.getItem("refLinks") || "[]");
    links.push(val);
    localStorage.setItem("refLinks", JSON.stringify(links));
    refLinkInput.value = "";
    loadRefLinks();
  }
});
