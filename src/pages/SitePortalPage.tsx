import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Shield, Camera, Send, CheckCircle, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/contexts/I18nContext';

export default function SitePortalPage() {
  const { siteCode } = useParams<{ siteCode: string }>();
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [desc, setDesc] = useState('');
  const [sent, setSent] = useState(false);
  const { t } = useI18n();
  const siteName = (siteCode || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !desc) return toast.error(t('portal.fill_all_fields'));
    try {
      await fetch('/api/operational-data/consignas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `Reporte: ${name} - U${unit}`, description: desc, type: 'resident_report' }),
      });
      setSent(true);
    } catch { toast.error(t('portal.send_error')); }
  };

  return (
    <div className="min-h-screen bg-[#0D1B2A] text-white">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <Shield className="h-12 w-12 text-[#D4A017] mx-auto mb-3" />
          <h1 className="text-2xl font-bold">{t('portal.title')}</h1>
          <p className="text-[#D4A017] font-medium mt-1">{siteName}</p>
        </div>
        <div className="bg-[#030810] rounded-xl p-4 mb-6 border border-green-500/30">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            <span className="font-semibold text-green-400">{t('portal.system_operational')}</span>
          </div>
          <div className="flex items-center gap-2 mt-3 text-sm text-gray-400">
            <Camera className="h-4 w-4" />
            <span>{t('portal.cameras_monitoring')}</span>
          </div>
        </div>
        {sent ? (
          <div className="bg-[#030810] rounded-xl p-6 text-center border border-green-500/30">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold">{t('portal.report_sent')}</h2>
            <p className="text-sm text-gray-400 mt-2">{t('portal.report_sent_desc')}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-[#030810] rounded-xl p-4 space-y-4 border border-white/10">
            <h2 className="font-semibold text-[#D4A017]">{t('portal.report_title')}</h2>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={t('portal.name_placeholder')} aria-label={t('portal.name_placeholder')} className="w-full bg-[#0D1B2A] border border-white/20 rounded-lg px-3 py-2.5 text-sm placeholder:text-gray-500 focus:border-[#D4A017] focus:outline-none" />
            <input value={unit} onChange={e => setUnit(e.target.value)} placeholder={t('portal.unit_placeholder')} aria-label={t('portal.unit_placeholder')} className="w-full bg-[#0D1B2A] border border-white/20 rounded-lg px-3 py-2.5 text-sm placeholder:text-gray-500 focus:border-[#D4A017] focus:outline-none" />
            <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder={t('portal.description_placeholder')} aria-label={t('portal.description_placeholder')} rows={3} className="w-full bg-[#0D1B2A] border border-white/20 rounded-lg px-3 py-2.5 text-sm placeholder:text-gray-500 focus:border-[#D4A017] focus:outline-none resize-none" />
            <button type="submit" className="w-full bg-[#C8232A] hover:bg-[#A8141A] text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors">
              <Send className="h-4 w-4" /> {t('portal.submit')}
            </button>
          </form>
        )}
        <div className="mt-8 text-center text-sm text-gray-500">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Phone className="h-4 w-4" /> <span>{t('portal.central_247')}: (604) 444-5555</span>
          </div>
          <p>{t('portal.company')}</p>
        </div>
      </div>
    </div>
  );
}
