async function cargarClientes() {
  try {
    const response = await fetch("https://appgh-2z0e.onrender.com/clientes2");
    const clientes = await response.json();
    const tbody = document.querySelector("#tablaClientes tbody");

    tbody.innerHTML = "";

    console.log("📦 Clientes recibidos:", clientes);

    if (!Array.isArray(clientes) || clientes.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No hay clientes registrados</td></tr>`;
      return;
    }

    clientes.forEach(cliente => {
      console.log("🧾 Cliente:", cliente);

      const fila = document.createElement("tr");
      fila.innerHTML = `
        <td>${cliente.id ?? '-'}</td>
        <td>${cliente.nombre || 'Sin nombre'}</td>
        <td>${cliente.telefono || '-'}</td>
        <td>${cliente.latitud ?? '-'}</td>
        <td>${cliente.longitud ?? '-'}</td>
        <td>
          <div class="dropdown">
            <button class="btn btn-sm btn-outline-light dropdown-toggle" type="button" data-bs-toggle="dropdown">
              Opciones
            </button>
            <ul class="dropdown-menu dropdown-menu-dark">
              <li>
                <a class="dropdown-item" href="#" onclick="editarCliente(${cliente.id}, '${cliente.nombre || ''}', '${cliente.telefono || ''}', '${cliente.latitud || ''}', '${cliente.longitud || ''}')">
                  <i class="fas fa-edit me-2 text-warning"></i>Editar
                </a>
              </li>
              <li>
                <a class="dropdown-item text-danger" href="#" onclick="eliminarCliente(${cliente.id})">
                  <i class="fas fa-trash-alt me-2"></i>Eliminar
                </a>
              </li>
            </ul>
          </div>
        </td>
      `;

      tbody.appendChild(fila);
    });

  } catch (error) {
    console.error("❌ Error al cargar clientes:", error);
    alert("Error al cargar la lista de clientes.");
  }
}

async function guardarCliente() {
  const nombre = document.getElementById("clienteNombre").value.trim();
  const telefono = document.getElementById("clienteTelefono").value.trim();
  let latitud = document.getElementById("clienteLatitud").value.trim();
  let longitud = document.getElementById("clienteLongitud").value.trim();

  if (!nombre) {
    alert("⚠️ El nombre es obligatorio.");
    return;
  }

  latitud = latitud === "" ? null : Number(latitud);
  longitud = longitud === "" ? null : Number(longitud);

  try {
    const response = await fetch("https://appgh-2z0e.onrender.com/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, telefono: telefono || null, latitud, longitud })
    });

    const data = await response.json();

    if (data.error) {
      alert("❌ Error: " + data.error);
    } else {
      alert("✅ Cliente guardado con éxito");
      document.getElementById("clienteForm").reset();
      await cargarClientes();
    }
  } catch (error) {
    console.error("❌ Error en guardarCliente:", error);
    alert("Error inesperado al guardar cliente.");
  }
}

function editarCliente(id, nombre, telefono, latitud, longitud) {
  const modalEl = document.getElementById("modalEditarCliente");
  const modal = new bootstrap.Modal(modalEl);

  modalEl.addEventListener('shown.bs.modal', () => {
    document.getElementById("editarId").value = id;
    document.getElementById("editarNombre").value = nombre;
    document.getElementById("editarTelefono").value = telefono;
    document.getElementById("editarLatitud").value = latitud;
    document.getElementById("editarLongitud").value = longitud;

    document.getElementById("editarNombre").focus(); // Darle foco controlado
  }, { once: true });

  modal.show();
}


async function eliminarCliente(id) {
  if (!confirm("¿Seguro que deseas eliminar este cliente?")) return;

  try {
    const response = await fetch(`https://appgh-2z0e.onrender.com/clientes/${id}`, {
      method: "DELETE"
    });

    const data = await response.json();

    if (data.error) {
      alert("❌ Error: " + data.error);
    } else {
      alert("✅ Cliente eliminado");
      await cargarClientes();
    }
  } catch (error) {
    console.error("❌ Error al eliminar cliente:", error);
    alert("Error al eliminar cliente.");
  }
}

async function guardarCambiosCliente() {
  const id = document.getElementById("editarId").value;
  const nombre = document.getElementById("editarNombre").value.trim();
  const telefono = document.getElementById("editarTelefono").value.trim();
  const latitud = document.getElementById("editarLatitud").value.trim();
  const longitud = document.getElementById("editarLongitud").value.trim();

  if (!nombre) {
    alert("⚠️ El nombre es obligatorio.");
    return;
  }

  try {
    const response = await fetch(`https://appgh-2z0e.onrender.com/clientes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre,
        telefono: telefono || null,
        latitud: latitud === "" ? null : Number(latitud),
        longitud: longitud === "" ? null : Number(longitud)
      })
    });

    const data = await response.json();

    if (data.error) {
      alert("❌ Error: " + data.error);
    } else {
      alert("✅ Cliente actualizado correctamente");
      const modal = bootstrap.Modal.getInstance(document.getElementById("modalEditarCliente"));
      modal.hide();
      await cargarClientes();
    }
  } catch (error) {
    console.error("❌ Error al actualizar cliente:", error);
    alert("Error al guardar cambios.");
  }
}

function obtenerUbicacion() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        document.getElementById("clienteLatitud").value = pos.coords.latitude.toFixed(7);
        document.getElementById("clienteLongitud").value = pos.coords.longitude.toFixed(7);
      },
      err => {
        alert("❌ No se pudo obtener la ubicación.");
        console.error("Error geolocalización:", err);
      }
    );
  } else {
    alert("⚠️ Tu navegador no soporta geolocalización.");
  }
}

function obtenerUbicacionEdicion() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        document.getElementById("editarLatitud").value = pos.coords.latitude.toFixed(7);
        document.getElementById("editarLongitud").value = pos.coords.longitude.toFixed(7);
      },
      err => {
        alert("❌ No se pudo obtener la ubicación.");
        console.error("Error geolocalización (edición):", err);
      }
    );
  } else {
    alert("⚠️ Tu navegador no soporta geolocalización.");
  }
}


async function mostrarClientesEnMapa() {
  try {
    const response = await fetch("https://appgh-2z0e.onrender.com/clientes/geo");
    const clientes = await response.json();

    const mapa = L.map("mapaClientes").setView([22.5, -102], 5);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors"
    }).addTo(mapa);

    clientes.forEach(cliente => {
      const marker = L.marker([cliente.latitud, cliente.longitud]).addTo(mapa);
      marker.bindPopup(`<b>${cliente.nombre}</b><br>Lat: ${cliente.latitud}<br>Lon: ${cliente.longitud}`);
    });

  } catch (error) {
    console.error("❌ Error al cargar clientes en el mapa:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  cargarClientes();
  mostrarClientesEnMapa();
});
