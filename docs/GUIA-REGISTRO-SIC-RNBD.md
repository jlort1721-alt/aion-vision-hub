# Guia de Registro en el RNBD de la SIC

> Registro Nacional de Bases de Datos — Superintendencia de Industria y Comercio
> URL: <https://rnbd.sic.gov.co>

---

## 1. Introduccion

La Ley 1581 de 2012 y el Decreto 1074 de 2015 (articulo 2.2.2.26.3.1 y
siguientes) obligan a toda persona natural o juridica que trate datos
personales a inscribir sus bases de datos ante el RNBD de la SIC.

El incumplimiento puede acarrear sanciones de hasta 2.000 SMMLV.

---

## 2. Prerrequisitos

Antes de iniciar el registro se debe contar con:

- [ ] **NIT** de la organizacion (Clave Seguridad CTA).
- [ ] **Representante legal** identificado con cedula y datos de contacto.
- [ ] **Oficial de Proteccion de Datos Personales** designado formalmente
      (acta de nombramiento o carta de designacion).
- [ ] **Politica de Tratamiento de Datos Personales** publicada y
      actualizada (URL publica o documento disponible).
- [ ] **Aviso de Privacidad** vigente.
- [ ] **Manual interno de politicas y procedimientos** para el tratamiento
      de datos personales.
