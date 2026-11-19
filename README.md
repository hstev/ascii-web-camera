# ASCII//CAM

Cámara web en tiempo real convertida a arte ASCII, con paletas estilo Matrix.

- **Siempre en movimiento**: antes de dar permiso (o si se niega) muestra estática de televisor en ASCII con el letrero "SIN SEÑAL"; al encender la cámara hace una transición de "sintonizando".
- **Paletas**: Matrix, Ámbar, Cian, Neón y Papel, o colores personalizados de fondo y caracteres.
- **Ajustes**: juego de caracteres (katakana Matrix, clásico, detallado, bloques, binario), densidad, contraste, lluvia digital, efecto CRT, invertir y espejo. Se guardan en el navegador.
- **Foto**: botón obturador o barra espaciadora. Se puede compartir (Web Share API con archivos), descargar como PNG o copiar como texto ASCII.
- Todo se procesa localmente; ningún fotograma sale del dispositivo.

## Ejecutar

Sin dependencias ni compilación. La cámara exige un contexto seguro (HTTPS o `localhost`):

```sh
python3 -m http.server 8000
# abrir http://localhost:8000
```

Para probar desde el móvil hay que servirlo por HTTPS (por ejemplo con un túnel o un hosting estático como GitHub Pages).

## Despliegue

`.github/workflows/pages.yml` verifica el código en cada push y PR, y publica `main` en GitHub Pages. Requiere activar una vez **Settings → Pages → Source: GitHub Actions** en el repositorio.
