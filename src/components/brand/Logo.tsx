import React from 'react';
import { useNavigate } from 'react-router-dom';

interface LogoProps {
  variant?: 'dark' | 'light' | 'compact' | 'icon' | 'minimal';
  width?: string | number;
  height?: string | number;
  className?: string;
  onClick?: () => void;
}

/**
 * Clave Seguridad CTA — Official Logo Component
 * 5 variants: dark, light, compact, icon, minimal
 * SVG rendered inline for quality + font inheritance
 */
export default function Logo({ variant = 'dark', width, height, className = '', onClick }: LogoProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) { onClick(); return; }
    navigate('/');
  };

  const defaultHeights: Record<string, number> = {
    dark: 108,
    light: 108,
    compact: 44,
    icon: 60,
    minimal: 40,
  };

  const h = height || defaultHeights[variant] || 60;
  const w = width || 'auto';

  return (
    <a
      href="/"
      onClick={(e) => { e.preventDefault(); handleClick(); }}
      className={`inline-flex items-center cursor-pointer ${className}`}
      aria-label="Ir al inicio - Clave Seguridad CTA"
      style={{ textDecoration: 'none' }}
    >
      {variant === 'icon' && <IconVariant width={w} height={h} />}
      {variant === 'compact' && <CompactVariant width={w} height={h} />}
      {variant === 'minimal' && <MinimalVariant width={w} height={h} />}
      {variant === 'dark' && <DarkVariant width={w} height={h} />}
      {variant === 'light' && <LightVariant width={w} height={h} />}
    </a>
  );
}

function IconVariant({ width, height }: { width: string | number; height: string | number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 96 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Clave Seguridad CTA">
      <defs>
        <linearGradient id="logo-A" x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="#D91E25"/><stop offset="40%" stopColor="#A8141A"/><stop offset="78%" stopColor="#7A0D11"/><stop offset="100%" stopColor="#4A0709"/>
        </linearGradient>
      </defs>
      <path d="M48,5 L72,5 L81,14 L81,60 Q81,78 48,93 Q15,78 15,60 L15,14 Z" fill="#250407" opacity=".7" transform="translate(3,3)"/>
      <path d="M48,3 L74,3 L84,13 L84,60 Q84,80 48,96 Q12,80 12,60 L12,13 Z" fill="url(#logo-A)"/>
      <path d="M48,3 L74,3 L84,13 L84,60 Q84,80 48,96 Q12,80 12,60 L12,13 Z" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth=".9"/>
      <circle cx="48" cy="52" r="21" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth=".9"/>
      <circle cx="48" cy="52" r="3" fill="white" opacity=".95"/>
      <circle cx="48" cy="52" r="1.8" fill="#C8232A"/>
      <line x1="48" y1="31" x2="48" y2="40" stroke="rgba(255,255,255,.55)" strokeWidth="1.1" strokeLinecap="round"/>
      <line x1="48" y1="64" x2="48" y2="73" stroke="rgba(255,255,255,.55)" strokeWidth="1.1" strokeLinecap="round"/>
      <line x1="27" y1="52" x2="36" y2="52" stroke="rgba(255,255,255,.55)" strokeWidth="1.1" strokeLinecap="round"/>
      <line x1="60" y1="52" x2="69" y2="52" stroke="rgba(255,255,255,.55)" strokeWidth="1.1" strokeLinecap="round"/>
      <path d="M72,3 L84,3 L84,15" fill="none" stroke="#D4A017" strokeWidth="2.4" strokeLinecap="square"/>
    </svg>
  );
}

