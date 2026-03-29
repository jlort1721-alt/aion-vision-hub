import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function TermsPage() {
  return (
    <ScrollArea className="h-full">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <FileText className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold">
              Terminos y Condiciones de Uso
            </CardTitle>
            <p className="text-muted-foreground mt-2">
              Plataforma AION Security — Clave Seguridad CTA
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Cooperativa de Trabajo Asociado — Medellin, Antioquia, Colombia
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

        {/* 1. Aceptacion */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">1. Aceptacion de los Terminos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              Los presentes Terminos y Condiciones (en adelante, "los Terminos") regulan el acceso y uso de la plataforma
              <strong> AION Security Platform</strong> (en adelante, "la Plataforma"), operada por
              <strong> Clave Seguridad CTA</strong> (en adelante, "la Cooperativa"), Cooperativa de Trabajo Asociado
              con domicilio en Medellin, Antioquia, Republica de Colombia.
            </p>
            <p>
              Al acceder, registrarse o utilizar la Plataforma, el usuario (en adelante, "el Usuario") declara que ha leido,
              comprendido y aceptado la totalidad de estos Terminos, asi como nuestra Politica de Privacidad y Politica de Cookies.
              Si no esta de acuerdo con alguna de las condiciones aqui establecidas, debera abstenerse de utilizar la Plataforma.
            </p>
            <p>
              El uso de la Plataforma esta reservado a personas mayores de edad conforme a la legislacion colombiana (18 anos cumplidos).
            </p>
          </CardContent>
        </Card>

        {/* 2. Descripcion del servicio */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">2. Descripcion del Servicio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              La Plataforma AION Security es un sistema integral de gestion de seguridad que proporciona las siguientes
              funcionalidades, segun el plan contratado:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Monitoreo de video en tiempo real (Live View):</strong> Visualizacion de camaras de seguridad (CCTV) en tiempo real.</li>
              <li><strong>Reproduccion de grabaciones (Playback):</strong> Acceso al archivo historico de grabaciones de video.</li>
              <li><strong>Control de acceso:</strong> Gestion de ingresos y salidas de personas en instalaciones vigiladas.</li>
              <li><strong>Gestion de visitantes:</strong> Registro y seguimiento de visitantes.</li>
              <li><strong>Gestion de alertas y eventos:</strong> Configuracion y recepcion de alertas de seguridad en tiempo real.</li>
              <li><strong>Reportes e informes:</strong> Generacion de reportes de seguridad, incidentes, rondas y operaciones.</li>
              <li><strong>Gestion de turnos y patrullas:</strong> Programacion y seguimiento de turnos de seguridad y rondas de vigilancia.</li>
              <li><strong>Administracion de dispositivos:</strong> Monitoreo del estado y configuracion de camaras, sensores y equipos de seguridad.</li>
              <li><strong>Analitica de video e inteligencia artificial:</strong> Deteccion de eventos mediante analisis de video inteligente.</li>
              <li><strong>Gestion de incidentes:</strong> Registro, seguimiento y cierre de incidentes de seguridad.</li>
              <li><strong>Comunicaciones integradas:</strong> Intercomunicacion, notificaciones y canales de comunicacion.</li>
              <li><strong>Panel de operaciones:</strong> Vista consolidada del estado operativo de seguridad.</li>
            </ul>
            <p>
              Las funcionalidades disponibles para cada Usuario dependeran del plan de servicio contratado y de los permisos
              asignados por el administrador de su cuenta.
            </p>
          </CardContent>
        </Card>

        {/* 3. Registro y cuenta */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">3. Registro y Cuenta de Usuario</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              Para acceder a la Plataforma, el Usuario debera contar con una cuenta proporcionada por la Cooperativa o
              por el administrador de la organizacion a la que pertenece. El Usuario se compromete a:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Proporcionar informacion veraz, completa y actualizada al momento del registro.</li>
              <li>Mantener la confidencialidad de sus credenciales de acceso (usuario y contrasena).</li>
              <li>No compartir sus credenciales con terceros ni permitir el acceso no autorizado a su cuenta.</li>
              <li>Notificar inmediatamente a la Cooperativa ante cualquier uso no autorizado de su cuenta o cualquier violacion de seguridad.</li>
              <li>Cerrar su sesion al finalizar cada periodo de uso, especialmente en equipos compartidos.</li>
            </ul>
            <p>
              El Usuario es responsable de todas las actividades que se realicen desde su cuenta. La Cooperativa no sera
              responsable por danos o perjuicios derivados del incumplimiento de estas obligaciones.
            </p>
            <p>
              La Cooperativa se reserva el derecho de suspender o cancelar cuentas de usuario cuando existan indicios
              de uso indebido, incumplimiento de estos Terminos o por razones de seguridad.
            </p>
          </CardContent>
        </Card>

        {/* 4. Uso aceptable */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">4. Uso Aceptable de la Plataforma</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>El Usuario se compromete a utilizar la Plataforma de manera licita, etica y conforme a estos Terminos. Queda expresamente prohibido:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Utilizar la Plataforma para fines distintos a los de seguridad y vigilancia para los cuales fue disenada.</li>
              <li>Acceder o intentar acceder a datos, grabaciones, sistemas o funcionalidades para los cuales no tenga autorizacion.</li>
              <li>Compartir, distribuir, copiar o divulgar grabaciones de video, imagenes o cualquier informacion obtenida a traves de la Plataforma sin autorizacion expresa.</li>
              <li>Realizar ingenieria inversa, descompilar, desensamblar o intentar obtener el codigo fuente de la Plataforma.</li>
              <li>Introducir virus, malware, codigo malicioso o cualquier tecnologia danina en la Plataforma.</li>
              <li>Sobrecargar, interferir o intentar vulnerar la infraestructura tecnologica de la Plataforma.</li>
              <li>Utilizar la Plataforma para acosar, intimidar, discriminar o violar los derechos fundamentales de cualquier persona.</li>
              <li>Utilizar los datos obtenidos a traves de la Plataforma para fines comerciales no autorizados o para la elaboracion de perfiles con fines discriminatorios.</li>
              <li>Eludir, desactivar o interferir con las medidas de seguridad de la Plataforma.</li>
              <li>Utilizar robots, scrapers u otros medios automatizados para acceder a la Plataforma sin autorizacion.</li>
            </ul>
            <p>
              El incumplimiento de estas prohibiciones podra dar lugar a la suspension o cancelacion inmediata de la cuenta
              del Usuario, sin perjuicio de las acciones legales que la Cooperativa pueda ejercer.
            </p>
          </CardContent>
        </Card>

        {/* 5. Propiedad intelectual */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">5. Propiedad Intelectual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              La Plataforma AION Security, incluyendo pero no limitandose a su codigo fuente, diseno, interfaz grafica,
              logotipos, marcas, nombres comerciales, textos, imagenes, graficos, algoritmos de inteligencia artificial,
              modelos de analisis predictivo y demas elementos que la componen, son propiedad exclusiva de
              <strong> Clave Seguridad CTA</strong> o de sus licenciantes, y se encuentran protegidos por las leyes
              colombianas e internacionales de propiedad intelectual, incluyendo la <strong>Decision Andina 486 de 2000</strong>,
              la <strong>Ley 23 de 1982</strong> y sus modificaciones, y la <strong>Decision Andina 351 de 1993</strong>.
            </p>
            <p>
              La autorizacion de uso de la Plataforma no implica cesion, transferencia ni licencia de ningun derecho de
              propiedad intelectual a favor del Usuario. El Usuario unicamente obtiene un derecho de uso limitado, no
              exclusivo, no transferible y revocable sobre la Plataforma, sujeto al cumplimiento de estos Terminos y
              al pago de las contraprestaciones acordadas.
            </p>
            <p>
              Los contenidos generados por los Usuarios a traves de la Plataforma (reportes, notas, minutas) son propiedad
              de la organizacion a la que pertenece el Usuario, conforme a lo establecido en el contrato de servicios correspondiente.
            </p>
          </CardContent>
        </Card>

        {/* 6. Disponibilidad del servicio */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">6. Disponibilidad del Servicio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              La Cooperativa se esfuerza por mantener la Plataforma disponible de manera continua, veinticuatro (24)
              horas al dia, siete (7) dias a la semana. Sin embargo, el Usuario reconoce y acepta que:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>La disponibilidad de la Plataforma puede verse afectada por mantenimientos programados, los cuales seran notificados con antelacion razonable cuando sea posible.</li>
              <li>Pueden ocurrir interrupciones imprevistas debido a fallas tecnicas, problemas de conectividad, ataques ciberneticos, causas de fuerza mayor u otros eventos fuera del control de la Cooperativa.</li>
              <li>La calidad del servicio puede depender de factores externos como la conexion a internet del Usuario, el rendimiento de los dispositivos de seguridad (camaras, sensores) y la infraestructura de red del cliente.</li>
            </ul>
            <p>
              Los niveles de disponibilidad especificos se regiran por los Acuerdos de Nivel de Servicio (SLA) pactados
              en el contrato de prestacion de servicios con cada cliente.
            </p>
          </CardContent>
        </Card>

        {/* 7. Limitacion de responsabilidad */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">7. Limitacion de Responsabilidad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              En la maxima medida permitida por la legislacion colombiana, la Cooperativa no sera responsable por:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Danos indirectos, incidentales, especiales o consecuenciales</strong> derivados del uso o la imposibilidad de uso de la Plataforma.</li>
              <li><strong>Perdidas de datos o informacion</strong> causadas por fallas en la infraestructura del Usuario, errores en la configuracion de dispositivos o circunstancias ajenas al control de la Cooperativa.</li>
              <li><strong>Interrupciones del servicio</strong> causadas por fuerza mayor, caso fortuito, fallas en redes de terceros, cortes de energia electrica o situaciones similares.</li>
              <li><strong>Acciones u omisiones de terceros</strong> que afecten el funcionamiento de la Plataforma o comprometan la seguridad de los datos.</li>
              <li><strong>Decisiones tomadas por el Usuario</strong> basandose en la informacion, alertas, reportes o analisis proporcionados por la Plataforma.</li>
              <li><strong>Fallas en los equipos de seguridad</strong> (camaras, sensores, controles de acceso) que no sean de propiedad o administracion directa de la Cooperativa.</li>
            </ul>
            <p>
              La Plataforma es una herramienta de apoyo a la gestion de seguridad. La Cooperativa no garantiza que el uso
              de la Plataforma prevenga en su totalidad la ocurrencia de incidentes de seguridad. La responsabilidad de la
              Cooperativa se limitara, en todo caso, al valor del contrato de servicios vigente con el cliente.
            </p>
          </CardContent>
        </Card>

        {/* 8. Confidencialidad */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">8. Confidencialidad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              El Usuario reconoce que toda la informacion a la que acceda a traves de la Plataforma, incluyendo
              grabaciones de video, registros de acceso, datos de visitantes, reportes de incidentes, informacion
              operativa y cualquier otra informacion relacionada con los servicios de seguridad, tiene caracter
              <strong> estrictamente confidencial</strong>.
            </p>
            <p>
              El Usuario se obliga a:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>No divulgar, compartir ni poner a disposicion de terceros la informacion confidencial.</li>
              <li>Utilizar la informacion unicamente para los fines autorizados relacionados con la seguridad.</li>
              <li>Adoptar las medidas necesarias para proteger la confidencialidad de la informacion.</li>
              <li>Notificar inmediatamente a la Cooperativa ante cualquier divulgacion no autorizada de informacion.</li>
            </ul>
            <p>
              Esta obligacion de confidencialidad se mantendra vigente incluso despues de la terminacion de la relacion
              contractual o del acceso a la Plataforma.
            </p>
          </CardContent>
        </Card>

        {/* 9. Contraprestacion */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">9. Contraprestacion Economica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              El acceso a la Plataforma esta sujeto al pago de las contraprestaciones economicas establecidas en el
              contrato de servicios correspondiente. Las tarifas, plazos de pago, penalidades por mora y demas
              condiciones comerciales se regiran por lo establecido en dicho contrato.
            </p>
            <p>
              La Cooperativa se reserva el derecho de suspender el acceso a la Plataforma en caso de incumplimiento
              en el pago de las obligaciones economicas, previa notificacion al cliente conforme a las condiciones
              contractuales.
            </p>
          </CardContent>
        </Card>

        {/* 10. Modificaciones */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">10. Modificaciones a los Terminos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              La Cooperativa se reserva el derecho de modificar estos Terminos en cualquier momento. Las modificaciones
              seran notificadas a los Usuarios a traves de los siguientes medios:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Publicacion de los Terminos actualizados en la Plataforma con indicacion de la fecha de actualizacion.</li>
              <li>Notificacion por correo electronico a los Usuarios registrados cuando los cambios sean sustanciales.</li>
              <li>Aviso destacado dentro de la Plataforma al iniciar sesion.</li>
            </ul>
            <p>
              El uso continuado de la Plataforma despues de la notificacion de las modificaciones constituira la
              aceptacion de los Terminos modificados. Si el Usuario no esta de acuerdo con las modificaciones,
              debera cesar el uso de la Plataforma y solicitar la cancelacion de su cuenta.
            </p>
          </CardContent>
        </Card>

        {/* 11. Terminacion */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">11. Suspension y Terminacion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              La Cooperativa podra suspender o terminar el acceso del Usuario a la Plataforma en los siguientes casos:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Incumplimiento de estos Terminos o de la Politica de Privacidad.</li>
              <li>Uso indebido de la Plataforma o de la informacion obtenida a traves de ella.</li>
              <li>Solicitud de la organizacion a la que pertenece el Usuario.</li>
              <li>Terminacion del contrato de servicios con el cliente.</li>
              <li>Incumplimiento de obligaciones de pago.</li>
              <li>Orden o requerimiento de autoridad competente.</li>
              <li>Razones de seguridad o prevencion de fraude.</li>
            </ul>
            <p>
              En caso de terminacion, el Usuario perdera el acceso a la Plataforma y a la informacion almacenada en ella.
              La Cooperativa conservara los datos conforme a los periodos de retencion establecidos en la Politica de Privacidad
              y en las obligaciones legales aplicables.
            </p>
          </CardContent>
        </Card>

        {/* 12. Ley aplicable */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">12. Legislacion Aplicable y Jurisdiccion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              Los presentes Terminos se regiran e interpretaran de conformidad con las leyes de la
              <strong> Republica de Colombia</strong>.
            </p>
            <p>
              Cualquier controversia, diferencia o reclamacion derivada de estos Terminos o del uso de la Plataforma
              sera resuelta de la siguiente manera:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Arreglo directo:</strong> Las partes intentaran resolver la controversia de manera amistosa mediante negociacion directa durante un plazo de treinta (30) dias calendario.</li>
              <li><strong>Conciliacion:</strong> Si no se logra un arreglo directo, las partes acudiran a un centro de conciliacion reconocido en la ciudad de Medellin.</li>
              <li><strong>Jurisdiccion ordinaria:</strong> En caso de no lograr un acuerdo mediante conciliacion, la controversia sera sometida a los jueces competentes de la ciudad de Medellin, Antioquia, Colombia, con renuncia expresa a cualquier otro fuero.</li>
            </ul>
          </CardContent>
        </Card>

        {/* 13. Resolucion de disputas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">13. Proteccion al Consumidor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              Sin perjuicio de lo anterior, los Usuarios que tengan la calidad de consumidores conforme a la
              <strong> Ley 1480 de 2011</strong> (Estatuto del Consumidor) podran ejercer sus derechos ante la
              Superintendencia de Industria y Comercio u otras autoridades competentes, conforme a la legislacion vigente.
            </p>
          </CardContent>
        </Card>

        {/* 14. Indemnizacion */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">14. Indemnizacion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              El Usuario se compromete a indemnizar y mantener indemne a la Cooperativa, sus directivos, asociados,
              empleados y colaboradores, frente a cualquier reclamacion, dano, perdida, costo o gasto (incluidos
              honorarios de abogados) derivados de:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>El incumplimiento de estos Terminos por parte del Usuario.</li>
              <li>El uso indebido de la Plataforma.</li>
              <li>La violacion de derechos de terceros.</li>
              <li>La divulgacion no autorizada de informacion confidencial.</li>
            </ul>
          </CardContent>
        </Card>

        {/* 15. Disposiciones generales */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">15. Disposiciones Generales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Integridad:</strong> Estos Terminos, junto con la Politica de Privacidad, la Politica de Cookies y el contrato de servicios, constituyen el acuerdo completo entre las partes en relacion con el uso de la Plataforma.</li>
              <li><strong>Divisibilidad:</strong> Si alguna disposicion de estos Terminos fuere declarada invalida o inaplicable, las demas disposiciones mantendran su plena validez y efecto.</li>
              <li><strong>No renuncia:</strong> La falta de ejercicio o la demora en el ejercicio de cualquier derecho por parte de la Cooperativa no constituira una renuncia al mismo.</li>
              <li><strong>Cesion:</strong> El Usuario no podra ceder ni transferir sus derechos u obligaciones bajo estos Terminos sin el consentimiento previo y por escrito de la Cooperativa.</li>
              <li><strong>Notificaciones:</strong> Las notificaciones relacionadas con estos Terminos se enviaran al correo electronico registrado del Usuario o a la direccion de contacto proporcionada al momento del registro.</li>
            </ul>
          </CardContent>
        </Card>

        {/* 16. Contacto */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">16. Informacion de Contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>Para cualquier consulta o comunicacion relacionada con estos Terminos, el Usuario podra contactarnos a traves de:</p>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p><strong>Correo electronico:</strong> legal@aionseg.co</p>
              <p><strong>Correo de soporte:</strong> soporte@aionseg.co</p>
              <p><strong>Telefono:</strong> [Telefono de contacto]</p>
              <p><strong>Direccion:</strong> [Direccion de la sede principal], Medellin, Antioquia, Colombia</p>
            </div>
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
              Estos Terminos y Condiciones se rigen por las leyes de la Republica de Colombia.
            </p>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
