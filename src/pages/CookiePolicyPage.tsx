import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cookie } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function CookiePolicyPage() {
  return (
    <ScrollArea className="h-full">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Cookie className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold">
              Politica de Cookies
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

        {/* 1. Que son las cookies */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">1. Que Son las Cookies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              Las cookies son pequenos archivos de texto que se almacenan en el dispositivo del usuario (computador,
              tablet, telefono movil) cuando visita un sitio web o utiliza una aplicacion web. Las cookies permiten
              que la Plataforma reconozca el dispositivo del usuario en visitas posteriores, almacene preferencias
              y mejore la experiencia de navegacion.
            </p>
            <p>
              La plataforma <strong>AION Security</strong>, operada por <strong>Clave Seguridad CTA</strong>, utiliza
              cookies y tecnologias similares (almacenamiento local, tokens de sesion) para garantizar el correcto
              funcionamiento de la Plataforma, mantener la seguridad de las sesiones y mejorar la experiencia del usuario.
            </p>
            <p>
              Esta Politica de Cookies complementa nuestra Politica de Privacidad y Tratamiento de Datos Personales,
              y debe leerse conjuntamente con ella.
            </p>
          </CardContent>
        </Card>

        {/* 2. Tipos de cookies */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">2. Tipos de Cookies que Utilizamos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed">
            <p>A continuacion, se detallan las categorias de cookies utilizadas en la Plataforma:</p>

            {/* 2.1 Cookies esenciales */}
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">2.1 Cookies Esenciales (Estrictamente Necesarias)</h4>
              <p className="mb-3">
                Estas cookies son indispensables para el funcionamiento basico de la Plataforma. Sin ellas, la Plataforma
                no puede funcionar correctamente. No requieren consentimiento previo del usuario.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-semibold">Cookie</th>
                      <th className="text-left p-2 font-semibold">Finalidad</th>
                      <th className="text-left p-2 font-semibold">Duracion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="p-2 font-mono text-xs">session_id</td>
                      <td className="p-2">Mantener la sesion activa del usuario autenticado en la Plataforma.</td>
                      <td className="p-2">Sesion (se elimina al cerrar el navegador o al cerrar sesion)</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono text-xs">auth_token</td>
                      <td className="p-2">Token de autenticacion para validar la identidad del usuario en cada solicitud.</td>
                      <td className="p-2">24 horas o hasta cierre de sesion</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono text-xs">refresh_token</td>
                      <td className="p-2">Permite renovar la sesion sin que el usuario deba iniciar sesion nuevamente.</td>
                      <td className="p-2">7 dias</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono text-xs">csrf_token</td>
                      <td className="p-2">Proteccion contra ataques de falsificacion de solicitudes entre sitios (CSRF).</td>
                      <td className="p-2">Sesion</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono text-xs">cookie_consent</td>
                      <td className="p-2">Almacena la preferencia del usuario respecto a la aceptacion de cookies.</td>
                      <td className="p-2">12 meses</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2.2 Cookies de preferencias */}
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">2.2 Cookies de Preferencias (Funcionales)</h4>
              <p className="mb-3">
                Estas cookies permiten recordar las preferencias y configuraciones del usuario para ofrecer una
                experiencia personalizada. Su desactivacion puede afectar la funcionalidad de la Plataforma.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-semibold">Cookie</th>
                      <th className="text-left p-2 font-semibold">Finalidad</th>
                      <th className="text-left p-2 font-semibold">Duracion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="p-2 font-mono text-xs">locale</td>
                      <td className="p-2">Almacena la preferencia de idioma del usuario (espanol, ingles).</td>
                      <td className="p-2">12 meses</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono text-xs">theme</td>
                      <td className="p-2">Almacena la preferencia de tema visual (claro, oscuro, sistema).</td>
                      <td className="p-2">12 meses</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono text-xs">layout_prefs</td>
                      <td className="p-2">Configuracion de la disposicion de paneles y vistas (ej. distribucion de camaras en Live View).</td>
                      <td className="p-2">12 meses</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono text-xs">notification_prefs</td>
                      <td className="p-2">Preferencias de notificaciones del usuario (sonido, escritorio, tipos de alerta).</td>
                      <td className="p-2">12 meses</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono text-xs">sidebar_state</td>
                      <td className="p-2">Estado del menu lateral (expandido o colapsado).</td>
                      <td className="p-2">12 meses</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2.3 Cookies de analisis */}
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">2.3 Cookies de Analisis y Rendimiento</h4>
              <p className="mb-3">
                Estas cookies recopilan informacion anonima sobre como los usuarios utilizan la Plataforma, lo que
                nos permite identificar areas de mejora y optimizar el rendimiento. Los datos recopilados son
                agregados y anonimizados.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-semibold">Cookie</th>
                      <th className="text-left p-2 font-semibold">Finalidad</th>
                      <th className="text-left p-2 font-semibold">Duracion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="p-2 font-mono text-xs">_analytics_id</td>
                      <td className="p-2">Identificador anonimo para medir el uso de la Plataforma y generar estadisticas internas.</td>
                      <td className="p-2">12 meses</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono text-xs">_perf_metrics</td>
                      <td className="p-2">Recopila metricas de rendimiento (tiempos de carga, errores) para optimizar la Plataforma.</td>
                      <td className="p-2">Sesion</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono text-xs">_feature_usage</td>
                      <td className="p-2">Registra el uso de funcionalidades para priorizar mejoras y desarrollo.</td>
                      <td className="p-2">6 meses</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Cookies de terceros */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">3. Cookies de Terceros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              La Plataforma puede utilizar servicios de terceros que establecen sus propias cookies en el dispositivo
              del usuario. La Cooperativa no controla estas cookies, las cuales se rigen por las politicas de
              privacidad de cada proveedor. Los terceros que pueden establecer cookies son:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-semibold">Proveedor</th>
                    <th className="text-left p-3 font-semibold">Finalidad</th>
                    <th className="text-left p-3 font-semibold">Politica de Privacidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="p-3">Supabase</td>
                    <td className="p-3">Autenticacion y gestion de sesiones de usuario.</td>
                    <td className="p-3">https://supabase.com/privacy</td>
                  </tr>
                  <tr>
                    <td className="p-3">Google Maps / Mapbox</td>
                    <td className="p-3">Visualizacion de mapas y ubicaciones de sitios vigilados.</td>
                    <td className="p-3">https://policies.google.com/privacy</td>
                  </tr>
                  <tr>
                    <td className="p-3">Servicios de comunicacion (WhatsApp Business API)</td>
                    <td className="p-3">Envio de notificaciones y alertas por WhatsApp.</td>
                    <td className="p-3">https://www.whatsapp.com/legal/privacy-policy</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              La Cooperativa se esfuerza por trabajar unicamente con proveedores que cumplan estandares adecuados de
              proteccion de datos. Le recomendamos revisar las politicas de privacidad de cada tercero para conocer
              como gestionan sus cookies.
            </p>
          </CardContent>
        </Card>

        {/* 4. Almacenamiento local */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">4. Almacenamiento Local y Tecnologias Similares</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              Ademas de las cookies tradicionales, la Plataforma utiliza otras tecnologias de almacenamiento en el navegador:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>LocalStorage:</strong> Almacena datos de configuracion y preferencias del usuario de forma persistente en el navegador. Se utiliza para recordar configuraciones de la interfaz, filtros aplicados y estados de la aplicacion.</li>
              <li><strong>SessionStorage:</strong> Almacena datos temporales durante la sesion de navegacion activa. Se utiliza para datos transitorios como el estado de formularios en curso.</li>
              <li><strong>IndexedDB:</strong> Base de datos del navegador utilizada para almacenar en cache datos frecuentemente consultados, mejorando el rendimiento y reduciendo la carga sobre los servidores.</li>
            </ul>
            <p>
              Estas tecnologias se rigen por las mismas politicas y principios descritos en este documento para las cookies.
            </p>
          </CardContent>
        </Card>

        {/* 5. Consentimiento */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">5. Consentimiento y Base Legal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              El uso de cookies en la Plataforma se rige por las siguientes bases legales:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Cookies esenciales:</strong> No requieren consentimiento previo, ya que son estrictamente necesarias
                para el funcionamiento de la Plataforma y la prestacion del servicio contratado. Su base legal es la
                ejecucion del contrato de servicios y el interes legitimo de la Cooperativa en garantizar la seguridad
                de la Plataforma.
              </li>
              <li>
                <strong>Cookies de preferencias y analitica:</strong> Requieren el consentimiento previo del usuario,
                el cual se obtiene a traves de un banner o aviso de cookies que se presenta al acceder por primera vez
                a la Plataforma. El usuario puede modificar sus preferencias en cualquier momento.
              </li>
            </ul>
            <p>
              Al acceder a la Plataforma, se presentara un aviso informativo sobre el uso de cookies que permitira al
              usuario:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Aceptar todas las cookies.</li>
              <li>Aceptar unicamente las cookies esenciales.</li>
              <li>Configurar sus preferencias de cookies de manera granular.</li>
            </ul>
          </CardContent>
        </Card>

        {/* 6. Como gestionar las cookies */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">6. Como Gestionar y Eliminar Cookies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed">
            <p>
              El usuario puede gestionar y eliminar las cookies a traves de los siguientes mecanismos:
            </p>

            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">6.1 Desde la Plataforma</h4>
              <p>
                La Plataforma dispone de un panel de configuracion de cookies accesible desde el menu de Configuracion,
                donde el usuario puede activar o desactivar las cookies no esenciales en cualquier momento.
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">6.2 Desde el Navegador</h4>
              <p className="mb-3">
                El usuario puede configurar su navegador para bloquear o eliminar cookies. A continuacion, se proporcionan
                enlaces a las instrucciones de los navegadores mas utilizados:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Google Chrome:</strong> chrome://settings/cookies</li>
                <li><strong>Mozilla Firefox:</strong> about:preferences#privacy</li>
                <li><strong>Microsoft Edge:</strong> edge://settings/privacy</li>
                <li><strong>Safari:</strong> Preferencias {">"} Privacidad</li>
                <li><strong>Opera:</strong> opera://settings/cookies</li>
              </ul>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">6.3 Consecuencias de Deshabilitar Cookies</h4>
              <p>
                Si el usuario decide deshabilitar o eliminar cookies, es posible que algunas funcionalidades de la
                Plataforma no operen correctamente. En particular:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>La desactivacion de <strong>cookies esenciales</strong> impedira el acceso a la Plataforma, ya que son necesarias para la autenticacion y la seguridad de la sesion.</li>
                <li>La desactivacion de <strong>cookies de preferencias</strong> hara que la Plataforma no recuerde sus configuraciones personalizadas (idioma, tema, disposicion de paneles).</li>
                <li>La desactivacion de <strong>cookies de analitica</strong> no afectara la funcionalidad de la Plataforma, pero limitara nuestra capacidad de mejorar el servicio.</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* 7. Actualizaciones */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">7. Actualizaciones de esta Politica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              La Cooperativa se reserva el derecho de actualizar esta Politica de Cookies para reflejar cambios en
              las cookies utilizadas, en la tecnologia de la Plataforma o en la legislacion aplicable.
            </p>
            <p>
              Cualquier modificacion sustancial sera notificada a los usuarios mediante un aviso en la Plataforma.
              La fecha de la ultima actualizacion se indicara en la parte superior de este documento.
            </p>
            <p>
              Se recomienda al usuario revisar periodicamente esta politica para estar informado sobre como
              se utilizan las cookies en la Plataforma.
            </p>
          </CardContent>
        </Card>

        {/* 8. Contacto */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">8. Contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              Si tiene alguna pregunta o inquietud sobre el uso de cookies en la Plataforma, puede contactarnos a traves de:
            </p>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p><strong>Correo electronico:</strong> privacidad@aionseg.co</p>
              <p><strong>Correo de soporte:</strong> soporte@aionseg.co</p>
              <p><strong>Telefono:</strong> [Telefono de contacto]</p>
              <p><strong>Direccion:</strong> [Direccion de la sede principal], Medellin, Antioquia, Colombia</p>
            </div>
          </CardContent>
        </Card>

        {/* 9. Relacion con otras politicas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">9. Relacion con Otras Politicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              Esta Politica de Cookies debe leerse conjuntamente con los siguientes documentos legales de la Cooperativa:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Politica de Privacidad y Tratamiento de Datos Personales:</strong> Detalla como recopilamos, usamos, almacenamos y protegemos los datos personales.</li>
              <li><strong>Terminos y Condiciones de Uso:</strong> Regula el acceso y uso de la Plataforma AION Security.</li>
            </ul>
            <p>
              En caso de contradiccion entre esta Politica de Cookies y la Politica de Privacidad, prevalecera lo
              establecido en la Politica de Privacidad en todo lo relacionado con el tratamiento de datos personales.
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
              Esta politica complementa la Politica de Privacidad y se rige por las leyes de la Republica de Colombia.
            </p>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
