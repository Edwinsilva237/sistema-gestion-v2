const API_URL = "https://appgh-2z0e.onrender.com";

const UBICACION_PERMITIDA = {
    lat: 19.4206,  // 📍 Ejemplo: Lat: 19.411763, Lon: -102.085427
    lon: -102.0744, // 📍 Ejemplo: Longitud de CDMX
    radio: 0.7        // 📍 Distancia permitida en kilómetros (100 metros)
};

let registros = []; // Almacena todos los registros para paginación
let paginaActual = 1;
const registrosPorPagina = 10;

document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");
    const decoded = decodificarToken(token);
    const usuario = localStorage.getItem("usuario");
    const rol = localStorage.getItem("rol");
    const turno = localStorage.getItem("turno");

    if (decoded && decoded.exp) {
        const tiempoExpiracion = decoded.exp * 1000; // segundos a ms
        const ahora = Date.now();
        const tiempoRestante = tiempoExpiracion - ahora;
    
        // Mostrar alerta 5 minutos antes de expirar
        const tiempoAlerta = tiempoRestante - (5 * 60 * 1000);
    
        if (tiempoAlerta > 0) {
            setTimeout(() => {
                mostrarAlertaRenovacion();
            }, tiempoAlerta);
        } else {
            // Ya está por expirar o vencido
            mostrarAlertaRenovacion();
        }
    }

    if (!token) {
        alert("⚠️ Debes iniciar sesión");
        window.location.href = "login.html";
        return;
    }

    document.getElementById("nombreUsuario").textContent = usuario;
    document.getElementById("rolUsuario").textContent = rol === "admin" ? "Administrador" : "Producción";

    // Mostrar modal de turno solo si NO es admin
    if (rol === "admin") {
        // 🔒 Mostrar resumen y cargar datos
        const resumenAdmin = document.getElementById("bloqueResumenAdmin");
        if (resumenAdmin) resumenAdmin.style.display = "block";

        cargarRegistros();
        mostrarResumenUsuariosActivos();
    } else {
        // 🔒 Ocultar solo funciones exclusivas de admin
        ["btnReporteEntradas"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = "none";
        });

        // 🔄 Mostrar modal de turno si no está definido
        if (!turno) {
            const modalTurno = new bootstrap.Modal(document.getElementById("turnoModal"));
            modalTurno.show();
        } else {
            document.getElementById("turnoSeleccionado").textContent =
                turno.charAt(0).toUpperCase() + turno.slice(1);
            cargarRegistros();
        }
    } 

    // ✅ Enlazar el botón del modal con su función
    const btnGenerar = document.getElementById("btnGenerarReporte");
    if (btnGenerar) {
        btnGenerar.addEventListener("click", generarReporteProduccion);
    }
});

function seleccionarTurno(turno) {
    localStorage.setItem("turno", turno);
    document.getElementById("turnoSeleccionado").textContent = turno;
    const modal = bootstrap.Modal.getInstance(document.getElementById("turnoModal"));
    if (modal) {
        modal.hide();
    }
    setTimeout(() => {
        window.location.reload(); // Refresca la página después de cerrar el modal
    }, 300);
}

function cambiarTurno() {
    const modal = new bootstrap.Modal(document.getElementById("turnoModal"));
    modal.show();
}

function cerrarSesion() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    localStorage.removeItem("rol");
    localStorage.removeItem("turno");
    window.location.href = "login.html";
}
function obtenerUbicacion() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject("❌ Geolocalización no soportada en este navegador.");
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => resolve({
                lat: position.coords.latitude,
                lon: position.coords.longitude
            }),
            (error) => reject("⚠️ No se pudo obtener la ubicación: " + error.message),
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    });
}

