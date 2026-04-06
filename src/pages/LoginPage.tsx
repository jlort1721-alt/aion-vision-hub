import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, EyeOff, Shield, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/contexts/I18nContext';
import { cn } from '@/lib/utils';
import Logo from '@/components/brand/Logo';

const getPasswordStrength = (pwd: string): number => {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return Math.min(score, 4);
};
const strengthColors: Record<number, string> = { 0: "bg-destructive", 1: "bg-destructive", 2: "bg-yellow-500", 3: "bg-green-500", 4: "bg-green-600" };

export default function LoginPage() {
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [dataAccepted, setDataAccepted] = useState(false);
  const [dataError, setDataError] = useState(false);
  const { login, signup, resetPassword } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const strengthLevel = getPasswordStrength(password);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dataAccepted) {
      setDataError(true);
      return;
    }
    setDataError(false);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      toast({ title: 'Error de autenticación', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: 'Contraseña muy corta', description: 'Mínimo 6 caracteres', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await signup(email, password, fullName);
      toast({ title: 'Cuenta creada', description: 'Revisa tu correo electrónico para confirmar tu cuenta.' });
      setTab('login');
    } catch (err: any) {
      toast({ title: 'Error de registro', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await resetPassword(email);
      setResetSent(true);
      toast({ title: 'Enlace enviado', description: 'Revisa tu correo para las instrucciones de recuperación.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'No se pudo enviar el enlace', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="rounded-2xl bg-card p-4 shadow-lg border">
            <Logo variant="icon" height={56} />
          </div>
          <h1 className="text-2xl font-bold font-heading tracking-tight mt-2">Clave Seguridad</h1>
          <p className="text-sm text-muted-foreground">Centro de Monitoreo y Control</p>
        </div>

        <Card className="shadow-lg">
          <Tabs value={tab} onValueChange={setTab}>
            <CardHeader className="pb-2">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
                <TabsTrigger value="signup">Registrarse</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="login" className="mt-0">
                <form onSubmit={handleLogin} className="space-y-4" aria-label="Login form">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Correo Electrónico<span className="text-destructive ml-0.5">*</span></Label>
                    <Input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@empresa.com" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Contraseña<span className="text-destructive ml-0.5">*</span></Label>
                    <div className="relative">
                      <Input id="login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required />
                      <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="data-protection"
                        checked={dataAccepted}
                        onCheckedChange={(checked) => {
                          setDataAccepted(checked === true);
                          if (checked) setDataError(false);
                        }}
                        className="mt-0.5"
                      />
                      <label htmlFor="data-protection" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                        {t('legal.data_protection')}{' '}
                        <a href="/privacy" className="text-primary underline underline-offset-2 hover:text-primary/80" onClick={(e) => e.stopPropagation()}>
                          {t('cookie.privacy_link')}
                        </a>
                      </label>
                    </div>
                    {dataError && (
                      <p className="text-xs text-destructive pl-6">{t('legal.data_protection_required')}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={loading || !dataAccepted}>
                    {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                  </Button>
                  <Button type="button" variant="link" className="w-full text-xs" onClick={() => setTab('reset')}>
                    ¿Olvidaste tu contraseña?
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-0">
                <form onSubmit={handleSignup} className="space-y-4" aria-label="Sign up form">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Nombre Completo<span className="text-destructive ml-0.5">*</span></Label>
                    <Input id="signup-name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Juan Pérez" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Correo Electrónico<span className="text-destructive ml-0.5">*</span></Label>
                    <Input id="signup-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@empresa.com" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Contraseña<span className="text-destructive ml-0.5">*</span></Label>
                    <Input id="signup-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required />
                  </div>
                  {/* Password strength indicator */}
                  {tab === 'signup' && password && (
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        {[1,2,3,4].map(i => (
                          <div key={i} className={cn("h-1 flex-1 rounded-full transition-all",
                            i <= strengthLevel ? strengthColors[strengthLevel] : "bg-muted"
                          )} />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {strengthLevel === 0 && t('password.very_weak')}
                        {strengthLevel === 1 && t('password.weak')}
                        {strengthLevel === 2 && t('password.acceptable')}
                        {strengthLevel === 3 && t('password.strong')}
                        {strengthLevel === 4 && t('password.very_strong')}
                      </p>
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="reset" className="mt-0">
                {resetSent ? (
                  <div className="text-center space-y-3 py-4">
                    <p className="text-sm">Revisa tu correo electrónico para el enlace de recuperación.</p>
                    <Button variant="outline" onClick={() => { setTab('login'); setResetSent(false); }}>
                      <ArrowLeft className="mr-1 h-3 w-3" /> Volver al inicio
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleReset} className="space-y-4" aria-label="Password reset form">
                    <p className="text-sm text-muted-foreground">Ingresa tu correo para recibir un enlace de recuperación de contraseña.</p>
                    <div className="space-y-2">
                      <Label htmlFor="reset-email">Correo Electrónico<span className="text-destructive ml-0.5">*</span></Label>
                      <Input id="reset-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? 'Enviando...' : 'Enviar Enlace'}
                    </Button>
                    <Button type="button" variant="ghost" className="w-full text-xs" onClick={() => setTab('login')}>
                      <ArrowLeft className="mr-1 h-3 w-3" /> Volver al inicio
                    </Button>
                  </form>
                )}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Shield className="h-3 w-3" />
            <span>Plataforma Protegida</span>
          </div>
          <nav className="flex items-center gap-3">
            <a href="/privacy" className="hover:underline transition-colors hover:text-foreground">Privacidad</a>
            <span className="text-border">&middot;</span>
            <a href="/terms" className="hover:underline transition-colors hover:text-foreground">Términos</a>
            <span className="text-border">&middot;</span>
            <a href="/cookies" className="hover:underline transition-colors hover:text-foreground">Cookies</a>
          </nav>
        </div>
      </div>
    </div>
  );
}
