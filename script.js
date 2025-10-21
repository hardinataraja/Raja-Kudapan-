import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, doc,
  query, orderBy, onSnapshot, where
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// --- Firebase ---
const firebaseConfig = {
  apiKey: "AIzaSyC7VFvAsqRjiYinzfUfwabqHVvMWsvVhFo",
  authDomain: "raja-kudapan.firebaseapp.com",
  projectId: "raja-kudapan",
  storageBucket: "raja-kudapan.firebasestorage.app",
  messagingSenderId: "61175543723",
  appId: "1:61175543723:web:57d4a4f64480cb7f4344ee",
  measurementId: "G-ZGFTZER9RJ"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const qs = (s) => document.querySelector(s);
let cart = [];
let unsubStatus = null;

if (document.body.id === "page-user") {
  const menuList = qs("#menuList");

  // --- Load menu dari Firestore ---
  async function loadMenus() {
    const snap = await getDocs(collection(db, "menus"));
    menuList.innerHTML = "";
    snap.forEach((d) => {
      const m = d.data();
      const img = m.image || "https://via.placeholder.com/400x300?text=No+Image";
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `
        <img src="${img}" alt="${m.name}">
        <h3>${m.name}</h3>
        <div class="price">Rp ${Number(m.price || 0).toLocaleString()}</div>
        <button class="btn" data-id="${d.id}" data-name="${m.name}" data-price="${m.price}">Tambah</button>
      `;
      div.querySelector("button").onclick = () => addToCart(d.id, m.name, m.price);
      menuList.appendChild(div);
    });
  }

  // --- Tambah ke keranjang ---
  function addToCart(id, name, price) {
    const ex = cart.find((x) => x.id === id);
    if (ex) ex.qty++;
    else cart.push({ id, name, price: Number(price), qty: 1 });
    updateCart();
    Swal.fire("Ditambahkan", `${name} ke keranjang`, "success");
  }

  function updateCart() {
    qs("#cartCount").textContent = cart.reduce((a, b) => a + b.qty, 0);
  }

  qs("#cartBtn").onclick = () => {
    if (!cart.length) return Swal.fire("Keranjang kosong");
    renderCart();
    qs("#checkoutWrap").style.display = "flex";
  };
  window.closeCheckout = () => (qs("#checkoutWrap").style.display = "none");

  function renderCart() {
    const el = qs("#cartItems");
    el.innerHTML = "";
    let total = 0;
    cart.forEach((i) => {
      el.innerHTML += `<div>${i.name} x${i.qty} - Rp ${(i.price * i.qty).toLocaleString()}</div>`;
      total += i.price * i.qty;
    });
    const kodeUnik = Math.floor(100 + Math.random() * 900);
    total += kodeUnik;
    el.innerHTML += `<hr><div style="font-weight:bold;">Kode Unik: ${kodeUnik}</div>`;
    qs("#cartTotal").textContent = total.toLocaleString();
    qs("#cartTotal").setAttribute("data-total", total);
  }

  // --- Tombol Bagikan Lokasi ---
  const btnLoc = document.getElementById("btnLoc");
  if (btnLoc) {
    btnLoc.addEventListener("click", async () => {
      if (!navigator.geolocation) {
        Swal.fire("Tidak tersedia", "Perangkat tidak mendukung lokasi", "error");
        return;
      }
      Swal.fire({ title: "Mengambil lokasi...", didOpen: () => Swal.showLoading() });
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          Swal.close();
          const lat = pos.coords.latitude,
            lon = pos.coords.longitude;
          const mapsLink = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
          document.getElementById("alamat").value += `\n${mapsLink}`;
          Swal.fire("Berhasil", "Link lokasi ditambahkan ke alamat", "success");
        },
        () => {
          Swal.close();
          Swal.fire("Gagal", "Tidak dapat mengambil lokasi", "error");
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  // --- Modal Pembayaran (ambil data merchant dari Firestore) ---
  qs("#lanjutBayar").onclick = async () => {
    const nama = qs("#nama").value.trim(),
      alamat = qs("#alamat").value.trim(),
      nohp = qs("#nohp").value.trim();
    if (!nama || !alamat || !nohp) return Swal.fire("Lengkapi data dulu");

    const total = Number(qs("#cartTotal").getAttribute("data-total") || 0);

    const snap = await getDocs(collection(db, "settings"));
    let data = {};
    snap.forEach((d) => (data = d.data()));

    let html = `<div style="text-align:left;">`;
    html += `<h4>${data.storeName || "Raja Kudapan"}</h4>`;
    html += `<p>Total: <strong>Rp ${total.toLocaleString()}</strong></p><hr>`;

    const payments = [
      { key: "rekeningBRI", label: "BRI" },
      { key: "rekeningBCA", label: "BCA" },
      { key: "dana", label: "DANA" },
      { key: "ovo", label: "OVO" },
      { key: "gopay", label: "GoPay" },
      { key: "linkaja", label: "LinkAja" },
    ];

    payments.forEach((p) => {
      if (data[p.key])
        html += `<div style="margin-bottom:6px;">
          <b>${p.label}</b><br>${data[p.key]} 
          <button class="btn-ghost" onclick='navigator.clipboard.writeText("${data[p.key]}");Swal.fire("Disalin","${data[p.key]}","success")'>📋</button>
        </div>`;
    });

    if (data.qris)
      html += `<hr><div style="text-align:center;">
        <img src="${data.qris}" alt="QRIS" style="max-width:240px;border-radius:8px;margin-top:10px;">
        <p style="font-size:0.9rem;color:#555;">Scan QRIS di atas untuk pembayaran</p>
      </div>`;

    html += `</div>`;

    const res = await Swal.fire({
      title: "Pembayaran",
      html,
      confirmButtonText: "Saya Sudah Bayar",
      showCancelButton: true,
      cancelButtonText: "Batal",
      width: window.innerWidth < 480 ? "95%" : 500,
    });

    if (res.isConfirmed) {
      qs("#checkoutWrap").style.display = "none";
      await buatPesanan(nama, alamat, nohp, total);
    }
  };

  // --- Simpan Pesanan ke Firestore ---
  async function buatPesanan(nama, alamat, nohp, total) {
    const qSnap = await getDocs(query(collection(db, "orders"), orderBy("time", "desc")));
    let max = 0;
    qSnap.forEach((d) => {
      const m = d.data().code?.match(/RK-(\d+)/);
      if (m) {
        const n = parseInt(m[1]);
        if (n > max) max = n;
      }
    });
    const code = "RK-" + String(max + 1).padStart(5, "0");
    const order = {
      code,
      nama,
      alamat,
      nohp,
      items: cart,
      total,
      status: "pending",
      time: new Date().toISOString(),
    };
    await addDoc(collection(db, "orders"), order);
    cart = [];
    updateCart();
    Swal.fire("Pesanan dibuat", `Kode Pesanan: ${code}`, "success");
    showStatus(code, true);
  }

  // --- Status Pesanan (Realtime Update) ---
  async function showStatus(code, autoOpen = false) {
    const statusWrap = qs("#statusWrap");
    statusWrap.style.display = "flex";
    qs("#kodePesanan").textContent = code;
    qs("#statusSteps").innerHTML = "Memuat...";

    if (unsubStatus) unsubStatus();

    const q = query(collection(db, "orders"), where("code", "==", code));
    unsubStatus = onSnapshot(q, (snap) => {
      if (snap.empty) {
        qs("#statusSteps").innerHTML = "<p>Tidak ditemukan.</p>";
        return;
      }
      const order = snap.docs[0].data();
      const steps = ["pending", "processing", "delivering", "done"];
      qs("#statusSteps").innerHTML = steps
        .map((s) => {
          const cls =
            s === order.status
              ? "active"
              : steps.indexOf(s) < steps.indexOf(order.status)
              ? "done"
              : "";
          const label =
            s === "pending"
              ? "Menunggu Konfirmasi"
              : s === "processing"
              ? "Diproses"
              : s === "delivering"
              ? "Dalam Pengiriman"
              : "Selesai";
          return `<div class="status-step ${cls}"><div class="circle"></div>${label}</div>`;
        })
        .join("");
    });
  }

  // --- Cek Status Pesanan Manual ---
  qs("#btnStatus").onclick = () => {
    Swal.fire({
      title: "Cek Kode Pesanan",
      input: "text",
      inputLabel: "Masukkan kode pesanan",
      showCancelButton: true,
      confirmButtonText: "Lihat",
    }).then((r) => {
      if (r.isConfirmed && r.value) showStatus(r.value.trim().toUpperCase());
    });
  };

  // --- Copy & Tutup Modal Status ---
  const closeStatusBtn = qs("#closeStatus");
  if (closeStatusBtn)
    closeStatusBtn.addEventListener("click", () => {
      if (unsubStatus) unsubStatus();
      qs("#statusWrap").style.display = "none";
    });

  const copyKodeBtn = qs("#copyKode");
  if (copyKodeBtn)
    copyKodeBtn.addEventListener("click", () => {
      const kode = qs("#kodePesanan").textContent.trim();
      navigator.clipboard.writeText(kode);
      Swal.fire("Disalin", `Kode ${kode} telah disalin.`, "success");
    });

  // --- Load menu saat pertama ---
  loadMenus();
}