console.log("✅ Script cargado correctamente.");
const API_BASE_URL = "https://appgh-2z0e.onrender.com"; // URL de tu backend en Render
let ventasGlobales = []; // Guardará todas las ventas
let paginaActual = 1;
const { jsPDF } = window.jspdf; // ✅ Usar jsPDF en frontend



const ventasPorPagina = 10; // 🔥 Muestra 10 registros por página

document.addEventListener("DOMContentLoaded", () => {
    console.log("🚀 Página cargada, iniciando funciones...");

    // Ocultar modales al inicio
    const modalVenta = document.getElementById("modalVenta");
    const modalEditarVenta = document.getElementById("modalEditarVenta");
    const modalAbono = document.getElementById("modalAbono");
    const modalHistorialAbonos = document.getElementById("modalHistorialAbonos");  
    // Cargar datos iniciales
    cargarClientes();
    cargarVentas();
});

document.addEventListener("click", (event) => {
    const button = event.target.closest(".menu-btn");
    if (button) toggleMenu(button);
});

// ✅ Implementación del dropdown de Bootstrap en la columna Acciones
function generarDropdownAcciones(ventaId, cliente, fecha, saldoInicial, saldoPendiente, folio) {
    return `
        <div class="dropdown">
            <button class="btn btn-secondary dropdown-toggle btn-sm" type="button" data-bs-toggle="dropdown">
                Opciones
            </button>
            <ul class="dropdown-menu">
                <li>
                    <button class="dropdown-item text-info" 
                        onclick="abrirModalHistorialAbonos(${ventaId})">
                        📜 Ver Abonos
                    </button>
                </li>
                <li>
                    <button class="dropdown-item text-success" 
                        onclick="abrirModalAbono(${ventaId})">
                        💰 Registrar Abono
                    </button>
                </li>
                <li>
                    <button class="dropdown-item text-warning" 
                        onclick="cancelarVenta(${ventaId})">
                        ❌ Cancelar Venta
                    </button>
                </li>
                <li>
                    <button class="dropdown-item text-primary" 
                        onclick="abrirModalEditarVenta(${ventaId}, '${cliente}', '${fecha}', ${saldoInicial}, '${folio}')">
                        ✏️ Editar Venta
                    </button>
                </li>
                <li>
                    <button class="dropdown-item text-danger" 
                        onclick="eliminarVenta(${ventaId})">
                        🗑️ Eliminar Venta
                    </button>
                </li>
            </ul>
        </div>
    `;
}

function generarBotonesAbono(idAbono) {
    const pdfURL = `${API_BASE_URL}/recibos/Recibo_Abono_${idAbono}.pdf`; // 🔹 URL dinámica del PDF

    return `
        <div class="dropdown">
            <button class="btn btn-secondary dropdown-toggle btn-sm" type="button" data-bs-toggle="dropdown">
                ☰ Opciones
            </button>
            <ul class="dropdown-menu">
                <li><button class="dropdown-item text-warning" onclick="editarAbono(${idAbono})">✏️ Editar</button></li>
                <li><button class="dropdown-item text-danger" onclick="eliminarAbono(${idAbono})">🗑️ Eliminar</button></li>
                <li><button class="dropdown-item text-primary" onclick="abrirReciboPDF(${idAbono})">📄 Ver Recibo</button></li>
            </ul>
        </div>
    `;
}

async function abrirReciboPDF(idAbono) {
    try {
        const response = await fetch(`${API_URL}/abono/${idAbono}`);
        if (!response.ok) throw new Error("Recibo no disponible");

        const { recibo_url } = await response.json();
        if (!recibo_url) throw new Error("Recibo aún no generado");

        window.open(recibo_url, "_blank");
    } catch (error) {
        alert("⚠️ No se pudo abrir el recibo PDF.");
        console.error("❌ Error abriendo recibo:", error);
    }
}

// ✅ Función para abrir el modal de nueva venta
function abrirModalNuevaVenta() {
    const modal = new bootstrap.Modal(document.getElementById("modalNuevaVenta"));
    modal.show();
}