- [ ] Acceso al portal RNBD con usuario y contrasena registrados
      (<https://rnbd.sic.gov.co>).
- [ ] Inventario completo de bases de datos (ver seccion 3).

---

## 3. Inventario de Bases de Datos a Registrar

### 3.1 Residentes

| Campo | Detalle |
|-------|---------|
| Nombre de la base | Residentes |
| Volumen aproximado | ~1.800 registros |
| Datos contenidos | Nombre completo, numero de documento, datos de contacto (telefono, correo), unidad de vivienda |
| Clasificacion SIC | **PRIVADO** |
| Finalidad | Gestion de acceso, comunicacion con residentes, administracion de conjuntos residenciales |
| Forma de recoleccion | Formulario de registro en porteria, aplicacion web |
| Medio de almacenamiento | Base de datos PostgreSQL en servidor cloud |

### 3.2 Biometria Facial

| Campo | Detalle |
|-------|---------|
| Nombre de la base | Biometria Facial |
| Volumen aproximado | Variable (imagenes de rostro vinculadas a residentes) |
| Datos contenidos | Imagen del rostro (plantilla biometrica) |
| Clasificacion SIC | **SENSIBLE** |
| Finalidad | Verificacion de identidad para control de acceso |
| Forma de recoleccion | Captura mediante camara en punto de acceso, previo consentimiento explicito |
| Medio de almacenamiento | Base de datos PostgreSQL / almacenamiento de archivos en servidor cloud |
| Observacion | Requiere autorizacion expresa e informada por tratarse de dato sensible (art. 6, Ley 1581) |

### 3.3 Vehiculos

| Campo | Detalle |
|-------|---------|
| Nombre de la base | Vehiculos |
| Volumen aproximado | ~1.200 registros |
| Datos contenidos | Placa, marca, color, propietario (vinculado a residente) |
| Clasificacion SIC | **SEMIPRIVADO** |
| Finalidad | Control de acceso vehicular, registro de parqueaderos |
| Forma de recoleccion | Registro en porteria, reconocimiento automatico de placas (LPR) |
| Medio de almacenamiento | Base de datos PostgreSQL en servidor cloud |

### 3.4 CCTV (Videovigilancia)

| Campo | Detalle |
|-------|---------|
| Nombre de la base | CCTV — Grabaciones de Video |
| Volumen aproximado | 22 sedes, grabacion continua |
| Datos contenidos | Grabaciones de video de camaras de seguridad (pueden contener imagenes de personas) |
| Clasificacion SIC | **PRIVADO** |
| Finalidad | Seguridad fisica, prevencion y deteccion de incidentes, soporte a investigaciones |
| Forma de recoleccion | Captura automatica mediante camaras IP (Hikvision, Dahua, etc.) |
| Medio de almacenamiento | NVR/DVR local en cada sede, respaldo en servidor cloud |
| Observacion | Debe existir senalizacion visible informando la existencia de videovigilancia (aviso de privacidad simplificado) |

### 3.5 Operadores / Empleados

| Campo | Detalle |
|-------|---------|
| Nombre de la base | Operadores y Empleados |
| Volumen aproximado | Variable |
| Datos contenidos | Nombre, documento, cargo, datos de contacto, datos laborales (turno, sede asignada) |
| Clasificacion SIC | **PRIVADO** |
| Finalidad | Gestion de recursos humanos, asignacion de turnos, control de acceso a la plataforma |
| Forma de recoleccion | Proceso de vinculacion laboral |
| Medio de almacenamiento | Base de datos PostgreSQL en servidor cloud |

### 3.6 Accesos (Logs de Entrada/Salida)

| Campo | Detalle |
|-------|---------|
| Nombre de la base | Registros de Acceso |
| Volumen aproximado | Variable (crecimiento continuo) |
| Datos contenidos | Fecha/hora, identificacion de la persona, tipo de acceso (entrada/salida), sede, medio de verificacion |
| Clasificacion SIC | **PRIVADO** |
| Finalidad | Trazabilidad de accesos, seguridad, generacion de reportes para administracion |
| Forma de recoleccion | Registro automatico en punto de acceso (biometria, tarjeta, app) |
| Medio de almacenamiento | Base de datos PostgreSQL en servidor cloud |

### 3.7 IoT (Logs de Dispositivos Domoticos)

| Campo | Detalle |
|-------|---------|
| Nombre de la base | IoT — Dispositivos Domoticos |
| Volumen aproximado | Variable (crecimiento continuo) |
| Datos contenidos | Identificador de dispositivo, tipo de evento, fecha/hora, estado, usuario asociado (si aplica) |
| Clasificacion SIC | **PRIVADO** |
| Finalidad | Monitoreo y control de dispositivos inteligentes (iluminacion, cerraduras, sensores), generacion de alertas |
| Forma de recoleccion | Registro automatico desde controladores IoT (Sonoff/eWeLink, etc.) |
| Medio de almacenamiento | Base de datos PostgreSQL en servidor cloud |

---

## 4. Clasificacion segun Categorias de la SIC

| Categoria SIC | Bases de datos |
|---------------|----------------|
| **Sensible** (art. 5, Ley 1581) | Biometria Facial |
| **Privado** (art. 3, Ley 1581) | Residentes, CCTV, Operadores/Empleados, Accesos, IoT |
| **Semiprivado** (art. 3, Ley 1581) | Vehiculos |

> **Nota:** Los datos sensibles requieren autorizacion explicita del titular
> y medidas reforzadas de seguridad. Nunca pueden ser obligatorios salvo
> por mandato legal.

---

## 5. Plantilla de Finalidades (Propositos del Tratamiento)

Para cada base de datos, registrar las finalidades aplicables:

1. **Ejecucion del contrato:** Cumplir con las obligaciones derivadas del
   contrato de prestacion de servicios de seguridad y administracion.
2. **Control de acceso:** Verificar la identidad de personas y vehiculos
   para permitir o denegar el ingreso a las sedes.
3. **Seguridad fisica:** Prevenir, detectar e investigar incidentes de
   seguridad mediante videovigilancia y registros de acceso.
4. **Gestion administrativa:** Administrar la relacion con residentes,
   propietarios y visitantes de los conjuntos residenciales.
5. **Gestion de talento humano:** Administrar la relacion laboral con
   operadores y empleados.
6. **Monitoreo de infraestructura:** Supervisar el estado de dispositivos
   IoT y domoticos para garantizar su correcto funcionamiento.
7. **Cumplimiento legal:** Atender requerimientos de autoridades
   competentes conforme a la ley colombiana.
8. **Mejora del servicio:** Analizar datos agregados y anonimizados para
   mejorar la calidad del servicio.
9. **Comunicacion:** Enviar notificaciones operativas relacionadas con el
   servicio (alertas, novedades, emergencias).
10. **Transferencia y transmision:** Compartir datos con encargados del
    tratamiento (proveedores de hosting, plataformas cloud) bajo acuerdos
    de procesamiento.

---

## 6. Proceso de Registro Paso a Paso

### Paso 1 — Crear cuenta en el RNBD

1. Ingresar a <https://rnbd.sic.gov.co>.
2. Seleccionar "Registrar nueva organizacion".
3. Diligenciar NIT, razon social, datos del representante legal.
4. Confirmar el correo electronico.

### Paso 2 — Designar al Oficial de Proteccion de Datos

1. En el portal, ir a "Datos de la organizacion" → "Responsable del
   tratamiento".
2. Registrar nombre completo, cargo, correo y telefono del Oficial de
   Proteccion de Datos.

### Paso 3 — Registrar la Politica de Tratamiento

1. Ir a "Politicas" → "Registrar politica".
2. Indicar la URL donde esta publicada la politica o cargar el documento PDF.
3. Indicar la fecha de ultima actualizacion.

### Paso 4 — Registrar cada base de datos

Repetir para cada una de las 7 bases de datos del inventario (seccion 3):

1. Ir a "Bases de datos" → "Registrar nueva base de datos".
2. Diligenciar:
   - Nombre de la base.
   - Finalidades del tratamiento (seleccionar de la lista o agregar las
     indicadas en seccion 5).
   - Datos personales contenidos (seleccionar tipos de datos).
   - Clasificacion (Sensible, Privado, Semiprivado, Publico).
   - Forma de obtencion de la autorizacion.
   - Canal de atencion al titular (correo, formulario web, etc.).
   - Medidas de seguridad implementadas (cifrado, control de acceso,
     backups, etc.).
   - Encargados del tratamiento (proveedores cloud, hosting, etc.).
   - Pais de almacenamiento (si los servidores estan fuera de Colombia,
     indicar el pais y el fundamento de la transferencia internacional).
3. Guardar y pasar a la siguiente base de datos.

### Paso 5 — Revisar y enviar

1. Ir a "Resumen" y verificar que las 7 bases de datos estan completas.
2. Confirmar que la informacion del Responsable y el Oficial son correctos.
3. Hacer clic en "Enviar inscripcion".
4. Descargar el comprobante de radicacion.

### Paso 6 — Seguimiento

1. La SIC puede solicitar correcciones o informacion adicional.
2. Monitorear el estado del tramite en el portal.
3. Una vez aprobado, descargar el certificado de inscripcion.

---

## 7. Checklist de Documentos Requeridos

- [ ] Certificado de existencia y representacion legal (Camara de Comercio,
      vigencia no mayor a 30 dias).
- [ ] Copia del NIT / RUT.
- [ ] Documento de identidad del representante legal.
- [ ] Acta de designacion del Oficial de Proteccion de Datos Personales.
- [ ] Politica de Tratamiento de Datos Personales (documento o URL).
- [ ] Aviso de Privacidad vigente.
- [ ] Manual interno de politicas y procedimientos para tratamiento de datos.
- [ ] Modelo de autorizacion utilizado para recolectar datos (consentimiento
      informado).
- [ ] Modelo de autorizacion especifica para datos sensibles (biometria).
- [ ] Contratos o acuerdos con encargados del tratamiento (Data Processing
      Agreements).
- [ ] Inventario de bases de datos diligenciado (seccion 3 de esta guia).
- [ ] Evidencia de medidas de seguridad implementadas (descripcion tecnica).
- [ ] Comprobante de senalizacion de videovigilancia en las 22 sedes.

---

## 8. Cronograma Estimado

| Actividad | Duracion estimada |
|-----------|-------------------|
| Recopilacion de documentos y prerrequisitos | 1–2 semanas |
| Revision y actualizacion de politicas de tratamiento | 1 semana |
| Inventario y clasificacion de bases de datos | 1 semana |
| Diligenciamiento del formulario en el portal RNBD | 2–3 dias |
| Revision interna antes de envio | 1–2 dias |
| Envio de la inscripcion | 1 dia |
| Respuesta de la SIC (correcciones si aplica) | 2–4 semanas |
| Registro aprobado y certificado emitido | 1–2 semanas adicionales |
| **Total estimado** | **6–10 semanas** |

---

## 9. Actualizacion y Mantenimiento

- El registro debe actualizarse **dentro de los primeros 10 dias habiles
  del mes de enero de cada ano** o cuando haya cambios significativos en
  las bases de datos (nuevas bases, cambio de finalidades, nuevos
  encargados, etc.).
- Documentar cada actualizacion con fecha y descripcion del cambio.
- Conservar evidencia de todas las versiones de las politicas y
  autorizaciones.

---

## 10. Referencias Legales

- **Ley 1581 de 2012** — Regimen General de Proteccion de Datos Personales.
- **Decreto 1377 de 2013** (compilado en Decreto 1074 de 2015) —
  Reglamentacion parcial de la Ley 1581.
- **Decreto 886 de 2014** (compilado en Decreto 1074 de 2015) — Registro
  Nacional de Bases de Datos.
- **Circular Externa 002 de 2015 de la SIC** — Instrucciones sobre el RNBD.
- **Guia para la implementacion del principio de responsabilidad
  demostrada (Accountability)** — SIC.
