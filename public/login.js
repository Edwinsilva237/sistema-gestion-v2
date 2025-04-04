document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("formLogin").addEventListener("submit", async (e) => {
        e.preventDefault();
        const API_URL = "https://appgh-2z0e.onrender.com"; // URL del backend en Render
        const usuario = document.getElementById("usuario").value;
        const password = document.getElementById("password").value;
        
        console.log("🔍 Enviando datos:", { usuario, password });

        try {
            const response = await fetch(`${API_URL}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ usuario, password })
            });
            
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem("token", data.token);
                localStorage.setItem("usuario", usuario);
                localStorage.setItem("rol", data.rol);
                localStorage.setItem("idUsuario", data.id); // ✅ Esto es lo que faltaba

                
                // Redirigir siempre a produccion.html
                window.location.href = "produccion.html";
            } else {
                alert("❌ Error: " + data.error);
            }
        } catch (error) {
            console.error("❌ Error al iniciar sesión:", error);
            alert("⚠️ Error de conexión con el servidor.");
        }
    });

    document.getElementById("scanQR").addEventListener("click", iniciarSesionConQR);
});


async function iniciarSesionConQR() {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = stream;
        video.setAttribute("playsinline", true);
        document.body.appendChild(video);
        video.play();
        
        const scan = setInterval(async () => {
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = await jsQR(imageData.data, imageData.width, imageData.height);
                
                if (code) {
                    clearInterval(scan);
                    stream.getTracks().forEach(track => track.stop());
                    video.remove();
                    procesarQR(code.data);
                }
            }
        }, 500);
    } catch (err) {
        alert("⚠️ No se pudo acceder a la cámara");
    }
}

async function procesarQR(qrData) {
    const response = await fetch(`${API_URL}/login-qr?usuario=${qrData}`);

    const data = await response.json();
    
    if (response.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("usuario", data.usuario);
        localStorage.setItem("rol", data.rol);
        
        if (data.rol === "admin") {
            window.location.href = "admin.html";
        } else {
            window.location.href = "produccion.html";
        }
    } else {
        alert("❌ Error: " + data.error);
    }
}