function CompactVariant({ width, height }: { width: string | number; height: string | number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 300 50" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Clave Seguridad CTA">
      <defs>
        <linearGradient id="logo-compact-A" x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="#D91E25"/><stop offset="40%" stopColor="#A8141A"/><stop offset="78%" stopColor="#7A0D11"/><stop offset="100%" stopColor="#4A0709"/>
        </linearGradient>
      </defs>
      <g transform="scale(0.48) translate(2,2)">
        <path d="M48,3 L74,3 L84,13 L84,60 Q84,80 48,96 Q12,80 12,60 L12,13 Z" fill="url(#logo-compact-A)"/>
        <circle cx="48" cy="52" r="3" fill="white"/><circle cx="48" cy="52" r="1.5" fill="#C8232A"/>
        <path d="M72,3 L84,3 L84,15" fill="none" stroke="#D4A017" strokeWidth="2.4"/>
      </g>
      <text x="56" y="24" fontFamily="'Montserrat','Arial Black',sans-serif" fontSize="18" fontWeight="900" fill="#FFFFFF" letterSpacing="4">CLAVE</text>
      <text x="56" y="43" fontFamily="'Montserrat','Arial Black',sans-serif" fontSize="18" fontWeight="900" fill="#C8232A" letterSpacing="1">SEGURIDAD</text>
    </svg>
  );
}

function MinimalVariant({ width, height }: { width: string | number; height: string | number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 238 52" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Clave Seguridad CTA">
      <defs>
        <linearGradient id="logo-min-A" x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="#D91E25"/><stop offset="40%" stopColor="#A8141A"/><stop offset="100%" stopColor="#4A0709"/>
        </linearGradient>
      </defs>
      <g transform="scale(0.42) translate(2,8)">
        <path d="M48,3 L74,3 L84,13 L84,60 Q84,80 48,96 Q12,80 12,60 L12,13 Z" fill="url(#logo-min-A)"/>
        <circle cx="48" cy="52" r="3" fill="white"/><circle cx="48" cy="52" r="1.5" fill="#C8232A"/>
      </g>
      <text x="48" y="22" fontFamily="'Montserrat',sans-serif" fontSize="16" fontWeight="900" fill="#0D1B2A" letterSpacing="3">CLAVE</text>
      <text x="48" y="40" fontFamily="'Montserrat',sans-serif" fontSize="16" fontWeight="900" fill="#C8232A" letterSpacing="1">SEGURIDAD</text>
    </svg>
  );
}