// ✅ Función para guardar una nueva venta
function guardarNuevaVenta() {
    const cliente = document.getElementById("inputCliente").value;
    const fecha = document.getElementById("inputFecha").value;
    const monto = document.getElementById("inputMonto").value;
    const folio = document.getElementById("inputFolio").value;

    if (!cliente || !fecha || !monto || !folio) {
        alert("⚠️ Todos los campos son obligatorios");
        return;
    }

    fetch(`${API_BASE_URL}/ventas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cliente, fecha, monto, folio })
    })
    .then(response => response.json())
    .then(data => {
        alert("✅ Venta agregada correctamente.");
        cargarVentas();
        bootstrap.Modal.getInstance(document.getElementById("modalVenta")).hide();

    })
    .catch(error => console.error("❌ Error al guardar la venta:", error));
}

// ✅ Función para abrir el modal de edición de cliente
function abrirModalEditarVenta(ventaId, cliente, fecha, saldoInicial, folio) {
    console.log("Abrir modal de edición para venta ID:", ventaId);

    const modalElement = document.getElementById("modalEditarVenta");
    if (!modalElement) {
        console.error("❌ Error: No se encontró el modal de edición de ventas.");
        return;
    }

    document.getElementById("editVentaId").value = ventaId;
    document.getElementById("editCliente").value = cliente || "";
    document.getElementById("editFecha").value = fecha ? fecha.split("T")[0] : ""; // ✅ Eliminar la parte de la hora
    document.getElementById("editMonto").value = saldoInicial ? parseFloat(saldoInicial).toFixed(2) : "0.00";
    document.getElementById("editFolio").value = folio || "";

    console.log("📌 id:", ventaId);
    console.log("📌 cliente:", cliente);
    console.log("📌 fecha:", document.getElementById("editFecha").value);  // ✅ Verificar en consola
    console.log("📌 monto:", saldoInicial);
    console.log("📌 folio:", folio);

    const modal = new bootstrap.Modal(modalElement);
    modal.show();
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////BOOTSTRAP MODALES

function abrirModalVenta() {
    const modalElement = document.getElementById("modalVenta");
    if (!modalElement) {
        console.error("❌ Error: No se encontró el modal de ventas.");
        return;
    }

    const modal = new bootstrap.Modal(modalElement);
    modal.show();
}

async function guardarEdicionVenta() {
    const id = document.getElementById("editVentaId")?.value.trim();
    const cliente = document.getElementById("editCliente")?.value.trim();
    const fecha = document.getElementById("editFecha")?.value.trim();
    const monto = parseFloat(document.getElementById("editMonto")?.value.trim());
    const folio = document.getElementById("editFolio")?.value.trim();

    if (!id || !cliente || !fecha || isNaN(monto) || !folio) {
        alert("⚠️ Todos los campos son obligatorios.");
        return;
    }

    console.log("📌 Enviando datos de edición:", { id, cliente, fecha, monto, folio });

    try {
        const response = await fetch(`https://appgh-2z0e.onrender.com/ventas/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cliente, fecha, monto, folio })
        });

        const responseData = await response.json();

        if (!response.ok) {
            console.error("❌ Respuesta del servidor:", responseData);
            throw new Error(responseData.message || "Error al actualizar la venta.");
        }

        alert("✅ Venta actualizada con éxito.");
        bootstrap.Modal.getInstance(document.getElementById("modalEditarVenta")).hide();
        cargarVentas();
    } catch (error) {
        console.error("❌ Error al actualizar la venta:", error);
        alert(`❌ No se pudo actualizar la venta: ${error.message}`);
    }
}

function verRecibo(url) {
    if (!url) return alert("Este abono aún no tiene un recibo.");
    window.open(url, "_blank");
}



function cerrarmodalHistorialAbonos() {
    const modalElement = document.getElementById("modalHistorialAbonos");
    const modal = bootstrap.Modal.getInstance(modalElement);
    if (modal) {
        modal.hide(); // ✅ Cierra correctamente el modal con Bootstrap
    }
}
async function actualizarTablas(ventaId) {
    console.log("🔄 Actualizando tablas tras acción en abonos...");

    // 🔄 Actualizar la tabla de abonos en el modal
    await abrirModalHistorialAbonos(ventaId);

    // 🔄 Actualizar la tabla de ventas (para reflejar saldo pendiente actualizado)
    await cargarVentas();
}


