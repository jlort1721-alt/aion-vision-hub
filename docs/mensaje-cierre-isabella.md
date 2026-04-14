Isabella, para cerrar Vision Hub al 78% (+4 devices sobre 61%)
solo falta registrar 4 XVR Dahua en la cuenta IMOU Life que ya
tenemos (la misma donde estan los otros 8). Son 40 minutos.

No necesita tecnico especializado — lo puede hacer cualquier
administrador de edificio con acceso fisico al XVR:

1. Abrir IMOU Life con nuestra cuenta
2. "+" > Add Device > ingresar SN
3. Ingresar Security Code que aparece en el menu del XVR

Los 4 XVR son:
- DNXVR002 (Danubios 2): SN AH0306CPAZ5EA1A
- TZXVR002 (Terrazzino 2): SN AH0306CPAZ5E9FA
- SAXVR001 (Santa Ana): SN AB081E4PAZD6D5B
- FCXVR001 (Factory): SN 9B02D09PAZ4C0D2

Doc completo con paso a paso:
docs/registro-imou-4-dahua.es.md

Como alternativa si no es posible IMOU: coordinar con ISP de
cada sitio para port-forwarding HTTP:80 al XVR. Mas complejo
pero tambien funciona (AION lo detectaria automaticamente via
CGI directo, ya esta implementado).

Despues de los 4 Dahua: 18/23 (78%). Los 5 Hik que faltan son
visita tecnica inevitable (reinicio fisico de DVR con sesion
colgada). Quedariamos al 100% con 1 visita de medio dia a
3 sitios (Torre Lucia, San Sebastian, Altos del Rosario) +
Altagracia para configurar port-forward HTTP.