function DarkVariant({ width, height }: { width: string | number; height: string | number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 440 108" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Clave Seguridad CTA">
      <defs>
        <linearGradient id="ld-A" x1="0" y1="0" x2="0.2" y2="1"><stop offset="0%" stopColor="#D91E25"/><stop offset="40%" stopColor="#A8141A"/><stop offset="78%" stopColor="#7A0D11"/><stop offset="100%" stopColor="#4A0709"/></linearGradient>
        <linearGradient id="ld-B" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FF7880" stopOpacity=".6"/><stop offset="45%" stopColor="#D91E25" stopOpacity=".12"/><stop offset="100%" stopColor="#7A0D11" stopOpacity="0"/></linearGradient>
        <linearGradient id="ld-C" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C8232A" stopOpacity="0"/><stop offset="20%" stopColor="#C8232A" stopOpacity=".9"/><stop offset="50%" stopColor="#C8232A"/><stop offset="80%" stopColor="#C8232A" stopOpacity=".9"/><stop offset="100%" stopColor="#C8232A" stopOpacity="0"/></linearGradient>
        <linearGradient id="ld-D" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#D4A017" stopOpacity="0"/><stop offset="50%" stopColor="#D4A017"/><stop offset="100%" stopColor="#D4A017" stopOpacity=".3"/></linearGradient>
        <linearGradient id="ld-E" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="white" stopOpacity="0"/><stop offset="70%" stopColor="white" stopOpacity=".75"/><stop offset="100%" stopColor="white" stopOpacity="1"/></linearGradient>
        <linearGradient id="ld-F" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#C8232A"/><stop offset="100%" stopColor="#C8232A" stopOpacity="0"/></linearGradient>
        <clipPath id="ld-SC"><path d="M48,3 L74,3 L84,13 L84,60 Q84,80 48,96 Q12,80 12,60 L12,13 Z"/></clipPath>
      </defs>
      <path d="M48,5 L72,5 L81,14 L81,60 Q81,78 48,93 Q15,78 15,60 L15,14 Z" fill="#250407" opacity=".7" transform="translate(3,3)"/>
      <path d="M48,3 L74,3 L84,13 L84,60 Q84,80 48,96 Q12,80 12,60 L12,13 Z" fill="url(#ld-A)"/>
      <path d="M74,3 L84,3 L84,13 Z" fill="rgba(255,220,220,.28)"/>
      <path d="M48,3 L26,3 L12,13 L12,38 L48,6 Z" fill="url(#ld-B)"/>
      <g clipPath="url(#ld-SC)" opacity=".04" stroke="white" strokeWidth=".8" fill="none">
        <path d="M48,3 L58,10 L58,24 L48,31 L38,24 L38,10 Z"/><path d="M58,24 L68,31 L68,45 L58,52 L48,45 L48,31 Z"/><path d="M38,24 L48,31 L48,45 L38,52 L28,45 L28,31 Z"/><path d="M68,45 L78,52 L78,66 L68,73 L58,66 L58,52 Z"/><path d="M48,45 L58,52 L58,66 L48,73 L38,66 L38,52 Z"/><path d="M28,45 L38,52 L38,66 L28,73 L18,66 L18,52 Z"/><path d="M58,66 L68,73 L68,87 L58,94 L48,87 L48,73 Z"/><path d="M38,66 L48,73 L48,87 L38,94 L28,87 L28,73 Z"/>
      </g>
      <path d="M48,7 L71,7 L80,16 L80,59 Q80,77 48,91 Q16,77 16,59 L16,16 Z" fill="none" stroke="rgba(255,255,255,.10)" strokeWidth=".8"/>
      <path d="M48,3 L74,3 L84,13 L84,60 Q84,80 48,96 Q12,80 12,60 L12,13 Z" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth=".9"/>
      <line x1="4" y1="4" x2="16" y2="4" stroke="#D4A017" strokeWidth="1.5" strokeLinecap="round" opacity=".7"/><line x1="4" y1="4" x2="4" y2="16" stroke="#D4A017" strokeWidth="1.5" strokeLinecap="round" opacity=".7"/>
      <line x1="92" y1="4" x2="80" y2="4" stroke="#D4A017" strokeWidth="1.5" strokeLinecap="round" opacity=".7"/><line x1="92" y1="4" x2="92" y2="16" stroke="#D4A017" strokeWidth="1.5" strokeLinecap="round" opacity=".7"/>
      <line x1="4" y1="95" x2="16" y2="95" stroke="#D4A017" strokeWidth="1.5" strokeLinecap="round" opacity=".45"/><line x1="4" y1="95" x2="4" y2="83" stroke="#D4A017" strokeWidth="1.5" strokeLinecap="round" opacity=".45"/>
      <line x1="92" y1="95" x2="80" y2="95" stroke="#D4A017" strokeWidth="1.5" strokeLinecap="round" opacity=".45"/><line x1="92" y1="95" x2="92" y2="83" stroke="#D4A017" strokeWidth="1.5" strokeLinecap="round" opacity=".45"/>
      <circle cx="48" cy="52" r="24" fill="none" stroke="rgba(255,255,255,.13)" strokeWidth=".8" strokeDasharray="3 4"/>
      <circle cx="48" cy="52" r="21" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth=".9"/>
      <circle cx="48" cy="52" r="14" fill="none" stroke="rgba(255,255,255,.17)" strokeWidth=".85"/>
      <circle cx="48" cy="52" r="8" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth=".85"/>
      <circle cx="48" cy="52" r="3.8" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth=".8"/>
      <g stroke="white" strokeLinecap="round">
        <line x1="48" y1="31" x2="48" y2="35" strokeWidth="1.4" opacity=".75"/><line x1="48" y1="69" x2="48" y2="73" strokeWidth="1.4" opacity=".75"/>
        <line x1="27" y1="52" x2="31" y2="52" strokeWidth="1.4" opacity=".75"/><line x1="65" y1="52" x2="69" y2="52" strokeWidth="1.4" opacity=".75"/>
        <line x1="33.2" y1="37.2" x2="36" y2="40" strokeWidth=".9" opacity=".45"/><line x1="60" y1="64" x2="62.8" y2="66.8" strokeWidth=".9" opacity=".45"/>
        <line x1="62.8" y1="37.2" x2="60" y2="40" strokeWidth=".9" opacity=".45"/><line x1="36" y1="64" x2="33.2" y2="66.8" strokeWidth=".9" opacity=".45"/>
      </g>
      <line x1="48" y1="31" x2="48" y2="40" stroke="rgba(255,255,255,.55)" strokeWidth="1.1" strokeLinecap="round"/>
      <line x1="48" y1="64" x2="48" y2="73" stroke="rgba(255,255,255,.55)" strokeWidth="1.1" strokeLinecap="round"/>
      <line x1="27" y1="52" x2="36" y2="52" stroke="rgba(255,255,255,.55)" strokeWidth="1.1" strokeLinecap="round"/>
      <line x1="60" y1="52" x2="69" y2="52" stroke="rgba(255,255,255,.55)" strokeWidth="1.1" strokeLinecap="round"/>
      <path d="M48,31 A21,21 0 0,1 69,52" fill="none" stroke="url(#ld-E)" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M48,31 A21,21 0 0,0 27,52" fill="none" stroke="white" strokeWidth=".7" strokeLinecap="round" opacity=".14" strokeDasharray="1.5 4"/>
      <line x1="48" y1="52" x2="62.8" y2="37.2" stroke="rgba(255,255,255,.38)" strokeWidth=".9" strokeLinecap="round"/>
      <text x="65" y="35" fontFamily="'Courier New',monospace" fontSize="7" fill="rgba(255,255,255,.45)" letterSpacing="0">045°</text>
      <text x="51" y="44" fontFamily="'Courier New',monospace" fontSize="6" fill="rgba(255,255,255,.3)">R:14</text>
      <circle cx="48" cy="52" r="4.5" fill="rgba(200,35,42,.25)" stroke="rgba(200,35,42,.5)" strokeWidth=".8"/>
      <circle cx="48" cy="52" r="3" fill="white" opacity=".95"/><circle cx="48" cy="52" r="1.8" fill="#C8232A"/><circle cx="48" cy="52" r=".7" fill="white"/>
      <path d="M72,3 L84,3 L84,15" fill="none" stroke="#D4A017" strokeWidth="2.4" strokeLinecap="square"/>
      <line x1="20" y1="94" x2="76" y2="94" stroke="url(#ld-D)" strokeWidth="1.1"/>
      <circle cx="12" cy="42" r="2" fill="#D4A017" opacity=".55"/><circle cx="84" cy="42" r="2" fill="#D4A017" opacity=".55"/>
      <line x1="4" y1="42" x2="12" y2="42" stroke="#D4A017" strokeWidth=".9" opacity=".35"/>
      <line x1="84" y1="42" x2="92" y2="42" stroke="#D4A017" strokeWidth=".9" opacity=".35"/>
      <line x1="106" y1="10" x2="106" y2="96" stroke="url(#ld-C)" strokeWidth="1.6"/>
      <line x1="116" y1="14" x2="265" y2="14" stroke="rgba(255,255,255,.06)" strokeWidth=".8"/>
      <text x="116" y="46" fontFamily="'Montserrat','Arial Black',sans-serif" fontSize="32" fontWeight="900" fill="#FFFFFF" letterSpacing="7">CLAVE</text>
      <text x="116" y="80" fontFamily="'Montserrat','Arial Black',sans-serif" fontSize="32" fontWeight="900" fill="#C8232A" letterSpacing="2">SEGURIDAD</text>
      <line x1="372" y1="60" x2="430" y2="60" stroke="url(#ld-F)" strokeWidth="2" opacity=".5"/>
      <line x1="116" y1="86" x2="420" y2="86" stroke="rgba(255,255,255,.055)" strokeWidth=".8"/>
      <text x="117" y="97" fontFamily="'Courier New',monospace" fontSize="7.5" fill="#D4A017" letterSpacing="3" opacity=".65">CTA // COOPERATIVA DE VIGILANCIA // MEDELLÍN, CO</text>
      <rect x="396" y="18" width="38" height="38" rx="4" fill="none" stroke="rgba(212,160,23,.18)" strokeWidth=".8"/>
      <text x="415" y="32" fontFamily="'Courier New',monospace" fontSize="6" fill="rgba(212,160,23,.5)" textAnchor="middle" letterSpacing=".5">SYS</text>
      <text x="415" y="42" fontFamily="'Courier New',monospace" fontSize="7.5" fill="#D4A017" textAnchor="middle" fontWeight="700" opacity=".75">ON</text>
      <circle cx="415" cy="51" r="2" fill="#D4A017" opacity=".6"/><circle cx="415" cy="51" r="3.5" fill="none" stroke="#D4A017" strokeWidth=".7" opacity=".35"/>
    </svg>
  );
}

