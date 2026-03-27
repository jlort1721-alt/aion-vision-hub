import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Eye,
  Lock,
  Cpu,
  ClipboardCheck,
  UserCheck,
  CheckCircle2,
  Star,
  Quote,
  Phone,
  Mail,
  MapPin,
  Clock,
  ChevronRight,
  MessageCircle,
  Send,
  Menu,
  X,
  Award,
  Users,
  Headphones,
  Zap,
  Camera,
  Fingerprint,
  ShieldCheck,
  ArrowRight,
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
} from 'lucide-react';

/* ── Brand Design System colour tokens (from CSS variables) ── */
const NAVY_900 = 'var(--color-navy-900)';
const NAVY_800 = 'var(--color-navy-800)';
const NAVY_700 = 'var(--color-navy-700)';
const NAVY_600 = 'var(--color-navy-500)';
const RED_600  = 'var(--color-red-600)';
const RED_700  = 'var(--color-red-700)';
const RED_500  = 'var(--color-red-600)';
const GOLD     = 'var(--color-gold-500)';
const GRAY_50  = 'var(--color-gray-50)';
const GRAY_100 = 'var(--color-gray-50)';
const GRAY_200 = 'var(--color-gray-200)';
const GRAY_400 = '#94a3b8';
const GRAY_500 = '#64748b';
const WHITE    = '#ffffff';

/* ─────────────────────────── data ──────────────────────────────────── */
const services = [
  {
    icon: UserCheck,
    title: 'Vigilancia Fisica',
    desc: 'Personal capacitado y certificado para resguardar sus instalaciones las 24 horas del dia, los 365 dias del ano. Protocolos de seguridad adaptados a su operacion.',
  },
  {
    icon: Camera,
    title: 'Monitoreo CCTV',
    desc: 'Centro de monitoreo con tecnologia de punta, camaras IP de alta resolucion, analisis inteligente de video y grabacion en la nube con respaldo redundante.',
  },
  {
    icon: Fingerprint,
    title: 'Control de Acceso',
    desc: 'Sistemas biometricos, tarjetas de proximidad y reconocimiento facial para gestionar el ingreso y egreso de personas en tiempo real.',
  },
  {
    icon: Cpu,
    title: 'Seguridad Electronica',
    desc: 'Alarmas perimetrales, sensores de movimiento, cercos electricos y sistemas de deteccion temprana integrados con nuestra plataforma AION.',
  },
  {
    icon: ClipboardCheck,
    title: 'Consultoria',
    desc: 'Evaluacion integral de riesgos, auditorias de seguridad, diseno de protocolos y planes de contingencia personalizados para su empresa.',
  },
  {
    icon: Shield,
    title: 'Escolta y Custodia',
    desc: 'Servicio de escolta ejecutiva, traslado de valores, custodia de mercancia y proteccion personal con vehiculos blindados y rastreo GPS.',
  },
];

const testimonials = [
  {
    name: 'Carlos Mendoza',
    company: 'Director de Operaciones, Grupo Industrial MX',
    text: 'Desde que contratamos a Clave Seguridad, los incidentes se redujeron un 85%. Su plataforma AION nos da visibilidad total en tiempo real. Excelente servicio y atencion personalizada.',
    stars: 5,
  },
  {
    name: 'Maria Elena Torres',
    company: 'Gerente General, Plaza Comercial Altavista',
    text: 'El sistema de monitoreo CCTV y control de acceso ha transformado la seguridad de nuestro centro comercial. La respuesta ante incidentes es inmediata y profesional.',
    stars: 5,
  },
  {
    name: 'Roberto Aguilar',
    company: 'CEO, Logistica Express del Norte',
    text: 'La consultoria de seguridad y los protocolos implementados superaron nuestras expectativas. Redujimos perdidas en un 92% el primer trimestre. Altamente recomendados.',
    stars: 5,
  },
];

