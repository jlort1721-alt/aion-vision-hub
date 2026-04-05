import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dna, Fingerprint, ScanFace, Database, Upload, Crosshair, Search, Loader2, Activity, Camera } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

const API_URL = import.meta.env.VITE_API_URL || '';

interface BioSearchResult {
  id: string;
  match: number;
  location: string;
  time: string;
  features: string[];
}

/** Convert an image URL (blob or data) to base64 string (without prefix) */
function imageUrlToBase64(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      // Strip "data:image/jpeg;base64," prefix
      resolve(dataUrl.split(',')[1]);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
}

interface FaceSearchResponse {
  success: boolean;
  data?: {
    faces_detected: number;
    face_info?: { confidence: number; embedding_size: number };
    matches: Array<{
      subjectId: string;
      matchPercentage: number;
      features: string[];
      lastSeenLocationId: string | null;
      lastSeenAt: string | null;
      metadata?: Record<string, unknown>;
    }>;
    message: string;
  };
  error?: string;
}

async function searchByFaceImage(imageBase64: string): Promise<{ results: BioSearchResult[]; facesDetected: number; message: string }> {
  if (!API_URL) return { results: [], facesDetected: 0, message: 'API URL not configured.' };
  const token = localStorage.getItem('aion_token');
  if (!token) return { results: [], facesDetected: 0, message: 'Not authenticated.' };

  // Try the real InsightFace-backed endpoint first
  const resp = await fetch(`${API_URL}/face-recognition/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ image: imageBase64 }),
  });

  if (!resp.ok) {
    // Fallback to legacy biomarkers/search with dummy embedding
    return { results: [], facesDetected: 0, message: `Face recognition service returned ${resp.status}.` };
  }

  const json: FaceSearchResponse = await resp.json();
  if (!json.success || !json.data) {
    return { results: [], facesDetected: 0, message: json.error || 'Unknown error.' };
  }

  const { faces_detected, matches, message } = json.data;
  const mapped = (matches || []).map((m) => ({
    id: m.subjectId,
    match: m.matchPercentage,
    location: m.lastSeenLocationId || 'Unknown',
    time: m.lastSeenAt ? new Date(m.lastSeenAt).toLocaleString('es-CO') : 'N/A',
    features: m.features || [],
  }));

  return { results: mapped, facesDetected: faces_detected, message };
}

export default function BiogeneticSearchPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [results, setResults] = useState<BioSearchResult[]>([]);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'upload' | 'live'>('upload');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setUploadedImage(url);
      setResults([]);
      toast.info('Biomarker Seed Loaded', { description: 'Ready for deep neural extraction.' });
    }
  };

  const executeBiogeneticSearch = async () => {
    if (!uploadedImage) {
      toast.error('Missing Input', { description: 'Please upload a reference frame or face image.' });
      return;
    }

    setIsScanning(true);
    setScanProgress(0);

    // Show progress while extracting embedding + querying backend
    const progressInterval = setInterval(() => {
      setScanProgress(p => Math.min(p + Math.floor(Math.random() * 12), 90));
    }, 300);

    try {
      const imageBase64 = await imageUrlToBase64(uploadedImage);
      setScanProgress(50);

      const { results: backendResults, facesDetected, message } = await searchByFaceImage(imageBase64);
      clearInterval(progressInterval);
      setScanProgress(100);

      if (facesDetected === 0) {
        setResults([]);
        toast.info('No Face Detected', { description: message || 'Could not detect a face in the uploaded image.' });
      } else if (backendResults.length > 0) {
        setResults(backendResults);
        toast.success('Search Complete', { description: `${backendResults.length} matches found (${facesDetected} face(s) detected).` });
      } else {
        setResults([]);
        toast.info('Search Complete', { description: message || 'Face detected but no matches in database.' });
      }
    } catch (err) {
      clearInterval(progressInterval);
      setScanProgress(100);
      setResults([]);
      toast.error('Search Error', { description: 'Could not complete biometric search. Check backend connectivity.' });
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Module Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-extrabold flex items-center gap-2 text-primary">
            <Dna className="h-8 w-8" /> Biogenetic Search AI
          </h1>
          <p className="text-muted-foreground mt-1">Cross-referencing phenotypic and geometric signatures across live datalake.</p>
        </div>
        <Badge variant="outline" className="px-4 py-1.5 border-primary/50 text-primary bg-primary/10 flex items-center gap-2">
           <Activity className="h-4 w-4 animate-pulse" /> Neural Engine: ONLINE
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Input Phase */}
        <Card className="lg:col-span-1 border-primary/20 shadow-[0_0_15px_rgba(0,180,216,0.05)] bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              <ScanFace className="h-4 w-4" /> 1. Input Vector
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            
            <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'upload' | 'live')}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                 <TabsTrigger value="upload" className="text-xs"><Upload className="w-3 h-3 mr-2"/> File Extract</TabsTrigger>
                 <TabsTrigger value="live" className="text-xs text-primary"><Camera className="w-3 h-3 mr-2"/> Live Scanner</TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="m-0 mt-2">
                <div className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-8 hover:border-primary hover:bg-primary/5 transition-all relative group overflow-hidden h-[200px] flex items-center justify-center">
                  <Input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleFileUpload} accept="image/*" />
                  
                  {uploadedImage ? (
                    <>
                      <img src={uploadedImage} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="Target" />
                      {isScanning && (
                        <div className="absolute inset-0 pointer-events-none">
                           <div className="w-full h-1 bg-primary shadow-[0_0_10px_#00ff88] animate-[ping_2s_linear_infinite]" />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
                      <Upload className="h-8 w-8" />
                      <span className="text-xs font-semibold">Drop face/subject snapshot here</span>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="live" className="m-0 mt-2">
                 <div className="border border-primary/40 rounded-xl overflow-hidden relative h-[200px] bg-black flex items-center justify-center shadow-[0_0_15px_rgba(0,255,136,0.1)]">
                   {/* Simulated Live Feed Wrapper */}
                   <div className="absolute inset-0 opacity-30 bg-[url('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop')] bg-cover bg-center mix-blend-luminosity"></div>
                   
                   {/* Facial Mesh Vector Grid */}
                   <div className="absolute z-10 w-[120px] h-[150px] border border-primary/50 rounded-[40%] flex items-center justify-center">
                      <div className="absolute w-full h-[1px] bg-primary/30 top-1/3"></div>
                      <div className="absolute w-full h-[1px] bg-primary/30 top-2/3"></div>
                      <div className="absolute h-full w-[1px] bg-primary/30 left-1/2"></div>
                      
                      {/* Active Nodes */}
                      <span className="absolute top-[35%] left-[30%] w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                      <span className="absolute top-[35%] right-[30%] w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                      <span className="absolute bottom-[25%] left-1/2 -translate-x-1/2 w-2 h-1 rounded-full bg-primary animate-pulse"></span>
                   </div>

                   {/* Scanning Laser */}
                   {isScanning && (
                      <div className="absolute top-0 w-full h-1 bg-red-500 shadow-[0_0_15px_#ff0000] z-20 animate-[pulse_1.5s_linear_infinite] opacity-80" style={{ animation: "scan-vertical 2s infinite linear" }} />
                   )}
                   
                   <Badge variant="outline" className="absolute bottom-2 left-2 text-[9px] bg-black/60 font-mono text-primary border-primary">CAM-INTEGRATED ACTIVE</Badge>
                   
                   <style>{`
                     @keyframes scan-vertical {
                       0% { top: 0%; transform: translateY(0); }
                       50% { top: 100%; transform: translateY(-100%); }
                       100% { top: 0%; transform: translateY(0); }
                     }
                   `}</style>
                 </div>
              </TabsContent>
            </Tabs>

            {(uploadedImage || inputMode === 'live') && (
              <Button onClick={executeBiogeneticSearch} disabled={isScanning} className="w-full bg-primary hover:bg-primary/80 font-bold tracking-widest mt-4">
                {isScanning ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> EXTRACTING BIOMARKERS</>
                ) : (
                  <><Search className="mr-2 h-4 w-4" /> INITIATE DEEP-SCAN</>
                )}
              </Button>
            )}

            {isScanning && (
              <div className="w-full bg-muted rounded-full h-2 mt-4 overflow-hidden">
                <div className="bg-primary h-2 transition-all duration-300" style={{ width: `${scanProgress}%` }} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results / Analysis Phase */}
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader>
             <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              <Database className="h-4 w-4" /> 2. Global Spatial Matches
            </CardTitle>
          </CardHeader>
          <CardContent>
            {results.length === 0 && !isScanning && (
               <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <Crosshair className="h-12 w-12 opacity-20 mb-2" />
                  <p>Awaiting biogenetic input data.</p>
               </div>
            )}
            
            {isScanning && results.length === 0 && (
               <div className="flex flex-col items-center justify-center h-64 space-y-4">
                 <div className="relative">
                   <Fingerprint className="h-16 w-16 text-primary animate-pulse opacity-50" />
                 </div>
                 <p className="font-mono text-xs text-primary blur-[0.5px]">Querying vectors across 45,000+ incident frames...</p>
               </div>
            )}

            {results.length > 0 && (
              <div className="space-y-3">
                {results.map((r, i) => (
                  <div key={i} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-lg border border-white/5 bg-background/50 hover:bg-accent/50 transition-colors">
                    
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded bg-black flex items-center justify-center border border-muted ring-1 ring-primary/20 flex-shrink-0">
                         <ScanFace className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold font-mono text-sm">{r.id}</p>
                          <Badge variant={r.match > 95 ? "default" : 'secondary'} className="text-[10px]">
                            {r.match}% Match
                          </Badge>
                        </div>
                        <p className="text-xs flex items-center gap-1 text-muted-foreground mt-1">
                           <Crosshair className="h-3 w-3" /> {r.location} • {r.time}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 sm:mt-0 flex flex-wrap gap-1 w-full sm:w-auto justify-end">
                      {(r.features || []).map((f: string, j: number) => (
                        <Badge key={j} variant="outline" className="text-[9px] bg-black/40 border-muted-foreground/30">{f}</Badge>
                      ))}
                    </div>

                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