function toggleMenu(button) {
    const menu = button.nextElementSibling;

    // Cierra otros menús antes de abrir este
    document.querySelectorAll(".action-menu-content").forEach(m => {
        if (m !== menu) m.style.display = "none";
    });

    // Alternar visibilidad del menú
    menu.style.display = menu.style.display === "block" ? "none" : "block";

    if (menu.style.display === "block") {
        const rect = button.getBoundingClientRect();
        menu.style.position = "absolute";
        menu.style.top = `${rect.bottom + window.scrollY}px`;
        menu.style.left = `${rect.left + window.scrollX}px`;
        menu.style.zIndex = "1000";
        menu.style.backgroundColor = "#333"; // Fondo oscuro para contrastar
        menu.style.color = "#FFF"; // Texto blanco para visibilidad
        menu.style.border = "1px solid #555";
        menu.style.padding = "8px";
        menu.style.borderRadius = "5px";
    }
}



async function agregarVenta() {
    const cliente = document.getElementById("cliente").value;
    const fecha = document.getElementById("fecha").value;
    const monto = document.getElementById("monto").value;
    const folio = document.getElementById("folio").value;

    if (!cliente || !fecha || !monto || !folio) {
        alert("⚠️ Todos los campos son obligatorios.");
        return;
    }

    try {
        const response = await fetch("https://appgh-2z0e.onrender.com/ventas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cliente, fecha, monto, folio })
        });

        if (!response.ok) throw new Error("Error al agregar la venta");

        alert("✅ Venta agregada con éxito");
        bootstrap.Modal.getInstance(document.getElementById("modalVenta")).hide();
        cargarVentas(); // 🔄 Actualiza la tabla
    } catch (error) {
        alert("❌ Error al agregar la venta");
        console.error(error);
    }
}


async function cancelarAbono(abonoId, ventaId) {
    if (!confirm("⚠️ ¿Seguro que quieres cancelar este abono?")) return;

    try {
        const response = await fetch(`${API_BASE_URL}/abonos/cancelar/${abonoId}`, { method: "PUT" });

        if (!response.ok) throw new Error("Error al cancelar el abono.");

        alert("✅ Abono cancelado.");
        await actualizarTablas(ventaId);

    } catch (error) {
        console.error("❌ Error al cancelar el abono:", error);
    }
    await actualizarTablas(ventaId);

}

function convertirNumeroALetras(num) {
    const unidades = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
    const especiales = ["diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve"];
    const decenas = ["", "", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
    num = parseInt(num);
    if (num < 10) return unidades[num];
    if (num < 20) return especiales[num - 10];
    return decenas[Math.floor(num / 10)] + (num % 10 ? " y " + unidades[num % 10] : "");
}

function cerrarModalAbono() {
    const modalElement = document.getElementById("modalAbono");
    const modal = bootstrap.Modal.getInstance(modalElement);
    if (modal) {
        modal.hide();
    }
}
function descargarReciboDesdeURL(url, idAbono) {
    const a = document.createElement("a");
    a.href = url;
    a.download = `Recibo_Abono_${idAbono}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  
async function editarAbono(abonoId, ventaId) {
    const nuevoMonto = prompt("Nuevo monto del abono:");
    if (!nuevoMonto || isNaN(nuevoMonto)) {
        return alert("Monto inválido");
    }

    const confirmacion = confirm("¿Deseas guardar los cambios?");
    if (!confirmacion) return;

    try {
        const res = await fetch(`/abonos/${abonoId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ monto: nuevoMonto })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al actualizar abono");

        alert("✅ Abono actualizado");

        // 🔄 Refrescar tablas
        await abrirModalHistorialAbonos(ventaId);
        await cargarVentas();

        // 🔁 Esperar un momento y luego abrir el nuevo recibo
        setTimeout(async () => {
            const abonoRes = await fetch(`/abonos/${ventaId}`);
            const abonos = await abonoRes.json();
            const abonoActual = abonos.find(a => a.id === abonoId);

            if (abonoActual && abonoActual.recibo_url) {
                verRecibo(abonoActual.recibo_url);
            } else {
                alert("El recibo aún no está disponible.");
            }
        }, 1000); // ⏱️ Espera de 1 segundo

    } catch (err) {
        console.error("❌ Error actualizando abono:", err);
        alert("Error al actualizar abono");
    }
}
function abrirModalAbono(ventaId) {
    const modalElement = document.getElementById("modalAbono");
    if (!modalElement) {
        console.error("❌ Error: No se encontró el modal de abono.");
        return;
    }

    // Limpiar campos antes de abrir
    document.getElementById("ventaId").value = ventaId;
    document.getElementById("inputMontoAbono").value = "";
    document.getElementById("inputFechaAbono").value = new Date().toISOString().split("T")[0];

    const modal = new bootstrap.Modal(modalElement);
    modal.show();
}


