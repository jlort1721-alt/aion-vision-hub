# Cargar Contexto Completo del Proyecto

Lee TODOS estos archivos para tener contexto completo de AION Vision Hub antes de hacer cualquier cosa:

## 1. Memoria del proyecto
```bash
cat ~/.claude/projects/-Users-ADMIN-Documents-open-view-hub-main/memory/project_current_state.md
cat ~/.claude/projects/-Users-ADMIN-Documents-open-view-hub-main/memory/last_session.md
cat ~/.claude/projects/-Users-ADMIN-Documents-open-view-hub-main/memory/MEMORY.md
```

## 2. Git reciente
```bash
git log --oneline -20
git diff --stat HEAD~3..HEAD
```

## 3. Estado del VPS
```bash
ssh -i /Users/ADMIN/Downloads/clave-demo-aion.pem -o StrictHostKeyChecking=no -o ConnectTimeout=5 ubuntu@18.230.40.6 'pm2 list 2>/dev/null | grep -c online; systemctl is-active go2rtc; curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health/ready'
```

## Instrucciones
- CLAUDE.md ya se carga automáticamente — tiene arquitectura, stack, convenciones
- project_current_state.md tiene el estado ACTUAL: qué funciona, qué falta, errores
- last_session.md tiene los últimos commits y archivos modificados
- NO asumas nada sin verificar en código. Usa [EXISTE], [NO EXISTE], [HIPOTESIS]
- UI en español, código en inglés
- Esta es la plataforma AION (aionseg.co) — VMS empresarial, 25 sitios, 312 cámaras
