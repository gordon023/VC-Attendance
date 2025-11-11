document.addEventListener("DOMContentLoaded", () => {
  // -------------------- SOCKET.IO --------------------
  const socket = io();
  let attendance = {};
  const activeBody = document.querySelector("#active tbody");
  const historyDiv = document.getElementById("history");
  const vcAlert = document.getElementById("vcAlert");

  // -------------------- VC ALERT --------------------
  function showVCAlert(message, type) {
    vcAlert.textContent = message;
    vcAlert.style.color = type === "join" ? "#2ea043" : "#da3633";
    vcAlert.style.display = "block";
    setTimeout(() => (vcAlert.style.display = "none"), 5000);
  }

  // -------------------- ACTIVE VC --------------------
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
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s
      .toString()
      .padStart(2, "0")}`;
  }

  setInterval(updateActive, 1000);

  socket.on("connect", () => console.log("✅ Connected to server"));
  socket.on("update", (data) => {
    const oldHistory = attendance.history || [];
    attendance = data;
    updateActive();
    updateHistory();

    // VC alert for recent events
    const last = attendance.history[0];
    if (last) {
      const now = Date.now();
      if (now - last.time <= 5000) showVCAlert(`${last.user} ${last.type === "join" ? "joined" : "left"} ${last.channel}`, last.type);
    }
  });

  // -------------------- IMAGE UPLOADER --------------------
  const imageInput = document.getElementById("marketScreensInput");
  const imageTableBody = document.querySelector("#screenshotTable tbody");
  const messageInput = document.getElementById("imageMessage"); // optional: add <input id="imageMessage">
  let uploadedImages = JSON.parse(localStorage.getItem("uploadedImages") || "[]");

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

  function uploadImages() {
    const files = Array.from(imageInput.files);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        uploadedImages.push({ name: file.name, dataURL: e.target.result, status: "Pending" });
        saveAndRender();
      };
      reader.readAsDataURL(file);
    });
    imageInput.value = "";
  }

  async function captureVCPannel() {
    const panel = document.querySelector(".panel:first-child");
    const canvas = await html2canvas(panel);
    const dataURL = canvas.toDataURL("image/png");
    uploadedImages.push({ name: `VC_Attendance_${Date.now()}.png`, dataURL, status: "Pending" });
    saveAndRender();
  }

  async function sendImagesToDiscord() {
    if (uploadedImages.length === 0) return alert("No images to send!");
    const message = messageInput?.value.trim() || "Attendance Today has been uploaded!";
    await captureVCPannel();
    fetch("https://vc-attendance.onrender.com/upload-images", {
      method: "POST",
      body: JSON.stringify({ images: uploadedImages, message }),
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.success) {
          uploadedImages.forEach((img) => (img.status = "Sent"));
          saveAndRender();
          setTimeout(() => {
            uploadedImages = [];
            saveAndRender();
          }, 15000);
        } else alert("Failed to send images.");
      })
      .catch((err) => console.error(err));
  }

  imageInput?.addEventListener("change", uploadImages);

  // -------------------- ADMIN LOGIN --------------------
  const adminBtn = document.getElementById("adminBtn");
  const adminPassword = document.getElementById("adminPassword");
  const logoutBtn = document.getElementById("logoutBtn");
  const adminStatus = document.getElementById("adminStatus");

  let adminLoggedIn = localStorage.getItem("adminLoggedIn") === "true";

  function updateAdminUI() {
    adminStatus.style.display = adminLoggedIn ? "inline-block" : "none";
    adminBtn.style.display = adminLoggedIn ? "none" : "inline-block";
    logoutBtn.style.display = adminLoggedIn ? "inline-block" : "none";

    // Show/hide all admin-only elements
    const adminElements = document.querySelectorAll(
      "#announcementInput, #saveAnnouncementBtn, #clearAnnouncementBtn, " +
        "#marketExcelInput, #marketLinkInput, #importMarketBtn, #clearMarketBtn, " +
        "#marketScreensInput, #uploadMarketScreensBtn, #clearMarketScreensBtn, " +
        "#refLinkInput, #addRefBtn"
    );
    adminElements.forEach((el) => el.classList.toggle("hidden", !adminLoggedIn));
  }

  updateAdminUI();

  adminBtn.addEventListener("click", () => {
    adminPassword.classList.remove("hidden");
    adminPassword.focus();
  });

  adminPassword.addEventListener("keyup", (e) => {
    if (e.key === "Enter") {
      if (adminPassword.value.trim() === "0212") {
        adminLoggedIn = true;
        localStorage.setItem("adminLoggedIn", "true");
        adminPassword.value = "";
        adminPassword.classList.add("hidden");
        updateAdminUI();
      } else {
        alert("❌ Incorrect password");
      }
    }
  });

  logoutBtn.addEventListener("click", () => {
    adminLoggedIn = false;
    localStorage.setItem("adminLoggedIn", "false");
    updateAdminUI();
  });
});