async function registrarChecada() {
    const usuario = localStorage.getItem("usuario");
    const turno = localStorage.getItem("turno");

    if (!usuario || !turno) {
        alert("⚠️ Error: No se encontró usuario o turno. Inicia sesión nuevamente.");
        return;
    }

    try {
        const ubicacion = await obtenerUbicacion();
        console.log("📍 Ubicación del usuario:", ubicacion);

        // Mostrar datos en el modal
        document.getElementById("checadorUsuario").textContent = usuario;
        document.getElementById("checadorTurno").textContent = turno;
        document.getElementById("checadorUbicacion").textContent = `Lat: ${ubicacion.lat.toFixed(6)}, Lon: ${ubicacion.lon.toFixed(6)}`;

        // Abrir el modal de confirmación
        const modalChecador = new bootstrap.Modal(document.getElementById("modalChecador"));
        modalChecador.show();

        // Al confirmar, registrar la checada
        document.getElementById("btnConfirmarChecada").onclick = async () => {
            const tipo = document.getElementById("tipoChecada").value; // 📌 Asegurar que `tipo` se obtiene
            if (!tipo) {
                alert("❌ Debes seleccionar si es entrada o salida.");
                return;
            }

            if (!estaEnZonaPermitida(ubicacion)) {
                alert("❌ No puedes registrar la entrada/salida fuera de las instalaciones.");
                return;
            }

            const fechaHora = new Date().toISOString();

            console.log("📡 Enviando solicitud con:", { usuario, turno, tipo, fechaHora, ubicacion });

            const response = await fetch(`${API_URL}/checador`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ usuario, turno, tipo, fechaHora, ubicacion })
            });

            if (response.ok) {
                alert(`✅ Registro de ${tipo} exitoso.`);
                modalChecador.hide();
            } else {
                alert("❌ Error al registrar checada.");
            }
        };
    } catch (error) {
        alert(error);
    }
}


function estaEnZonaPermitida(ubicacion) {
    function calcularDistancia(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radio de la Tierra en km
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distancia en km
    }

    const distancia = calcularDistancia(
        ubicacion.lat, ubicacion.lon,
        UBICACION_PERMITIDA.lat, UBICACION_PERMITIDA.lon
    );

    console.log(`📏 Distancia al punto permitido: ${distancia.toFixed(3)} km`);

    return distancia <= UBICACION_PERMITIDA.radio;
}

