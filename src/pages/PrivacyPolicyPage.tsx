import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Mail, Phone, MapPin, ExternalLink } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function PrivacyPolicyPage() {
  return (
    <ScrollArea className="h-full">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Shield className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold">
              Politica de Privacidad y Tratamiento de Datos Personales
            </CardTitle>
            <p className="text-muted-foreground mt-2">
              Clave Seguridad CTA — Cooperativa de Trabajo Asociado
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              NIT: [NIT de la empresa] — Domicilio: Medellin, Antioquia, Colombia
            </p>
            <p className="text-sm text-muted-foreground">
              Dominio: aionseg.co
            </p>
            <Separator className="mt-4" />
            <p className="text-xs text-muted-foreground">
              Ultima actualizacion: 29 de marzo de 2026
            </p>
          </CardHeader>
        </Card>

        {/* 1. Introduccion y marco legal */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">1. Introduccion y Marco Legal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed">
            <p>
              <strong>Clave Seguridad CTA</strong> (en adelante, "la Cooperativa", "nosotros" o "el Responsable del Tratamiento"),
              con domicilio en la ciudad de Medellin, departamento de Antioquia, Republica de Colombia, en cumplimiento de la
              <strong> Ley 1581 de 2012</strong> (Ley de Proteccion de Datos Personales o Habeas Data), el
              <strong> Decreto Reglamentario 1377 de 2013</strong> (compilado en el Decreto 1074 de 2015),
              y demas normas concordantes, adopta la presente Politica de Privacidad y Tratamiento de Datos Personales
              para garantizar el derecho constitucional que tienen todas las personas a conocer, actualizar y rectificar
              las informaciones que se hayan recogido sobre ellas en bases de datos o archivos, consagrado en el
              <strong> articulo 15 de la Constitucion Politica de Colombia</strong>.
            </p>
            <p>
              Esta politica aplica a todos los datos personales recopilados y tratados a traves de la plataforma
              <strong> AION Security Platform</strong> (en adelante, "la Plataforma"), disponible en el dominio
              <strong> aionseg.co</strong>, asi como a cualquier dato recopilado por medios fisicos o electronicos
              en el ejercicio de nuestras actividades de seguridad, vigilancia y control de acceso.
            </p>
          </CardContent>
        </Card>

        {/* 2. Responsable del tratamiento */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">2. Responsable del Tratamiento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/50 rounded-lg p-4">
              <div>
                <p className="font-semibold">Razon Social:</p>
                <p>Clave Seguridad CTA</p>
              </div>
              <div>
                <p className="font-semibold">Tipo de Organizacion:</p>
                <p>Cooperativa de Trabajo Asociado</p>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="font-semibold">Domicilio:</p>
                  <p>Medellin, Antioquia, Colombia</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="font-semibold">Correo de Contacto:</p>
                  <p>privacidad@aionseg.co</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="font-semibold">Telefono:</p>
                  <p>[Telefono de contacto]</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <ExternalLink className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="font-semibold">Sitio Web:</p>
                  <p>https://aionseg.co</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Definiciones */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">3. Definiciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>Para efectos de la presente politica, se adoptaran las definiciones contenidas en el articulo 3 de la Ley 1581 de 2012:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Dato personal:</strong> Cualquier informacion vinculada o que pueda asociarse a una o varias personas naturales determinadas o determinables.</li>
              <li><strong>Dato publico:</strong> Dato que no es semiprivado, privado ni sensible. Son considerados datos publicos, entre otros, los datos relativos al estado civil de las personas, su profesion u oficio, y su calidad de comerciante o servidor publico.</li>
              <li><strong>Dato semiprivado:</strong> Dato que no tiene naturaleza intima, reservada ni publica, cuyo conocimiento o divulgacion puede interesar no solo a su titular sino a cierto sector o grupo de personas.</li>
              <li><strong>Dato privado:</strong> Dato que por su naturaleza intima o reservada solo es relevante para el titular.</li>
              <li><strong>Dato sensible:</strong> Dato que afecta la intimidad del titular o cuyo uso indebido puede generar su discriminacion (origen racial o etnico, orientacion politica, convicciones religiosas, datos biometricos, salud, vida sexual, entre otros).</li>
              <li><strong>Titular:</strong> Persona natural cuyos datos personales sean objeto de tratamiento.</li>
              <li><strong>Responsable del tratamiento:</strong> Persona natural o juridica que decide sobre la base de datos y/o el tratamiento de los datos.</li>
              <li><strong>Encargado del tratamiento:</strong> Persona natural o juridica que realiza el tratamiento de datos personales por cuenta del responsable.</li>
              <li><strong>Tratamiento:</strong> Cualquier operacion sobre datos personales, tales como recoleccion, almacenamiento, uso, circulacion o supresion.</li>
              <li><strong>Autorizacion:</strong> Consentimiento previo, expreso e informado del titular para llevar a cabo el tratamiento de datos personales.</li>
              <li><strong>Base de datos:</strong> Conjunto organizado de datos personales que sea objeto de tratamiento.</li>
              <li><strong>PQRS:</strong> Peticiones, Quejas, Reclamos y Sugerencias.</li>
            </ul>
          </CardContent>
        </Card>

        {/* 4. Principios del tratamiento */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">4. Principios del Tratamiento de Datos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>El tratamiento de datos personales por parte de la Cooperativa se regira por los siguientes principios, conforme al articulo 4 de la Ley 1581 de 2012:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Principio de legalidad:</strong> El tratamiento es una actividad reglada que se sujeta a las disposiciones legales vigentes.</li>
              <li><strong>Principio de finalidad:</strong> El tratamiento obedecera a una finalidad legitima, la cual sera informada al titular.</li>
              <li><strong>Principio de libertad:</strong> El tratamiento solo puede ejercerse con el consentimiento previo, expreso e informado del titular.</li>
              <li><strong>Principio de veracidad o calidad:</strong> La informacion sujeta a tratamiento debe ser veraz, completa, exacta, actualizada, comprobable y comprensible.</li>
              <li><strong>Principio de transparencia:</strong> Se garantiza el derecho del titular a obtener informacion acerca de la existencia de datos que le conciernan.</li>
              <li><strong>Principio de acceso y circulacion restringida:</strong> El tratamiento se sujeta a los limites derivados de la naturaleza de los datos.</li>
              <li><strong>Principio de seguridad:</strong> La informacion se manejara con las medidas tecnicas, humanas y administrativas necesarias para otorgar seguridad a los registros.</li>
              <li><strong>Principio de confidencialidad:</strong> Todas las personas que intervengan en el tratamiento estan obligadas a garantizar la reserva de la informacion.</li>
            </ul>
          </CardContent>
        </Card>

        {/* 5. Datos que recopilamos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">5. Datos Personales que Recopilamos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed">
            <p>En el ejercicio de nuestras actividades y a traves de la Plataforma AION, recopilamos las siguientes categorias de datos personales:</p>

            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-semibold mb-2">5.1 Datos de Identificacion y Contacto</h4>
                <p>Nombres y apellidos, numero de identificacion (cedula de ciudadania, cedula de extranjeria, pasaporte), direccion de correo electronico, numero de telefono, direccion fisica, cargo u ocupacion.</p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-semibold mb-2">5.2 Datos de Videovigilancia</h4>
                <p>Imagenes y grabaciones de video captadas por camaras de seguridad (CCTV) instaladas en las instalaciones de nuestros clientes. Estos datos incluyen imagenes en tiempo real (live view), grabaciones almacenadas (playback), metadatos asociados (fecha, hora, ubicacion de la camara, eventos detectados por analitica de video).</p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-semibold mb-2">5.3 Datos de Control de Acceso</h4>
                <p>Registros de ingreso y salida de personas en instalaciones vigiladas, incluyendo: nombre del visitante o empleado, documento de identidad, hora de entrada y salida, area o zona accedida, motivo de la visita, identificacion del anfitrion, fotografia de registro.</p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-semibold mb-2">5.4 Datos Biometricos (Dato Sensible)</h4>
                <p>Cuando asi lo autorice el titular y sea necesario para la prestacion de servicios de seguridad, podremos recopilar datos biometricos tales como: reconocimiento facial, huellas dactilares u otros identificadores biometricos utilizados para control de acceso. El tratamiento de estos datos se realizara unicamente con autorizacion expresa y reforzada del titular, conforme al articulo 6 de la Ley 1581 de 2012.</p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-semibold mb-2">5.5 Datos de Uso de la Plataforma</h4>
                <p>Informacion de inicio de sesion, direccion IP, tipo de navegador, sistema operativo, paginas visitadas dentro de la Plataforma, registros de actividad (logs de auditoria), preferencias de configuracion.</p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-semibold mb-2">5.6 Datos de Asociados y Trabajadores</h4>
                <p>Datos laborales de nuestros asociados cooperativos y personal, incluyendo: informacion de afiliacion, turnos asignados, ubicaciones de servicio, reportes de rondas y patrullas, datos de capacitacion.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 6. Finalidades del tratamiento */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">6. Finalidades del Tratamiento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>Los datos personales recopilados seran utilizados para las siguientes finalidades:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Prestacion de servicios de seguridad, vigilancia y control de acceso a nuestros clientes.</li>
              <li>Monitoreo en tiempo real de camaras de seguridad y sistemas de alarma.</li>
              <li>Gestion de control de acceso a instalaciones vigiladas.</li>
              <li>Generacion de reportes e informes de seguridad para nuestros clientes.</li>
              <li>Deteccion, prevencion e investigacion de incidentes de seguridad.</li>
              <li>Cumplimiento de obligaciones legales, regulatorias y contractuales.</li>
              <li>Gestion de la relacion laboral y cooperativa con nuestros asociados.</li>
              <li>Administracion de turnos, rondas, patrullas y operaciones de seguridad.</li>
              <li>Envio de comunicaciones relacionadas con el servicio (alertas, notificaciones, reportes).</li>
              <li>Mejoramiento de la Plataforma y sus funcionalidades.</li>
              <li>Atencion de peticiones, quejas, reclamos y sugerencias (PQRS).</li>
              <li>Cumplimiento de requerimientos de autoridades competentes conforme a la ley.</li>
              <li>Analisis predictivo de seguridad mediante herramientas de inteligencia artificial, cuando aplique.</li>
            </ul>
          </CardContent>
        </Card>

        {/* 7. Autorizacion */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">7. Autorizacion para el Tratamiento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              La Cooperativa obtendra autorizacion previa, expresa e informada del titular para el tratamiento de sus datos personales,
              salvo en los casos exceptuados por la ley (articulo 10 de la Ley 1581 de 2012).
            </p>
            <p>La autorizacion podra obtenerse por los siguientes medios:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Documento fisico o electronico firmado por el titular.</li>
              <li>Aceptacion de terminos y condiciones al registrarse en la Plataforma.</li>
              <li>Mecanismo tecnico de aceptacion (checkbox, boton de aceptacion) en medios electronicos.</li>
              <li>Conducta inequivoca del titular que permita concluir razonablemente que otorgo la autorizacion.</li>
            </ul>
            <p>
              Para el tratamiento de <strong>datos sensibles</strong> (incluidos datos biometricos), la Cooperativa informara al titular
              que no esta obligado a autorizar dicho tratamiento y obtendra autorizacion expresa y reforzada, indicando cuales datos
              son sensibles y la finalidad especifica del tratamiento.
            </p>
            <p>
              Para el tratamiento de datos de <strong>menores de edad</strong>, se procedera conforme a los derechos prevalentes
              de los menores, con autorizacion de sus representantes legales, respetando el interes superior del menor.
            </p>
          </CardContent>
        </Card>

        {/* 8. Derechos del titular */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">8. Derechos de los Titulares</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>De conformidad con el articulo 8 de la Ley 1581 de 2012, los titulares de los datos personales tienen los siguientes derechos:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Derecho de acceso o consulta:</strong> Conocer los datos personales que la Cooperativa tiene sobre ellos en sus bases de datos.</li>
              <li><strong>Derecho de actualizacion:</strong> Solicitar la actualizacion de sus datos personales cuando estos sean inexactos o incompletos.</li>
              <li><strong>Derecho de rectificacion:</strong> Solicitar la correccion de la informacion personal que sea inexacta.</li>
              <li><strong>Derecho de supresion:</strong> Solicitar la eliminacion de sus datos personales cuando considere que no estan siendo tratados conforme a los principios, deberes y obligaciones previstas en la ley, salvo que exista un deber legal o contractual de conservarlos.</li>
              <li><strong>Derecho de revocatoria:</strong> Revocar la autorizacion otorgada para el tratamiento de sus datos personales cuando no se respeten los principios, derechos y garantias constitucionales y legales.</li>
              <li><strong>Derecho a solicitar prueba de la autorizacion:</strong> Salvo cuando se exceptue expresamente como requisito para el tratamiento (articulo 10 de la Ley 1581 de 2012).</li>
              <li><strong>Derecho a presentar quejas ante la SIC:</strong> Presentar quejas ante la Superintendencia de Industria y Comercio por infracciones a la ley de proteccion de datos.</li>
            </ul>
          </CardContent>
        </Card>

        {/* 9. Procedimiento para ejercer derechos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">9. Procedimiento para Ejercer los Derechos (Consultas y Reclamos)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed">
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">9.1 Consultas (Articulo 14 de la Ley 1581 de 2012)</h4>
              <p>
                Los titulares o sus causahabientes podran consultar la informacion personal que reposa en las bases de datos
                de la Cooperativa. La consulta sera atendida en un termino maximo de <strong>diez (10) dias habiles</strong>
                contados a partir de la fecha de recibo de la misma. Cuando no fuere posible atender la consulta dentro de dicho
                termino, se informara al interesado, expresando los motivos de la demora y senalando la fecha en que se atendera
                la consulta, la cual en ningun caso podra superar los <strong>cinco (5) dias habiles</strong> siguientes al
                vencimiento del primer termino.
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">9.2 Reclamos (Articulo 15 de la Ley 1581 de 2012)</h4>
              <p>
                El titular o sus causahabientes que consideren que la informacion contenida en una base de datos debe ser objeto
                de correccion, actualizacion o supresion, o cuando adviertan el presunto incumplimiento de cualquiera de los deberes
                contenidos en la ley, podran presentar un reclamo ante la Cooperativa. El reclamo sera atendido en un termino maximo
                de <strong>quince (15) dias habiles</strong> contados a partir del dia siguiente a la fecha de su recibo. Cuando no
                fuere posible atender el reclamo dentro de dicho termino, se informara al interesado los motivos de la demora y la
                fecha en que se atendera su reclamo, la cual en ningun caso podra superar los <strong>ocho (8) dias habiles</strong>
                siguientes al vencimiento del primer termino.
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">9.3 Canal de Atencion</h4>
              <p>Las consultas y reclamos deberan dirigirse a:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li><strong>Correo electronico:</strong> privacidad@aionseg.co</li>
                <li><strong>Asunto:</strong> "Consulta de Datos Personales" o "Reclamo de Datos Personales"</li>
                <li><strong>Informacion requerida:</strong> Nombre completo, numero de identificacion, descripcion de los hechos, documentos que soporten la solicitud, datos de contacto.</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* 10. Videovigilancia */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">10. Tratamiento de Datos de Videovigilancia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              La Cooperativa opera sistemas de videovigilancia (CCTV) como parte de sus servicios de seguridad. El tratamiento
              de datos derivados de la videovigilancia se realiza bajo las siguientes condiciones:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Las instalaciones donde operen camaras de seguridad contaran con avisos visibles que informen sobre la existencia de videovigilancia.</li>
              <li>Las grabaciones se utilizaran exclusivamente para fines de seguridad, prevencion e investigacion de incidentes.</li>
              <li>El acceso a las grabaciones estara restringido al personal autorizado de la Cooperativa y a los clientes contratantes, segun los permisos asignados en la Plataforma.</li>
              <li>Las grabaciones podran ser proporcionadas a autoridades competentes cuando medie una orden judicial o requerimiento legal.</li>
              <li>La retencion de grabaciones se ajustara a los periodos establecidos en la seccion 13 de esta politica y a lo pactado contractualmente con cada cliente.</li>
            </ul>
          </CardContent>
        </Card>

        {/* 11. Datos biometricos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">11. Tratamiento de Datos Biometricos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              Los datos biometricos son considerados <strong>datos sensibles</strong> conforme a la Ley 1581 de 2012.
              Su tratamiento se realizara bajo las siguientes condiciones especiales:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Solo se recopilaran cuando sea estrictamente necesario para la prestacion del servicio de seguridad contratado.</li>
              <li>Se requerira autorizacion expresa, previa e informada del titular, independiente de la autorizacion general de tratamiento de datos.</li>
              <li>Se informara al titular que no esta obligado a suministrar datos biometricos.</li>
              <li>Se implementaran medidas reforzadas de seguridad para su almacenamiento y proteccion, incluyendo cifrado y controles de acceso estrictos.</li>
              <li>No seran compartidos con terceros salvo por requerimiento de autoridad competente.</li>
              <li>El titular podra revocar su autorizacion en cualquier momento, salvo que exista un deber legal que impida la supresion.</li>
            </ul>
          </CardContent>
        </Card>

        {/* 12. Terceros encargados */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">12. Encargados del Tratamiento y Transferencia de Datos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              Para la prestacion de nuestros servicios, la Cooperativa puede compartir datos personales con los siguientes
              tipos de encargados del tratamiento:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Proveedores de infraestructura en la nube:</strong> Para el almacenamiento seguro de datos, grabaciones de video y respaldos. Estos proveedores cuentan con certificaciones de seguridad reconocidas internacionalmente.</li>
              <li><strong>Proveedores de servicios de comunicacion:</strong> Para el envio de alertas, notificaciones y comunicaciones del servicio (correo electronico, SMS, WhatsApp).</li>
              <li><strong>Proveedores de analitica:</strong> Para el analisis de uso de la Plataforma y mejora del servicio.</li>
              <li><strong>Autoridades competentes:</strong> Cuando medie requerimiento legal, orden judicial o sea necesario para la prevencion de delitos.</li>
            </ul>
            <p>
              Todos los encargados del tratamiento estan obligados contractualmente a cumplir con la Ley 1581 de 2012 y a
              implementar medidas de seguridad adecuadas para la proteccion de los datos personales.
            </p>
            <p>
              En caso de <strong>transferencia internacional de datos</strong>, la Cooperativa se asegurara de que el pais
              receptor cuente con niveles adecuados de proteccion de datos conforme a lo establecido por la Superintendencia
              de Industria y Comercio, o que se cumplan las excepciones previstas en el articulo 26 de la Ley 1581 de 2012.
            </p>
          </CardContent>
        </Card>

        {/* 13. Periodos de retencion */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">13. Periodos de Retencion de Datos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>Los datos personales seran conservados durante los siguientes periodos, salvo que una norma legal o contractual disponga algo diferente:</p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-semibold">Tipo de Dato</th>
                    <th className="text-left p-3 font-semibold">Periodo de Retencion</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="p-3">Grabaciones de video (CCTV)</td>
                    <td className="p-3">30 a 90 dias, segun contrato con el cliente</td>
                  </tr>
                  <tr>
                    <td className="p-3">Registros de control de acceso</td>
                    <td className="p-3">1 ano</td>
                  </tr>
                  <tr>
                    <td className="p-3">Registros de visitantes</td>
                    <td className="p-3">1 ano</td>
                  </tr>
                  <tr>
                    <td className="p-3">Logs de auditoria de la Plataforma</td>
                    <td className="p-3">2 anos</td>
                  </tr>
                  <tr>
                    <td className="p-3">Datos biometricos</td>
                    <td className="p-3">Mientras dure la relacion contractual o hasta revocacion de la autorizacion</td>
                  </tr>
                  <tr>
                    <td className="p-3">Datos de asociados y trabajadores</td>
                    <td className="p-3">Durante la vinculacion y 5 anos posteriores a su terminacion</td>
                  </tr>
                  <tr>
                    <td className="p-3">Datos de clientes (contractuales)</td>
                    <td className="p-3">Durante la vigencia del contrato y 5 anos posteriores</td>
                  </tr>
                  <tr>
                    <td className="p-3">Registros de eventos e incidentes</td>
                    <td className="p-3">3 anos</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Una vez cumplido el periodo de retencion y siempre que no exista deber legal o contractual de conservacion,
              los datos seran eliminados de forma segura o anonimizados de manera irreversible.
            </p>
          </CardContent>
        </Card>

        {/* 14. Cookies */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">14. Uso de Cookies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              La Plataforma utiliza cookies y tecnologias similares para su funcionamiento. Para informacion detallada sobre
              las cookies que utilizamos, sus finalidades y como gestionarlas, consulte nuestra
              <strong> Politica de Cookies</strong> disponible en la Plataforma.
            </p>
          </CardContent>
        </Card>

        {/* 15. Medidas de seguridad */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">15. Medidas de Seguridad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              La Cooperativa implementa medidas tecnicas, humanas y administrativas para proteger los datos personales contra
              acceso no autorizado, perdida, alteracion, destruccion o uso indebido, incluyendo:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Medidas tecnicas:</strong> Cifrado de datos en transito y en reposo, autenticacion multifactor, firewalls, sistemas de deteccion de intrusos, control de acceso basado en roles, copias de seguridad periodicas, monitoreo continuo de la infraestructura.</li>
              <li><strong>Medidas humanas:</strong> Capacitacion periodica del personal en proteccion de datos, acuerdos de confidencialidad con todos los asociados y contratistas, politicas internas de seguridad de la informacion.</li>
              <li><strong>Medidas administrativas:</strong> Politicas y procedimientos documentados para el tratamiento de datos, registro de bases de datos ante la SIC (Registro Nacional de Bases de Datos — RNBD), auditorias periodicas de cumplimiento, plan de respuesta ante incidentes de seguridad.</li>
            </ul>
          </CardContent>
        </Card>

        {/* 16. Incidentes de seguridad */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">16. Gestion de Incidentes de Seguridad de Datos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              En caso de que se presente un incidente de seguridad que comprometa datos personales, la Cooperativa:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Activara su plan de respuesta ante incidentes de manera inmediata.</li>
              <li>Notificara a la Superintendencia de Industria y Comercio conforme a los plazos y procedimientos legales vigentes.</li>
              <li>Informara a los titulares afectados cuando el incidente represente un riesgo significativo para sus derechos y libertades.</li>
              <li>Documentara el incidente y las medidas correctivas adoptadas.</li>
            </ul>
          </CardContent>
        </Card>

        {/* 17. Superintendencia de Industria y Comercio */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">17. Autoridad de Proteccion de Datos — Superintendencia de Industria y Comercio (SIC)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              La <strong>Superintendencia de Industria y Comercio (SIC)</strong> es la autoridad nacional de proteccion de datos
              en Colombia. Si el titular considera que la Cooperativa ha vulnerado sus derechos en materia de proteccion de datos
              personales, y una vez agotado el tramite de consulta o reclamo ante la Cooperativa, podra presentar una queja
              ante la SIC:
            </p>
            <div className="bg-muted/50 rounded-lg p-4 space-y-1">
              <p><strong>Superintendencia de Industria y Comercio</strong></p>
              <p>Delegatura para la Proteccion de Datos Personales</p>
              <p>Carrera 13 No. 27-00, Pisos 1 al 7, Bogota D.C., Colombia</p>
              <p>Linea gratuita nacional: 01 8000 910 165</p>
              <p>Pagina web: www.sic.gov.co</p>
              <p>Correo: contactenos@sic.gov.co</p>
            </div>
          </CardContent>
        </Card>

        {/* 18. Canal PQRS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">18. Canal de PQRS (Peticiones, Quejas, Reclamos y Sugerencias)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              Para cualquier solicitud relacionada con el tratamiento de datos personales, el titular podra comunicarse
              a traves de los siguientes canales:
            </p>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p><strong>Correo electronico:</strong> pqrs@aionseg.co / privacidad@aionseg.co</p>
              <p><strong>Telefono:</strong> [Telefono de contacto]</p>
              <p><strong>Direccion fisica:</strong> [Direccion de la sede principal], Medellin, Antioquia</p>
              <p><strong>Horario de atencion:</strong> Lunes a viernes de 8:00 a.m. a 5:00 p.m.</p>
            </div>
          </CardContent>
        </Card>

        {/* 19. Vigencia y modificaciones */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">19. Vigencia y Modificaciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              La presente Politica de Privacidad entra en vigencia a partir de su publicacion y estara vigente mientras
              la Cooperativa realice tratamiento de datos personales. Las bases de datos administradas por la Cooperativa
              se mantendran vigentes durante el tiempo que sea necesario para cumplir las finalidades descritas.
            </p>
            <p>
              La Cooperativa se reserva el derecho de modificar esta politica en cualquier momento. Cualquier cambio
              sustancial sera informado a los titulares a traves de los canales disponibles (correo electronico, aviso
              en la Plataforma) con una antelacion razonable. El uso continuado de la Plataforma despues de la notificacion
              de cambios constituira aceptacion de la politica modificada.
            </p>
          </CardContent>
        </Card>

        {/* Footer */}
        <Card>
          <CardContent className="pt-6 text-center text-sm text-muted-foreground space-y-2">
            <p className="font-semibold">Clave Seguridad CTA</p>
            <p>Cooperativa de Trabajo Asociado</p>
            <p>Medellin, Antioquia, Colombia</p>
            <p>Plataforma AION Security — aionseg.co</p>
            <Separator className="my-4" />
            <p className="text-xs">
              Esta politica ha sido elaborada en cumplimiento de la Ley 1581 de 2012, el Decreto 1377 de 2013
              (compilado en el Decreto 1074 de 2015) y demas normas concordantes de la Republica de Colombia.
            </p>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
