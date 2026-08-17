# Certificados TLS (desarrollo)

Frontend: **https://192.168.1.43:8080**

El aviso «La conexión no es segura» en tablet aparece porque el certificado **no está firmado por una CA que el dispositivo confíe**. En LAN con IP privada no hay certificado público (Let's Encrypt); hay que usar **mkcert** e instalar su CA en cada dispositivo.

---

## 1. Generar certs con mkcert (en el PC/servidor)

En el host donde despliegas (k8-master):

```bash
# Instalar mkcert (una vez)
go install filippo.io/mkcert@latest
export PATH="$PATH:$(go env GOPATH)/bin"
mkcert -install

# Frontend (y/o copiar los mismos archivos al backend)
LAN_IP=192.168.1.43 ./deploy.sh --mkcert
./deploy.sh --rebuild
```

Si backend y frontend comparten la misma IP, puedes usar **los mismos** `cert.pem` / `key.pem` en ambos repos.

---

## 2. Instalar la CA en la tablet (evita «no es segura»)

La CA **no** es `cert.pem`: es **`rootCA.pem`**.

En el PC:

```bash
mkcert -CAROOT
# Muestra una carpeta, p. ej. ~/.local/share/mkcert/
# Copia rootCA.pem al tablet (email, Drive, USB, etc.)
```

### Android (Chrome)

1. Copia `rootCA.pem` al tablet.
2. **Ajustes → Seguridad → Más ajustes de seguridad → Cifrado y credenciales**  
   (ruta exacta varía según marca/Android)
3. **Instalar un certificado → Certificado de CA**
4. Pon un nombre (p. ej. «NILO dev») y confirma.
5. **Cierra Chrome por completo** (también desde apps recientes) y vuelve a abrir.
6. Entra en `https://192.168.1.43:8080`

Si sigue el aviso: borra caché del sitio o prueba en ventana privada.

**Nota:** En Android 7+ las apps pueden ignorar CAs de usuario; **Chrome sí las usa** para HTTPS web.

### iPad / iPhone

1. Envía `rootCA.pem` al dispositivo (AirDrop, Mail…).
2. Instala el perfil cuando iOS lo pida.
3. **Ajustes → General → Información → Ajustes de confianza de certificados** → activa confianza para «NILO dev» / mkcert.
4. Abre `https://192.168.1.43:8080` en Safari.

---

## 3. Si usaste OpenSSL (sin mkcert)

`./deploy.sh --mkcert` sin mkcert instalado genera cert **autofirmado**. El navegador **seguirá avisando** aunque pulses «Continuar»; no hay forma fiable de quitarlo en tablet sin instalar una CA.

**Solución:** instala mkcert en el servidor, regenera certs y instala `rootCA.pem` en la tablet (pasos arriba).

---

## 4. Comprobar

En el PC (debería salir candado verde si mkcert -install):

```bash
curl -vI https://192.168.1.43:8080/healthz
```

En tablet, la barra de direcciones debe mostrar **https** sin «No es seguro» tras instalar la CA.

---

## Resumen

| Método | Tablet sin aviso |
|--------|------------------|
| OpenSSL autofirmado | ❌ Solo «aceptar riesgo» |
| mkcert + `rootCA.pem` en tablet | ✅ |
| Certificado público (dominio real) | ✅ (producción) |