function cerrarModalEditar() {
    const modalElement = document.getElementById("modalEditarVenta");
    const modal = bootstrap.Modal.getInstance(modalElement);
    if (modal) {
        modal.hide();
    }
}

async function eliminarAbono(abonoId, ventaId) {
    const confirmacion = confirm("¿Estás seguro de eliminar este abono?");
    if (!confirmacion) return;

    try {
        const res = await fetch(`/abonos/${abonoId}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al eliminar abono");

        alert("🗑️ Abono eliminado");

        // 🔄 Refrescar tabla de abonos y tabla principal
        await abrirModalHistorialAbonos(ventaId);
        await cargarVentas();
    } catch (err) {
        console.error("❌ Error eliminando abono:", err);
        alert("Error al eliminar abono");
    }
}


// ✅ Cancelar una venta (actualiza estado en la base de datos)
async function cancelarVenta(ventaId) {
    if (confirm("¿Estás seguro de cancelar esta venta?")) {
        try {
            const response = await fetch(`https://appgh-2z0e.onrender.com/ventas/${ventaId}/cancelar`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" }
            });

            if (!response.ok) throw new Error("Error al cancelar la venta");

            alert("✅ Venta cancelada con éxito");
            cargarVentas(); // 🔄 Recargar la tabla
        } catch (error) {
            console.error("❌ Error al cancelar venta:", error);
            alert("❌ No se pudo cancelar la venta.");
        }
    }
}

