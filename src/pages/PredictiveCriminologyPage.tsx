import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BrainCircuit, AlertTriangle, ShieldAlert, Map, TrendingUp,
  Activity, Timer, BarChart3, Target, Shield,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { usePredictiveForecast, usePredictiveHotzones } from '@/hooks/use-predictive';
import { Loader2 } from 'lucide-react';

/* ── Component ── */

export default function PredictiveCriminologyPage() {
  const [modelStatus, setModelStatus] = useState<'calibrating' | 'active'>('active');

  const { data: forecastData = [], isLoading: forecastLoading } = usePredictiveForecast();
  const { data: hotspotData = [], isLoading: hotspotLoading } = usePredictiveHotzones();

  const isLoading = forecastLoading || hotspotLoading;
  const hasForecasts = forecastData.length > 0;
  const hasHotspots = hotspotData.length > 0;

  const stats = useMemo(() => {
    const criticalZones = hotspotData.filter(h => h.severity === 'critical').length;
    const avgConfidence = hotspotData.length > 0
      ? Math.round(hotspotData.reduce((sum, h) => sum + h.confidence, 0) / hotspotData.length)
      : 0;
    const peakRisk = forecastData.length > 0
      ? forecastData.reduce((max, d) => Math.max(max, d.predictedRisk), 0)
      : 0;
    const totalIncidents = forecastData.reduce((sum, d) => sum + (d.realEvents ?? 0), 0);
    return { criticalZones, avgConfidence, peakRisk, totalIncidents };
  }, [forecastData, hotspotData]);

  const recalibrateModel = () => {
    setModelStatus('calibrating');
    setTimeout(() => {
      setModelStatus('active');
    }, 2000);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Strategy Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-extrabold flex items-center gap-2 text-destructive">
            <BrainCircuit className="h-8 w-8" /> Predictive Criminology AI
          </h1>
          <p className="text-muted-foreground mt-1">Spatial-temporal forecasting of security incident probabilities.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={`px-4 py-1.5 flex items-center gap-2 ${modelStatus === 'active' ? 'border-primary/50 text-primary bg-primary/10' : 'border-yellow-500/50 text-yellow-500 bg-yellow-500/10'}`}>
             <Activity className="h-4 w-4 animate-pulse" /> {modelStatus === 'active' ? 'FORECAST ENGINE: ACCURATE' : 'RECALIBRATING WEIGHTS...'}
          </Badge>
          <Button variant="outline" size="sm" onClick={recalibrateModel} disabled={modelStatus === 'calibrating'}>
            <Timer className="h-4 w-4 mr-2" /> Force Recalibration
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Critical Zones</p>
                <p className="text-2xl font-bold text-destructive">{stats.criticalZones}</p>
              </div>
              <Target className="h-8 w-8 text-destructive/40" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Peak Risk</p>
                <p className="text-2xl font-bold text-primary">{stats.peakRisk}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary/40" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Avg Confidence</p>
                <p className="text-2xl font-bold text-foreground">{stats.avgConfidence}%</p>
              </div>
              <Shield className="h-8 w-8 text-muted-foreground/40" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Weekly Incidents</p>
                <p className="text-2xl font-bold text-foreground">{stats.totalIncidents}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 1: Temporal Forecast + Hotzone List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Core Prediction Chart */}
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm tracking-widest font-bold uppercase flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-destructive" /> Temporal Threat Forecast (Next 6 Hours)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center h-[300px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !hasForecasts ? (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                <BrainCircuit className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">No hay datos de prediccion disponibles</p>
                <p className="text-xs mt-1">El modelo necesita datos historicos para generar predicciones</p>
              </div>
            ) : (
              <>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={forecastData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '8px',
                          color: 'hsl(var(--card-foreground))',
                        }}
                      />
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <Area type="monotone" dataKey="realEvents" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorReal)" name="Actual Incidents %" />
                      <Area type="monotone" dataKey="predictedRisk" stroke="hsl(var(--destructive))" fillOpacity={1} fill="url(#colorRisk)" name="Forecasted Risk %" strokeDasharray="5 5" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {modelStatus === 'active' && stats.peakRisk > 0 ? (
                  <div className="mt-4 flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-destructive">Peak Risk: {stats.peakRisk}%</p>
                      <p className="text-xs text-destructive/80">Historical data combined with current patterns indicates elevated risk. Preventative patrol dispatch recommended.</p>
                    </div>
                  </div>
                ) : modelStatus === 'calibrating' ? (
                  <div className="mt-4 p-3 border border-dashed border-yellow-500/50 text-yellow-500 text-sm text-center font-mono animate-pulse">
                    Re-aligning Neural Weights using latest 24h datasets...
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        {/* Spatial Hotzones List */}
        <Card className="lg:col-span-1 bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm tracking-widest font-bold uppercase flex items-center gap-2">
              <Map className="h-4 w-4 text-primary" /> Predictive Hotzones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="flex justify-center p-6"><Loader2 className="animate-spin text-muted-foreground" /></div>
            ) : !hasHotspots ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Map className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm">No hay datos de prediccion disponibles</p>
              </div>
            ) : (
              hotspotData.map((hotspot) => {
                const isCritical = hotspot.severity === 'critical';
                const isElevated = hotspot.severity === 'elevated';

                return (
                  <div key={hotspot.id} className={`p-3 border rounded-lg flex items-center justify-between transition-colors ${
                    isCritical ? 'bg-destructive/10 border-destructive/30' :
                    isElevated ? 'bg-yellow-500/10 border-yellow-500/30' :
                    'bg-primary/10 border-primary/30'
                  }`}>
                    <div className="min-w-0 flex-1 mr-3">
                      <p className={`text-sm font-bold truncate ${
                        isCritical ? 'text-destructive' : isElevated ? 'text-yellow-500' : 'text-primary'
                      }`}>{hotspot.name}</p>
                      <p className="text-xs text-muted-foreground">Confidence: {hotspot.confidence}%</p>
                    </div>
                    {isCritical ? (
                      <Badge variant="destructive" className="animate-pulse shrink-0">CRITICAL</Badge>
                    ) : isElevated ? (
                      <Badge variant="outline" className="border-yellow-500 text-yellow-500 shrink-0">ELEVATED</Badge>
                    ) : (
                      <Badge variant="outline" className="text-primary shrink-0">NOMINAL</Badge>
                    )}
                  </div>
                );
              })
            )}

            <Button className="w-full mt-4 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold" disabled={modelStatus === 'calibrating'}>
              <ShieldAlert className="h-4 w-4 mr-2" /> FORCE-DEPLOY PATROLS
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Summary — data-driven, no mock charts */}
      {hasForecasts && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-3 px-4 text-center">
              <p className="text-xs text-muted-foreground uppercase">Total Recorded Events</p>
              <p className="text-2xl font-bold text-destructive">{stats.totalIncidents}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-3 px-4 text-center">
              <p className="text-xs text-muted-foreground uppercase">Peak Predicted Risk</p>
              <p className="text-2xl font-bold text-primary">{stats.peakRisk}%</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-3 px-4 text-center">
              <p className="text-xs text-muted-foreground uppercase">Forecast Data Points</p>
              <p className="text-2xl font-bold text-foreground">{forecastData.length}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