async function cargarRegistros() {
    const rol = localStorage.getItem("rol");

    try {
        const response = await fetch(`${API_URL}/produccion`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`
            }
        });

        if (!response.ok) {
            const data = await response.json();
            const mensaje = data?.error || "Error al cargar producción";

            if (response.status === 404) {
                alert("⚠️ No se encontró una entrada registrada. Por favor registra tu entrada antes de continuar.");
            } else {
                alert("❌ " + mensaje);
            }

            return;
        }

        registros = await response.json();

        if (rol === "admin") {
            mostrarTodosLosRegistros();
            mostrarResumenUsuariosActivos(); // ✅ Acá se muestra el resumen de cada turno activo
        } else {
            mostrarPagina(1);
        }

        actualizarContadorProduccion();

    } catch (error) {
        console.error("❌ Error al cargar registros:", error);
        alert("⚠️ No se pudo cargar la producción.");
    }
}



function mostrarTodosLosRegistros() {
    generarEncabezadoTabla();
    const tabla = document.getElementById("tablaProduccion");
    const rol = localStorage.getItem("rol");
    tabla.innerHTML = "";

    if (registros.length === 0) {
        tabla.innerHTML = "<tr><td colspan='5'>No hay registros.</td></tr>";
        return;
    }

    registros.forEach(registro => {
        const fechaFormateada = new Date(registro.fecha).toLocaleString("es-MX", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });

        const fila = `<tr>
            ${rol === "admin" ? `<td>${registro.usuario}</td>` : ""}
            <td>${parseFloat(registro.peso).toFixed(2)} kg</td>
            <td>${parseFloat(registro.medida).toFixed(2)}</td>
            <td>${registro.tipoPlastico}</td>
            <td>${fechaFormateada}</td>
        </tr>`;

        tabla.innerHTML += fila;
    });

    actualizarPaginacion();
}

async function generarReporteProduccion() {
    const usuario = localStorage.getItem("usuario");
    const usuario_id = localStorage.getItem("idUsuario");
    const turno = localStorage.getItem("turno");
    const fechaSeleccionada = document.getElementById("fechaReporte")?.value;

    if (!usuario || !usuario_id || !fechaSeleccionada || !turno) {
        alert("⚠️ Completa usuario, fecha y turno para continuar.");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/produccion/rango?fecha=${fechaSeleccionada}&usuario_id=${usuario_id}`, {
            headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`
            }
        });

        if (!response.ok) {
            const { error } = await response.json();
            alert(`❌ Error al obtener los datos: ${error}`);
            return;
        }

        const registros = await response.json();

        if (registros.length === 0) {
            alert("⚠️ No hay registros para ese rango de tiempo.");
            return;
        }

        const resumen = {};
        const inicio = new Date(registros[0].fecha);
        const fin = new Date(inicio.getTime() + 10 * 60 * 60 * 1000);

        registros.forEach(r => {
            const tipo = r.tipoPlastico || "Sin tipo";
            const medida = parseFloat(r.medida);
            const peso = parseFloat(r.peso);

            if (!resumen[tipo]) {
                resumen[tipo] = {
                    totalKilos: 0,
                    totalMetros: 0,
                    medidas: {},
                    paquetes: 0,
                    totalPeso: 0
                };
            }

            resumen[tipo].totalKilos += peso;
            resumen[tipo].totalMetros += medida * 50;
            resumen[tipo].paquetes += 1;
            resumen[tipo].totalPeso += peso;

            if (!resumen[tipo].medidas[medida]) {
                resumen[tipo].medidas[medida] = 0;
            }

            resumen[tipo].medidas[medida]++;
        });

        // 🧾 Generar PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFontSize(16);
        doc.text("Reporte de Producción", 14, 20);
        doc.setFontSize(12);
        doc.text(`Usuario: ${usuario}`, 14, 30);
        doc.text(`Turno: ${turno}`, 14, 36);
        doc.text(`Desde: ${inicio.toLocaleString()}`, 14, 42);
        doc.text(`Hasta: ${fin.toLocaleString()}`, 14, 48);

        // 📊 Resumen antes de la tabla
        let y = 55;
        doc.setFontSize(14);
        doc.text("Resumen por Tipo de Plástico", 14, y);
        y += 6;

        Object.entries(resumen).forEach(([tipo, datos]) => {
            doc.setFontSize(12);
            doc.text(`Tipo: ${tipo}`, 14, y); y += 6;

            Object.entries(datos.medidas).forEach(([medida, cantidad]) => {
                doc.text(`   - Paquetes: ${cantidad} (${medida} m)`, 20, y); y += 6;
            });

            doc.text(`   Total kilos: ${datos.totalKilos.toFixed(2)} kg`, 20, y); y += 6;
            doc.text(`   Total metros: ${datos.totalMetros.toFixed(2)} m`, 20, y); y += 6;
            doc.text(`   Peso promedio por paquete: ${(datos.totalPeso / datos.paquetes).toFixed(2)} kg`, 20, y); y += 6;
            doc.text(`   Total de piezas: ${datos.paquetes * 50}`, 20, y); y += 10;
        });

        // 🧾 Tabla de registros
        doc.autoTable({
            head: [["#", "Fecha", "Tipo", "Medida", "Peso"]],
            body: registros.map((r, i) => [
                i + 1,
                new Date(r.fecha).toLocaleString(),
                r.tipoPlastico,
                `${parseFloat(r.medida).toFixed(2)} m`,
                `${parseFloat(r.peso).toFixed(2)} kg`
            ]),
            startY: y
        });

        // Abrir en nueva pestaña
        const blob = doc.output("blob");
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");

    } catch (err) {
        console.error("❌ Error generando el reporte:", err);
        alert("Error inesperado al generar el reporte.");
    }
}


function mostrarToast(mensaje) {
    const toast = document.createElement("div");
    toast.className = "toast align-items-center text-bg-success border-0 show";
    toast.setAttribute("role", "alert");
    toast.setAttribute("aria-live", "assertive");
    toast.setAttribute("aria-atomic", "true");
    toast.style.position = "fixed";
    toast.style.bottom = "20px";
    toast.style.right = "20px";
    toast.style.zIndex = 1055;

    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${mensaje}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function abrirModalReporte() {
    const modal = new bootstrap.Modal(document.getElementById("modalReporteProduccion"));
    modal.show();
}


async function verReporteEntradas() {
    try {
        const response = await fetch(`${API_URL}/checador/reporte`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const datos = await response.json();
        console.log("📊 Reporte de Entradas/Salidas:", datos);

        // Aquí puedes mostrar los datos en un modal o exportarlos a un archivo
        alert("📊 Reporte de Entradas/Salidas generado. Revisa la consola.");
    } catch (error) {
        console.error("❌ Error al obtener reporte de entradas/salidas:", error);
    }
}

function mostrarPagina(pagina) {
    const registrosPorPagina = 10;
    const inicio = (pagina - 1) * registrosPorPagina;
    const fin = inicio + registrosPorPagina;
    const registrosPagina = registros.slice(inicio, fin);
    const tabla = document.getElementById("tablaProduccion");
    tabla.innerHTML = "";

    const rol = localStorage.getItem("rol");

    registrosPagina.forEach(registro => {
        const fila = document.createElement("tr");

        const fecha = new Date(registro.fecha || registro.fecha_hora);
        const tipo = registro.tipoPlastico || registro.tipo_plastico || "No disponible";
        const medida = registro.medida ?? "No disponible";
        const peso = parseFloat(registro.peso) || 0;

        const horaLegible = !isNaN(fecha)
            ? fecha.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: true })
            : "Fecha inválida";

        fila.innerHTML = `
            ${rol === "admin" ? `<td>${registro.usuario || "Usuario"}</td>` : ""}
            <td>${peso.toFixed(2)} kg</td>
            <td>${medida}</td>
            <td>${tipo}</td>
            <td>${horaLegible}</td>
        `;

        // Columna de acciones
        const ahora = new Date();
        const diferenciaHoras = (ahora - fecha) / (1000 * 60 * 60);
        const tdAcciones = document.createElement("td");
        tdAcciones.classList.add("text-center");

        if (rol === "produccion" && diferenciaHoras <= 3) {
            tdAcciones.innerHTML = `
                <div class="dropdown">
                    <button class="btn btn-sm btn-outline-light dropdown-toggle" type="button" data-bs-toggle="dropdown">
                        Opciones
                    </button>
                    <ul class="dropdown-menu">
                        <li><a class="dropdown-item" href="#" onclick="abrirModalEditar(${registro.id})">✏️ Editar</a></li>
                        <li><a class="dropdown-item text-danger" href="#" onclick="confirmarEliminarRegistro(${registro.id})">🗑️ Eliminar</a></li>
                    </ul>
                </div>
            `;
        } else {
            tdAcciones.innerHTML = `<span class="text-muted">No disponible</span>`;
        }

        fila.appendChild(tdAcciones);
        tabla.appendChild(fila);
    });

    actualizarPaginacion();
}



async function guardarCambiosEdicion() {
    const id = document.getElementById("editarId").value;
    const tipo = document.getElementById("editarTipo").value;
    const medida = document.getElementById("editarMedida").value;
    const peso = document.getElementById("editarPeso").value;

    try {
        const response = await fetch(`https://appgh-2z0e.onrender.com/produccion/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tipo_plastico: tipo, medida, peso })
        });

        if (!response.ok) throw new Error("❌ Error al guardar cambios");

        alert("✅ Registro actualizado");
        const modal = bootstrap.Modal.getInstance(document.getElementById("modalEditarProduccion"));
        if (modal) modal.hide();

        await obtenerRegistros(); // vuelve a cargar tabla
    } catch (error) {
        console.error(error);
        alert("❌ No se pudo actualizar el registro");
    }
}
async function confirmarEliminarRegistro(id) {
    if (!confirm("¿Estás seguro de que quieres eliminar este registro?")) return;

    try {
        const response = await fetch(`https://appgh-2z0e.onrender.com/produccion/${id}`, {
            method: "DELETE"
        });

        if (!response.ok) throw new Error("❌ No se pudo eliminar");

        alert("🗑️ Registro eliminado");
        await obtenerRegistros();
    } catch (error) {
        console.error(error);
        alert("❌ Error al eliminar el registro");
    }
}