// ✅ Eliminar una venta (la borra de la base de datos)
async function eliminarVenta(ventaId) {
    if (confirm("¿Estás seguro de eliminar esta venta? Esta acción no se puede deshacer.")) {
        try {
            const response = await fetch(`https://appgh-2z0e.onrender.com/ventas/${ventaId}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" }
            });

            if (!response.ok) throw new Error("Error al eliminar la venta");

            alert("✅ Venta eliminada con éxito");
            cargarVentas(); // 🔄 Recargar la tabla
        } catch (error) {
            console.error("❌ Error al eliminar venta:", error);
            alert("❌ No se pudo eliminar la venta.");
        }
    }
}

function cerrarModalVenta() {
    const modalElement = document.getElementById("modalVenta");
    const modal = bootstrap.Modal.getInstance(modalElement);
    if (modal) {
        modal.hide(); // ✅ Cierra correctamente el modal con Bootstrap
    }
}



// Cierra el menú si se hace clic fuera
document.addEventListener("click", (event) => {
    if (!event.target.closest(".action-menu")) {
        document.querySelectorAll(".action-menu-content").forEach(m => m.style.display = "none");
    }
});

function filtrarVentas() {
    const filtroCliente = document.getElementById("filtroCliente").value.toLowerCase();
    const filtroFolio = document.getElementById("filtroFolio").value.toLowerCase();
    const filtroEstado = document.getElementById("filtroEstado").value; // Aquí antes filtrábamos por "estado"

    const ventasFiltradas = ventasGlobales.filter(venta => {
        const coincideCliente = venta.cliente.toLowerCase().includes(filtroCliente);
        const coincideFolio = venta.folio.toLowerCase().includes(filtroFolio);
        
        let coincideSaldo = true; // Default: mostrar todas
        if (filtroEstado === "pendiente") {
            coincideSaldo = venta.saldo_actual > 0; // Ventas con saldo pendiente
        } else if (filtroEstado === "pagada") {
            coincideSaldo = venta.saldo_actual === 0; // Ventas pagadas completamente
        }

        return coincideCliente && coincideFolio && coincideSaldo;
    });

    mostrarVentas(ventasFiltradas);
}

async function abrirModalHistorialAbonos(ventaId) {
    try {
        // Obtener datos de la venta
        const ventaRes = await fetch(`${API_BASE_URL}/ventas/${ventaId}`);
        if (!ventaRes.ok) throw new Error("Error al obtener datos de la venta");
        const { venta } = await ventaRes.json();

        // Mostrar datos de la venta en el modal
        document.getElementById("historialCliente").textContent = venta.cliente || "N/A";
        document.getElementById("historialFecha").textContent = new Date(venta.fecha).toLocaleDateString("es-MX") || "N/A";
        document.getElementById("historialSaldoInicial").textContent = parseFloat(venta.saldo_inicial).toFixed(2) || "0.00";
        document.getElementById("historialSaldoPendiente").textContent = parseFloat(venta.saldo_actual).toFixed(2) || "0.00";

        // Obtener abonos relacionados a esta venta
        const abonosRes = await fetch(`${API_BASE_URL}/abonos/venta/${ventaId}`);
        if (!abonosRes.ok) throw new Error("Error al obtener abonos");
        const abonos = await abonosRes.json();

        // Construir tabla de abonos
        const tabla = document.getElementById("tablaHistorialAbonos");
        tabla.innerHTML = "";

        if (abonos.length === 0) {
            tabla.innerHTML = `<tr><td colspan="4">No hay abonos registrados para esta venta.</td></tr>`;
        } else {
            abonos.forEach(abono => {
                const fila = `
                    <tr>
                        <td>${abono.id}</td>
                        <td>$${parseFloat(abono.monto).toFixed(2)}</td>
                        <td>${new Date(abono.fecha).toLocaleDateString("es-MX")}</td>
                        <td>${generarBotonesAbono(abono.id)}</td>
                    </tr>
                `;
                tabla.innerHTML += fila;
            });
        }

        // Mostrar el modal
        const modal = new bootstrap.Modal(document.getElementById("modalHistorialAbonos"));
        modal.show();

    } catch (error) {
        console.error("❌ Error al abrir historial de abonos:", error);
        alert("❌ No se pudo cargar el historial de abonos.");
    }
}

  
  // ✅ Flujo completo de abono + generación de PDF + QR + subida a Cloudinary + guardar URL
  async function agregarAbono() {
    const ventaId = document.getElementById("ventaId").value;
    const monto = parseFloat(document.getElementById("inputMontoAbono").value);
    const fecha = document.getElementById("inputFechaAbono").value;

    if (!ventaId || isNaN(monto) || !fecha) {
        alert("⚠️ Todos los campos son obligatorios.");
        return;
    }

    try {
        // 1️⃣ Registrar abono y generar recibo desde el backend
        const response = await fetch(`${API_BASE_URL}/abonos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ venta_id: ventaId, monto, fecha })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Error al registrar el abono");

        const abonoId = data.id || data.insertId;
        const reciboURL = data.recibo_url;

        // 2️⃣ Mostrar éxito y actualizar vista
        alert("✅ Abono registrado y recibo generado con QR.");
        cerrarModalAbono();
        await cargarVentas();
        await abrirModalHistorialAbonos(ventaId);

        // 3️⃣ Abrir automáticamente el recibo en nueva pestaña (opcional: espera breve)
        setTimeout(() => {
            window.open(reciboURL, "_blank");
        }, 1000); // espera 1 segundo para asegurar disponibilidad

    } catch (error) {
        console.error("❌ Error en el flujo de abono:", error);
        alert("❌ No se pudo registrar el abono o generar el recibo.");
    }
}

async function cargarVentas() {
    try {
        console.log("🔄 Cargando ventas desde el servidor...");
        const response = await fetch("https://appgh-2z0e.onrender.com/ventas");
        
        if (!response.ok) throw new Error("Error al obtener las ventas");

        const ventas = await response.json();

        // ✅ Convertir `saldo_inicial` y `saldo_actual` a número seguro
        ventas.forEach(v => {
            v.saldo_inicial = parseFloat(v.saldo_inicial) || 0;
            v.saldo_actual = parseFloat(v.saldo_actual) || 0;
        });

        ventasGlobales = ventas; // Guardamos las ventas para paginación y filtros
        console.log("✅ Ventas cargadas correctamente:", ventasGlobales); // 🔍 Depuración en consola

        mostrarVentas(ventasGlobales); // 🔄 Llamar a la función que renderiza la tabla

    } catch (error) {
        console.error("❌ Error al cargar ventas:", error);
    }
}