function LightVariant({ width, height }: { width: string | number; height: string | number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 440 108" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Clave Seguridad CTA">
      <defs>
        <linearGradient id="ll-A" x1="0" y1="0" x2="0.2" y2="1"><stop offset="0%" stopColor="#D91E25"/><stop offset="40%" stopColor="#A8141A"/><stop offset="78%" stopColor="#7A0D11"/><stop offset="100%" stopColor="#4A0709"/></linearGradient>
        <linearGradient id="ll-C" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C8232A" stopOpacity="0"/><stop offset="20%" stopColor="#C8232A" stopOpacity=".9"/><stop offset="50%" stopColor="#C8232A"/><stop offset="80%" stopColor="#C8232A" stopOpacity=".9"/><stop offset="100%" stopColor="#C8232A" stopOpacity="0"/></linearGradient>
      </defs>
      <path d="M48,5 L72,5 L81,14 L81,60 Q81,78 48,93 Q15,78 15,60 L15,14 Z" fill="#ccc" opacity=".2" transform="translate(3,3)"/>
      <path d="M48,3 L74,3 L84,13 L84,60 Q84,80 48,96 Q12,80 12,60 L12,13 Z" fill="url(#ll-A)"/>
      <circle cx="48" cy="52" r="21" fill="none" stroke="rgba(0,0,0,.12)" strokeWidth=".9"/>
      <circle cx="48" cy="52" r="3" fill="white" opacity=".95"/><circle cx="48" cy="52" r="1.8" fill="#C8232A"/>
      <path d="M72,3 L84,3 L84,15" fill="none" stroke="#D4A017" strokeWidth="2.4" strokeLinecap="square"/>
      <line x1="106" y1="10" x2="106" y2="96" stroke="url(#ll-C)" strokeWidth="1.6"/>
      <text x="116" y="46" fontFamily="'Montserrat','Arial Black',sans-serif" fontSize="32" fontWeight="900" fill="#0D1B2A" letterSpacing="7">CLAVE</text>
      <text x="116" y="80" fontFamily="'Montserrat','Arial Black',sans-serif" fontSize="32" fontWeight="900" fill="#C8232A" letterSpacing="2">SEGURIDAD</text>
      <text x="117" y="97" fontFamily="'Courier New',monospace" fontSize="7.5" fill="#9A7A10" letterSpacing="3" opacity=".65">CTA // COOPERATIVA DE VIGILANCIA // MEDELLÍN, CO</text>
    </svg>
  );
}