function decodificarToken(token) {
    if (!token) return null;
    const payloadBase64 = token.split('.')[1];
    const decoded = JSON.parse(atob(payloadBase64));
    return decoded;
}

function mostrarAlertaRenovacion() {
    const confirmacion = confirm("⚠️ Tu sesión está por expirar.\n¿Deseas continuar conectado?");

    if (confirmacion) {
        renovarSesion();
    } else {
        cerrarSesion();
    }
}

function cerrarModalSesion() {
    const modal = bootstrap.Modal.getInstance(document.getElementById("modalRenovarSesion"));
    if (modal) modal.hide();
}

function actualizarContadorProduccion() {
    const rol = localStorage.getItem("rol");

    if (!registros || registros.length === 0) {
        document.getElementById("totalPaquetes").textContent = "Total de paquetes: 0";
        document.getElementById("totalMedida").textContent = "Total medida: 0 m";
        document.getElementById("promedioPeso").textContent = "Peso promedio: 0 kg";
        document.getElementById("totalKilos").textContent = "Total de kilos: 0 kg";
        return;
    }

    let totalPaquetes = registros.length;
    let totalKg = 0;
    let totalMetros = 0;

    registros.forEach(reg => {
        const peso = parseFloat(reg.peso) || 0;
        const medida = parseFloat(reg.medida) || 0;

        totalKg += peso;
        totalMetros += medida * 50; // ✅ 50 piezas por paquete
    });

    const promedioPeso = totalKg / totalPaquetes;

    document.getElementById("totalPaquetes").textContent = `Total de paquetes: ${totalPaquetes}`;
    document.getElementById("totalMedida").textContent = `Total medida: ${totalMetros.toFixed(2)} m`;
    document.getElementById("promedioPeso").textContent = `Peso promedio: ${promedioPeso.toFixed(2)} kg`;
    document.getElementById("totalKilos").textContent = `Total de kilos: ${totalKg.toFixed(2)} kg`;
}