function formatearFecha(fecha) {
    if (!fecha) return "Fecha no disponible";

    const date = new Date(fecha);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Mes de 0-11, sumamos 1
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}/${month}/${day}`;
}

function mostrarControlesPaginacion(totalVentas) {
    const totalPaginas = Math.ceil(totalVentas / ventasPorPagina);
    document.getElementById("paginaActual").textContent = `Página ${paginaActual} de ${totalPaginas}`;

    const btnAnterior = document.querySelector(".btn-previous");
    const btnSiguiente = document.querySelector(".btn-next");

    if (paginaActual <= 1) {
        btnAnterior.disabled = true;
    } else {
        btnAnterior.disabled = false;
    }

    if (paginaActual >= totalPaginas) {
        btnSiguiente.disabled = true;
    } else {
        btnSiguiente.disabled = false;
    }
}

// ✅ Nueva función para mostrar las ventas en la tabla
function mostrarVentas(ventas) {
    const ventasTable = document.getElementById("ventasTable");
    if (!ventasTable) {
        console.error("❌ Error: No se encontró la tabla de ventas.");
        return;
    }

    ventasTable.innerHTML = ""; // Limpiar la tabla

    // 🔥 Paginación
    const inicio = (paginaActual - 1) * ventasPorPagina;
    const fin = inicio + ventasPorPagina;
    const ventasPaginadas = ventas.slice(inicio, fin);

    if (ventasPaginadas.length === 0) {
        ventasTable.innerHTML = `<tr><td colspan="7">No hay ventas registradas</td></tr>`;
        return;
    }

    ventasPaginadas.forEach(venta => {
        const saldoActual = parseFloat(venta.saldo_actual || 0);
        const saldoInicial = parseFloat(venta.saldo_inicial || 0);
        const fechaFormateada = new Date(venta.fecha).toLocaleDateString("es-MX");
        const estado = venta.estado || "";

        const fila = `
            <tr>
                <td>${venta.cliente}</td>
                <td>${fechaFormateada}</td>
                <td>$${saldoInicial.toFixed(2)}</td>
                <td>$${saldoActual.toFixed(2)}</td>
                <td>${venta.folio}</td>
                <td>${estado}</td>
                <td>${generarDropdownAcciones(venta.id, venta.cliente, venta.fecha, saldoInicial, saldoActual, venta.folio)}</td>
            </tr>
        `;

        ventasTable.innerHTML += fila;
    });

    mostrarControlesPaginacion(ventas.length);
}

async function generarEstadoCuentaCliente() {
    try {
        const clienteSeleccionado = document.getElementById("clienteSelect").value.trim();
        const url = clienteSeleccionado ? `/generar-estado-cuenta/${encodeURIComponent(clienteSeleccionado)}` : "/generar-estado-cuenta";

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const blob = await response.blob();
        const link = document.createElement("a");
        link.href = window.URL.createObjectURL(blob);
        link.download = `Estado_Cuenta_${clienteSeleccionado || "Todos"}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error("❌ Error al generar estado de cuenta:", error);
        alert("Ocurrió un error al generar el estado de cuenta. Intenta nuevamente.");
    }
}


async function cargarClientes() {
    try {
        const response = await fetch("https://appgh-2z0e.onrender.com/clientes");
        if (!response.ok) throw new Error("Error al obtener clientes");

        const clientes = await response.json();
        const clienteSelect = document.getElementById("clienteSelect");

        if (!clienteSelect) {
            console.error("❌ No se encontró el elemento clienteSelect.");
            return;
        }

        const fragment = document.createDocumentFragment();
        clientes.forEach(cliente => {
            let option = document.createElement("option");
            option.value = cliente.cliente;
            option.textContent = cliente.cliente;
            fragment.appendChild(option);
        });

        clienteSelect.innerHTML = '<option value="">-- Selecciona un cliente --</option>';
        clienteSelect.appendChild(fragment);

    } catch (error) {
        console.error("❌ Error al cargar clientes:", error);
    }
}

