# NILO · Frontend

Frontend de **NILO**, plataforma para la monitorización médica integral de pacientes.

Construido con **React 18 + TypeScript + Vite** y **React Router** (rutas anidadas).
Arquitectura modular por roles, con componentes, layouts y vistas reutilizables.
Listo para desplegar en un contenedor **Docker** (build + nginx).

## Requisitos

- Node.js 20+ (probado con Node 22/25)
- npm 10+
- Docker (opcional, para despliegue en contenedor)

## Puesta en marcha (desarrollo)

Requiere **HTTPS** (cámara, APIs del navegador). Certificados con [mkcert](https://github.com/FiloSottile/mkcert):

```bash
npm install
cp .env.example .env
LAN_IP=192.168.1.43 ./deploy.sh --mkcert   # genera certs/cert.pem + key.pem
./deploy.sh --dev                          # https://<IP>:5173, proxy /api/v1 → backend :8443
```

O despliegue Docker:

```bash
./deploy.sh --rebuild    # https://192.168.1.43:8080
```

API backend: `https://192.168.1.43:8443/api/v1`. El frontend llama a `/api/v1` en la misma origen (sin mixed content).

Credenciales demo (backend): ver documentación en `docs/01.login_patient_node_spec.md`.

## Scripts

| Comando             | Descripción                                    |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Servidor de desarrollo con HMR                 |
| `npm run build`     | Comprobación de tipos + build de producción    |
| `npm run preview`   | Sirve localmente el build de producción        |
| `npm run typecheck` | Solo comprobación de tipos                     |

## Despliegue con Docker

```bash
LAN_IP=192.168.1.43 ./deploy.sh --mkcert   # una vez
./deploy.sh --rebuild                      # https://192.168.1.43:8080
```

Ver `certs/README.md` para instalar la CA mkcert en tablet.

El `Dockerfile` es multi-stage: compila con Node y sirve los estáticos con
nginx, que incluye fallback SPA para que funcione el enrutado del lado cliente.

## Arquitectura

Diseño **modular por características (feature-based)**. Cada rol vive en su
propia carpeta con su navegación, layout y páginas, reutilizando componentes y
layouts comunes.

```
src/
├── main.tsx                 # Punto de entrada
├── App.tsx                  # Providers + Router
├── config/                  # Acceso tipado a variables de entorno
├── types/                   # Tipos compartidos (roles, usuario, navegación)
├── services/                # Cliente HTTP + servicios (auth…)
├── context/                 # AuthContext (sesión y roles)
├── hooks/                   # Hooks reutilizables (useAuth, useMediaQuery…)
├── router/                  # Definición de rutas, paths y guardas
├── styles/                  # Design tokens, reset y estilos globales
├── components/
│   ├── ui/                  # Componentes reutilizables (Button, Card, Badge…)
│   ├── layout/              # Header, Footer, Sidebar, Brand
│   ├── common/              # PageHeader y otros bloques comunes
│   └── icons/               # Iconos SVG
├── layouts/                 # DashboardLayout (genérico) y AuthLayout
└── features/                # Un módulo por área de usuario
    ├── auth/                # Login
    ├── admin/               # Administrador
    ├── doctor/              # Médico
    ├── nurse/               # Enfermería
    ├── patient/             # Paciente
    └── shared/              # Páginas comunes (404, redirección raíz…)
```

### Roles de usuario

Definidos en `src/types/user.ts` (`UserRole`). Cada rol tiene su propia área
protegida: `/admin`, `/doctor`, `/nurse`, `/patient`. `ProtectedRoute` exige
sesión y valida el rol antes de renderizar.

### Layouts reutilizables

`DashboardLayout` es **agnóstico al rol**: recibe los `navItems` y la etiqueta
de sección, y monta `Sidebar + AppHeader + <Outlet /> + AppFooter`. Así los 4
roles comparten la misma carcasa cambiando solo su configuración de navegación.

### Vistas modulares e intercambio de subvistas

Cada vista es un fichero independiente dentro de `features/<rol>/pages/`. El
enrutado anidado permite tener **contenedores con subvistas intercambiables**:

- Ejemplo: `features/doctor/pages/PatientDetail/PatientDetailPage.tsx` tiene dos
  contenedores. El izquierdo muestra la ficha del paciente (fija) y el derecho
  usa `TabNav` + un `<Outlet />` interno para alternar entre las subvistas
  **Resumen / Constantes / Historial** (`tabs/`), sin recargar el resto.

Para añadir una nueva subvista basta con crear el componente en `tabs/` y
registrarlo como ruta hija en `src/router/index.tsx`.

## Conexión con el backend

Configura `VITE_API_BASE_URL` y pon `VITE_USE_MOCKS=false`. El cliente HTTP
(`src/services/api.ts`) añade automáticamente el token `Bearer` y centraliza el
manejo de errores.
