let mapaClientes = new Map();
let mapaProductos = new Map();
let paginaActual = 1;
const preciosPorPagina = 10;


document.addEventListener("DOMContentLoaded", async () => {
  await cargarClientesYProductos();
  await cargarPreciosCliente();

  document.getElementById("formPrecios").addEventListener("submit", (e) => {
    e.preventDefault();
    guardarPrecioCliente();
  });

  document.getElementById("filtroCliente").addEventListener("input", filtrarPrecios);
  document.getElementById("filtroProducto").addEventListener("input", filtrarPrecios);

});

async function cargarClientesYProductos() {
  const [clientesRes, productosRes] = await Promise.all([
    fetch("https://appgh-2z0e.onrender.com/clientes2"),
    fetch("https://appgh-2z0e.onrender.com/productos")
  ]);

  const clientes = await clientesRes.json();
  const productos = await productosRes.json();

  const nombresClientes = [];
  const nombresProductos = [];

  clientes.forEach(c => {
    mapaClientes.set(c.nombre.toLowerCase(), c.id);
    nombresClientes.push(c.nombre);
  });

  productos.forEach(p => {
    mapaProductos.set(p.nombre.toLowerCase(), p.id);
    nombresProductos.push(p.nombre);
  });

  new Awesomplete(document.getElementById("inputCliente"), {
    list: nombresClientes,
    minChars: 1,
    autoFirst: true
  });

  new Awesomplete(document.getElementById("inputProducto"), {
    list: nombresProductos,
    minChars: 1,
    autoFirst: true
  });
}

function filtrarPrecios() {
  const filtroCliente = document.getElementById("filtroCliente").value.toLowerCase();
  const filtroProducto = document.getElementById("filtroProducto").value.toLowerCase();

  const filtrados = preciosGlobal.filter(p =>
    p.cliente_nombre.toLowerCase().includes(filtroCliente) &&
    p.producto_nombre.toLowerCase().includes(filtroProducto)
  );

  renderizarPrecios(filtrados);
}


async function guardarPrecioCliente() {
  const nombreCliente = document.getElementById("inputCliente").value.trim().toLowerCase();
  const nombreProducto = document.getElementById("inputProducto").value.trim().toLowerCase();
  const precio = parseFloat(document.getElementById("precioPersonalizado").value);

  const cliente_id = mapaClientes.get(nombreCliente);
  const producto_id = mapaProductos.get(nombreProducto);

  if (!cliente_id) {
    alert("⚠️ Cliente no válido.");
    return;
  }
  if (!producto_id) {
    alert("⚠️ Producto no válido.");
    return;
  }
  if (isNaN(precio)) {
    alert("⚠️ Precio inválido.");
    return;
  }

  try {
    const res = await fetch("https://appgh-2z0e.onrender.com/precios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cliente_id, producto_id, precio })
    });

    const data = await res.json();

    if (data.error) {
      alert("❌ Error: " + data.error);
    } else {
      alert("✅ Precio asignado correctamente");
      document.getElementById("inputCliente").value = "";
      document.getElementById("inputProducto").value = "";
      document.getElementById("precioPersonalizado").value = "";
      cargarPreciosCliente();
    }
  } catch (err) {
    console.error("❌ Error al guardar precio:", err);
    alert("Error al guardar precio personalizado.");
  }
}
function renderizarPrecios(precios) {
  const tbody = document.querySelector("#tablaPreciosCliente tbody");
  const paginador = document.getElementById("paginador");
  tbody.innerHTML = "";
  paginador.innerHTML = "";

  if (precios.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No hay coincidencias</td></tr>`;
    return;
  }

  const totalPaginas = Math.ceil(precios.length / preciosPorPagina);
  const inicio = (paginaActual - 1) * preciosPorPagina;
  const preciosPagina = precios.slice(inicio, inicio + preciosPorPagina);

  preciosPagina.forEach(p => {
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${p.cliente_nombre}</td>
      <td>${p.producto_nombre}</td>
      <td>$${parseFloat(p.precio).toFixed(2)}</td>
      <td>
        <div class="dropdown">
          <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
            Opciones
          </button>
          <ul class="dropdown-menu dropdown-menu-dark">
            <li>
              <a class="dropdown-item" href="#" onclick="editarPrecioCliente(${p.id}, '${p.cliente_nombre}', '${p.producto_nombre}', '${p.precio}')">
                <i class="fas fa-edit me-2 text-warning"></i>Editar
              </a>
            </li>
            <li>
              <a class="dropdown-item text-danger" href="#" onclick="eliminarPrecioCliente(${p.id})">
                <i class="fas fa-trash-alt me-2"></i>Eliminar
              </a>
            </li>
          </ul>
        </div>
      </td>
    `;
    tbody.appendChild(fila);
  });

  // Crear botones de paginación
  for (let i = 1; i <= totalPaginas; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    btn.className = `btn btn-sm mx-1 ${i === paginaActual ? 'btn-primary' : 'btn-outline-primary'}`;
    btn.onclick = () => {
      paginaActual = i;
      renderizarPrecios(precios);
    };
    paginador.appendChild(btn);
  }
}

let preciosGlobal = []; // 👈 Global
async function cargarPreciosCliente() {
  try {
    const res = await fetch("https://appgh-2z0e.onrender.com/precios");
    const precios = await res.json();
    preciosGlobal = precios;
    paginaActual = 1;
    filtrarPrecios(); // Ya hace el renderizado y slicing
  } catch (err) {
    console.error("❌ Error al cargar precios:", err);
    renderizarPrecios([]);
  }
}

function editarPrecioCliente(id, cliente, producto, precio) {
  document.getElementById("editarPrecioId").value = id;
  document.getElementById("editarCliente").value = cliente;
  document.getElementById("editarProducto").value = producto;
  document.getElementById("editarPrecio").value = precio;

  const modal = new bootstrap.Modal(document.getElementById("modalEditarPrecio"));
  modal.show();
}

async function guardarCambiosPrecioCliente() {
  const id = document.getElementById("editarPrecioId").value;
  const precio = parseFloat(document.getElementById("editarPrecio").value);

  if (!id || isNaN(precio)) {
    alert("⚠️ Precio inválido.");
    return;
  }

  try {
    const res = await fetch(`https://appgh-2z0e.onrender.com/precios/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ precio })
    });

    const data = await res.json();

    if (data.error) {
      alert("❌ Error: " + data.error);
    } else {
      alert("✅ Precio actualizado");
      bootstrap.Modal.getInstance(document.getElementById("modalEditarPrecio")).hide();
      cargarPreciosCliente();
    }
  } catch (err) {
    console.error("❌ Error al actualizar precio:", err);
    alert("Error al actualizar precio.");
  }
}

async function eliminarPrecioCliente(id) {
  if (!confirm("¿Seguro que deseas eliminar este precio personalizado?")) return;

  try {
    const res = await fetch(`https://appgh-2z0e.onrender.com/precios/${id}`, {
      method: "DELETE"
    });

    const data = await res.json();

    if (data.error) {
      alert("❌ Error: " + data.error);
    } else {
      alert("✅ Precio eliminado");
      cargarPreciosCliente();
    }
  } catch (err) {
    console.error("❌ Error al eliminar precio:", err);
    alert("Error al eliminar precio.");
  }
}