async function mostrarResumenUsuariosActivos() {
    const contenedor = document.getElementById("resumenPorUsuario");
    contenedor.innerHTML = "<h4>📊 Resumen del día (usuarios con turno activo)</h4>";

    try {
        const response = await fetch(`${API_URL}/resumen-activos`, {
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });

        if (!response.ok) {
            contenedor.innerHTML += "<p class='text-danger'>No se pudo cargar el resumen.</p>";
            return;
        }

        const datos = await response.json();

        if (!datos.length) {
            contenedor.innerHTML += "<p>No hay usuarios con turno activo en este momento.</p>";
            return;
        }

        datos.forEach(resumen => {
            contenedor.innerHTML += `
                <div class="card bg-dark text-white mb-3">
                    <div class="card-body">
                        <h5 class="card-title">👤 ${resumen.usuario}</h5>
                        <p class="card-text">
                            Total paquetes: ${resumen.totalPaquetes}<br>
                            Total metros: ${resumen.totalMetros.toFixed(2)} m<br>
                            Total kilos: ${resumen.totalKilos.toFixed(2)} kg<br>
                            Peso promedio: ${resumen.promedio.toFixed(2)} kg
                        </p>
                    </div>
                </div>
            `;
        });
    } catch (error) {
        console.error("❌ Error al cargar resumen por usuarios activos:", error);
        contenedor.innerHTML += "<p class='text-danger'>Error de red al obtener el resumen.</p>";
    }
}


function generarEncabezadoTabla() {
    const encabezado = document.getElementById("encabezadoTabla");
    const rol = localStorage.getItem("rol");

    let fila = "<tr>";

    if (rol === "admin") {
        fila += "<th>Usuario</th>";
    }

    fila += `
        <th>Peso (kg)</th>
        <th>Medida (m)</th>
        <th>Tipo Plástico</th>
        <th>Fecha</th>
    </tr>`;

    encabezado.innerHTML = fila;
}

async function renovarSesion() {
    const usuario = localStorage.getItem("usuario");
    try {
        const response = await fetch(`https://appgh-2z0e.onrender.com/login-qr?usuario=${usuario}`);
        const data = await response.json();

        if (response.ok) {
            localStorage.setItem("token", data.token);
            console.log("🔄 Token renovado");
            alert("✅ Sesión extendida 2 horas más.");
            window.location.reload();
        } else {
            alert("❌ No se pudo renovar la sesión.");
            cerrarSesion();
        }
    } catch (err) {
        console.error("❌ Error al renovar sesión:", err);
        cerrarSesion();
    }
}


function actualizarPaginacion() {
    const totalPaginas = Math.ceil(registros.length / registrosPorPagina);
    const paginacion = document.getElementById("paginacion");
    paginacion.innerHTML = "";

    for (let i = 1; i <= totalPaginas; i++) {
        paginacion.innerHTML += `<button class='btn btn-sm ${i === paginaActual ? "btn-primary" : "btn-secondary"}' onclick='mostrarPagina(${i})'>${i}</button> `;
    }

    paginacion.style.display = totalPaginas > 1 ? "block" : "none";
}


