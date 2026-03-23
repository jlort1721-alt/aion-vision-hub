import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BrainCircuit, AlertTriangle, ShieldAlert, Crosshair, Map, TrendingUp, Activity, Timer } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { usePredictiveForecast, usePredictiveHotzones } from '@/hooks/use-predictive';
import { Loader2 } from 'lucide-react';

export default function PredictiveCriminologyPage() {
  const [modelStatus, setModelStatus] = useState<'calibrating' | 'active'>('active');

  const { data: forecastData = [], isLoading: forecastLoading } = usePredictiveForecast();
  const { data: hotspotData = [], isLoading: hotspotLoading } = usePredictiveHotzones();

  const isLoading = forecastLoading || hotspotLoading;

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
          <Button variant="outline" size="sm" onClick={recalibrateModel} disabled={modelStatus === 'calibrating'}><Timer className="h-4 w-4 mr-2"/> Force Recalibration</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Core Prediction Chart */}
        <Card className="lg:col-span-2 border-border shadow-[0_0_20px_rgba(255,0,0,0.05)]">
          <CardHeader>
             <CardTitle className="text-sm tracking-widest font-bold uppercase flex items-center gap-2">
               <TrendingUp className="h-4 w-4 text-destructive" /> Temporal Threat Forecast (Next 6 Hours)
             </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecastData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
                  <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a' }} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                  <Area type="monotone" dataKey="realEvents" stroke="#10b981" fillOpacity={1} fill="url(#colorReal)" name="Actual Incidents %" />
                  <Area type="monotone" dataKey="predictedRisk" stroke="#ef4444" fillOpacity={1} fill="url(#colorRisk)" name="Forecasted Risk %" strokeDasharray="5 5" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {modelStatus === 'active' ? (
               <div className="mt-4 flex items-start gap-2 p-3 bg-red-950/20 border border-red-500/20 rounded-lg">
                 <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                 <div>
                   <p className="text-sm font-bold text-red-500">Peak Risk Alert: 22:00 hrs</p>
                   <p className="text-xs text-red-400/80">Historical data combined with current weather patterns indicates a 65% probability of perimeter breaches aroundWarehouse Sector B. Preventative patrol dispatch recommended.</p>
                 </div>
               </div>
            ) : (
                <div className="mt-4 p-3 border border-dashed border-yellow-500/50 text-yellow-500 text-sm text-center font-mono animate-pulse">
                  Re-aligning Neural Weights using latest 24h datasets...
                </div>
            )}
          </CardContent>
        </Card>

        {/* Spatial Hotzones List */}
        <Card className="lg:col-span-1">
          <CardHeader>
             <CardTitle className="text-sm tracking-widest font-bold uppercase flex items-center gap-2">
               <Map className="h-4 w-4" /> Predictive Hotzones
             </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             {isLoading ? (
               <div className="flex justify-center p-6"><Loader2 className="animate-spin text-muted-foreground" /></div>
             ) : (
               hotspotData.map((hotspot) => {
                 const isCritical = hotspot.severity === 'critical';
                 const isElevated = hotspot.severity === 'elevated';
                 
                 return (
                   <div key={hotspot.id} className={`p-3 border rounded-lg flex items-center justify-between ${
                     isCritical ? 'bg-red-500/10 border-red-500/30' : 
                     isElevated ? 'bg-yellow-500/10 border-yellow-500/30' : 
                     'bg-primary/10 border-primary/30'
                   }`}>
                     <div>
                        <p className={`text-sm font-bold ${
                          isCritical ? 'text-red-500' : isElevated ? 'text-yellow-500' : 'text-primary'
                        }`}>{hotspot.name}</p>
                        <p className="text-xs text-muted-foreground">Confidence: {hotspot.confidence}%</p>
                     </div>
                     {isCritical ? (
                       <Badge variant="destructive" className="animate-pulse">CRITICAL</Badge>
                     ) : isElevated ? (
                       <Badge variant="outline" className="border-yellow-500 text-yellow-500">ELEVATED</Badge>
                     ) : (
                       <Badge variant="outline" className="text-primary">NOMINAL</Badge>
                     )}
                   </div>
                 );
               })
             )}
             
             <Button className="w-full mt-4 bg-red-600 hover:bg-red-700 font-bold" disabled={modelStatus === 'calibrating'}>
               <ShieldAlert className="h-4 w-4 mr-2" /> FORCE-DEPLOY PATROLS
             </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