const benefits = [
  { icon: Award, text: 'Certificaciones ISO 9001 y ISO 27001' },
  { icon: Users, text: 'Mas de 1,200 guardias capacitados' },
  { icon: Headphones, text: 'Soporte tecnico y operativo 24/7/365' },
  { icon: Zap, text: 'Respuesta ante emergencias en menos de 5 minutos' },
  { icon: ShieldCheck, text: 'Tecnologia AION con IA integrada' },
  { icon: Eye, text: 'Monitoreo remoto desde cualquier dispositivo' },
];

/* ═══════════════════════════════════════════════════════════════════════
   LANDING PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  /* ── contact form state ── */
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', message: '' });
  const [formSubmitted, setFormSubmitted] = useState(false);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
    setTimeout(() => setFormSubmitted(false), 4000);
  };

  /* ═══════════════════════════════════════════════════════════════════
     NAVBAR
     ═══════════════════════════════════════════════════════════════════ */
  const Navbar = () => (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{ background: `${NAVY_900}ee`, backdropFilter: 'blur(12px)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: RED_600 }}
            >
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-white font-bold text-lg leading-tight tracking-wide">
                CLAVE
              </span>
              <span className="text-xs tracking-[0.25em] leading-tight" style={{ color: GRAY_400 }}>
                SEGURIDAD
              </span>
            </div>
          </div>

          {/* Desktop links */}
          <div className="hidden lg:flex items-center gap-8">
            {['Inicio', 'Servicios', 'Nosotros', 'Testimonios', 'Contacto'].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="text-sm font-medium transition-colors duration-200 hover:text-white"
                style={{ color: GRAY_400 }}
              >
                {item}
              </a>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="hidden lg:flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="px-5 py-2 text-sm font-medium rounded-lg border transition-all duration-200 hover:bg-white/10"
              style={{ color: WHITE, borderColor: GRAY_500 }}
            >
              Iniciar Sesion
            </button>
            <button
              onClick={() => {
                const el = document.getElementById('contacto');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-5 py-2 text-sm font-semibold rounded-lg text-white transition-all duration-200 hover:brightness-110"
              style={{ background: RED_600 }}
            >
              Solicitar Cotizacion
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden text-white p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden border-t px-4 py-4 space-y-3"
          style={{ background: NAVY_900, borderColor: NAVY_700 }}
        >
          {['Inicio', 'Servicios', 'Nosotros', 'Testimonios', 'Contacto'].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="block text-sm font-medium py-2"
              style={{ color: GRAY_400 }}
              onClick={() => setMobileMenuOpen(false)}
            >
              {item}
            </a>
          ))}
          <div className="pt-3 flex flex-col gap-2 border-t" style={{ borderColor: NAVY_700 }}>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-2.5 text-sm font-medium rounded-lg border"
              style={{ color: WHITE, borderColor: GRAY_500 }}
            >
              Iniciar Sesion
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                const el = document.getElementById('contacto');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full py-2.5 text-sm font-semibold rounded-lg text-white"
              style={{ background: RED_600 }}
            >
              Solicitar Cotizacion
            </button>
          </div>
        </div>
      )}
    </nav>
  );

  /* ═══════════════════════════════════════════════════════════════════
     1 · HERO SECTION
     ═══════════════════════════════════════════════════════════════════ */
  const HeroSection = () => (
    <section
      id="inicio"
      className="relative min-h-screen flex items-center overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${NAVY_900} 0%, ${NAVY_800} 50%, ${NAVY_700} 100%)`,
        clipPath: 'polygon(0 0, 100% 0, 100% 88%, 0 100%)',
      }}
    >
      {/* Decorative grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Decorative gradient orbs */}
      <div
        className="absolute top-20 right-20 w-[500px] h-[500px] rounded-full opacity-10 blur-3xl"
        style={{ background: RED_600 }}
      />
      <div
        className="absolute bottom-40 left-10 w-[300px] h-[300px] rounded-full opacity-5 blur-3xl"
        style={{ background: '#3b82f6' }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-32 lg:pt-32 lg:pb-40 w-full">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          {/* Left content — 7 cols */}
          <div className="lg:col-span-7 space-y-8">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border" style={{ borderColor: `${RED_600}40`, background: `${RED_600}10` }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: RED_500 }} />
              <span className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: RED_500 }}>
                Seguridad Profesional
              </span>
            </div>

            {/* H1 */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold leading-[1.08] tracking-tight text-white">
              Proteccion{' '}
              <span style={{ color: RED_500 }}>Inteligente</span>{' '}
              para su Empresa
            </h1>

            {/* Paragraph */}
            <p className="text-lg lg:text-xl max-w-xl leading-relaxed" style={{ color: GRAY_400 }}>
              Soluciones integrales de seguridad privada potenciadas por la plataforma{' '}
              <span className="font-semibold text-white">AION</span>. Vigilancia fisica,
              monitoreo CCTV, control de acceso y mas, respaldados por tecnologia de
              vanguardia e inteligencia artificial.
            </p>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => {
                  const el = document.getElementById('contacto');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold rounded-xl text-white transition-all duration-200 hover:brightness-110 hover:shadow-lg hover:shadow-red-600/25"
                style={{ background: RED_600 }}
              >
                Solicitar Cotizacion
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  const el = document.getElementById('servicios');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold rounded-xl border transition-all duration-200 hover:bg-white/5"
                style={{ color: WHITE, borderColor: GRAY_500 }}
              >
                Conocer Servicios
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap gap-8 pt-4">
              {[
                { value: '15+', label: 'Anos de Experiencia' },
                { value: '500+', label: 'Clientes Activos' },
                { value: '24/7', label: 'Soporte Continuo' },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col">
                  <span className="text-3xl lg:text-4xl font-extrabold" style={{ color: RED_500 }}>
                    {stat.value}
                  </span>
                  <span className="text-sm mt-1" style={{ color: GRAY_400 }}>
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right decorative — 5 cols */}
          <div className="hidden lg:flex lg:col-span-5 items-center justify-center relative">
            {/* Main shield */}
            <div className="relative">
              <div
                className="w-72 h-72 xl:w-80 xl:h-80 rounded-3xl flex items-center justify-center shadow-2xl"
                style={{
                  background: `linear-gradient(135deg, ${RED_600}20, ${NAVY_700})`,
                  border: `1px solid ${RED_600}30`,
                }}
              >
                <Shield className="w-32 h-32 xl:w-40 xl:h-40" style={{ color: `${RED_600}60` }} />
              </div>

              {/* Floating cards */}
              <div
                className="absolute -top-6 -right-6 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-pulse-slow"
                style={{ background: NAVY_700, border: `1px solid ${NAVY_600}` }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${RED_600}20` }}>
                  <Camera className="w-5 h-5" style={{ color: RED_500 }} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">128 Camaras</p>
                  <p className="text-[10px]" style={{ color: GRAY_500 }}>En linea</p>
                </div>
              </div>

              <div
                className="absolute -bottom-4 -left-8 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3"
                style={{ background: NAVY_700, border: `1px solid ${NAVY_600}` }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#10b98120' }}>
                  <CheckCircle2 className="w-5 h-5" style={{ color: '#10b981' }} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Sistema Activo</p>
                  <p className="text-[10px]" style={{ color: GRAY_500 }}>Sin incidentes</p>
                </div>
              </div>

              <div
                className="absolute top-1/2 -right-16 transform -translate-y-1/2 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3"
                style={{ background: NAVY_700, border: `1px solid ${NAVY_600}` }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}20` }}>
                  <Fingerprint className="w-5 h-5" style={{ color: GOLD }} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Acceso Bio</p>
                  <p className="text-[10px]" style={{ color: GRAY_500 }}>Activo</p>
                </div>
              </div>

              {/* Orbiting ring */}
              <div
                className="absolute inset-[-40px] rounded-full border opacity-20"
                style={{ borderColor: RED_600, borderStyle: 'dashed' }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  /* ═══════════════════════════════════════════════════════════════════
     2 · SERVICES SECTION
     ═══════════════════════════════════════════════════════════════════ */
  const ServicesSection = () => (
    <section
      id="servicios"
      className="relative py-24 lg:py-32"
      style={{ background: GRAY_50 }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6" style={{ background: `${RED_600}10` }}>
            <span className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: RED_600 }}>
              Nuestros Servicios
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight" style={{ color: NAVY_900 }}>
            Soluciones Integrales de{' '}
            <span style={{ color: RED_600 }}>Seguridad</span>
          </h2>
          <div className="w-20 h-1 mx-auto mt-6 rounded-full" style={{ background: RED_600 }} />
          <p className="mt-6 text-lg leading-relaxed" style={{ color: GRAY_500 }}>
            Ofrecemos un ecosistema completo de servicios diseñados para proteger lo que mas
            importa. Cada solucion se adapta a las necesidades especificas de su empresa.
          </p>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((svc) => (
            <div
              key={svc.title}
              className="group relative bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
              style={{ borderTop: `4px solid ${RED_600}` }}
            >
              {/* Icon */}
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center mb-6 transition-colors duration-300"
                style={{ background: `${RED_600}10` }}
              >
                <svc.icon className="w-7 h-7 transition-colors duration-300" style={{ color: RED_600 }} />
              </div>

              <h3 className="text-xl font-bold mb-3" style={{ color: NAVY_900 }}>
                {svc.title}
              </h3>
              <p className="text-sm leading-relaxed mb-6" style={{ color: GRAY_500 }}>
                {svc.desc}
              </p>
              <a
                href="#contacto"
                className="inline-flex items-center gap-1 text-sm font-semibold transition-colors duration-200"
                style={{ color: RED_600 }}
              >
                Ver mas
                <ChevronRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  /* ═══════════════════════════════════════════════════════════════════
     3 · WHY CHOOSE US SECTION
     ═══════════════════════════════════════════════════════════════════ */
  const WhyUsSection = () => (
    <section
      id="nosotros"
      className="relative py-24 lg:py-32 overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${NAVY_900}, ${NAVY_800})` }}
    >
      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left — Image placeholder */}
          <div className="relative">
            <div
              className="w-full aspect-[4/3] rounded-2xl flex items-center justify-center overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${NAVY_700}, ${NAVY_600})`,
                border: `1px solid ${NAVY_600}`,
              }}
            >
              <div className="text-center space-y-4">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto"
                  style={{ background: `${RED_600}15` }}
                >
                  <Shield className="w-10 h-10" style={{ color: RED_600 }} />
                </div>
                <p className="text-sm font-medium" style={{ color: GRAY_400 }}>
                  Centro de Operaciones AION
                </p>
              </div>
            </div>

            {/* Big numbers overlay */}
            <div
              className="absolute -bottom-6 -right-6 sm:right-4 px-6 py-5 rounded-2xl shadow-2xl"
              style={{ background: RED_600 }}
            >
              <div className="grid grid-cols-3 gap-6 text-center">
                {[
                  { num: '15+', label: 'Anos' },
                  { num: '500+', label: 'Clientes' },
                  { num: '98%', label: 'Satisfaccion' },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-2xl font-extrabold text-white">{item.num}</p>
                    <p className="text-xs text-white/70 mt-0.5">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right — Benefits */}
          <div className="space-y-8">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6" style={{ background: `${GOLD}15` }}>
                <span className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: GOLD }}>
                  Por que elegirnos
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight tracking-tight">
                Experiencia y{' '}
                <span style={{ color: RED_500 }}>Tecnologia</span>{' '}
                al Servicio de su Seguridad
              </h2>
              <p className="mt-6 text-lg leading-relaxed" style={{ color: GRAY_400 }}>
                Combinamos mas de 15 anos de experiencia en seguridad privada con la
                plataforma tecnologica mas avanzada del mercado. Nuestra mision es
                brindar tranquilidad total a cada uno de nuestros clientes.
              </p>
            </div>

            <div className="space-y-5">
              {benefits.map((b) => (
                <div key={b.text} className="flex items-start gap-4">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${GOLD}15` }}
                  >
                    <b.icon className="w-5 h-5" style={{ color: GOLD }} />
                  </div>
                  <p className="text-base text-white/90 pt-2.5">{b.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  /* ═══════════════════════════════════════════════════════════════════
     4 · TESTIMONIALS SECTION
     ═══════════════════════════════════════════════════════════════════ */
  const TestimonialsSection = () => (
    <section
      id="testimonios"
      className="relative py-24 lg:py-32"
      style={{
        background: GRAY_50,
        clipPath: 'polygon(0 4%, 100% 0, 100% 96%, 0 100%)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16 pt-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6" style={{ background: `${RED_600}10` }}>
            <span className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: RED_600 }}>
              Testimonios
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight" style={{ color: NAVY_900 }}>
            Lo que Dicen Nuestros{' '}
            <span style={{ color: RED_600 }}>Clientes</span>
          </h2>
          <div className="w-20 h-1 mx-auto mt-6 rounded-full" style={{ background: RED_600 }} />
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-8 pb-8">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col"
            >
              {/* Quote icon */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-6"
                style={{ background: `${RED_600}10` }}
              >
                <Quote className="w-6 h-6" style={{ color: RED_600 }} />
              </div>

              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {Array.from({ length: t.stars }).map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-current" style={{ color: GOLD }} />
                ))}
              </div>

              {/* Text */}
              <p className="text-sm leading-relaxed flex-1 mb-6" style={{ color: GRAY_500 }}>
                "{t.text}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-3 pt-4 border-t" style={{ borderColor: GRAY_200 }}>
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm text-white"
                  style={{ background: RED_600 }}
                >
                  {t.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: NAVY_900 }}>{t.name}</p>
                  <p className="text-xs" style={{ color: GRAY_500 }}>{t.company}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  /* ═══════════════════════════════════════════════════════════════════
     5 · CONTACT / QUOTE FORM
     ═══════════════════════════════════════════════════════════════════ */
  const ContactSection = () => (
    <section
      id="contacto"
      className="relative py-24 lg:py-32"
      style={{ background: `linear-gradient(135deg, ${NAVY_700}, ${NAVY_800})` }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Left info */}
          <div className="space-y-8">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6" style={{ background: `${RED_600}15` }}>
                <span className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: RED_500 }}>
                  Contacto
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight tracking-tight">
                Solicite su{' '}
                <span style={{ color: RED_500 }}>Cotizacion</span>{' '}
                Gratuita
              </h2>
              <p className="mt-6 text-lg leading-relaxed" style={{ color: GRAY_400 }}>
                Nuestro equipo de asesores especializados le contactara en menos de 24 horas
                para disenar la solucion perfecta para su empresa.
              </p>
            </div>

            {/* Benefits list */}
            <div className="space-y-4">
              {[
                'Evaluacion de riesgos sin costo',
                'Propuesta personalizada en 48 horas',
                'Sin compromisos ni contratos minimos',
                'Asesor dedicado para su cuenta',
              ].map((b) => (
                <div key={b} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: '#10b981' }} />
                  <span className="text-sm text-white/90">{b}</span>
                </div>
              ))}
            </div>

            {/* Contact info cards */}
            <div className="space-y-4 pt-4">
              {[
                { icon: Phone, label: 'Telefono', value: '+52 (55) 1234-5678', href: 'tel:+5255123456780' },
                { icon: Mail, label: 'Correo', value: 'contacto@claveseguridad.mx', href: 'mailto:contacto@claveseguridad.mx' },
                { icon: MapPin, label: 'Oficina Central', value: 'Av. Insurgentes Sur 1234, Col. Del Valle, CDMX', href: '#' },
              ].map((c) => (
                <a
                  key={c.label}
                  href={c.href}
                  className="flex items-start gap-4 p-4 rounded-xl transition-colors duration-200 hover:bg-white/5"
                  style={{ border: `1px solid ${NAVY_600}` }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${RED_600}15` }}
                  >
                    <c.icon className="w-5 h-5" style={{ color: RED_500 }} />
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-0.5" style={{ color: GRAY_400 }}>{c.label}</p>
                    <p className="text-sm text-white">{c.value}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Right — Form card */}
          <div className="bg-white rounded-2xl p-8 sm:p-10 shadow-2xl">
            <h3 className="text-2xl font-bold mb-2" style={{ color: NAVY_900 }}>
              Formulario de Contacto
            </h3>
            <p className="text-sm mb-8" style={{ color: GRAY_500 }}>
              Complete los datos y nos pondremos en contacto a la brevedad.
            </p>

            {formSubmitted ? (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: '#10b98115' }}
                >
                  <CheckCircle2 className="w-8 h-8" style={{ color: '#10b981' }} />
                </div>
                <h4 className="text-xl font-bold" style={{ color: NAVY_900 }}>Mensaje Enviado</h4>
                <p className="text-sm" style={{ color: GRAY_500 }}>
                  Gracias por su interes. Un asesor se comunicara con usted en breve.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: NAVY_900 }}>
                      Nombre completo *
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      value={form.name}
                      onChange={handleFormChange}
                      placeholder="Juan Perez"
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200 focus:ring-2"
                      style={{
                        background: GRAY_50,
                        border: `1px solid ${GRAY_200}`,
                        color: NAVY_900,
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: NAVY_900 }}>
                      Correo electronico *
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      value={form.email}
                      onChange={handleFormChange}
                      placeholder="correo@empresa.com"
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200 focus:ring-2"
                      style={{
                        background: GRAY_50,
                        border: `1px solid ${GRAY_200}`,
                        color: NAVY_900,
                      }}
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: NAVY_900 }}>
                      Telefono
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={handleFormChange}
                      placeholder="+52 (55) 0000-0000"
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200 focus:ring-2"
                      style={{
                        background: GRAY_50,
                        border: `1px solid ${GRAY_200}`,
                        color: NAVY_900,
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: NAVY_900 }}>
                      Empresa
                    </label>
                    <input
                      type="text"
                      name="company"
                      value={form.company}
                      onChange={handleFormChange}
                      placeholder="Mi Empresa S.A. de C.V."
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200 focus:ring-2"
                      style={{
                        background: GRAY_50,
                        border: `1px solid ${GRAY_200}`,
                        color: NAVY_900,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: NAVY_900 }}>
                    Mensaje *
                  </label>
                  <textarea
                    name="message"
                    required
                    rows={4}
                    value={form.message}
                    onChange={handleFormChange}
                    placeholder="Describa brevemente sus necesidades de seguridad..."
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200 focus:ring-2 resize-none"
                    style={{
                      background: GRAY_50,
                      border: `1px solid ${GRAY_200}`,
                      color: NAVY_900,
                    }}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold rounded-xl text-white transition-all duration-200 hover:brightness-110 hover:shadow-lg hover:shadow-red-600/25"
                  style={{ background: RED_600 }}
                >
                  <Send className="w-5 h-5" />
                  Enviar Solicitud
                </button>

                <p className="text-xs text-center" style={{ color: GRAY_400 }}>
                  Al enviar, acepta nuestra politica de privacidad. Sus datos estan protegidos.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );

  /* ═══════════════════════════════════════════════════════════════════
     6 · FOOTER
     ═══════════════════════════════════════════════════════════════════ */
  const Footer = () => (
    <footer style={{ background: NAVY_900 }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Col 1 — Brand */}
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: RED_600 }}
              >
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-lg leading-tight">CLAVE</p>
                <p className="text-xs tracking-[0.25em]" style={{ color: GRAY_500 }}>SEGURIDAD</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: GRAY_400 }}>
              Lider en seguridad privada e integracion tecnologica. Protegemos empresas,
              patrimonios y personas con soluciones de vanguardia potenciadas por nuestra
              plataforma AION.
            </p>
            {/* Social icons */}
            <div className="flex gap-3">
              {[Facebook, Instagram, Linkedin, Twitter].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-200 hover:bg-white/10"
                  style={{ background: `${NAVY_700}`, border: `1px solid ${NAVY_600}` }}
                >
                  <Icon className="w-4 h-4" style={{ color: GRAY_400 }} />
                </a>
              ))}
            </div>
          </div>

          {/* Col 2 — Links */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-5 tracking-wide uppercase">
              Enlaces
            </h4>
            <ul className="space-y-3">
              {[
                { label: 'Inicio', href: '#inicio' },
                { label: 'Servicios', href: '#servicios' },
                { label: 'Nosotros', href: '#nosotros' },
                { label: 'Testimonios', href: '#testimonios' },
                { label: 'Contacto', href: '#contacto' },
                { label: 'Plataforma AION', href: '/login' },
              ].map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    className="text-sm transition-colors duration-200 hover:text-white inline-flex items-center gap-1"
                    style={{ color: GRAY_400 }}
                  >
                    <ChevronRight className="w-3 h-3" />
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3 — Hours */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-5 tracking-wide uppercase">
              Horarios de Atencion
            </h4>
            <div className="space-y-4">
              {[
                { day: 'Lunes a Viernes', hours: '8:00 AM - 8:00 PM' },
                { day: 'Sabados', hours: '9:00 AM - 3:00 PM' },
                { day: 'Domingos', hours: 'Cerrado (guardia 24/7)' },
              ].map((h) => (
                <div key={h.day} className="flex items-start gap-3">
                  <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: GRAY_500 }} />
                  <div>
                    <p className="text-sm text-white font-medium">{h.day}</p>
                    <p className="text-xs" style={{ color: GRAY_400 }}>{h.hours}</p>
                  </div>
                </div>
              ))}
              <div
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg mt-2"
                style={{ background: `${RED_600}15`, border: `1px solid ${RED_600}30` }}
              >
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: RED_500 }} />
                <span className="text-xs font-semibold" style={{ color: RED_500 }}>
                  Centro de Monitoreo 24/7/365
                </span>
              </div>
            </div>
          </div>

          {/* Col 4 — Contact */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-5 tracking-wide uppercase">
              Contacto Directo
            </h4>
            <div className="space-y-4">
              <a href="tel:+525512345678" className="flex items-start gap-3 group">
                <Phone className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: GRAY_500 }} />
                <div>
                  <p className="text-sm text-white group-hover:underline">+52 (55) 1234-5678</p>
                  <p className="text-xs" style={{ color: GRAY_400 }}>Oficina Central</p>
                </div>
              </a>
              <a href="tel:+528001234567" className="flex items-start gap-3 group">
                <Phone className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: GRAY_500 }} />
                <div>
                  <p className="text-sm text-white group-hover:underline">800 123 4567</p>
                  <p className="text-xs" style={{ color: GRAY_400 }}>Linea gratuita</p>
                </div>
              </a>
              <a href="mailto:contacto@claveseguridad.mx" className="flex items-start gap-3 group">
                <Mail className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: GRAY_500 }} />
                <div>
                  <p className="text-sm text-white group-hover:underline">contacto@claveseguridad.mx</p>
                </div>
              </a>
              <a href="#" className="flex items-start gap-3 group">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: GRAY_500 }} />
                <div>
                  <p className="text-sm text-white">Av. Insurgentes Sur 1234</p>
                  <p className="text-xs" style={{ color: GRAY_400 }}>Col. Del Valle, CDMX 03100</p>
                </div>
              </a>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div
          className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t"
          style={{ borderColor: NAVY_700 }}
        >
          <p className="text-xs" style={{ color: GRAY_500 }}>
            &copy; {new Date().getFullYear()} Clave Seguridad. Todos los derechos reservados.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-xs hover:text-white transition-colors" style={{ color: GRAY_500 }}>
              Aviso de Privacidad
            </a>
            <a href="#" className="text-xs hover:text-white transition-colors" style={{ color: GRAY_500 }}>
              Terminos y Condiciones
            </a>
          </div>
        </div>
      </div>
    </footer>
  );

  /* ═══════════════════════════════════════════════════════════════════
     WHATSAPP FLOATING BUTTON
     ═══════════════════════════════════════════════════════════════════ */
  const WhatsAppButton = () => (
    <a
      href="https://wa.me/525512345678?text=Hola%2C%20me%20interesa%20conocer%20sus%20servicios%20de%20seguridad."
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform duration-200 hover:scale-110"
      style={{ background: '#25d366' }}
      aria-label="Contactar por WhatsApp"
    >
      <MessageCircle className="w-7 h-7 text-white" />
    </a>
  );

  /* ═══════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen" style={{ background: NAVY_900 }}>
      <Navbar />
      <HeroSection />
      <ServicesSection />
      <WhyUsSection />
      <TestimonialsSection />
      <ContactSection />
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