async function generarEstadoCuentaPDF() {
    const clienteInput = document.getElementById("clienteSelect");
    if (!clienteInput) {
        console.error("❌ Error: No se encontró el campo de cliente en el HTML.");
        alert("⚠️ Ocurrió un error. Asegúrate de que el campo de cliente existe.");
        return;
    }

    let cliente = clienteInput.value.trim();
    const doc = new jsPDF();

    // ✅ Si no hay cliente seleccionado, obtenemos todos los clientes y generamos un solo PDF
    if (!cliente) {
        alert("⚠️ No hay cliente seleccionado. Generando estado de cuenta para todos en un solo PDF...");
        try {
            const response = await fetch("/obtener-clientes");
            if (!response.ok) throw new Error("Error al obtener la lista de clientes");
            const clientes = await response.json();
            
            for (let i = 0; i < clientes.length; i++) {
                await agregarEstadoCuentaAlPDF(doc, clientes[i]);
                if (i < clientes.length - 1) doc.addPage(); // Agregar nueva página si no es el último cliente
            }
            
            doc.save("Estados_de_Cuenta.pdf");
            alert("✅ Se generó un solo PDF con todos los estados de cuenta.");
        } catch (error) {
            console.error("❌ Error al obtener la lista de clientes:", error);
            alert("❌ No se pudo obtener la lista de clientes.");
        }
        return;
    }

    // ✅ Si hay cliente seleccionado, generamos solo su estado de cuenta en un solo PDF
    await agregarEstadoCuentaAlPDF(doc, cliente);
    doc.save(`estado_cuenta_${cliente}.pdf`);
}

async function agregarEstadoCuentaAlPDF(doc, cliente) {
    try {
        const response = await fetch(`/obtener-estado-cuenta/${encodeURIComponent(cliente)}`);
        if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);
        
        const data = await response.json();
        if (data.error) {
            console.warn(`⚠️ No se generó estado de cuenta para ${cliente}:`, data.error);
            return;
        }
        console.log(`✅ Agregando estado de cuenta para: ${cliente}`, data);

        const { ventas, totalSaldoPendiente } = data;
        
        // ✅ Ajustar el título y centrarlo correctamente
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text("ESTADO DE CUENTA", 105, 20, { align: "center" });
        
        // ✅ Información del cliente y fecha mejor organizada
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(cliente.toUpperCase(), 20, 35);
        doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 150, 35);
        
        // ✅ Encabezado de tabla minimalista
        let startY = 50;
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Folio", 20, startY);
        doc.text("Fecha", 50, startY);
        doc.text("Saldo Inicial", 110, startY, { align: "right" });
        doc.text("Saldo Pendiente", 180, startY, { align: "right" });
        doc.setFont("helvetica", "normal");
        
        let y = startY + 6;
        let totalSaldoInicial = 0;
        let totalSaldoFinal = 0;
        
        ventas.forEach(venta => {
            let saldoInicial = parseFloat(venta.saldo_inicial) || 0;
            let saldoPendiente = parseFloat(venta.saldo_pendiente) || 0;
            totalSaldoInicial += saldoInicial;
            totalSaldoFinal += saldoPendiente;
            
            doc.text(venta.folio.toString(), 20, y);
            doc.text(new Date(venta.fecha).toLocaleDateString(), 50, y);
            doc.text(new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(saldoInicial), 110, y, { align: "right" });
            doc.text(new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(saldoPendiente), 180, y, { align: "right" });
            y += 6;
        });
        
        // ✅ Total destacado pero minimalista
        doc.setFont("helvetica", "bold");
        doc.text("TOTAL:", 20, y + 6);
        doc.text(new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalSaldoFinal), 180, y + 6, { align: "right" });
    } catch (error) {
        console.error(`❌ Error al agregar estado de cuenta para ${cliente}:`, error);
    }
}

async function descargarReciboPDF(idAbono) {
    try {
      const response = await fetch(`${API_URL}/abono/${idAbono}`);
      if (!response.ok) throw new Error("Recibo no disponible.");
  
      const { recibo_url } = await response.json();
      if (!recibo_url) throw new Error("Recibo aún no generado.");
  
      const a = document.createElement("a");
      a.href = recibo_url;
      a.download = `Recibo_Abono_${idAbono}.pdf`; // Nombre sugerido para guardar
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (error) {
      console.error("❌ Error descargando recibo:", error);
      alert("⚠️ El recibo no se pudo descargar.");
    }
  }
  
function cambiarPagina(direccion) {
    const totalPaginas = Math.ceil(ventasGlobales.length / ventasPorPagina);

    if (paginaActual + direccion >= 1 && paginaActual + direccion <= totalPaginas) {
        paginaActual += direccion;
        mostrarVentas(ventasGlobales);
    }
}

