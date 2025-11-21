import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, Download, Copy, Image as ImageIcon, CheckCircle, X, Loader2, RotateCcw, Maximize2, ChevronLeft, ChevronRight } from 'lucide-react';
import JSZip from 'jszip';
import { MAX_FILES, DEFAULT_PARAMS } from './constants';
import { ProcessedImage, ProcessingStatus } from './types';
import { processImage } from './services/imageProcessingService';

const App: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<ProcessedImage[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>({
    isProcessing: false,
    currentStep: 'Waiting for input',
    progress: 0,
    totalImages: 0,
    completedImages: 0
  });
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []) as File[];
    const validFiles = selectedFiles.filter(f => 
      ['image/jpeg', 'image/png', 'image/jpg'].includes(f.type)
    );

    if (validFiles.length + files.length > MAX_FILES) {
      alert(`Maximum ${MAX_FILES} images allowed.`);
      return;
    }

    setFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const processImages = async () => {
    if (files.length === 0) return;

    setStatus({
      isProcessing: true,
      currentStep: 'Initializing...',
      progress: 0,
      totalImages: files.length,
      completedImages: 0
    });

    const newResults: ProcessedImage[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setStatus(prev => ({
        ...prev,
        currentStep: `Processing ${file.name}...`,
        progress: (i / files.length) * 100
      }));

      try {
        // Small delay to allow UI to render status update
        await new Promise(r => setTimeout(r, 100));
        
        const result = await processImage(file, DEFAULT_PARAMS);
        newResults.push({
          id: Math.random().toString(36).substr(2, 9),
          fileName: file.name,
          ...result
        });

        setStatus(prev => ({
          ...prev,
          completedImages: prev.completedImages + 1,
          progress: ((i + 1) / files.length) * 100
        }));
      } catch (error) {
        console.error(`Error processing ${file.name}`, error);
      }
    }

    setStatus(prev => ({ ...prev, isProcessing: false, currentStep: 'Done!', progress: 100 }));
    setResults(newResults);
    setFiles([]); // Clear queue
  };

  const copyToClipboard = async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      alert("Image copied to clipboard!");
    } catch (err) {
      console.error(err);
      alert("Failed to copy image.");
    }
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `processed_${filename.replace(/\.[^/.]+$/, "")}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAllZip = async () => {
    if (results.length === 0) return;
    
    const zip = new JSZip();
    
    // Add images
    await Promise.all(results.map(async (res) => {
      const response = await fetch(res.processedUrl);
      const blob = await response.blob();
      const filename = `processed_${res.fileName.replace(/\.[^/.]+$/, "")}.png`;
      zip.file(filename, blob);
    }));

    // Generate zip
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    
    // Download
    const link = document.createElement('a');
    link.href = url;
    link.download = "shadowcast_batch.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Lightbox Logic
  // Total slides = results.length * 2 (Original, Result, Original, Result...)
  // Even Index = Original
  // Odd Index = Result
  const closeLightbox = () => setLightboxIndex(null);

  const nextImage = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setLightboxIndex(prev => {
      if (prev === null) return null;
      const totalSlides = results.length * 2;
      return (prev + 1) % totalSlides;
    });
  }, [results.length]);

  const prevImage = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setLightboxIndex(prev => {
      if (prev === null) return null;
      const totalSlides = results.length * 2;
      return (prev - 1 + totalSlides) % totalSlides;
    });
  }, [results.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextImage();
      if (e.key === 'ArrowLeft') prevImage();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, nextImage, prevImage]);

  // Helper to get current slide data
  const getCurrentSlide = () => {
    if (lightboxIndex === null) return null;
    const imageIndex = Math.floor(lightboxIndex / 2);
    const isOriginal = lightboxIndex % 2 === 0;
    const data = results[imageIndex];
    
    return {
      data,
      url: isOriginal ? data.originalUrl : data.processedUrl,
      type: isOriginal ? 'Original' : 'Result',
      indexStr: `${imageIndex + 1} / ${results.length}`
    };
  };

  const slide = getCurrentSlide();

  return (
    <div className="min-h-screen bg-zinc-950 text-gray-200 font-sans selection:bg-teal-500/30">
      
      {/* Header */}
      <header className="bg-zinc-900/50 border-b border-zinc-800 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-teal-500 to-teal-300 rounded-lg flex items-center justify-center shadow-lg shadow-teal-900/20">
              <ImageIcon className="w-5 h-5 text-zinc-900" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Shadow<span className="text-teal-400">Cast</span></h1>
          </div>
          <div className="text-xs text-zinc-500">v1.0.0 &bull; Client-side Processing</div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        
        {/* Intro */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <h2 className="text-4xl font-bold text-white">Transparent PNGs. <span className="text-teal-400">Preserved Shadows.</span></h2>
          <p className="text-zinc-400 text-lg">
            Upload your studio shots. We'll remove the background, preserve natural shadows, and clean up edges using advanced matrix operations right in your browser.
          </p>
        </div>

        {/* Upload Section (Hidden when results exist, or minimal) */}
        {!status.isProcessing && results.length === 0 && (
          <div className="max-w-2xl mx-auto">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="group relative border-2 border-dashed border-zinc-700 hover:border-teal-500 hover:bg-zinc-900/50 rounded-2xl p-12 transition-all cursor-pointer text-center"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                multiple 
                accept=".jpg,.jpeg,.png" 
                onChange={handleFileChange}
              />
              
              <div className="w-16 h-16 bg-zinc-800 group-hover:bg-teal-900/30 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors">
                <Upload className="w-8 h-8 text-zinc-400 group-hover:text-teal-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Drop images here or click to upload</h3>
              <p className="text-zinc-500 text-sm">Supports JPG, PNG (Max 10 files)</p>

              {/* File List Preview inside Dropzone */}
              {files.length > 0 && (
                <div className="mt-8 grid grid-cols-5 gap-2">
                  {files.map((f, i) => (
                    <div key={i} className="relative aspect-square bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700 group/file">
                      <img src={URL.createObjectURL(f)} alt="prev" className="w-full h-full object-cover opacity-70" />
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                        className="absolute top-1 right-1 bg-black/50 hover:bg-red-500/80 p-1 rounded-full text-white opacity-0 group-hover/file:opacity-100 transition-all"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {files.length > 0 && (
              <div className="mt-6 flex justify-center">
                <button 
                  onClick={processImages}
                  className="bg-teal-500 hover:bg-teal-400 text-zinc-900 font-bold py-3 px-8 rounded-full shadow-lg shadow-teal-900/20 transition-all hover:scale-105 active:scale-95"
                >
                  Process {files.length} Images
                </button>
              </div>
            )}
          </div>
        )}

        {/* Progress Section */}
        {status.isProcessing && (
          <div className="max-w-2xl mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
             <div className="flex justify-between items-end mb-4">
                <div>
                  <h3 className="text-lg font-medium text-white animate-pulse">Processing...</h3>
                  <p className="text-zinc-400 text-sm font-mono mt-1">{status.currentStep}</p>
                </div>
                <span className="text-teal-400 font-mono text-xl">{Math.round(status.progress)}%</span>
             </div>
             <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
               <div 
                  className="h-full bg-teal-500 transition-all duration-300 ease-out"
                  style={{ width: `${status.progress}%` }}
               />
             </div>
             <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500 uppercase tracking-wider justify-center">
                <Loader2 className="w-3 h-3 animate-spin" />
                Applying Alpha Matting & Shaving Logic
             </div>
          </div>
        )}

        {/* Results Gallery */}
        {results.length > 0 && (
          <div className="space-y-8 animate-in fade-in duration-700 slide-in-from-bottom-8">
            <div className="flex items-center justify-between">
               <h3 className="text-2xl font-bold text-white">Results</h3>
               <div className="flex items-center gap-3">
                  <button 
                    onClick={downloadAllZip}
                    className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-5 py-2.5 rounded-full font-medium border border-zinc-700 transition-all hover:border-zinc-600 text-sm"
                  >
                    <Download className="w-4 h-4" /> Download All PNG
                  </button>
                  <button 
                    onClick={() => window.location.reload()} 
                    className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-zinc-900 px-5 py-2.5 rounded-full font-bold shadow-lg shadow-teal-900/20 transition-all hover:scale-105 active:scale-95 text-sm"
                  >
                    <RotateCcw className="w-4 h-4" /> Start Over
                  </button>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {results.map((res, idx) => (
                <div key={res.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg flex flex-col">
                  
                  {/* Header */}
                  <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-850">
                    <span className="text-sm font-medium text-zinc-300 truncate max-w-[200px]">{res.fileName}</span>
                    <span className="text-xs text-zinc-500 font-mono">{res.width}x{res.height}</span>
                  </div>

                  {/* Split View */}
                  <div className="grid grid-cols-2 h-64 sm:h-80 relative divide-x divide-zinc-800">
                    {/* Original - Click to open Lightbox (Original View) */}
                    <div 
                      onClick={() => setLightboxIndex(idx * 2)} // Even index = Original
                      className="relative group overflow-hidden bg-[url('https://bg.siteorigin.com/blog/wp-content/uploads/2015/06/p6.png')] cursor-zoom-in"
                    >
                      <div className="absolute inset-0 bg-zinc-900/80"></div> {/* Dim checkerboard */}
                      <img src={res.originalUrl} alt="Original" className="absolute inset-0 w-full h-full object-contain p-4" />
                      <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded uppercase tracking-wide">Original</div>
                    </div>

                    {/* Processed - Click to open Lightbox (Result View) */}
                    <div 
                      onClick={() => setLightboxIndex(idx * 2 + 1)} // Odd index = Result
                      className="relative group overflow-hidden bg-[url('https://bg.siteorigin.com/blog/wp-content/uploads/2015/06/p6.png')] cursor-zoom-in"
                    >
                       {/* Teal accent background for transparency visualization */}
                      <div className="absolute inset-0 bg-teal-500/50"></div>
                      <img src={res.processedUrl} alt="Processed" className="absolute inset-0 w-full h-full object-contain p-4" />
                      <div className="absolute top-2 right-2 bg-teal-900/80 text-teal-100 text-[10px] px-2 py-0.5 rounded uppercase tracking-wide border border-teal-700">Result</div>
                      
                      {/* Hover Actions */}
                      <div className="absolute inset-0 bg-zinc-900/90 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
                         <div className="flex gap-2">
                            <button 
                              onClick={(e) => { e.stopPropagation(); downloadImage(res.processedUrl, res.fileName); }}
                              className="flex items-center gap-2 bg-white text-zinc-900 px-4 py-2 rounded-full font-bold hover:bg-teal-400 transition-colors text-sm"
                            >
                              <Download className="w-4 h-4" /> Save
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setLightboxIndex(idx * 2 + 1); }}
                              className="flex items-center gap-2 bg-zinc-800 text-white px-3 py-2 rounded-full font-medium hover:bg-zinc-700 transition-colors text-sm border border-zinc-700"
                            >
                              <Maximize2 className="w-4 h-4" />
                            </button>
                         </div>
                         <button 
                           onClick={(e) => { e.stopPropagation(); copyToClipboard(res.processedUrl); }}
                           className="text-zinc-400 text-xs hover:text-white flex items-center gap-1"
                         >
                           <Copy className="w-3 h-3" /> Copy to Clipboard
                         </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lightbox Modal */}
        {slide && (
          <div 
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center animate-in fade-in duration-200"
            onClick={closeLightbox}
          >
            {/* Top Controls */}
            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-10">
              <div className="text-white">
                 <div className="flex items-baseline gap-3">
                    <h3 className="text-lg font-bold">{slide.data.fileName}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded uppercase tracking-wide ${slide.type === 'Original' ? 'bg-zinc-800 text-zinc-400' : 'bg-teal-900 text-teal-400'}`}>
                      {slide.type}
                    </span>
                 </div>
                 <p className="text-zinc-400 text-sm">{slide.data.width} x {slide.data.height} px</p>
              </div>
              <button 
                onClick={closeLightbox}
                className="p-2 bg-zinc-900/50 rounded-full hover:bg-zinc-800 text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Main Image Area */}
            <div 
              className="w-full h-full p-4 md:p-12 flex items-center justify-center"
              onClick={(e) => e.stopPropagation()} // Prevent click on image closing modal
            >
               <div className="relative max-w-full max-h-full flex flex-col items-center">
                 {/* Dynamic Background for the image container */}
                 {/* Result: Teal background. Original: Neutral dark. */}
                 <div className={`relative rounded-lg overflow-hidden shadow-2xl ${slide.type === 'Result' ? 'bg-teal-600' : 'bg-zinc-900'}`}>
                   {/* Add checkerboard only if transparent result (though now solid teal per request) or original if needed */}
                    {slide.type === 'Result' && (
                       <div className="absolute inset-0 bg-[url('https://bg.siteorigin.com/blog/wp-content/uploads/2015/06/p6.png')] opacity-10 mix-blend-overlay"></div>
                    )}
                   
                   <img 
                      src={slide.url} 
                      alt={slide.type} 
                      className="relative max-w-full max-h-[80vh] object-contain"
                   />
                 </div>
               </div>
            </div>

            {/* Navigation Arrows */}
            <button 
              onClick={prevImage}
              className="absolute left-4 p-3 rounded-full bg-zinc-900/50 hover:bg-teal-500 text-white hover:text-zinc-900 transition-all z-20 backdrop-blur-md border border-zinc-700 hover:border-teal-400"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
            <button 
              onClick={nextImage}
              className="absolute right-4 p-3 rounded-full bg-zinc-900/50 hover:bg-teal-500 text-white hover:text-zinc-900 transition-all z-20 backdrop-blur-md border border-zinc-700 hover:border-teal-400"
            >
              <ChevronRight className="w-8 h-8" />
            </button>

            {/* Footer Actions */}
            {slide.type === 'Result' && (
              <div className="absolute bottom-8 flex gap-4 z-10" onClick={(e) => e.stopPropagation()}>
                <button 
                  onClick={() => downloadImage(slide.data.processedUrl, slide.data.fileName)}
                  className="flex items-center gap-2 bg-white text-zinc-900 px-6 py-3 rounded-full font-bold hover:bg-teal-400 transition-colors shadow-xl"
                >
                  <Download className="w-5 h-5" /> Download
                </button>
              </div>
            )}

            {/* Counter */}
            <div className="absolute bottom-8 right-8 text-zinc-500 font-mono text-sm">
               Image {slide.indexStr}
            </div>
          </div>
        )}

        {/* Buy Me A Coffee Badge */}
        <div className="flex justify-center mt-12 pb-8">
          <a
            href="https://buymeacoffee.com/ashoksivalingam"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900/50 border border-zinc-800/50 hover:border-yellow-500/30 hover:bg-zinc-900 transition-all duration-300"
          >
            <img 
              src="https://cdn.buymeacoffee.com/buttons/bmc-new-btn-logo.svg"
              alt="BMC" 
              className="w-6 h-6 rounded-full bg-[#FFDD00] p-1 shadow-sm group-hover:shadow-yellow-500/20"
            />
            <span className="text-xs font-medium text-zinc-500 group-hover:text-zinc-300 transition-colors">
              Buy me a coffee
            </span>
          </a>
        </div>

      </main>
    </div>
  );
};

export default App;