async function generarReportePDF() {
    const usuario = localStorage.getItem("usuario") || "Usuario";
    const turno = localStorage.getItem("turno") || "Sin turno";
    const fechaActual = new Date();
    const fecha = fechaActual.toLocaleDateString();
    const horaActual = fechaActual.toLocaleTimeString();

    // 📌 Extraer datos de la tabla en el HTML
    const filas = document.querySelectorAll("#tablaProduccion tr");
    let registros = [];
    let totalKg = 0, totalMetros = 0;

    filas.forEach(fila => {
        const columnas = fila.querySelectorAll("td");
        if (columnas.length === 4) { // Verifica que tenga las 4 columnas esperadas
            const peso = parseFloat(columnas[0].innerText) || 0;
            const medida = parseFloat(columnas[1].innerText) || 0;
            const tipoPlastico = columnas[2].innerText.trim();
            const fechaHora = new Date(columnas[3].innerText);

            registros.push({ peso, medida, tipoPlastico, fechaHora });

            totalKg += peso;
            totalMetros += medida;
        }
    });

    // 📄 Crear PDF
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");

    // 📌 Encabezado
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.setTextColor(34, 139, 34); // Verde oscuro
    pdf.text("Reporte de Producción", 70, 20);

    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0); // Negro
    pdf.text(`Usuario: ${usuario}`, 10, 30);
    pdf.text(`Turno: ${turno}`, 10, 40);
    pdf.text(`Fecha: ${fecha} - Hora: ${horaActual}`, 10, 50);

    // 📌 Dibujar tabla
    let startY = 60;
    pdf.setFont("helvetica", "bold");
    pdf.setFillColor(34, 139, 34); // Fondo verde
    pdf.setTextColor(255, 255, 255); // Texto blanco
    pdf.rect(10, startY, 190, 8, "F");
    pdf.text("No.", 12, startY + 5);
    pdf.text("Peso (kg)", 30, startY + 5);
    pdf.text("Medida", 60, startY + 5);
    pdf.text("Tipo Plástico", 90, startY + 5);
    pdf.text("Hora", 140, startY + 5);

    // 📌 Agregar datos a la tabla
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(0, 0, 0);
    let y = startY + 10;

    registros.forEach((reg, index) => {
        const horaRegistro = reg.fechaHora.toLocaleTimeString();

        // Alternar color de filas
        if (index % 2 === 0) {
            pdf.setFillColor(230, 255, 230); // Verde claro
            pdf.rect(10, y - 4, 190, 8, "F");
        }

        pdf.text(`${index + 1}`, 12, y);
        pdf.text(`${reg.peso.toFixed(2)} kg`, 30, y);
        pdf.text(`${reg.medida.toFixed(2)} m`, 60, y);
        pdf.text(`${reg.tipoPlastico}`, 90, y);
        pdf.text(`${horaRegistro}`, 140, y);
        y += 7;
    });

    // 📌 Resumen final
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(34, 139, 34); // Verde oscuro
    pdf.text("Resumen de Producción", 10, y + 10);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(0, 0, 0);
    pdf.text(`Total Kilogramos: ${totalKg.toFixed(2)} kg`, 10, y + 20);
    pdf.text(`Total Metros: ${totalMetros.toFixed(2)} m`, 10, y + 30);

    // ✅ Mostrar el PDF en nueva pestaña
    const pdfBlob = pdf.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, "_blank");
}


// ✅ Función para registrar producción en la base de datos
document.getElementById("formProduccion").addEventListener("submit", async (e) => {
    e.preventDefault();

    const usuario = localStorage.getItem("usuario") || "";
    const turno = localStorage.getItem("turno") || "";
    const peso = parseFloat(document.getElementById("peso")?.value) || 0;
    const medida = document.getElementById("medida")?.value.trim() || "";
    const tipoPlastico = document.getElementById("tipoPlastico")?.value.trim() || "";

    if (!usuario || !turno || peso <= 0 || medida === "" || tipoPlastico === "") {
        alert("❌ Todos los campos son obligatorios y el peso debe ser mayor a 0.");
        return;
    }

    console.log("📡 Enviando datos al backend:", { usuario, turno, peso, medida, tipoPlastico });

    try {
        const response = await fetch(`${API_URL}/produccion`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${localStorage.getItem("token")}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ usuario, turno, peso, medida, tipoPlastico })
        });

        const data = await response.json();
        if (response.ok) {
            alert("✅ Producción registrada con éxito.");
            window.location.reload();
        } else {
            alert("❌ Error: " + data.error);
        }
    } catch (error) {
        console.error("❌ Error al enviar datos:", error);
    }
});

function poblarSelectUsuarios() {
    const select = document.getElementById("selectUsuario");
    const usuariosUnicos = [...new Set(registros.map(r => r.usuario))];

    // Evita volver a llenar si ya están cargados
    if (select.options.length > 1) return;

    usuariosUnicos.forEach(usuario => {
        const option = document.createElement("option");
        option.value = usuario;
        option.textContent = usuario;
        select.appendChild(option);
    });
}

function filtrarPorUsuario() {
    mostrarTodosLosRegistros();
}


document.getElementById("btnReporteProduccion").addEventListener("click", () => {
    const modal = new bootstrap.Modal(document.getElementById("modalReporteProduccion"));
    modal.show();
});

